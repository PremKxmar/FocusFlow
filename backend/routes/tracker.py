"""
Tracker Control Routes - Start/Stop activity tracker for logged-in user
"""
from flask import Blueprint, request, jsonify
import threading
from utils.auth_middleware import token_required

tracker_bp = Blueprint('tracker', __name__, url_prefix='/api/tracker')

@tracker_bp.route('/start', methods=['POST'])
@token_required
def start_tracker():
    """Start the activity tracker for the current logged-in user"""
    # Import here to avoid circular imports
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    try:
        # Get the active_tracker and tracker functions from app module
        from app import active_tracker, run_tracker_thread_with_token, TRACKER_AVAILABLE
        
        if not TRACKER_AVAILABLE:
            return jsonify({
                'success': False,
                'error': 'Tracker not available. Install pygetwindow.'
            }), 400
        
        # Check if already running
        if active_tracker['running']:
            return jsonify({
                'success': True,
                'message': f"Tracker already running for {active_tracker['user_email']}",
                'already_running': True
            })
        
        # Get token from request header
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header
        
        user_email = request.current_user.get('email', 'user')
        
        # Update tracker state
        active_tracker['running'] = True
        active_tracker['token'] = token
        active_tracker['user_email'] = user_email
        
        # Start tracker thread
        tracker_thread = threading.Thread(
            target=run_tracker_thread_with_token,
            args=(token, user_email, 30),  # Track every 30 seconds
            daemon=True
        )
        tracker_thread.start()
        active_tracker['thread'] = tracker_thread
        
        return jsonify({
            'success': True,
            'message': f'Tracker started for {user_email}',
            'user_email': user_email
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tracker_bp.route('/stop', methods=['POST'])
@token_required
def stop_tracker():
    """Stop the activity tracker"""
    try:
        from app import active_tracker
        
        if not active_tracker['running']:
            return jsonify({
                'success': True,
                'message': 'Tracker was not running'
            })
        
        # Signal tracker to stop
        active_tracker['running'] = False
        active_tracker['token'] = None
        active_tracker['user_email'] = None
        
        return jsonify({
            'success': True,
            'message': 'Tracker stopped'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tracker_bp.route('/status', methods=['GET'])
@token_required
def tracker_status():
    """Get tracker status"""
    try:
        from app import active_tracker, TRACKER_AVAILABLE
        
        return jsonify({
            'available': TRACKER_AVAILABLE,
            'running': active_tracker['running'],
            'user_email': active_tracker['user_email']
        })
        
    except Exception as e:
        return jsonify({
            'available': False,
            'running': False,
            'error': str(e)
        })
