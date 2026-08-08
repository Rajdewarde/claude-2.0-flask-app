import os

class Config:
    # --- Branding Settings ---
    APP_NAME = os.getenv("APP_NAME", "Sarathi AI")
    APP_SUBTITLE = os.getenv("APP_SUBTITLE", "Your AI guide for every conversation")
    ACCENT_COLOR = "#C7862E"  # Charioteer Gold

    # --- Server Config ---
    # IMPORTANT: set a real SECRET_KEY env var in production (Render dashboard).
    # This fallback is only for local dev and is NOT safe to deploy with.
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me-in-render-env-vars")

    # --- OpenRouter AI API Configuration ---
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    DEFAULT_MODEL = "anthropic/claude-3.5-haiku"
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 4096
    SYSTEM_PROMPT = (
        "You are Sarathi, a helpful, precise, and thoughtful AI assistant built to guide the user "
        "through whatever they're working on. You are fluent in both English and Marathi and reply "
        "naturally in whichever language or code-switched mix the user writes in. "
        "Respond in well-formatted Markdown."
    )