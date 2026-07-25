"""
Activity Tracking Routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from utils.db import get_db
from utils.auth_middleware import token_required
from models.activity import ActivityModel

activities_bp = Blueprint('activities', __name__, url_prefix='/api/activities')

@activities_bp.route('', methods=['GET'])
@token_required
def get_activities():
    """Get activity history"""
    db = get_db()
    activity_model = ActivityModel(db)
    
    days = request.args.get('days', 7, type=int)
    activities = activity_model.get_activities(request.current_user['id'], days)
    
    return jsonify({
        'activities': activities,
        'count': len(activities)
    })

@activities_bp.route('', methods=['POST'])
@token_required
def log_activity():
    """Log a new activity"""
    data = request.get_json()
    
    if not data.get('app_name') or not data.get('duration_minutes'):
        return jsonify({'error': 'app_name and duration_minutes are required'}), 400
    
    db = get_db()
    activity_model = ActivityModel(db)
    
    # Parse timestamp if provided
    timestamp = None
    if data.get('timestamp'):
        try:
            timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
        except:
            pass
    
    activity = activity_model.log_activity(
        user_id=request.current_user['id'],
        app_name=data['app_name'],
        duration_minutes=data['duration_minutes'],
        category=data.get('category'),
        timestamp=timestamp
    )
    
    return jsonify({
        'message': 'Activity logged successfully',
        'activity': activity
    }), 201

@activities_bp.route('/summary', methods=['GET'])
@token_required
def get_daily_summary():
    """Get daily activity summary"""
    db = get_db()
    activity_model = ActivityModel(db)
    
    # Optional date parameter
    date_str = request.args.get('date')
    date = None
    if date_str:
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d')
        except:
            pass
    
    summary = activity_model.get_daily_summary(request.current_user['id'], date)
    
    return jsonify({'summary': summary})

@activities_bp.route('/weekly', methods=['GET'])
@token_required
def get_weekly_trends():
    """Get weekly activity trends"""
    db = get_db()
    activity_model = ActivityModel(db)
    
    trends = activity_model.get_weekly_trends(request.current_user['id'])
    
    return jsonify({'trends': trends})

@activities_bp.route('/hourly', methods=['GET'])
@token_required
def get_hourly_breakdown():
    """Get hourly activity breakdown"""
    db = get_db()
    activity_model = ActivityModel(db)
    
    days = request.args.get('days', 7, type=int)
    hourly = activity_model.get_hourly_breakdown(request.current_user['id'], days)
    
    return jsonify({'hourly': hourly})

@activities_bp.route('/batch', methods=['POST'])
@token_required
def log_batch_activities():
    """Log multiple activities at once"""
    data = request.get_json()
    
    if not isinstance(data.get('activities'), list):
        return jsonify({'error': 'activities must be a list'}), 400
    
    db = get_db()
    activity_model = ActivityModel(db)
    
    logged = []
    for act in data['activities']:
        if act.get('app_name') and act.get('duration_minutes'):
            timestamp = None
            if act.get('timestamp'):
                try:
                    timestamp = datetime.fromisoformat(act['timestamp'].replace('Z', '+00:00'))
                except:
                    pass
            
            activity = activity_model.log_activity(
                user_id=request.current_user['id'],
                app_name=act['app_name'],
                duration_minutes=act['duration_minutes'],
                category=act.get('category'),
                timestamp=timestamp
            )
            logged.append(activity)
    
    return jsonify({
        'message': f'Logged {len(logged)} activities',
        'activities': logged
    }), 201
