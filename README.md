🧭 Sarathi AI — Web AI Platform
A modern, responsive, full-stack AI conversational interface built with Flask (Python) and the OpenRouter API. "Sarathi" (सारथी) means guide or charioteer — the assistant is designed to be bilingual, replying naturally in English or Marathi depending on how you write to it.
✨ Features
💬 Real-time Streaming Responses: Server-Sent Events (SSE) streaming for natural conversational interaction.
🖼️ Multimodal Support (Image Input): Attach and preview images with direct AI vision context processing.
🔊 Text-to-Speech (Listen): Listen to AI answers directly in the chat with built-in voice output.
📋 Interactive Message Actions: One-click Copy, Feedback (Thumbs Up/Down), and Regenerate Response.
🔐 User Authentication System: Sign In / Sign Up support with validation and session management.
📱 Mobile First & Responsive Layout: Dynamic viewport adjustment (100dvh) for flawless display across all screen sizes.
🌙 Dark / Light Theme Engine: Smooth theme switcher with automatic system preference detection.
💾 Local Chat Storage: Automatically saves chat history locally in IndexedDB, with JSON export and a clear-history option in Settings.
🧭 Switchable Models: Pick between Sarathi Prime (balanced) and Sarathi Flash (fastest) from Settings.
🎟️ Subscription Tiers (demo): Three plans — Yatri (free), Sarathi, and Maharathi — each with its own daily message limit and model access, enforced server-side via session. No real payment is wired up; switching plans is instant and self-serve.
📲 Installable PWA: Manifest + service worker so it can be added to a phone's home screen.
🛠️ Tech Stack
Backend: Python (Flask), OpenAI Python SDK (pointed at OpenRouter's endpoint), server-side session for plan/usage tracking
Frontend: HTML5, CSS3, JavaScript (ES6 Modules)
Model access: OpenRouter API — currently routed to Anthropic's Claude 3 Haiku / Claude 3.5 Haiku under the hood
Libraries: Marked.js (Markdown), Highlight.js (Code Highlighting), KaTeX (Math Formatting)
Deployment: Render / Vercel
🚀 Getting Started
Prerequisites
Python 3.9+
An OpenRouter API key (get one here)
Installation & Local Setup
Clone the repository:
git clone https://github.com/Rajdewarde/claude-2.0-flask-app.git
cd claude-2.0-flask-app
Create a virtual environment:
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
Install dependencies:
pip install -r requirements.txt
Set up environment variables:
Copy the example file and fill in your own values:
cp .env.example .env
Then edit .env:
OPENROUTER_API_KEY=your_openrouter_api_key_here
SECRET_KEY=a-long-random-string-you-generate-yourself
⚠️ .env is git-ignored on purpose — never commit it. In production (Render/Vercel), set these as environment variables in the dashboard instead of in a file. If a key is ever pushed to a public repo, treat it as compromised and regenerate it immediately on openrouter.ai/keys.
Run the application:
python app.py
Open http://localhost:5000 in your browser.
📂 Project Structure
├── api/
│   └── index.py            # Vercel entry point (optional)
├── static/
│   ├── css/
│   │   └── style.css       # Main stylesheet with mobile responsive CSS
│   ├── icons/               # PWA app icons
│   ├── app.js               # Frontend application logic
│   ├── api.js
│   ├── db.js                # IndexedDB history storage handler
│   ├── markdown.js          # Markdown parsing & syntax highlighter
│   ├── theme.js             # Light/Dark mode switcher
│   ├── sw.js                # Service worker (offline cache)
│   └── manifest.json        # PWA manifest
├── templates/
│   └── index.html           # Main application layout & modals
├── app.py                   # Flask backend server & OpenRouter stream APIs
├── config.py                 # Application configuration
├── .env.example              # Template for local environment variables
├── requirements.txt          # Python dependencies
└── README.md                 # Documentation
🌟 Author
Created by Rajdewarde 🚀