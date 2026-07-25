"""
Focus Session Model and Operations
"""
from datetime import datetime, timedelta
from bson import ObjectId

class FocusSessionModel:
    """Focus session database operations"""
    
    def __init__(self, db):
        self.collection = db.focus_sessions
    
    def start_session(self, user_id: str, duration_minutes: int = 25) -> dict:
        """Start a new focus session"""
        session = {
            'user_id': user_id,
            'start_time': datetime.utcnow(),
            'planned_duration': duration_minutes,
            'end_time': None,
            'actual_duration': 0,
            'completed': False,
            'created_at': datetime.utcnow()
        }
        
        result = self.collection.insert_one(session)
        session['_id'] = result.inserted_id
        return self._serialize(session)
    
    def end_session(self, session_id: str, user_id: str, completed: bool = True) -> dict:
        """End a focus session"""
        session = self.collection.find_one({
            '_id': ObjectId(session_id),
            'user_id': user_id
        })
        
        if not session:
            return None
        
        end_time = datetime.utcnow()
        actual_duration = (end_time - session['start_time']).total_seconds() / 60
        
        self.collection.update_one(
            {'_id': ObjectId(session_id)},
            {'$set': {
                'end_time': end_time,
                'actual_duration': round(actual_duration, 1),
                'completed': completed
            }}
        )
        
        return self.get_session_by_id(session_id, user_id)
    
    def get_session_by_id(self, session_id: str, user_id: str) -> dict:
        """Get a specific session"""
        session = self.collection.find_one({
            '_id': ObjectId(session_id),
            'user_id': user_id
        })
        return self._serialize(session) if session else None
    
    def get_active_session(self, user_id: str) -> dict:
        """Get currently active session if any"""
        session = self.collection.find_one({
            'user_id': user_id,
            'end_time': None
        })
        return self._serialize(session) if session else None
    
    def get_session_history(self, user_id: str, days: int = 30) -> list:
        """Get focus session history"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        sessions = self.collection.find({
            'user_id': user_id,
            'start_time': {'$gte': start_date}
        }).sort('start_time', -1)
        
        return [self._serialize(s) for s in sessions]
    
    def get_focus_stats(self, user_id: str, days: int = 7) -> dict:
        """Get focus session statistics"""
        # Query for BOTH ObjectId and string user_id
        user_id_str = str(user_id)
        user_id_queries = [user_id_str]
        try:
            user_id_queries.append(ObjectId(user_id_str))
        except:
            pass
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {'$match': {
                'user_id': {'$in': user_id_queries},
                'start_time': {'$gte': start_date},
                'end_time': {'$ne': None}
            }},
            {'$group': {
                '_id': None,
                'total_sessions': {'$sum': 1},
                'completed_sessions': {'$sum': {'$cond': ['$completed', 1, 0]}},
                'total_focus_time': {'$sum': '$actual_duration'},
                'avg_duration': {'$avg': '$actual_duration'}
            }}
        ]
        
        result = list(self.collection.aggregate(pipeline))
        
        if result:
            stats = result[0]
            return {
                'total_sessions': stats['total_sessions'],
                'completed_sessions': stats['completed_sessions'],
                'completion_rate': round(stats['completed_sessions'] / stats['total_sessions'] * 100, 1) if stats['total_sessions'] > 0 else 0,
                'total_focus_time': round(stats['total_focus_time'], 1),
                'avg_duration': round(stats['avg_duration'] or 0, 1)
            }
        
        return {
            'total_sessions': 0,
            'completed_sessions': 0,
            'completion_rate': 0,
            'total_focus_time': 0,
            'avg_duration': 0
        }
    
    def _serialize(self, session: dict) -> dict:
        """Serialize session for API response"""
        if not session:
            return None
        return {
            'id': str(session['_id']),
            'start_time': session['start_time'].isoformat(),
            'end_time': session['end_time'].isoformat() if session.get('end_time') else None,
            'planned_duration': session['planned_duration'],
            'actual_duration': session.get('actual_duration', 0),
            'completed': session['completed']
        }
