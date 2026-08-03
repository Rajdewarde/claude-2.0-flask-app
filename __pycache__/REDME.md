# 🤖 Claude 2.0 - AI Chat Application

A sleek, responsive, and lightweight AI Chat Assistant web application built with **Flask**, **OpenRouter API** (powered by Anthropic's Claude / DeepSeek models), and **Vanilla JavaScript**.

---

## ✨ Features

* 🚀 **Real-time Response Streaming:** Smooth server-sent events (SSE) streaming for instant replies.
* 💬 **Chat History Persistence:** Saves conversations locally using IndexedDB for quick reload.
* 📝 **Markdown & Code Highlighting:** Native support for rich Markdown rendering and formatted code blocks.
* 🎨 **Minimal & Modern UI:** Clean interface inspired by Claude with light/dark theme support.
* ⚙️ **Configurable Models:** Easily switch between OpenRouter-supported models (Claude 3.5 Sonnet, Claude 3 Haiku, DeepSeek, etc.).

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, OpenAI/OpenRouter SDK
* **Frontend:** HTML5, CSS3, JavaScript (ES6+), IndexedDB
* **API Provider:** [OpenRouter](https://openrouter.ai/)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/claude-2.0-flask-app.git](https://github.com/YOUR_USERNAME/claude-2.0-flask-app.git)
cd claude-2.0-flask-app
2. Install Dependencies
Bash
pip install -r requirements.txt
3. Environment Setup
Create a .env file in the root directory and add your OpenRouter API key:

Code snippet
OPENROUTER_API_KEY=your_openrouter_api_key_here
4. Run the Application
Bash
python app.py
Open your browser and navigate to http://127.0.0.1:5000.

🛡️ License
Distributed under the MIT License.