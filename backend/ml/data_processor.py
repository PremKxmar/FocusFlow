"""
Data Processor for ML Models
Handles feature engineering and data preparation
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class DataProcessor:
    """Prepare data for ML models"""
    
    def prepare_classification_features(self, weekly_trends: list, task_stats: dict, focus_stats: dict) -> dict:
        """
        Prepare features for productivity classification
        
        Features:
        - tasks_completed: Number of tasks completed
        - completion_rate: Task completion percentage
        - productive_time: Total productive minutes
        - distraction_time: Total distraction minutes
        - focus_sessions: Number of focus sessions
        - avg_session_duration: Average focus session length
        - consistency_score: Days with >2hrs productive work
        - overdue_tasks: Number of overdue tasks
        - total_tasks: Total number of tasks
        """
        # Calculate from weekly trends
        total_productive = sum(d.get('productive_minutes', 0) for d in weekly_trends)
        total_distracted = sum(d.get('distracting_minutes', 0) for d in weekly_trends)
        productive_days = sum(1 for d in weekly_trends if d.get('productive_minutes', 0) > 120)
        
        features = {
            'tasks_completed': task_stats.get('completed', 0),
            'completion_rate': task_stats.get('completed', 0) / max(task_stats.get('total', 1), 1) * 100,
            'productive_time': total_productive,
            'distraction_time': total_distracted,
            'focus_sessions': focus_stats.get('total_sessions', 0),
            'avg_session_duration': focus_stats.get('avg_duration', 0),
            'consistency_score': productive_days / 7 * 100,
            'focus_ratio': total_productive / max(total_productive + total_distracted, 1),
            'overdue_tasks': task_stats.get('overdue', 0),
            'total_tasks': task_stats.get('total', 0)
        }
        
        return features
    
    def prepare_timeseries_data(self, weekly_trends: list) -> pd.DataFrame:
        """
        Prepare time series data for forecasting
        
        Returns DataFrame with columns:
        - ds: datetime
        - y: productivity value (productive minutes)
        - productive: productive minutes
        - distracted: distracted minutes
        """
        if not weekly_trends:
            # Return empty DataFrame with correct structure
            return pd.DataFrame(columns=['ds', 'y', 'productive', 'distracted'])
        
        data = []
        for i, trend in enumerate(weekly_trends):
            # Parse date or generate based on position
            if 'date' in trend:
                try:
                    date = datetime.strptime(trend['date'], '%Y-%m-%d')
                except:
                    date = datetime.utcnow() - timedelta(days=len(weekly_trends) - i - 1)
            else:
                date = datetime.utcnow() - timedelta(days=len(weekly_trends) - i - 1)
            
            data.append({
                'ds': date,
                'y': trend.get('productive_minutes', 0),
                'productive': trend.get('productive_minutes', 0),
                'distracted': trend.get('distracting_minutes', 0)
            })
        
        df = pd.DataFrame(data)
        return df
    
    def calculate_productivity_score(self, features: dict) -> float:
        """
        Calculate overall productivity score (0-100)
        
        Weighted combination of:
        - Task completion rate (25%)
        - Focus ratio (30%)
        - Consistency score (20%)
        - Session quality (20%)
        - Overdue penalty (up to -15% deduction)
        """
        weights = {
            'completion_rate': 0.25,
            'focus_ratio': 0.30,
            'consistency_score': 0.20,
            'session_quality': 0.20
        }
        
        # Normalize focus ratio to 0-100
        focus_ratio_normalized = features.get('focus_ratio', 0.5) * 100
        
        # Calculate session quality (based on avg duration, optimal is 45-60 min)
        avg_duration = features.get('avg_session_duration', 25)
        if avg_duration < 15:
            session_quality = avg_duration / 15 * 50
        elif avg_duration <= 60:
            session_quality = 50 + (avg_duration - 15) / 45 * 50
        else:
            session_quality = max(60, 100 - (avg_duration - 60) * 0.5)
        
        # Calculate base score
        base_score = (
            features.get('completion_rate', 0) * weights['completion_rate'] +
            focus_ratio_normalized * weights['focus_ratio'] +
            features.get('consistency_score', 0) * weights['consistency_score'] +
            session_quality * weights['session_quality']
        )
        
        # Apply overdue penalty (max 15% of total score)
        overdue_count = features.get('overdue_tasks', 0)
        total_tasks = features.get('total_tasks', 1)
        if total_tasks > 0 and overdue_count > 0:
            overdue_ratio = overdue_count / total_tasks
            overdue_penalty = min(15, overdue_ratio * 30)  # Max 15 point penalty
            base_score = base_score - overdue_penalty
        
        return min(100, max(0, round(base_score, 1)))
    
    def detect_best_focus_hours(self, hourly_data: list) -> str:
        """Detect the best focus window from hourly data"""
        if not hourly_data:
            return "09:00 AM - 11:30 AM"  # Default
        
        # Find peak productive hours
        sorted_hours = sorted(hourly_data, key=lambda x: x.get('productive', 0), reverse=True)
        
        if len(sorted_hours) >= 2:
            peak_hours = sorted_hours[:3]
            times = [h['time'] for h in peak_hours]
            
            # Parse hours and find range
            hours = []
            for t in times:
                try:
                    h = int(t.split(':')[0])
                    hours.append(h)
                except:
                    pass
            
            if hours:
                start_hour = min(hours)
                end_hour = max(hours) + 2
                
                start_str = f"{start_hour:02d}:00 {'AM' if start_hour < 12 else 'PM'}"
                end_str = f"{end_hour:02d}:00 {'AM' if end_hour < 12 else 'PM'}"
                
                return f"{start_str} - {end_str}"
        
        return "09:00 AM - 11:30 AM"
    
    def detect_distraction_triggers(self, hourly_data: list) -> str:
        """Detect common distraction triggers"""
        if not hourly_data:
            return "Social Media"
        
        # Find peak distraction hours
        sorted_hours = sorted(hourly_data, key=lambda x: x.get('distracted', 0), reverse=True)
        
        if sorted_hours:
            peak_hour = sorted_hours[0]['time']
            
            # Categorize by time of day
            try:
                hour = int(peak_hour.split(':')[0])
                if 8 <= hour <= 10:
                    return "Morning Emails / News"
                elif 12 <= hour <= 14:
                    return "Post-Lunch Social Media"
                elif 15 <= hour <= 17:
                    return "Afternoon Fatigue"
                elif hour >= 18:
                    return "Evening Entertainment"
                else:
                    return "Social Media"
            except:
                pass
        
        return "Social Media"
