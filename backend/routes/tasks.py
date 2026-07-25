"""
Task Routes
"""
from flask import Blueprint, request, jsonify
from utils.db import get_db
from utils.auth_middleware import token_required
from models.task import TaskModel

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')

@tasks_bp.route('', methods=['GET'])
@token_required
def get_tasks():
    """Get all tasks for current user"""
    db = get_db()
    task_model = TaskModel(db)
    
    # Optional filter by completion status
    completed = request.args.get('completed')
    if completed is not None:
        completed = completed.lower() == 'true'
    
    tasks = task_model.get_user_tasks(request.current_user['id'], completed)
    
    return jsonify({
        'tasks': tasks,
        'count': len(tasks)
    })

@tasks_bp.route('', methods=['POST'])
@token_required
def create_task():
    """Create a new task"""
    data = request.get_json()
    
    if not data.get('title'):
        return jsonify({'error': 'Task title is required'}), 400
    
    db = get_db()
    task_model = TaskModel(db)
    
    task = task_model.create_task(
        user_id=request.current_user['id'],
        title=data['title'],
        deadline=data.get('deadline', ''),
        category=data.get('category', 'Work'),
        priority=data.get('priority', 'Medium')
    )
    
    return jsonify({
        'message': 'Task created successfully',
        'task': task
    }), 201

@tasks_bp.route('/<task_id>', methods=['GET'])
@token_required
def get_task(task_id):
    """Get a specific task"""
    db = get_db()
    task_model = TaskModel(db)
    
    task = task_model.get_task_by_id(task_id, request.current_user['id'])
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    return jsonify({'task': task})

@tasks_bp.route('/<task_id>', methods=['PUT'])
@token_required
def update_task(task_id):
    """Update a task"""
    data = request.get_json()
    
    db = get_db()
    task_model = TaskModel(db)
    
    task = task_model.update_task(task_id, request.current_user['id'], data)
    if not task:
        return jsonify({'error': 'Task not found or update failed'}), 404
    
    return jsonify({
        'message': 'Task updated successfully',
        'task': task
    })

@tasks_bp.route('/<task_id>', methods=['DELETE'])
@token_required
def delete_task(task_id):
    """Delete a task"""
    db = get_db()
    task_model = TaskModel(db)
    
    if task_model.delete_task(task_id, request.current_user['id']):
        return jsonify({'message': 'Task deleted successfully'})
    
    return jsonify({'error': 'Task not found'}), 404

@tasks_bp.route('/stats', methods=['GET'])
@token_required
def get_task_stats():
    """Get task statistics for current user"""
    db = get_db()
    task_model = TaskModel(db)
    
    stats = task_model.get_task_stats(request.current_user['id'])
    
    return jsonify({'stats': stats})
