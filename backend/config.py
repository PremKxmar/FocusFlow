"""
FocusFlow Backend Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(key: str, default: str = 'false') -> bool:
    return os.getenv(key, default).strip().lower() in ('1', 'true', 'yes', 'on')


class Config:
    """Application configuration"""

    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'focusflow-secret-key-change-in-production')
    DEBUG = _env_bool('DEBUG', 'True')

    # MongoDB
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'focusflow')

    # JWT
    JWT_SECRET = os.getenv('JWT_SECRET', 'jwt-secret-key-change-in-production')
    JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))

    # CORS
    CORS_ORIGINS = os.getenv(
        'CORS_ORIGINS',
        'http://localhost:5173,http://localhost:3000'
    ).split(',')

    # Demo seeding - off by default; enable locally to get a throwaway login
    SEED_DEMO_USER = _env_bool('SEED_DEMO_USER', 'false')
    DEMO_USER_EMAIL = os.getenv('DEMO_USER_EMAIL', 'demo@focusflow.local')
    DEMO_USER_PASSWORD = os.getenv('DEMO_USER_PASSWORD', 'changeme123')
