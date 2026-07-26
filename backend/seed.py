"""
Seed script to create demo user, initialize database collections, and add sample data
"""
import os
import sys
import random
from datetime import datetime, timedelta

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils.db import get_db
from models.user import UserModel

def seed_database():
    """Initialize database with demo user only"""
    print("=" * 50)
    print("🗃️  FocusFlow Database Setup")
    print("=" * 50)
    print()
    
    db = get_db()
    print("✅ Connected to MongoDB Atlas")
    
    # Create collections (MongoDB creates them automatically, but this ensures indexes)
    print()
    print("📂 Creating collections...")
    
    collections = ['users', 'tasks', 'activities', 'focus_sessions']
    for collection in collections:
        # Ensure collection exists by accessing it
        db[collection].find_one()
        print(f"   ✓ {collection}")
    
    # Create demo user
    print()
    print("👤 Creating demo user...")
    
    user_model = UserModel(db)
    existing_user = user_model.find_by_email(Config.DEMO_USER_EMAIL)

    if existing_user:
        print("   ℹ️  Demo user already exists")
        user_id = str(existing_user['_id'])
    else:
        user = user_model.create_user(
            name='Demo User',
            email=Config.DEMO_USER_EMAIL,
            password=Config.DEMO_USER_PASSWORD,
            style='Balanced',
            goals=['Improve focus', 'Track productivity', 'Reduce distractions']
        )
        user_id = user['id']
        print("   ✅ Demo user created")
    
    print()
    print("=" * 50)
    print("✅ DATABASE READY!")
    print("=" * 50)
    print()
    print("📋 Collections created:")
    print("   • users         - User accounts")
    print("   • tasks         - Task management")
    print("   • activities    - App usage tracking (real-time)")
    print("   • focus_sessions - Focus mode sessions")
    print()
    print("🔐 Demo Login:")
    print(f"   Email:    {Config.DEMO_USER_EMAIL}")
    print("   Password: (from DEMO_USER_PASSWORD in .env)")
    print()
    
    days = int(os.getenv('SEED_DAYS', '90'))

    # Add sample activity data for demo user
    print(f"📊 Adding sample activity data for demo user ({days} days)...")
    seed_activities(db, user_id, days)
    seed_tasks(db, user_id)

    # Add sample data for ALL other users too
    print("📊 Adding data for all other users...")
    for u in db.users.find({}):
        if str(u['_id']) != user_id:
            seed_activities(db, u['_id'], days)


    print("🚀 Next step: Run 'python app.py' to start server")
    print("=" * 50)


SAMPLE_TASKS = [
    # (title, category, priority, days_from_today, completed, progress)
    ('Ship the analytics dashboard redesign', 'Work', 'High', 3, False, 65),
    ('Write unit tests for the forecasting service', 'Work', 'High', 5, False, 30),
    ('Review pull requests', 'Work', 'Medium', 1, False, 0),
    ('Prepare sprint demo slides', 'Work', 'Medium', 7, False, 15),
    ('Refactor the activity aggregation pipeline', 'Work', 'Low', 14, False, 0),
    ('Finish time-series analysis chapter', 'Study', 'High', 2, False, 80),
    ('Read paper on attention mechanisms', 'Study', 'Medium', 10, False, 45),
    ('Complete Kaggle competition submission', 'Study', 'Medium', -2, False, 55),
    ('Morning workout', 'Health', 'Medium', 0, True, 100),
    ('Book dentist appointment', 'Health', 'Low', -4, False, 0),
    ('Meal prep for the week', 'Health', 'Low', 4, False, 0),
    ('Renew domain registration', 'Urgent', 'High', -1, False, 0),
    ('Submit expense report', 'Urgent', 'High', 1, True, 100),
    ('Call family', 'Personal', 'Medium', 2, False, 0),
    ('Plan weekend trip', 'Personal', 'Low', 12, False, 20),
    ('Update portfolio site', 'Personal', 'Medium', 21, True, 100),
]


def seed_tasks(db, user_id):
    """Add a realistic task backlog: a mix of open, completed and overdue work."""
    user_id_str = str(user_id)
    db.tasks.delete_many({'user_id': {'$in': [user_id_str]}})

    today = datetime.utcnow().date()
    tasks = []
    for title, category, priority, offset, completed, progress in SAMPLE_TASKS:
        deadline = today + timedelta(days=offset)
        created = datetime.utcnow() - timedelta(days=random.randint(1, 30))
        tasks.append({
            'user_id': user_id_str,
            'title': title,
            'deadline': deadline.strftime('%Y-%m-%d'),
            'category': category,
            'priority': priority,
            'completed': completed,
            'progress': 100 if completed else progress,
            'created_at': created,
            'updated_at': created,
        })

    db.tasks.insert_many(tasks)
    overdue = sum(1 for t in tasks
                  if not t['completed']
                  and datetime.strptime(t['deadline'], '%Y-%m-%d').date() < today)
    print(f"   ✅ Added {len(tasks)} tasks "
          f"({sum(1 for t in tasks if t['completed'])} completed, {overdue} overdue)")
    print()


