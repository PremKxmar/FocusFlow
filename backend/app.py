"""
FocusFlow Backend - Main Application Entry Point
Includes:
- Auto database seeding (creates demo user if not exists)
- Integrated activity tracker that runs in background
"""
import os
import sys
import threading
import time

# Force unbuffered output for real-time logging
sys.stdout.reconfigure(line_buffering=True)

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from routes import auth_bp, tasks_bp, activities_bp, focus_bp, insights_bp, tracker_bp, team_bp, novel_bp

# Activity Tracker Imports
import requests
try:
    import pygetwindow as gw
    TRACKER_AVAILABLE = True
except (ImportError, Exception):
    TRACKER_AVAILABLE = False
    print("⚠️  pygetwindow not available (Linux/cloud). Activity tracker disabled.", flush=True)

from datetime import datetime

# ============ ACTIVITY TRACKER ============

PRODUCTIVE_APPS = [
    'visual studio code', 'vscode', 'code', 'pycharm', 'intellij', 'webstorm',
    'sublime', 'atom', 'vim', 'nvim', 'terminal', 'cmd', 'powershell', 'git',
    'notion', 'obsidian', 'evernote', 'onenote', 'slack', 'teams', 'zoom',
    'figma', 'photoshop', 'illustrator', 'blender', 'unity', 'unreal',
    'excel', 'word', 'powerpoint', 'docs', 'sheets', 'slides',
    'postman', 'insomnia', 'mongodb', 'mysql', 'postgres', 'dbeaver'
]

DISTRACTING_APPS = [
    'youtube', 'netflix', 'prime video', 'disney', 'disney+', 'hotstar', 'hulu', 'hbo',
    'twitch', 'tiktok', 'crunchyroll',
    'twitter', 'x.com', 'facebook', 'instagram', 'reddit', 'snapchat', 'pinterest', 'tumblr',
    'whatsapp', 'telegram', 'discord', 'messenger',
    'games', 'steam', 'epic games', 'spotify', 'vlc', 'media player', 'soundcloud',
    'amazon', 'ebay', 'shopping', 'flipkart', 'myntra'
]

def categorize_app(app_name: str) -> str:
    app_lower = app_name.lower()
    for prod_app in PRODUCTIVE_APPS:
        if prod_app in app_lower:
            return 'productive'
    for dist_app in DISTRACTING_APPS:
        if dist_app in app_lower:
            return 'distracting'
    return 'neutral'

def get_category_emoji(category: str) -> str:
    return {'productive': '🟢', 'distracting': '🔴', 'neutral': '🟡'}.get(category, '⚪')

# Browser names to detect
BROWSERS = ['google chrome', 'chrome', 'firefox', 'mozilla', 'edge', 'safari', 'opera', 'brave']

# Keywords to detect websites from window title
WEBSITE_KEYWORDS = {
    # Streaming/Entertainment (Distracting)
    'youtube': 'YouTube',
    'netflix': 'Netflix',
    'prime video': 'Prime Video',
    'primevideo': 'Prime Video',
    'amazon.com/gp/video': 'Prime Video',
    'disney+': 'Disney+',
    'disneyplus': 'Disney+',
    'hotstar': 'Hotstar',
    'hulu': 'Hulu',
    'hbo max': 'HBO Max',
    'twitch': 'Twitch',
    'crunchyroll': 'Crunchyroll',
    'spotify': 'Spotify',
    'soundcloud': 'SoundCloud',
    
    # Social Media (Distracting)
    'twitter': 'Twitter',
    'x.com': 'Twitter/X',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'reddit': 'Reddit',
    'tiktok': 'TikTok',
    'snapchat': 'Snapchat',
    'pinterest': 'Pinterest',
    'tumblr': 'Tumblr',
    
    # Messaging (Distracting)
    'discord': 'Discord',
    'whatsapp': 'WhatsApp',
    'telegram': 'Telegram',
    'messenger': 'Messenger',
    
    # Productivity (Productive)
    'linkedin': 'LinkedIn',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'stackoverflow': 'Stack Overflow',
    'stack overflow': 'Stack Overflow',
    'gmail': 'Gmail',
    'outlook': 'Outlook',
    'docs.google': 'Google Docs',
    'sheets.google': 'Google Sheets',
    'drive.google': 'Google Drive',
    'slides.google': 'Google Slides',
    'notion.so': 'Notion',
    'notion': 'Notion',
    'figma': 'Figma',
    'canva': 'Canva',
    'trello': 'Trello',
    'asana': 'Asana',
    'jira': 'Jira',
    'confluence': 'Confluence',
    'google calendar': 'Google Calendar',
    'calendar.google': 'Google Calendar',
    
    # AI Tools (Productive)
    'chatgpt': 'ChatGPT',
    'claude': 'Claude AI',
    'gemini': 'Google Gemini',
    'copilot': 'GitHub Copilot',
    'perplexity': 'Perplexity AI',
    
    # Shopping (Distracting)
    'amazon': 'Amazon',
    'flipkart': 'Flipkart',
    'ebay': 'eBay',
    'myntra': 'Myntra'
}

