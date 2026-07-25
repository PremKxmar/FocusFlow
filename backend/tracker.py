"""
FocusFlow Desktop Activity Tracker
Monitors active window every 10 seconds and logs to database via API
Uses pygetwindow to get active window information
"""
import os
import sys
import time
import requests
try:
    import pygetwindow as gw
    TRACKER_AVAILABLE = True
except (ImportError, Exception):
    gw = None
    TRACKER_AVAILABLE = False
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# API Configuration
API_BASE_URL = 'http://localhost:5000/api'

# App categorization
PRODUCTIVE_APPS = [
    'visual studio code', 'vscode', 'code', 'pycharm', 'intellij', 'webstorm',
    'sublime', 'atom', 'vim', 'nvim', 'terminal', 'cmd', 'powershell', 'git',
    'notion', 'obsidian', 'evernote', 'onenote', 'slack', 'teams', 'zoom',
    'figma', 'photoshop', 'illustrator', 'blender', 'unity', 'unreal',
    'excel', 'word', 'powerpoint', 'docs', 'sheets', 'slides',
    'postman', 'insomnia', 'mongodb', 'mysql', 'postgres', 'dbeaver',
    'github', 'gitlab', 'bitbucket', 'stack overflow', 'stackoverflow',
    'chatgpt', 'claude', 'gemini', 'copilot',
    'google docs', 'google sheets', 'google slides', 'google drive',
    'canva', 'miro', 'trello', 'asana', 'jira', 'confluence',
    'gmail', 'outlook', 'calendar', 'linkedin'
]

DISTRACTING_APPS = [
    'youtube', 'netflix', 'prime video', 'disney', 'twitch', 'tiktok',
    'twitter', 'facebook', 'instagram', 'reddit', 'whatsapp', 'telegram',
    'discord', 'games', 'steam', 'epic games', 'spotify', 'vlc', 'media player',
    'snapchat', 'pinterest', 'tumblr', '9gag', 'imgur',
    'amazon', 'ebay', 'shopping', 'flipkart'
]

def print_banner():
    """Print startup banner"""
    print("\n" + "=" * 60)
    print("   🎯 FocusFlow ACTIVITY TRACKER")
    print("=" * 60)

def print_status(message, status_type="info"):
    """Print formatted status message"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    icons = {
        "info": "ℹ️ ",
        "success": "✅",
        "error": "❌",
        "track": "📊",
        "save": "💾",
        "app": "🖥️ "
    }
    icon = icons.get(status_type, "  ")
    print(f"[{timestamp}] {icon} {message}")

def categorize_app(app_name: str) -> str:
    """Categorize app as productive, distracting, or neutral"""
    app_lower = app_name.lower()
    
    for prod_app in PRODUCTIVE_APPS:
        if prod_app in app_lower:
            return 'productive'
    
    for dist_app in DISTRACTING_APPS:
        if dist_app in app_lower:
            return 'distracting'
    
    return 'neutral'

def get_category_emoji(category: str) -> str:
    """Get emoji for category"""
    return {
        'productive': '🟢',
        'distracting': '🔴',
        'neutral': '🟡'
    }.get(category, '⚪')

def extract_website_from_title(title: str) -> str:
    """Extract website/page name from browser window title"""
    # Common browser indicators
    browsers = ['Google Chrome', 'Mozilla Firefox', 'Microsoft Edge', 'Opera', 'Brave', 'Safari']
    
    # Check if it's a browser window
    is_browser = any(browser in title for browser in browsers)
    
    if is_browser:
        # Browser titles usually follow: "Page Title - Website Name - Browser"
        # or "Page Title - Browser"
        parts = title.split(' - ')
        
        if len(parts) >= 2:
            # Remove browser name from the end if present
            cleaned_parts = [p.strip() for p in parts if p.strip() not in browsers]
            
            if cleaned_parts:
                # Check for common website indicators in each part
                for part in cleaned_parts:
                    part_lower = part.lower()
                    
                    # Check if this part contains a known website/service
                    common_sites = {
                        'youtube': 'YouTube',
                        'netflix': 'Netflix',
                        'prime video': 'Prime Video',
                        'amazon': 'Amazon',
                        'facebook': 'Facebook',
                        'instagram': 'Instagram',
                        'twitter': 'Twitter',
                        'reddit': 'Reddit',
                        'linkedin': 'LinkedIn',
                        'gmail': 'Gmail',
                        'github': 'GitHub',
                        'stackoverflow': 'Stack Overflow',
                        'stack overflow': 'Stack Overflow',
                        'spotify': 'Spotify',
                        'twitch': 'Twitch',
                        'discord': 'Discord',
                        'whatsapp': 'WhatsApp',
                        'telegram': 'Telegram',
                        'notion': 'Notion',
                        'figma': 'Figma',
                        'canva': 'Canva',
                        'google docs': 'Google Docs',
                        'google sheets': 'Google Sheets',
                        'google slides': 'Google Slides',
                        'google drive': 'Google Drive',
                        'chatgpt': 'ChatGPT',
                        'claude': 'Claude AI',
                        'gemini': 'Google Gemini'
                    }
                    
                    for keyword, site_name in common_sites.items():
                        if keyword in part_lower:
                            return site_name
                
                # If no specific site detected, use the first meaningful part
                # This handles titles like "Some Page - Google Chrome"
                return cleaned_parts[0] if cleaned_parts[0] else parts[0].strip()
        
        return title.split(' - ')[0].strip() if ' - ' in title else title
    
    # Not a browser, return as-is
    return title


def get_active_window():
    """Get the currently active window title and app name"""
    try:
        active_window = gw.getActiveWindow()
        if active_window:
            title = active_window.title
            
            # Smart extraction: detect if it's a browser and extract website
            app_name = extract_website_from_title(title)
            
            # If extraction didn't work well, fall back to old method
            if not app_name or app_name == title:
                if ' - ' in title:
                    parts = title.split(' - ')
                    # Try to get the most meaningful part (avoid just getting "Google Chrome")
                    # Prefer the first part unless it's very short
                    if len(parts[0].strip()) > 3:
                        app_name = parts[0].strip()
                    elif len(parts) > 1:
                        app_name = parts[-2].strip() if len(parts) > 2 else parts[0].strip()
                    else:
                        app_name = parts[0].strip()
                else:
                    app_name = title
            
            return {
                'title': title,
                'app_name': app_name
            }
    except Exception as e:
        print_status(f"Error getting window: {e}", "error")
    
    return None

def login(email: str, password: str) -> str:
    """Login to get auth token"""
    try:
        print_status(f"Connecting to backend at {API_BASE_URL}...", "info")
        response = requests.post(f'{API_BASE_URL}/auth/login', json={
            'email': email,
            'password': password
        }, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print_status(f"Logged in as: {email}", "success")
            return data.get('token')
        else:
            error = response.json().get('error', 'Unknown error')
            print_status(f"Login failed: {error}", "error")
    except requests.exceptions.ConnectionError:
        print_status("Cannot connect to backend. Is it running?", "error")
    except Exception as e:
        print_status(f"Login error: {e}", "error")
    
    return None

def log_activity(token: str, app_name: str, duration_minutes: float, category: str):
    """Log activity to the backend API"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.post(
            f'{API_BASE_URL}/activities',
            json={
                'app_name': app_name,
                'duration_minutes': duration_minutes,
                'category': category,
                'timestamp': datetime.utcnow().isoformat()
            },
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 201:
            emoji = get_category_emoji(category)
            print_status(f"SAVED TO DB: {app_name} | {duration_minutes:.1f} min | {emoji} {category}", "save")
            return True
        else:
            error = response.json().get('error', 'Unknown error')
            print_status(f"Failed to save: {error}", "error")
    except Exception as e:
        print_status(f"API error: {e}", "error")
    
    return False

