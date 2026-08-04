import os
import json
from flask import Flask, render_template, request, Response, jsonify, stream_with_context
from config import Config
from openai import OpenAI

base_dir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config.from_object(Config)

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
    
    model_name = data.get("model")
    if not model_name or "gemini" in model_name or "3.5-sonnet" in model_name:
        model_name = "anthropic/claude-3-haiku"

    client = get_openrouter_client(api_key_override)

    if not client:
        return jsonify({"error": "OpenRouter API Key is not configured."}), 400

    formatted_messages = []
    if system_instruction:
        formatted_messages.append({"role": "system", "content": system_instruction})
    
    for msg in messages:
        formatted_messages.append({
            "role": msg.get("role"),
            "content": msg.get("content", "")
        })

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
    app.run(host='0.0.0.0', port=5000, debug=True)