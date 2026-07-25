"""
Team Routes for FocusFlow
"""
from flask import Blueprint, request, jsonify
from utils.db import get_db
from utils.auth_middleware import token_required
from models.team import TeamModel
from datetime import datetime, timedelta
from bson import ObjectId

team_bp = Blueprint('team', __name__, url_prefix='/api/team')


@team_bp.route('/create', methods=['POST'])
@token_required
def create_team():
    """Create a new team"""
    data = request.get_json()
    name = data.get('name', '').strip()
    user_id = request.current_user['id']

    if not name:
        return jsonify({'error': 'Team name required'}), 400

    if len(name) > 50:
        return jsonify({'error': 'Team name too long (max 50 chars)'}), 400

    # Check if user already in a team
    existing = TeamModel.find_user_team(user_id)
    if existing:
        return jsonify({'error': 'You are already in a team. Leave first to create a new one.'}), 400

    team = TeamModel.create_team(name, user_id)
    return jsonify({
        'message': 'Team created',
        'invite_code': team['invite_code'],
        'team_id': str(team['_id'])
    })


@team_bp.route('/join', methods=['POST'])
@token_required
def join_team():
    """Join a team via invite code"""
    data = request.get_json()
    invite_code = data.get('invite_code', '').strip().upper()
    user_id = request.current_user['id']

    if not invite_code:
        return jsonify({'error': 'Invite code required'}), 400

    # Check if user already in a team
    existing = TeamModel.find_user_team(user_id)
    if existing:
        return jsonify({'error': 'You are already in a team. Leave first to join another.'}), 400

    team = TeamModel.find_by_invite_code(invite_code)
    if not team:
        return jsonify({'error': 'Invalid invite code'}), 404

    # Check if already a member
    if any(m['user_id'] == str(user_id) for m in team['members']):
        return jsonify({'error': 'You are already in this team'}), 400

    TeamModel.add_member(team['_id'], user_id)
    return jsonify({'message': 'Joined team successfully', 'team_name': team['name']})


@team_bp.route('/leave', methods=['POST'])
@token_required
def leave_team():
    """Leave current team"""
    user_id = request.current_user['id']
    team = TeamModel.find_user_team(user_id)

    if not team:
        return jsonify({'error': 'Not in any team'}), 404

    TeamModel.remove_member(team['_id'], user_id)
    return jsonify({'message': 'Left team successfully'})


@team_bp.route('/dashboard', methods=['GET'])
@token_required
def team_dashboard():
    """Get team dashboard with member stats"""
    user_id = request.current_user['id']
    team = TeamModel.find_user_team(user_id)

    if not team:
        return jsonify({'error': 'Not in any team'}), 404

    db = get_db()

    # Get stats for each member
    members_data = []
    total_focus = 0
    total_tasks = 0
    total_productive = 0

    for member in team['members']:
        mid = member['user_id']

        # Get user info
        try:
            user_obj = db.users.find_one({'_id': ObjectId(mid)})
        except Exception:
            user_obj = db.users.find_one({'_id': mid})

        user_name = user_obj.get('name', 'Unknown') if user_obj else 'Unknown'
        user_email = user_obj.get('email', '') if user_obj else ''

        # Focus sessions in last 7 days
        cutoff = datetime.utcnow() - timedelta(days=7)
        focus_sessions = list(db.focus_sessions.find({
            'user_id': {'$in': [mid, ObjectId(mid) if ObjectId.is_valid(mid) else mid]},
            'start_time': {'$gte': cutoff}
        }))
        focus_minutes = sum(s.get('duration', 0) for s in focus_sessions)

        # Completed tasks in last 7 days
        completed_tasks = db.tasks.count_documents({
            'user_id': {'$in': [mid, ObjectId(mid) if ObjectId.is_valid(mid) else mid]},
            'status': 'completed'
        })

        # Productive minutes (from activities)
        activities = list(db.activities.find({
            'user_id': {'$in': [mid, ObjectId(mid) if ObjectId.is_valid(mid) else mid]},
            'start_time': {'$gte': cutoff}
        }))
        productive_mins = sum(
            a.get('duration', 0) for a in activities
            if a.get('category') == 'productive'
        ) / 60

        # Streak: consecutive days with focus sessions
        streak = 0
        check_date = datetime.utcnow().date()
        for _ in range(30):
            day_start = datetime.combine(check_date, datetime.min.time())
            day_end = day_start + timedelta(days=1)
            has_focus = db.focus_sessions.find_one({
                'user_id': {'$in': [mid, ObjectId(mid) if ObjectId.is_valid(mid) else mid]},
                'start_time': {'$gte': day_start, '$lt': day_end}
            })
            if has_focus:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break

        member_data = {
            'id': mid,
            'name': user_name,
            'email': user_email,
            'role': member.get('role', 'member'),
            'focus_minutes': round(focus_minutes),
            'tasks_completed': completed_tasks,
            'productive_minutes': round(productive_mins),
            'streak': streak
        }
        members_data.append(member_data)

        total_focus += focus_minutes
        total_tasks += completed_tasks
        total_productive += productive_mins

    avg_productivity = total_productive / len(members_data) if members_data else 0

    return jsonify({
        'id': str(team['_id']),
        'name': team['name'],
        'invite_code': team['invite_code'],
        'created_by': team['created_by'],
        'members': members_data,
        'total_focus': round(total_focus),
        'total_tasks': total_tasks,
        'avg_productivity': round(avg_productivity, 1)
    })
