"""
Novel Research Feature Routes
6 novel contributions for conference-paper-level innovation:
  1. SHAP Explainable AI
  2. Digital Fatigue Index
  3. Context-Switch Cost (Attention Residue)
  4. Procrastination Sequence Mining
  5. Adaptive Ensemble Weights
  6. Mood–Productivity Bidirectional VAR / Granger Causality
"""
from flask import Blueprint, request, jsonify
from utils.db import get_db
from utils.auth_middleware import token_required
from datetime import datetime, timedelta
from bson import ObjectId

novel_bp = Blueprint('novel', __name__, url_prefix='/api/novel')

# ------------------------------------------------------------------ helpers --
def _user_id(req):
    uid = req.current_user['id']
    return ObjectId(uid) if isinstance(uid, str) else uid


def _get_activities(db, user_id, days=14):
    """Fetch recent activities for a user."""
    since = datetime.utcnow() - timedelta(days=days)
    return list(db.activities.find(
        {'user_id': user_id, 'start_time': {'$gte': since}},
        {'_id': 0}
    ).sort('start_time', 1))


def _get_focus_sessions(db, user_id, days=14):
    since = datetime.utcnow() - timedelta(days=days)
    return list(db.focus_sessions.find(
        {'user_id': user_id, 'started_at': {'$gte': since}},
        {'_id': 0}
    ).sort('started_at', 1))


def _daily_aggregates(activities):
    """Group activities into per-day productive/distracting minutes."""
    daily = {}
    for a in activities:
        st = a.get('start_time')
        if isinstance(st, datetime):
            day = st.strftime('%Y-%m-%d')
        else:
            day = str(st)[:10]
        if day not in daily:
            daily[day] = {'date': day, 'productive_minutes': 0, 'distracting_minutes': 0}
        dur = a.get('duration_minutes', a.get('duration', 0))
        cat = a.get('category', 'neutral')
        if cat == 'productive':
            daily[day]['productive_minutes'] += dur
        elif cat == 'distracting':
            daily[day]['distracting_minutes'] += dur
    return sorted(daily.values(), key=lambda x: x['date'])


# ====================================================================== 1 ====
# SHAP Explainable AI
# ====================================================================== 1 ====
@novel_bp.route('/shap', methods=['GET'])
@token_required
def shap_explanations():
    try:
        from ml import get_shap_explainer

        db = get_db()
        user_id = _user_id(request)
        activities = _get_activities(db, user_id)
        weekly_trends = _daily_aggregates(activities)

        tasks = list(db.tasks.find({'user_id': user_id}, {'_id': 0}))
        task_stats = {
            'total': len(tasks),
            'completed': sum(1 for t in tasks if t.get('completed')),
            'overdue': sum(1 for t in tasks if t.get('is_overdue')),
        }

        sessions = _get_focus_sessions(db, user_id)
        durations = [s.get('duration', 0) for s in sessions if s.get('duration')]
        focus_stats = {
            'total_sessions': len(sessions),
            'avg_duration': sum(durations) / max(len(durations), 1),
        }

        explainer = get_shap_explainer()
        result = explainer.explain(weekly_trends, task_stats, focus_stats)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'shap_values': [], 'explanation': 'Could not compute SHAP explanations.'}), 200


# ====================================================================== 2 ====
# Digital Fatigue Index
# ====================================================================== 2 ====
@novel_bp.route('/fatigue', methods=['GET'])
@token_required
def fatigue_index():
    try:
        from ml import get_fatigue_index

        db = get_db()
        user_id = _user_id(request)
        activities = _get_activities(db, user_id, days=1)  # today
        sessions = _get_focus_sessions(db, user_id, days=1)

        dfi = get_fatigue_index()
        result = dfi.compute(activities, sessions)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'fatigue_index': 0, 'status': 'unknown'}), 200


# ====================================================================== 3 ====
# Context-Switch Cost / Attention Residue
# ====================================================================== 3 ====
@novel_bp.route('/context-switch', methods=['GET'])
@token_required
def context_switch():
    try:
        from ml import get_context_switch_analyzer

        db = get_db()
        user_id = _user_id(request)
        activities = _get_activities(db, user_id)

        analyzer = get_context_switch_analyzer()
        result = analyzer.analyze(activities)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'csps': 0, 'transitions': []}), 200


# ====================================================================== 4 ====
# Procrastination Sequence Mining
# ====================================================================== 4 ====
@novel_bp.route('/procrastination', methods=['GET'])
@token_required
def procrastination():
    try:
        from ml import get_procrastination_detector

        db = get_db()
        user_id = _user_id(request)
        activities = _get_activities(db, user_id)

        detector = get_procrastination_detector()
        result = detector.analyze(activities)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'risk_score': 0, 'episodes': []}), 200


# ====================================================================== 5 ====
# Adaptive Ensemble Weights
# ====================================================================== 5 ====
@novel_bp.route('/ensemble-weights', methods=['GET'])
@token_required
def ensemble_weights():
    try:
        from ml import get_adaptive_ensemble_optimizer

        user_id = str(_user_id(request))
        optimizer = get_adaptive_ensemble_optimizer()
        weights = optimizer.get_weights(user_id)
        report = optimizer.get_performance_report(user_id)

        return jsonify({
            'weights': weights,
            'report': report,
        })
    except Exception as e:
        return jsonify({'error': str(e), 'weights': {'lstm': 0.4, 'arima': 0.3, 'prophet': 0.3}}), 200