def extract_website_from_title(title: str) -> str:
    """Extract website name from browser window title"""
    title_lower = title.lower()
    
    # Check if it's a browser window
    is_browser = any(browser in title_lower for browser in BROWSERS)
    
    if is_browser or ' - ' in title:
        # Check for known websites
        for keyword, site_name in WEBSITE_KEYWORDS.items():
            if keyword in title_lower:
                return site_name
    
    return None

def get_active_window():
    if not TRACKER_AVAILABLE:
        return None
    try:
        active_window = gw.getActiveWindow()
        if active_window:
            title = active_window.title
            title_lower = title.lower()
            
            # Try to extract website name first (known sites)
            website = extract_website_from_title(title)
            if website:
                return {'title': title, 'app_name': website}
            
            # Check if it's a browser window
            is_browser = any(browser in title_lower for browser in BROWSERS)
            
            if is_browser and ' - ' in title:
                parts = title.split(' - ')
                # Remove browser name from the end
                browser_names = ['google chrome', 'chrome', 'firefox', 'mozilla firefox', 
                               'microsoft edge', 'edge', 'safari', 'opera', 'brave']
                
                # Filter out browser names and get page title
                cleaned_parts = []
                for part in parts:
                    if part.strip().lower() not in browser_names:
                        cleaned_parts.append(part.strip())
                
                if cleaned_parts:
                    # Get the first part (usually page title) or the most meaningful one
                    app_name = cleaned_parts[0]
                    # If first part is very short, try the second
                    if len(app_name) <= 3 and len(cleaned_parts) > 1:
                        app_name = cleaned_parts[1]
                    return {'title': title, 'app_name': app_name}
                else:
                    # All parts were browser names, use full title first part
                    return {'title': title, 'app_name': parts[0].strip()}
            
            # Not a browser or no ' - ' separator
            if ' - ' in title:
                parts = title.split(' - ')
                # For non-browser apps, last part is usually app name
                app_name = parts[-1].strip()
            else:
                app_name = title
            
            return {'title': title, 'app_name': app_name}
    except:
        pass
    return None


def tracker_login(email: str, password: str) -> str:
    try:
        response = requests.post('http://localhost:5000/api/auth/login', json={
            'email': email, 'password': password
        }, timeout=5)
        if response.status_code == 200:
            return response.json().get('token')
    except Exception as e:
        print(f"[TRACKER] Login error: {e}", flush=True)
    return None

def log_activity(token: str, app_name: str, duration_minutes: float, category: str):
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.post(
            'http://localhost:5000/api/activities',
            json={
                'app_name': app_name,
                'duration_minutes': duration_minutes,
                'category': category,
                'timestamp': datetime.utcnow().isoformat()
            },
            headers=headers, timeout=5
        )
        return response.status_code == 201
    except Exception as e:
        print(f"[TRACKER] API error: {e}", flush=True)
    return False

# Global tracker state
active_tracker = {
    'running': False,
    'token': None,
    'user_email': None,
    'thread': None
}

def run_tracker_thread_with_token(token: str, user_email: str, interval: int = 10):
    """Background tracker thread - uses provided token"""
    global active_tracker
    
    print("", flush=True)
    print(f"🎯 ACTIVITY TRACKER: Started for {user_email}", flush=True)
    print(f"🎯 ACTIVITY TRACKER: 📊 Tracking every {interval} seconds", flush=True)
    print("=" * 70, flush=True)
    print("TIME      | CURRENT WINDOW                              | STATUS", flush=True)
    print("=" * 70, flush=True)
    
    current_app = None
    app_start_time = time.time()
    records_saved = 0
    
    while True:
        try:
            window_info = get_active_window()
            ts = datetime.now().strftime('%H:%M:%S')
            
            if window_info:
                app_name = window_info['app_name'][:40]
                category = categorize_app(app_name)
                emoji = get_category_emoji(category)
                
                print(f"[{ts}] | {app_name:<43} | {emoji} Tracking", flush=True)
                
                if current_app and current_app != window_info['app_name']:
                    duration = (time.time() - app_start_time) / 60
                    prev_category = categorize_app(current_app)
                    
                    if duration >= 0.05:
                        success = log_activity(active_tracker['token'], current_app, round(duration, 2), prev_category)
                        if success:
                            records_saved += 1
                            prev_emoji = get_category_emoji(prev_category)
                            print(f"[{ts}] | 💾 SAVED TO DB: {current_app[:30]} | {prev_emoji} {duration:.2f}min (#{records_saved})", flush=True)
                    
                    app_start_time = time.time()

                current_app = window_info['app_name']
            else:
                print(f"[{ts}] | (No active window)                          | ⚪ Waiting", flush=True)

            # Check if tracker should stop
            if not active_tracker['running']:
                print(f"[{ts}] | 🛑 TRACKER STOPPED", flush=True)
                break

            time.sleep(interval)
        except Exception as e:
            print(f"[{ts}] | ERROR: {str(e)[:35]}                  | ⚠️", flush=True)
            time.sleep(interval)

