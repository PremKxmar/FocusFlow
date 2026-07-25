"""
Authentication Routes
"""
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from config import Config
from utils.db import get_db
from utils.auth_middleware import token_required
from models.user import UserModel

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    # Validate required fields
    required = ['name', 'email', 'password']
    if not all(field in data for field in required):
        return jsonify({'error': 'Missing required fields: name, email, password'}), 400
    
    db = get_db()
    user_model = UserModel(db)
    
    # Check if email already exists
    if user_model.find_by_email(data['email']):
        return jsonify({'error': 'Email already registered'}), 409
    
    # Create user
    try:
        user = user_model.create_user(
            name=data['name'],
            email=data['email'],
            password=data['password'],
            style=data.get('style', 'Balanced'),
            goals=data.get('goals', [])
        )
        
        # Generate JWT token
        token = _generate_token(user['id'])
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user,
            'token': token
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    db = get_db()
    user_model = UserModel(db)
    
    # Find user
    user = user_model.find_by_email(data['email'])
    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Verify password
    if not user_model.verify_password(user, data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Check if 2FA is enabled
    if user_model.is_2fa_enabled(user):
        totp_code = data.get('totp_code')
        if not totp_code:
            return jsonify({
                'requires_2fa': True,
                'message': 'Two-factor authentication code required'
            }), 200
        
        if not user_model.verify_2fa_code(user, totp_code):
            return jsonify({'error': 'Invalid 2FA code'}), 401
    
    # Generate token
    token = _generate_token(str(user['_id']))
    
    return jsonify({
        'message': 'Login successful',
        'user': user_model._serialize(user),
        'token': token
    })

@auth_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get current user profile"""
    db = get_db()
    user_model = UserModel(db)
    
    user = user_model.find_by_id(request.current_user['id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user})

@auth_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile():
    """Update user profile"""
    data = request.get_json()
    
    db = get_db()
    user_model = UserModel(db)
    
    user = user_model.update_profile(request.current_user['id'], data)
    if not user:
        return jsonify({'error': 'Failed to update profile'}), 400
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': user
    })

@auth_bp.route('/account', methods=['DELETE'])
@token_required
def delete_account():
    """Delete user account and all associated data"""
    db = get_db()
    user_id = request.current_user['id']
    
    from bson import ObjectId
    uid = ObjectId(user_id)
    
    # Delete all user data
    db.users.delete_one({'_id': uid})
    db.tasks.delete_many({'user_id': user_id})
    db.activities.delete_many({'user_id': uid})
    db.activities.delete_many({'user_id': user_id})
    db.focus_sessions.delete_many({'user_id': uid})
    db.focus_sessions.delete_many({'user_id': user_id})
    
    return jsonify({'message': 'Account and all data deleted successfully'})

@auth_bp.route('/clear-data', methods=['POST'])
@token_required
def clear_data():
    """Clear user activity data older than retention period"""
    data = request.get_json()
    retention_days = data.get('retention_days', 90)
    
    db = get_db()
    user_id = request.current_user['id']
    
    from bson import ObjectId
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    
    # Clear old activities
    result_activities = db.activities.delete_many({
        '$or': [{'user_id': ObjectId(user_id)}, {'user_id': user_id}],
        'timestamp': {'$lt': cutoff}
    })
    
    # Clear old focus sessions
    result_sessions = db.focus_sessions.delete_many({
        '$or': [{'user_id': ObjectId(user_id)}, {'user_id': user_id}],
        'start_time': {'$lt': cutoff}
    })
    
    return jsonify({
        'message': f'Cleared data older than {retention_days} days',
        'activities_deleted': result_activities.deleted_count,
        'sessions_deleted': result_sessions.deleted_count
    })

@auth_bp.route('/2fa/setup', methods=['POST'])
@token_required
def setup_2fa():
    """Generate a TOTP secret and provisioning URI for 2FA setup"""
    db = get_db()
    user_model = UserModel(db)
    
    user = user_model.find_by_id(request.current_user['id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    secret = user_model.setup_2fa(request.current_user['id'])
    
    import pyotp
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user['email'],
        issuer_name='FocusFlow'
    )
    
    return jsonify({
        'secret': secret,
        'provisioning_uri': provisioning_uri,
        'message': 'Scan the QR code or enter the secret in your authenticator app'
    })

@auth_bp.route('/2fa/verify', methods=['POST'])
@token_required
def verify_2fa():
    """Verify TOTP code and enable 2FA"""
    data = request.get_json()
    code = data.get('code')
    
    if not code:
        return jsonify({'error': '2FA code is required'}), 400
    
    db = get_db()
    user_model = UserModel(db)
    
    if user_model.verify_and_enable_2fa(request.current_user['id'], code):
        return jsonify({'message': '2FA enabled successfully', 'totp_enabled': True})
    
    return jsonify({'error': 'Invalid verification code'}), 400

@auth_bp.route('/2fa/disable', methods=['POST'])
@token_required
def disable_2fa():
    """Disable 2FA for user"""
    data = request.get_json()
    password = data.get('password')
    
    if not password:
        return jsonify({'error': 'Password is required to disable 2FA'}), 400
    
    db = get_db()
    user_model = UserModel(db)
    
    user = user_model.find_by_email(request.current_user.get('email', ''))
    if not user:
        # Fallback: find by ID
        from bson import ObjectId
        user = db.users.find_one({'_id': ObjectId(request.current_user['id'])})
    
    if not user or not user_model.verify_password(user, password):
        return jsonify({'error': 'Invalid password'}), 401
    
    user_model.disable_2fa(request.current_user['id'])
    return jsonify({'message': '2FA disabled successfully', 'totp_enabled': False})

def _generate_token(user_id: str) -> str:
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')
