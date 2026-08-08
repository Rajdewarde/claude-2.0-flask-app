import os
import io
import re
import json
import math
from collections import Counter
from datetime import date
from flask import Flask, render_template, request, Response, jsonify, stream_with_context, session
from config import Config
from openai import OpenAI
from pypdf import PdfReader

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config.from_object(Config)
# Note: app.secret_key reads/writes app.config['SECRET_KEY'], which is already
# set by app.config.from_object(Config) above — no need to set it a second time.
app.config['MAX_CONTENT_LENGTH'] = 15 * 1024 * 1024  # 15MB upload ceiling

# Mock User Database (Production मध्ये SQLite/PostgreSQL वापरू शकता)
USERS_DB = {}

# Mock Document Store (Production मध्ये a real vector DB — pgvector/Pinecone/etc — वापरू शकता)
DOCUMENTS = {}

DEFAULT_MODEL = "anthropic/claude-3.5-haiku"

MODEL_LABELS = {
    "anthropic/claude-3.5-haiku": "Sarathi Prime",
    "anthropic/claude-3-haiku": "Sarathi Flash",
}

# --- Subscription tiers -------------------------------------------------
# Self-serve demo tiers: switching plans just updates the session, there is
# no real payment step. Wire a provider (Razorpay/Stripe) into switch_plan()
# below before charging anyone for real.
PLAN_ORDER = ["yatri", "sarathi", "maharathi"]

PLANS = {
    "yatri": {
        "label": "Yatri",
        "tagline": "Try the journey",
        "price": "Free",
        "daily_limit": 15,
        "models": ["anthropic/claude-3-haiku"],
        "features": ["15 messages / day", "Sarathi Flash model", "Local chat history"],
    },
    "sarathi": {
        "label": "Sarathi",
        "tagline": "For daily conversations",
        "price": "₹199/mo",
        "daily_limit": 150,
        "models": ["anthropic/claude-3-haiku", "anthropic/claude-3.5-haiku"],
        "features": ["150 messages / day", "Sarathi Prime + Flash", "Image uploads", "Priority streaming"],
    },
    "maharathi": {
        "label": "Maharathi",
        "tagline": "For power users",
        "price": "₹499/mo",
        "daily_limit": 1000,
        "models": ["anthropic/claude-3-haiku", "anthropic/claude-3.5-haiku"],
        "features": ["1000 messages / day", "Sarathi Prime + Flash", "Image uploads", "Early access to new features"],
    },
}


def get_session_plan():
    plan_id = session.get('plan', 'yatri')
    return plan_id if plan_id in PLANS else 'yatri'


def get_usage():
    """Returns (messages_used_today, today_iso). Resets automatically when the date rolls over."""
    today = date.today().isoformat()
    if session.get('usage_date') != today:
        session['usage_date'] = today
        session['usage_count'] = 0
    return session.get('usage_count', 0), today


def increment_usage():
    count, today = get_usage()
    session['usage_count'] = count + 1
    session['usage_date'] = today
    return session['usage_count']


# --- Document RAG (retrieval-augmented generation) --------------------
# Lightweight TF/cosine retrieval — no embeddings API, no extra paid calls.
# Good enough for a single attached document; swap for real embeddings +
# a vector DB if you outgrow this.
MAX_DOC_CHARS = 200_000  # keeps memory + retrieval latency sane on a small instance
CHUNK_WORDS = 180
CHUNK_OVERLAP = 30

STOPWORDS = set(
    "a an the is are was were be been being to of in on for with and or but if then "
    "so as at by from this that these those it its i you he she they we our your his "
    "her their not no do does did can could will would should may might have has had".split()
)