def test_mongodb_and_seed():
    """Test MongoDB connection, and seed a demo user when SEED_DEMO_USER is enabled."""
    print("", flush=True)
    print("📊 Connecting to MongoDB...", flush=True)

    try:
        from utils.db import get_db
        from models.user import UserModel

        db = get_db()
        collections = db.list_collection_names()

        print(f"✅ MongoDB Connected!", flush=True)
        print(f"   Database: {Config.MONGO_DB_NAME}", flush=True)
        print(f"   Collections: {', '.join(collections) if collections else '(new database)'}", flush=True)

        if not Config.SEED_DEMO_USER:
            print("", flush=True)
            print("👤 Demo user seeding disabled (set SEED_DEMO_USER=true to enable)", flush=True)
            return True

        print("", flush=True)
        print("👤 Checking demo user...", flush=True)

        user_model = UserModel(db)
        existing_user = user_model.find_by_email(Config.DEMO_USER_EMAIL)

        if existing_user:
            print("   ✅ Demo user exists", flush=True)
        else:
            user_model.create_user(
                name='Demo User',
                email=Config.DEMO_USER_EMAIL,
                password=Config.DEMO_USER_PASSWORD,
                style='Balanced',
                goals=['Improve focus', 'Track productivity']
            )
            print("   ✅ Demo user created!", flush=True)

        print(f"   Email: {Config.DEMO_USER_EMAIL}", flush=True)

        return True

    except Exception as e:
        print(f"❌ MongoDB Connection Failed!", flush=True)
        print(f"   Error: {str(e)}", flush=True)
        print("", flush=True)
        print("   Please check:", flush=True)
        print("   1. .env file has correct MONGO_URI", flush=True)
        print("   2. MongoDB Atlas IP whitelist includes your IP", flush=True)
        return False

# ============ FLASK APP ============

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Configure CORS properly with all necessary options
    CORS(app, 
         resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    @app.before_request
    def handle_preflight():
        """Intercept OPTIONS preflight requests and return 200 immediately"""
        if request.method == 'OPTIONS':
            resp = app.make_default_options_response()
            origin = request.headers.get('Origin', '')
            allowed = Config.CORS_ORIGINS
            if origin in allowed or '*' in allowed:
                resp.headers['Access-Control-Allow-Origin'] = origin
            else:
                resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Max-Age'] = '3600'
            return resp

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin', '')
        allowed = Config.CORS_ORIGINS
        if origin in allowed or '*' in allowed:
            response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(activities_bp)
    app.register_blueprint(focus_bp)
    app.register_blueprint(insights_bp)
    app.register_blueprint(tracker_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(novel_bp)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy', 'service': 'FocusFlow API', 'version': '1.0.0'})
    
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({'message': 'Welcome to FocusFlow API'})
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

app = create_app()

# Auto-seed database on startup (both dev and production)
try:
    test_mongodb_and_seed()
except Exception as e:
    print(f"⚠️  Database seed warning: {e}", flush=True)

if __name__ == '__main__':
    print("", flush=True)
    print("=" * 70, flush=True)
    print("🚀 FocusFlow BACKEND SERVER", flush=True)
    print("=" * 70, flush=True)
    
    # Test MongoDB and auto-seed
    if not test_mongodb_and_seed():
        print("", flush=True)
        print("⚠️  Cannot start without MongoDB. Exiting.", flush=True)
        sys.exit(1)
    
    print("", flush=True)
    print("🌐 Server: http://localhost:5000", flush=True)
    print("", flush=True)
    print("📡 API Endpoints:", flush=True)
    print("   POST /api/auth/login", flush=True)
    print("   GET  /api/insights/dashboard", flush=True)
    print("   GET  /api/insights/forecast", flush=True)
    print("=" * 70, flush=True)
    
    # Tracker will start when user logs in via API
    if TRACKER_AVAILABLE:
        print("🎯 ACTIVITY TRACKER: Ready (starts when user logs in)", flush=True)
    else:
        print("⚠️  Install pygetwindow: pip install pygetwindow", flush=True)
    
    print("", flush=True)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
