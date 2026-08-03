import os

class Config:
    # --- Replaceable Branding Settings ---
    APP_NAME = os.getenv("APP_NAME", "Claude 2.0")
    APP_SUBTITLE = os.getenv("APP_SUBTITLE", "Intelligent Conversational Partner")
    ACCENT_COLOR = "#D97706"  # Warm amber minimal tone
    
    # --- Server Config ---
    SECRET_KEY = os.getenv("SECRET_KEY", "my-secret-key-123")
    
    # --- OpenRouter AI API Configuration ---
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    DEFAULT_MODEL = "anthropic/claude-3.5-sonnet"
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 4096
    SYSTEM_PROMPT = "You are Claude, a helpful, precise, and thoughtful AI assistant. Respond in well-formatted Markdown."