@novel_bp.route('/ensemble-weights/simulate', methods=['POST'])
@token_required
def simulate_ensemble():
    try:
        from ml import get_adaptive_ensemble_optimizer

        user_id = str(_user_id(request))
        data = request.get_json(silent=True) or {}
        days = data.get('days', 14)

        optimizer = get_adaptive_ensemble_optimizer()
        result = optimizer.simulate_adaptation(user_id, days=days)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 200


# ====================================================================== 6 ====
# Mood–Productivity Bidirectional VAR
# ====================================================================== 6 ====
@novel_bp.route('/mood-productivity', methods=['GET'])
@token_required
def mood_productivity():
    try:
        from ml import get_mood_productivity_var

        db = get_db()
        user_id = _user_id(request)

        # Mood history from wellness logs
        mood_entries = list(db.mood_logs.find(
            {'user_id': user_id},
            {'_id': 0}
        ).sort('timestamp', 1))

        mood_history = []
        for m in mood_entries:
            ts = m.get('timestamp', m.get('date'))
            if isinstance(ts, datetime):
                date_str = ts.strftime('%Y-%m-%d')
            else:
                date_str = str(ts)[:10]
            mood_history.append({
                'date': date_str,
                'mood': m.get('mood', 3),
                'energy': m.get('energy', 3),
                'stress': m.get('stress', 3),
            })

        # Productivity from activities
        activities = _get_activities(db, user_id, days=60)
        productivity_history = _daily_aggregates(activities)

        var_model = get_mood_productivity_var()
        result = var_model.analyze(mood_history, productivity_history)

        return jsonify(result)
    except Exception as e:
        return jsonify({
            'error': str(e),
            'has_sufficient_data': False,
            'message': 'Could not perform bidirectional analysis.',
        }), 200


# ====================================================================== ALL ==
# Combined overview (single call from frontend)
# ====================================================================== ALL ==
@novel_bp.route('/overview', methods=['GET'])
@token_required
def novel_overview():
    """Return a lightweight summary of all 6 novel features in one call."""
    results = {}
    db = get_db()
    user_id = _user_id(request)
    activities = _get_activities(db, user_id)
    sessions = _get_focus_sessions(db, user_id, days=1)

    # 1. SHAP
    try:
        from ml import get_shap_explainer
        weekly_trends = _daily_aggregates(activities)
        tasks = list(db.tasks.find({'user_id': user_id}, {'_id': 0}))
        task_stats = {
            'total': len(tasks),
            'completed': sum(1 for t in tasks if t.get('completed')),
            'overdue': sum(1 for t in tasks if t.get('is_overdue')),
        }
        all_sessions = _get_focus_sessions(db, user_id)
        durations = [s.get('duration', 0) for s in all_sessions if s.get('duration')]
        focus_stats = {
            'total_sessions': len(all_sessions),
            'avg_duration': sum(durations) / max(len(durations), 1),
        }
        explainer = get_shap_explainer()
        results['shap'] = explainer.explain(weekly_trends, task_stats, focus_stats)
    except Exception as e:
        results['shap'] = {'error': str(e)}

    # 2. Fatigue
    try:
        from ml import get_fatigue_index
        dfi = get_fatigue_index()
        today_acts = [a for a in activities if (a.get('start_time', datetime.min)).date() == datetime.utcnow().date()] if activities else []
        results['fatigue'] = dfi.compute(today_acts, sessions)
    except Exception as e:
        results['fatigue'] = {'error': str(e)}

    # 3. Context-Switch
    try:
        from ml import get_context_switch_analyzer
        analyzer = get_context_switch_analyzer()
        results['context_switch'] = analyzer.analyze(activities)
    except Exception as e:
        results['context_switch'] = {'error': str(e)}

    # 4. Procrastination
    try:
        from ml import get_procrastination_detector
        detector = get_procrastination_detector()
        results['procrastination'] = detector.analyze(activities)
    except Exception as e:
        results['procrastination'] = {'error': str(e)}

    # 5. Ensemble
    try:
        from ml import get_adaptive_ensemble_optimizer
        optimizer = get_adaptive_ensemble_optimizer()
        uid_str = str(user_id)
        results['ensemble'] = {
            'weights': optimizer.get_weights(uid_str),
            'report': optimizer.get_performance_report(uid_str),
        }
    except Exception as e:
        results['ensemble'] = {'error': str(e)}

    # 6. Mood-Productivity
    try:
        from ml import get_mood_productivity_var
        mood_entries = list(db.mood_logs.find({'user_id': user_id}, {'_id': 0}).sort('timestamp', 1))
        mood_history = []
        for m in mood_entries:
            ts = m.get('timestamp', m.get('date'))
            date_str = ts.strftime('%Y-%m-%d') if isinstance(ts, datetime) else str(ts)[:10]
            mood_history.append({'date': date_str, 'mood': m.get('mood', 3), 'energy': m.get('energy', 3), 'stress': m.get('stress', 3)})
        productivity_history = _daily_aggregates(_get_activities(db, user_id, days=60))
        var_model = get_mood_productivity_var()
        results['mood_productivity'] = var_model.analyze(mood_history, productivity_history)
    except Exception as e:
        results['mood_productivity'] = {'error': str(e), 'has_sufficient_data': False}

    return jsonify(results)