def run_tracker(email: str, password: str, interval_seconds: int = 10):
    """Main tracker loop"""
    print_banner()
    
    # Login
    print_status(f"Logging in as {email}...", "info")
    token = login(email, password)
    
    if not token:
        print_status("Authentication failed. Please check:", "error")
        print("   1. Backend is running (python app.py)")
        print("   2. Database is seeded (python seed.py)")
        print("   3. Credentials are correct")
        return
    
    print()
    print("-" * 60)
    print_status("🚀 TRACKER STARTED!", "success")
    print_status(f"Monitoring every {interval_seconds} seconds", "info")
    print_status("Press Ctrl+C to stop", "info")
    print("-" * 60)
    print()
    
    current_app = None
    app_start_time = time.time()
    records_saved = 0
    
    try:
        while True:
            window_info = get_active_window()
            
            if window_info:
                app_name = window_info['app_name']
                
                # Show current tracking
                if current_app != app_name:
                    category = categorize_app(app_name)
                    emoji = get_category_emoji(category)
                    print_status(f"Now tracking: {app_name} {emoji}", "app")
                
                # If app changed, log the previous app's duration
                if current_app and current_app != app_name:
                    duration = (time.time() - app_start_time) / 60  # Convert to minutes
                    category = categorize_app(current_app)
                    
                    if duration >= 0.1:  # Only log if used for at least 6 seconds
                        success = log_activity(token, current_app, round(duration, 2), category)
                        if success:
                            records_saved += 1
                    
                    app_start_time = time.time()
                
                current_app = app_name
            
            time.sleep(interval_seconds)
            
    except KeyboardInterrupt:
        print()
        print("-" * 60)
        
        # Log final app on exit
        if current_app:
            duration = (time.time() - app_start_time) / 60
            category = categorize_app(current_app)
            if duration >= 0.1:
                success = log_activity(token, current_app, round(duration, 2), category)
                if success:
                    records_saved += 1
        
        print()
        print_status("🛑 TRACKER STOPPED", "info")
        print_status(f"Total records saved to database: {records_saved}", "success")
        print("-" * 60)
        print()

if __name__ == '__main__':
    # Default credentials
    EMAIL = 'demo@focusflow.local'
    PASSWORD = 'demo123'
    INTERVAL = 10  # seconds
    
    # Allow command line arguments
    if len(sys.argv) >= 3:
        EMAIL = sys.argv[1]
        PASSWORD = sys.argv[2]
    if len(sys.argv) >= 4:
        INTERVAL = int(sys.argv[3])
    
    run_tracker(EMAIL, PASSWORD, INTERVAL)
