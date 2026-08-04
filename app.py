import os
import json
import base64
from flask import Flask, render_template, request, Response, jsonify, stream_with_context, session
from config import Config
from openai import OpenAI

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config.from_object(Config)
app.secret_key = os.getenv("SECRET_KEY", "super-secret-key-1234")

# Mock User Database (Production मध्ये SQLite/PostgreSQL वापरू शकता)
USERS_DB = {}

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

    USERS_DB[email] = password
    session['user'] = email
    return jsonify({"message": "Account created successfully!", "user": email}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Please enter email and password."}), 400

    if email not in USERS_DB or USERS_DB[email] != password:
        return jsonify({"error": "Invalid email or password. Please try again."}), 401

    session['user'] = email
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
    return jsonify({
        "appName": app.config.get('APP_NAME', 'Claude 2.0'),
        "appSubtitle": app.config.get('APP_SUBTITLE', 'Intelligent Conversational Partner'),
        "defaultModel": "anthropic/claude-3-haiku",
        "defaultTemperature": 0.7,
        "hasApiKey": has_key
    })

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    system_instruction = data.get("systemInstruction", app.config.get('SYSTEM_PROMPT', ''))
    api_key_override = data.get("apiKeyOverride")
    images = data.get("images", []) # Base64 Image Support
    
    model_name = data.get("model") or "anthropic/claude-3.5-haiku"  # Default model

    client = get_openrouter_client(api_key_override)

    if not client:
        return jsonify({"error": "OpenRouter API Key is not configured."}), 400

    formatted_messages = []
    if system_instruction:
        formatted_messages.append({"role": "system", "content": system_instruction})
    
    for idx, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "")

        # If last user message contains attached images
        if role == "user" and idx == len(messages) - 1 and images:
            content_list = [{"type": "text", "text": content}]
            for img in images:
                content_list.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
            formatted_messages.append({"role": role, "content": content_list})
        else:
            formatted_messages.append({"role": role, "content": content})

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
import os
import json
import base64
from flask import Flask, render_template, request, Response, jsonify, stream_with_context, session
from config import Config
from openai import OpenAI

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config.from_object(Config)
app.secret_key = os.getenv("SECRET_KEY", "super-secret-key-1234")

# Mock User Database (Production मध्ये SQLite/PostgreSQL वापरू शकता)
USERS_DB = {}

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

    USERS_DB[email] = password
    session['user'] = email
    return jsonify({"message": "Account created successfully!", "user": email}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Please enter email and password."}), 400

    if email not in USERS_DB or USERS_DB[email] != password:
        return jsonify({"error": "Invalid email or password. Please try again."}), 401

    session['user'] = email
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
    return jsonify({
        "appName": app.config.get('APP_NAME', 'Claude 2.0'),
        "appSubtitle": app.config.get('APP_SUBTITLE', 'Intelligent Conversational Partner'),
        "defaultModel": "anthropic/claude-3-haiku",
        "defaultTemperature": 0.7,
        "hasApiKey": has_key
    })

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    system_instruction = data.get("systemInstruction", app.config.get('SYSTEM_PROMPT', ''))
    api_key_override = data.get("apiKeyOverride")
    images = data.get("images", []) # Base64 Image Support
    
    model_name = data.get("model") or "anthropic/claude-3-haiku"  # Default model

    client = get_openrouter_client(api_key_override)

    if not client:
        return jsonify({"error": "OpenRouter API Key is not configured."}), 400

    formatted_messages = []
    if system_instruction:
        formatted_messages.append({"role": "system", "content": system_instruction})
    
    for idx, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "").strip()

        # If last user message contains attached images
        if role == "user" and idx == len(messages) - 1 and images:
            # जर युजरने काहीच टाईप केले नसेल तर डीफॉल्ट मजकूर वापरा जेणेकरून Bedrock API एरर देणार नाही
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