# 🤖 Claude 2.0 - Web AI Platform

A modern, responsive, full-stack AI Conversational Interface built with **Flask (Python)** and **OpenRouter API** (powered by Anthropic Claude Models). Designed with a clean UI inspired by Claude and modern Web Apps.

---

## ✨ Features

- 💬 **Real-time Streaming Responses:** Fast Server-Sent Events (SSE) streaming for natural conversational interaction.
- 🖼️ **Multimodal Support (Image Input):** Drag, attach, and preview images with direct AI vision context processing.
- 🔊 **Text-to-Speech (Listen):** Listen to AI answers directly in the chat with built-in voice output.
- 📋 **Interactive Message Actions:** One-click **Copy**, **Feedback (Thumbs Up/Down)**, and **Regenerate Response**.
- 🔐 **User Authentication System:** Sign In / Sign Up support with validation and session management.
- 📱 **Mobile First & Responsive Layout:** Dynamic viewport adjustment (`100dvh`) for flawless display across all screen sizes.
- 🌙 **Dark / Light Theme Engine:** Smooth theme switcher with automatic system preference detection.
- 💾 **Local Chat Storage:** Automatically saves chat history locally in IndexedDB with dynamic sidebar access.

---

## 🛠️ Tech Stack

- **Backend:** Python (Flask), OpenAI / OpenRouter Python SDK
- **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
- **APIs:** OpenRouter API (Anthropic Claude 3 Haiku / Sonnet)
- **Libraries:** Marked.js (Markdown), Highlight.js (Code Highlighting), KaTeX (Math Formatting)
- **Deployment:** Render / Vercel

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- OpenRouter API Key ([Get API Key](https://openrouter.ai/))

### Installation & Local Setup

1. **Clone the repository:**
   ```
   
   git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
   cd your-repo-name


   
1.Create a virtual environment:

python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

2.Install dependencies:

pip install -r requirements.txt


3.Environment Configuration:

Create a .env file in the root directory:
Code snippet
OPENROUTER_API_KEY=your_openrouter_api_key_here
SECRET_KEY=super-secret-key-1234

4.Run the Application:

python app.py
Open http://localhost:5000 in your browser.

📂 Project Structure
Plaintext
├── api/
│   └── index.py            # Vercel entry point (optional)
├── static/
│   ├── css/
│   │   └── style.css       # Main stylesheet with mobile responsive CSS
│   ├── app.js              # Frontend application logic
│   ├── db.js               # IndexedDB history storage handler
│   ├── markdown.js         # Markdown parsing & syntax highlighter
│   └── theme.js            # Light/Dark mode switcher
├── templates/
│   └── index.html          # Main application layout & modals
├── app.py                  # Flask backend server & OpenRouter stream APIs
├── config.py               # Application configuration
├── requirements.txt        # Python dependencies
└── README.md               # Documentation

🌟 Author
Created by Rajdewarde 🚀
---
🚀 Commands to Add and Push to Git:
Create a new file named README.md in your project folder and paste the above content into it.

Push it from the terminal using the following commands:

git add README.md
git commit -m "add professional README documentation"
git push origin main
