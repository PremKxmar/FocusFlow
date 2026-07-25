"""
Team Model for FocusFlow
"""
from utils.db import get_db
from datetime import datetime
import random
import string


class TeamModel:
    @staticmethod
    def create_team(name, creator_id):
        """Create a new team with a unique invite code"""
        db = get_db()
        invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

        # Ensure unique invite code
        while db.teams.find_one({'invite_code': invite_code}):
            invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

        team = {
            'name': name,
            'invite_code': invite_code,
            'created_by': str(creator_id),
            'members': [
                {'user_id': str(creator_id), 'role': 'admin', 'joined_at': datetime.utcnow()}
            ],
            'created_at': datetime.utcnow()
        }

        result = db.teams.insert_one(team)
        team['_id'] = result.inserted_id
        return team

    @staticmethod
    def find_by_invite_code(code):
        db = get_db()
        return db.teams.find_one({'invite_code': code.upper()})

    @staticmethod
    def find_user_team(user_id):
        db = get_db()
        return db.teams.find_one({'members.user_id': str(user_id)})

    @staticmethod
    def add_member(team_id, user_id):
        db = get_db()
        db.teams.update_one(
            {'_id': team_id},
            {'$push': {
                'members': {
                    'user_id': str(user_id),
                    'role': 'member',
                    'joined_at': datetime.utcnow()
                }
            }}
        )

    @staticmethod
    def remove_member(team_id, user_id):
        db = get_db()
        team = db.teams.find_one({'_id': team_id})
        if not team:
            return False

        remaining = [m for m in team['members'] if m['user_id'] != str(user_id)]
        if not remaining:
            # Delete team if no members left
            db.teams.delete_one({'_id': team_id})
            return True

        # If the leaving member was admin, promote the next member
        if team['created_by'] == str(user_id) and remaining:
            remaining[0]['role'] = 'admin'
            db.teams.update_one(
                {'_id': team_id},
                {'$set': {'members': remaining, 'created_by': remaining[0]['user_id']}}
            )
        else:
            db.teams.update_one(
                {'_id': team_id},
                {'$set': {'members': remaining}}
            )
        return True