def tokenize(text):
    words = re.findall(r"[a-zA-Z']+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def chunk_text(text, chunk_size=CHUNK_WORDS, overlap=CHUNK_OVERLAP):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
        i += chunk_size - overlap
    return chunks


def tf_vector(tokens):
    return Counter(tokens)


def cosine_sim(vec_a, vec_b):
    common = set(vec_a) & set(vec_b)
    dot = sum(vec_a[t] * vec_b[t] for t in common)
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def retrieve_relevant_chunks(doc_id, query, top_k=3):
    doc = DOCUMENTS.get(doc_id)
    if not doc or not query:
        return []
    query_vec = tf_vector(tokenize(query))
    if not query_vec:
        return []
    scored = [
        (cosine_sim(query_vec, cv), chunk)
        for cv, chunk in zip(doc["chunk_vectors"], doc["chunks"])
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [chunk for score, chunk in scored[:top_k] if score > 0]


# OpenRouter Client Helper
def get_openrouter_client(api_key_override=None):
    api_key = api_key_override or app.config.get('OPENROUTER_API_KEY') or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

@app.route('/')
def index():
    return render_template('index.html', config=Config)

# Authentication APIs
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    if email in USERS_DB:
        return jsonify({"error": "Account already exists with this email."}), 400

    USERS_DB[email] = {"password": password, "plan": "yatri"}
    session['user'] = email
    session['plan'] = "yatri"
    return jsonify({"message": "Account created successfully!", "user": email}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Please enter email and password."}), 400

    record = USERS_DB.get(email)
    if not record or record["password"] != password:
        return jsonify({"error": "Invalid email or password. Please try again."}), 401

    session['user'] = email
    session['plan'] = record.get("plan", "yatri")
    return jsonify({"message": "Logged in successfully!", "user": email}), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully."})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user = session.get('user')
    if user:
        return jsonify({"authenticated": True, "user": user})
    return jsonify({"authenticated": False})

@app.route('/api/config', methods=['GET'])
def get_config():
    has_key = bool(app.config.get('OPENROUTER_API_KEY') or os.getenv("OPENROUTER_API_KEY"))
    active_doc_id = session.get('active_doc')
    active_doc = DOCUMENTS.get(active_doc_id) if active_doc_id else None
    return jsonify({
        "appName": app.config.get('APP_NAME', 'Sarathi AI'),
        "appSubtitle": app.config.get('APP_SUBTITLE', 'Your AI guide for every conversation'),
        "defaultModel": DEFAULT_MODEL,
        "defaultTemperature": app.config.get('DEFAULT_TEMPERATURE', 0.7),
        "hasApiKey": has_key,
        "activeDocument": {"filename": active_doc["filename"], "chunkCount": len(active_doc["chunks"])} if active_doc else None
    })

# --- Plans API ------------------------------------------------------------
@app.route('/api/plan', methods=['GET'])
def get_plan():
    plan_id = get_session_plan()
    used, _ = get_usage()
    plan_info = PLANS[plan_id]
    return jsonify({
        "plan": plan_id,
        "planLabel": plan_info["label"],
        "used": used,
        "limit": plan_info["daily_limit"],
        "models": plan_info["models"],
        "plans": PLANS,
        "planOrder": PLAN_ORDER,
    })

@app.route('/api/plan', methods=['POST'])
def switch_plan():
    # Demo self-serve switch — no payment is collected. If you add real
    # billing later, verify payment success here before setting the plan.
    data = request.get_json() or {}
    new_plan = data.get('plan')
    if new_plan not in PLANS:
        return jsonify({"error": "Unknown plan."}), 400

    session['plan'] = new_plan
    user = session.get('user')
    if user and user in USERS_DB:
        USERS_DB[user]['plan'] = new_plan

    return jsonify({"message": f"Switched to {PLANS[new_plan]['label']}.", "plan": new_plan})

# --- Documents API (RAG) ---------------------------------------------------
@app.route('/api/documents/upload', methods=['POST'])
def upload_document():
    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({"error": "No file uploaded."}), 400

    filename = file.filename
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    try:
        if ext == 'pdf':
            reader = PdfReader(io.BytesIO(file.read()))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        elif ext in ('txt', 'md'):
            text = file.read().decode('utf-8', errors='ignore')
        else:
            return jsonify({"error": "Only .pdf, .txt, or .md files are supported."}), 400
    except Exception as e:
        return jsonify({"error": f"Couldn't read that file: {e}"}), 400

    text = text.strip()
    if not text:
        return jsonify({"error": "No extractable text found in that file (scanned/image-only PDFs aren't supported yet)."}), 400
    text = text[:MAX_DOC_CHARS]

    chunks = chunk_text(text)
    chunk_vectors = [tf_vector(tokenize(c)) for c in chunks]

    # Drop any previous document for this session before storing the new one
    old_doc_id = session.get('active_doc')
    if old_doc_id:
        DOCUMENTS.pop(old_doc_id, None)

    doc_id = os.urandom(8).hex()
    DOCUMENTS[doc_id] = {"filename": filename, "chunks": chunks, "chunk_vectors": chunk_vectors}
    session['active_doc'] = doc_id

    return jsonify({"docId": doc_id, "filename": filename, "chunkCount": len(chunks)})


@app.route('/api/documents/clear', methods=['POST'])
def clear_document():
    doc_id = session.pop('active_doc', None)
    if doc_id:
        DOCUMENTS.pop(doc_id, None)
    return jsonify({"message": "Document cleared."})


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    system_instruction = data.get("systemInstruction", app.config.get('SYSTEM_PROMPT', ''))
    api_key_override = data.get("apiKeyOverride")
    images = data.get("images", [])  # Base64 Image Support
    bring_your_own_key = bool(api_key_override and api_key_override.strip())

    plan_id = get_session_plan()
    plan_info = PLANS[plan_id]
    used, _ = get_usage()

    model_name = data.get("model") or DEFAULT_MODEL

    # Plan limits only protect the shared server key — someone using their
    # own OpenRouter key isn't spending Sarathi's quota, so they skip both checks.
    if not bring_your_own_key:
        if used >= plan_info["daily_limit"]:
            return jsonify({
                "error": f"Daily limit reached for the {plan_info['label']} plan "
                         f"({plan_info['daily_limit']} messages/day). Upgrade for more.",
                "limitReached": True,
                "plan": plan_id
            }), 429

        if model_name not in plan_info["models"]:
            friendly = MODEL_LABELS.get(model_name, model_name)
            return jsonify({
                "error": f"{friendly} isn't available on the {plan_info['label']} plan. Upgrade to unlock it.",
                "upgradeRequired": True,
                "plan": plan_id
            }), 403

    client = get_openrouter_client(api_key_override)

    if not client:
        return jsonify({"error": "OpenRouter API Key is not configured."}), 400

    # If a document is attached to this session, retrieve the chunks most
    # relevant to the latest user message and ground the answer in them.
    active_doc_id = session.get('active_doc')
    if active_doc_id and active_doc_id in DOCUMENTS:
        last_user_text = ""
        for m in reversed(messages):
            if m.get("role") == "user" and isinstance(m.get("content"), str):
                last_user_text = m["content"]
                break
        relevant_chunks = retrieve_relevant_chunks(active_doc_id, last_user_text, top_k=3)
        if relevant_chunks:
            doc_name = DOCUMENTS[active_doc_id]["filename"]
            context_block = "\n\n---\n".join(relevant_chunks)
            system_instruction = (
                f"{system_instruction}\n\n"
                f"The user has attached a document called \"{doc_name}\". Here are the excerpts "
                f"most relevant to their latest message — use them to answer when relevant, and "
                f"say clearly if the excerpts don't cover what they're asking:\n\n{context_block}"
            )

    formatted_messages = []
    if system_instruction:
        formatted_messages.append({"role": "system", "content": system_instruction})

    for idx, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "").strip() if isinstance(msg.get("content"), str) else msg.get("content", "")

        # If last user message contains attached images
        if role == "user" and idx == len(messages) - 1 and images:
            # जर युजरने काहीच टाईप केले नसेल तर डीफॉल्ट मजकूर वापरा जेणेकरून API एरर देणार नाही
            user_prompt = content if content else "Please analyze and describe this image."

            content_list = [{"type": "text", "text": user_prompt}]
            for img in images:
                content_list.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
            formatted_messages.append({"role": role, "content": content_list})
        else:
            formatted_messages.append({"role": role, "content": content})

    if not bring_your_own_key:
        increment_usage()

    def generate():
        try:
            response_stream = client.chat.completions.create(
                model=model_name,
                messages=formatted_messages,
                stream=True
            )

            for chunk in response_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    text_content = chunk.choices[0].delta.content
                    payload = json.dumps({"text": text_content})
                    yield f"data: {payload}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            err_payload = json.dumps({"error": str(e)})
            yield f"data: {err_payload}\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)