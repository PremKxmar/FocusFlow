"""
MongoDB Database Connection Utility
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
try:
    from config import Config
except ImportError:
    from backend.config import Config

# Global database connection
_client = None
_db = None

def get_db():
    """Get MongoDB database instance"""
    global _client, _db
    
    if _db is None:
        _client = MongoClient(Config.MONGO_URI)
        _db = _client[Config.MONGO_DB_NAME]
        
        # Create indexes for better performance
        _create_indexes(_db)
    
    return _db

def _create_indexes(db):
    """Create database indexes for optimal queries"""
    # Users collection
    db.users.create_index('email', unique=True)
    
    # Tasks collection
    db.tasks.create_index('user_id')
    db.tasks.create_index([('user_id', 1), ('deadline', 1)])
    
    # Activities collection
    db.activities.create_index('user_id')
    db.activities.create_index([('user_id', 1), ('timestamp', -1)])
    
    # Focus sessions collection
    db.focus_sessions.create_index('user_id')
    db.focus_sessions.create_index([('user_id', 1), ('start_time', -1)])

def close_db():
    """Close database connection"""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
