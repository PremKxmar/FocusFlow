"""
Task Model and Operations
"""
from datetime import datetime, date
from bson import ObjectId

class TaskModel:
    """Task database operations"""
    
    CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Urgent']
    PRIORITIES = ['Low', 'Medium', 'High']
    
    def __init__(self, db):
        self.collection = db.tasks
    
    def _is_overdue(self, deadline_str: str, completed: bool) -> bool:
        """Check if a task is overdue (deadline passed and not completed)"""
        if completed or not deadline_str:
            return False
        try:
            # Parse the deadline date (format: YYYY-MM-DD)
            deadline_date = datetime.strptime(deadline_str, '%Y-%m-%d').date()
            today = date.today()
            return deadline_date < today
        except (ValueError, TypeError):
            return False
    
    def create_task(self, user_id: str, title: str, deadline: str, category: str, priority: str) -> dict:
        """Create a new task"""
        task = {
            'user_id': user_id,
            'title': title,
            'deadline': deadline,
            'category': category if category in self.CATEGORIES else 'Work',
            'priority': priority if priority in self.PRIORITIES else 'Medium',
            'completed': False,
            'progress': 0,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = self.collection.insert_one(task)
        task['_id'] = result.inserted_id
        return self._serialize(task)
    
    def get_user_tasks(self, user_id: str, completed: bool = None) -> list:
        """Get all tasks for a user"""
        # Query for BOTH ObjectId and string user_id
        user_id_str = str(user_id)
        user_id_queries = [user_id_str]
        try:
            user_id_queries.append(ObjectId(user_id_str))
        except:
            pass
        
        query = {'user_id': {'$in': user_id_queries}}
        if completed is not None:
            query['completed'] = completed
        
        tasks = self.collection.find(query).sort('deadline', 1)
        return [self._serialize(task) for task in tasks]
    
    def get_task_by_id(self, task_id: str, user_id: str) -> dict:
        """Get a specific task"""
        task = self.collection.find_one({
            '_id': ObjectId(task_id),
            'user_id': user_id
        })
        return self._serialize(task) if task else None
    
    def update_task(self, task_id: str, user_id: str, updates: dict) -> dict:
        """Update a task"""
        allowed_fields = ['title', 'deadline', 'category', 'priority', 'completed', 'progress']
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        filtered_updates['updated_at'] = datetime.utcnow()
        
        # Validate category and priority
        if 'category' in filtered_updates and filtered_updates['category'] not in self.CATEGORIES:
            filtered_updates['category'] = 'Work'
        if 'priority' in filtered_updates and filtered_updates['priority'] not in self.PRIORITIES:
            filtered_updates['priority'] = 'Medium'
        
        # Auto-set progress to 100 if completed
        if filtered_updates.get('completed') == True:
            filtered_updates['progress'] = 100
        
        result = self.collection.update_one(
            {'_id': ObjectId(task_id), 'user_id': user_id},
            {'$set': filtered_updates}
        )
        
        if result.modified_count > 0:
            return self.get_task_by_id(task_id, user_id)
        return None
    
    def delete_task(self, task_id: str, user_id: str) -> bool:
        """Delete a task"""
        result = self.collection.delete_one({
            '_id': ObjectId(task_id),
            'user_id': user_id
        })
        return result.deleted_count > 0
    
    def get_task_stats(self, user_id: str) -> dict:
        """Get task statistics for a user, including overdue tasks"""
        # Query for BOTH ObjectId and string user_id
        user_id_str = str(user_id)
        user_id_queries = [user_id_str]
        try:
            user_id_queries.append(ObjectId(user_id_str))
        except:
            pass
        
        pipeline = [
            {'$match': {'user_id': {'$in': user_id_queries}}},
            {'$group': {
                '_id': None,
                'total': {'$sum': 1},
                'completed': {'$sum': {'$cond': ['$completed', 1, 0]}},
                'high_priority': {'$sum': {'$cond': [{'$eq': ['$priority', 'High']}, 1, 0]}},
                'avg_progress': {'$avg': '$progress'}
            }}
        ]
        
        result = list(self.collection.aggregate(pipeline))
        
        # Count overdue tasks (deadline passed with completed=false)
        tasks = list(self.collection.find({'user_id': {'$in': user_id_queries}}))
        overdue_count = sum(
            1 for t in tasks 
            if self._is_overdue(t.get('deadline', ''), t.get('completed', False))
        )
        
        if result:
            stats = result[0]
            return {
                'total': stats['total'],
                'completed': stats['completed'],
                'pending': stats['total'] - stats['completed'],
                'overdue': overdue_count,
                'high_priority': stats['high_priority'],
                'avg_progress': round(stats['avg_progress'] or 0, 1)
            }
        return {'total': 0, 'completed': 0, 'pending': 0, 'overdue': 0, 'high_priority': 0, 'avg_progress': 0}
    
    def _serialize(self, task: dict) -> dict:
        """Serialize task for API response"""
        if not task:
            return None
        
        deadline = task.get('deadline', '')
        completed = task.get('completed', False)
        is_overdue = self._is_overdue(deadline, completed)
        
        return {
            'id': str(task['_id']),
            'title': task['title'],
            'deadline': deadline,
            'category': task['category'],
            'priority': task['priority'],
            'completed': completed,
            'progress': task['progress'],
            'is_overdue': is_overdue,
            'created_at': task.get('created_at', datetime.utcnow()).isoformat()
        }
