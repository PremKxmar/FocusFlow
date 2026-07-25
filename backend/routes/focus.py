"""
Focus Session Routes
"""
from flask import Blueprint, request, jsonify
from utils.db import get_db
from utils.auth_middleware import token_required
from models.focus_session import FocusSessionModel

focus_bp = Blueprint('focus', __name__, url_prefix='/api/focus')

@focus_bp.route('/start', methods=['POST'])
@token_required
def start_session():
    """Start a new focus session"""
    data = request.get_json() or {}
    
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    # Check if there's already an active session
    active = focus_model.get_active_session(request.current_user['id'])
    if active:
        return jsonify({
            'error': 'You already have an active focus session',
            'session': active
        }), 400
    
    # Get duration (default 25 minutes - Pomodoro)
    duration = data.get('duration', 25)
    
    session = focus_model.start_session(request.current_user['id'], duration)
    
    return jsonify({
        'message': 'Focus session started',
        'session': session
    }), 201

@focus_bp.route('/end', methods=['POST'])
@token_required
def end_session():
    """End the current focus session"""
    data = request.get_json() or {}
    
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    # Find active session
    active = focus_model.get_active_session(request.current_user['id'])
    if not active:
        return jsonify({'error': 'No active focus session found'}), 404
    
    completed = data.get('completed', True)
    session = focus_model.end_session(active['id'], request.current_user['id'], completed)
    
    return jsonify({
        'message': 'Focus session ended',
        'session': session
    })

@focus_bp.route('/end/<session_id>', methods=['POST'])
@token_required
def end_specific_session(session_id):
    """End a specific focus session"""
    data = request.get_json() or {}
    
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    completed = data.get('completed', True)
    session = focus_model.end_session(session_id, request.current_user['id'], completed)
    
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify({
        'message': 'Focus session ended',
        'session': session
    })

@focus_bp.route('/active', methods=['GET'])
@token_required
def get_active_session():
    """Get currently active focus session"""
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    session = focus_model.get_active_session(request.current_user['id'])
    
    return jsonify({
        'active': session is not None,
        'session': session
    })

@focus_bp.route('/history', methods=['GET'])
@token_required
def get_session_history():
    """Get focus session history"""
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    days = request.args.get('days', 30, type=int)
    sessions = focus_model.get_session_history(request.current_user['id'], days)
    
    return jsonify({
        'sessions': sessions,
        'count': len(sessions)
    })

@focus_bp.route('/stats', methods=['GET'])
@token_required
def get_focus_stats():
    """Get focus session statistics"""
    db = get_db()
    focus_model = FocusSessionModel(db)
    
    days = request.args.get('days', 7, type=int)
    stats = focus_model.get_focus_stats(request.current_user['id'], days)
    
    return jsonify({'stats': stats})
