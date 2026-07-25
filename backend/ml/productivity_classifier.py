"""
Productivity Classification Model
Uses Random Forest to classify productivity level (Low/Medium/High)
"""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import os
from .data_processor import DataProcessor

class ProductivityClassifier:
    """
    Random Forest classifier for productivity level prediction
    
    Output classes:
    - Low: User is underperforming
    - Medium: Average productivity
    - High: Excellent productivity
    """
    
    def __init__(self, model_path: str = None):
        self.model = None
        self.scaler = StandardScaler()
        self.data_processor = DataProcessor()
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), 'models', 'productivity_classifier.pkl')
        self.feature_names = [
            'tasks_completed', 'completion_rate', 'productive_time',
            'distraction_time', 'focus_sessions', 'avg_session_duration',
            'consistency_score', 'focus_ratio'
        ]
        
        # Try to load existing model
        self._load_model()
    
    def _load_model(self):
        """Load trained model from disk if available"""
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    data = pickle.load(f)
                    self.model = data['model']
                    self.scaler = data['scaler']
        except Exception as e:
            print(f"Could not load classifier model: {e}")
            self.model = None
    
    def _save_model(self):
        """Save trained model to disk"""
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            with open(self.model_path, 'wb') as f:
                pickle.dump({
                    'model': self.model,
                    'scaler': self.scaler
                }, f)
        except Exception as e:
            print(f"Could not save classifier model: {e}")
    
    def train(self, X: np.ndarray, y: np.ndarray):
        """
        Train the classifier
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y: Labels (Low=0, Medium=1, High=2)
        """
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train Random Forest
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42
        )
        self.model.fit(X_scaled, y)
        
        # Save model
        self._save_model()
    
    def predict(self, weekly_trends: list, task_stats: dict, focus_stats: dict) -> str:
        """
        Predict productivity level
        
        Args:
            weekly_trends: List of daily activity summaries
            task_stats: Task statistics dict
            focus_stats: Focus session statistics dict
            
        Returns:
            Productivity level: 'Low', 'Medium', or 'High'
        """
        # Prepare features
        features = self.data_processor.prepare_classification_features(
            weekly_trends, task_stats, focus_stats
        )
        
        # If no trained model, use rule-based classification
        if self.model is None:
            return self._rule_based_classify(features)
        
        # Create feature vector
        X = np.array([[features[name] for name in self.feature_names]])
        
        try:
            X_scaled = self.scaler.transform(X)
            prediction = self.model.predict(X_scaled)[0]
            
            labels = ['Low', 'Medium', 'High']
            return labels[prediction]
        except Exception as e:
            print(f"Prediction failed: {e}")
            return self._rule_based_classify(features)
    
    def predict_proba(self, weekly_trends: list, task_stats: dict, focus_stats: dict) -> dict:
        """
        Get probability distribution for each class
        
        Returns:
            Dict with probabilities for each class
        """
        features = self.data_processor.prepare_classification_features(
            weekly_trends, task_stats, focus_stats
        )
        
        if self.model is None:
            # Use rule-based probabilities
            score = self.data_processor.calculate_productivity_score(features)
            if score < 40:
                return {'Low': 0.7, 'Medium': 0.25, 'High': 0.05}
            elif score < 70:
                return {'Low': 0.2, 'Medium': 0.6, 'High': 0.2}
            else:
                return {'Low': 0.05, 'Medium': 0.25, 'High': 0.7}
        
        X = np.array([[features[name] for name in self.feature_names]])
        
        try:
            X_scaled = self.scaler.transform(X)
            probas = self.model.predict_proba(X_scaled)[0]
            
            return {
                'Low': round(probas[0], 2),
                'Medium': round(probas[1], 2),
                'High': round(probas[2], 2)
            }
        except Exception as e:
            print(f"Probability prediction failed: {e}")
            return {'Low': 0.33, 'Medium': 0.34, 'High': 0.33}
    
    def _rule_based_classify(self, features: dict) -> str:
        """
        Rule-based fallback classification when no trained model available
        """
        score = self.data_processor.calculate_productivity_score(features)
        
        if score < 40:
            return 'Low'
        elif score < 70:
            return 'Medium'
        else:
            return 'High'
    
    def get_feature_importance(self) -> dict:
        """Get feature importance from trained model"""
        if self.model is None:
            return {name: 1/len(self.feature_names) for name in self.feature_names}
        
        importances = self.model.feature_importances_
        return {
            name: round(imp, 3)
            for name, imp in zip(self.feature_names, importances)
        }