PRODUCTIVE_APPS = ['Visual Studio Code', 'GitHub', 'ChatGPT', 'Google Docs',
                   'Stack Overflow', 'Figma', 'Notion']
DISTRACTING_APPS = ['YouTube', 'Netflix', 'Reddit', 'Instagram', 'Twitter', 'Facebook']
NEUTRAL_APPS = ['Gmail', 'Google Search', 'News', 'Weather']


def _day_productivity_factor(day_offset, total_days):
    """
    Scale a day's productive output so the generated series has structure the
    forecasting models can actually learn:

      - weekly seasonality (weekends are much quieter than weekdays)
      - a mild upward trend across the window
      - day-to-day noise

    Without seasonality and trend, ARIMA/Prophet/LSTM fit a flat line and the
    forecast screens look broken even though the models are working correctly.
    """
    date = datetime.utcnow() - timedelta(days=day_offset)
    weekday = date.weekday()  # 0=Mon .. 6=Sun

    if weekday == 5:      # Saturday
        seasonal = 0.35
    elif weekday == 6:    # Sunday
        seasonal = 0.45
    elif weekday == 4:    # Friday tapers off
        seasonal = 0.80
    else:
        seasonal = 1.0

    # Older days sit lower, recent days higher -> gentle improving trend.
    progress = (total_days - day_offset) / max(total_days, 1)
    trend = 0.75 + (0.45 * progress)

    noise = random.uniform(0.85, 1.15)
    return seasonal * trend * noise


def seed_activities(db, user_id, days=None):
    """Add sample activity data for the past `days` days."""
    from bson import ObjectId

    if days is None:
        days = int(os.getenv('SEED_DAYS', '90'))

    # Convert user_id to ObjectId if needed
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)

    # Clear existing activities
    db.activities.delete_many({'user_id': user_id})
    db.focus_sessions.delete_many({'user_id': user_id})

    activities = []
    focus_sessions = []

    for day_offset in range(days):
        current_date = datetime.utcnow() - timedelta(days=day_offset)
        factor = _day_productivity_factor(day_offset, days)

        # Morning - mostly productive, scaled by the day's factor
        for _ in range(max(1, int(round(random.randint(4, 6) * factor)))):
            activities.append({
                'user_id': user_id,
                'app_name': random.choice(PRODUCTIVE_APPS),
                'duration_minutes': max(5, int(random.randint(10, 45) * factor)),
                'category': 'productive',
                'is_productive': True,
                'timestamp': current_date.replace(hour=random.randint(9, 11),
                                                  minute=random.randint(0, 59)),
                'created_at': current_date
            })

        # Afternoon - mixed
        for _ in range(random.randint(3, 5)):
            roll = random.random()
            if roll < 0.6 * factor:
                app, category = random.choice(PRODUCTIVE_APPS), 'productive'
            elif roll < 0.8:
                app, category = random.choice(NEUTRAL_APPS), 'neutral'
            else:
                app, category = random.choice(DISTRACTING_APPS), 'distracting'

            activities.append({
                'user_id': user_id,
                'app_name': app,
                'duration_minutes': random.randint(5, 30),
                'category': category,
                'is_productive': category == 'productive',
                'timestamp': current_date.replace(hour=random.randint(14, 16),
                                                  minute=random.randint(0, 59)),
                'created_at': current_date
            })

        # Evening - distraction-heavy, and more so on low-productivity days
        for _ in range(random.randint(2, 4)):
            if random.random() < 0.3 * factor:
                app, category = random.choice(PRODUCTIVE_APPS), 'productive'
            else:
                app, category = random.choice(DISTRACTING_APPS), 'distracting'

            activities.append({
                'user_id': user_id,
                'app_name': app,
                'duration_minutes': random.randint(10, 60),
                'category': category,
                'is_productive': category == 'productive',
                'timestamp': current_date.replace(hour=random.randint(18, 20),
                                                  minute=random.randint(0, 59)),
                'created_at': current_date
            })

        # Focus sessions - fewer on quiet days
        for _ in range(max(0, int(round(random.randint(2, 3) * factor)))):
            start = current_date.replace(hour=random.randint(9, 17),
                                         minute=random.randint(0, 59))
            planned = random.choice([15, 25, 30, 45])
            completed = random.random() < (0.6 + 0.25 * min(factor, 1.0))
            actual = planned if completed else random.randint(5, planned - 1)
            focus_sessions.append({
                'user_id': user_id,
                'planned_duration': planned,
                'actual_duration': actual,
                'completed': completed,
                'start_time': start,
                'end_time': start + timedelta(minutes=actual),
                'created_at': start
            })

    if activities:
        db.activities.insert_many(activities)
        print(f"   ✅ Added {len(activities)} activities ({days} days)")

    if focus_sessions:
        db.focus_sessions.insert_many(focus_sessions)
        print(f"   ✅ Added {len(focus_sessions)} focus sessions")

    print()


if __name__ == '__main__':
    seed_database()
