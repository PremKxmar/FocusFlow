"""
JWT Authentication Middleware
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import jwt
from functools import wraps
from flask import request, jsonify
from bson import ObjectId

try:
    from config import Config
    from utils.db import get_db
except ImportError:
    from backend.config import Config
    from backend.utils.db import get_db

def token_required(f):
    """Decorator to require valid JWT token for protected routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Authentication token is missing'}), 401
        
        try:
            # Decode the token
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            
            # Get user from database
            db = get_db()
            user = db.users.find_one({'_id': ObjectId(payload['user_id'])})
            
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            # Add user to request context
            request.current_user = {
                'id': str(user['_id']),
                'email': user['email'],
                'name': user['name']
            }
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    
    return decorated

def get_current_user_id():
    """Get current user ID from request context"""
    return request.current_user.get('id') if hasattr(request, 'current_user') else None
