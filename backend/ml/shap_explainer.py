"""
SHAP Explainable AI Module
Provides feature-level explanations for productivity classification using
SHapley Additive exPlanations (SHAP).

Novel Contribution:
- No existing productivity app provides explainable AI for its recommendations.
- SHAP values show EXACTLY which features drove a prediction (e.g., "Your productivity
  dropped because distraction_time increased 40% and focus_sessions decreased by 2").
- Uses TreeExplainer for Random Forest (exact Shapley values, not approximations).

Reference:
  Lundberg & Lee (2017). "A Unified Approach to Interpreting Model Predictions." NeurIPS.
"""
import numpy as np
import os
import pickle
from typing import Dict, List, Optional

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("[WARN] SHAP not installed. Run: pip install shap")

from .data_processor import DataProcessor


class SHAPExplainer:
    """
    Generates SHAP-based explanations for productivity predictions.

    Pipeline:
    1. Load the trained RandomForest from ProductivityClassifier
    2. Compute SHAP values for the current user's feature vector
    3. Return per-feature contribution to the predicted class
    4. Generate natural-language explanations
    """

    FEATURE_LABELS = {
        'tasks_completed': 'Tasks Completed',
        'completion_rate': 'Task Completion Rate (%)',
        'productive_time': 'Productive Time (min)',
        'distraction_time': 'Distraction Time (min)',
        'focus_sessions': 'Focus Sessions',
        'avg_session_duration': 'Avg Session Duration (min)',
        'consistency_score': 'Consistency Score (%)',
        'focus_ratio': 'Focus Ratio',
    }

    CLASS_LABELS = ['Low', 'Medium', 'High']

    def __init__(self):
        self.data_processor = DataProcessor()
        self.model = None
        self.scaler = None
        self.explainer = None
        self._load_classifier()

    def _load_classifier(self):
        """Load the trained classifier and create SHAP explainer."""
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'productivity_classifier.pkl')
        try:
            if os.path.exists(model_path):
                with open(model_path, 'rb') as f:
                    data = pickle.load(f)
                    self.model = data['model']
                    self.scaler = data['scaler']
                if SHAP_AVAILABLE and self.model is not None:
                    self.explainer = shap.TreeExplainer(self.model)
        except Exception as e:
            print(f"[SHAP] Could not load classifier: {e}")

    def explain(self, weekly_trends: list, task_stats: dict, focus_stats: dict) -> Dict:
        """
        Generate SHAP explanation for a productivity prediction.

        Returns:
            {
                'prediction': 'High',
                'probabilities': {'Low': 0.05, 'Medium': 0.25, 'High': 0.70},
                'feature_contributions': [
                    {'feature': 'Productive Time (min)', 'value': 250, 'impact': 0.32, 'direction': 'positive'},
                    ...
                ],
                'top_positive': [...],
                'top_negative': [...],
                'explanation_text': 'Your productivity is High because ...',
                'shap_available': True
            }
        """
        features = self.data_processor.prepare_classification_features(
            weekly_trends, task_stats, focus_stats
        )

        feature_names = list(self.FEATURE_LABELS.keys())
        X = np.array([[features.get(name, 0) for name in feature_names]])

        # If no trained model, use rule-based with synthetic explanations
        if self.model is None or not SHAP_AVAILABLE or self.explainer is None:
            return self._rule_based_explain(features, feature_names, X)

        try:
            X_scaled = self.scaler.transform(X)
            prediction = self.model.predict(X_scaled)[0]
            probas = self.model.predict_proba(X_scaled)[0]

            # SHAP values — shape: (1, n_features, n_classes) for multi-class
            shap_values = self.explainer.shap_values(X_scaled)

            # For the predicted class, get SHAP values
            pred_class = int(prediction)
            if isinstance(shap_values, list):
                # Multi-output: list of arrays per class
                sv = shap_values[pred_class][0]
            else:
                # Single array with shape (1, features, classes)
                sv = shap_values[0, :, pred_class] if shap_values.ndim == 3 else shap_values[0]

            contributions = []
            for i, name in enumerate(feature_names):
                contributions.append({
                    'feature': self.FEATURE_LABELS.get(name, name),
                    'raw_feature': name,
                    'value': round(float(X[0][i]), 2),
                    'shap_value': round(float(sv[i]), 4),
                    'impact': round(abs(float(sv[i])), 4),
                    'direction': 'positive' if sv[i] > 0 else 'negative',
                })

            contributions.sort(key=lambda c: c['impact'], reverse=True)

            top_positive = [c for c in contributions if c['direction'] == 'positive'][:3]
            top_negative = [c for c in contributions if c['direction'] == 'negative'][:3]

            explanation = self._generate_explanation_text(
                self.CLASS_LABELS[pred_class], top_positive, top_negative
            )

            return {
                'prediction': self.CLASS_LABELS[pred_class],
                'probabilities': {
                    self.CLASS_LABELS[i]: round(float(probas[i]), 3) for i in range(len(probas))
                },
                'feature_contributions': contributions,
                'top_positive': top_positive,
                'top_negative': top_negative,
                'explanation_text': explanation,
                'shap_available': True,
                'base_value': round(float(self.explainer.expected_value[pred_class]
                                         if isinstance(self.explainer.expected_value, (list, np.ndarray))
                                         else self.explainer.expected_value), 4),
            }

        except Exception as e:
            print(f"[SHAP] Explanation failed: {e}")
            return self._rule_based_explain(features, feature_names, X)

    def _rule_based_explain(self, features: dict, feature_names: list, X: np.ndarray) -> Dict:
        """Fallback when SHAP or model is not available — uses heuristic importance."""
        score = self.data_processor.calculate_productivity_score(features)
        if score >= 70:
            pred = 'High'
        elif score >= 40:
            pred = 'Medium'
        else:
            pred = 'Low'

        # Heuristic feature importance
        importance_weights = {
            'productive_time': 0.25, 'distraction_time': -0.20, 'focus_ratio': 0.20,
            'focus_sessions': 0.12, 'consistency_score': 0.10, 'avg_session_duration': 0.08,
            'completion_rate': 0.08, 'tasks_completed': 0.05,
        }

        contributions = []
        for i, name in enumerate(feature_names):
            w = importance_weights.get(name, 0.05)
            val = float(X[0][i])
            # Simple directional impact
            impact = abs(w) * (val / max(val, 1))
            contributions.append({
                'feature': self.FEATURE_LABELS.get(name, name),
                'raw_feature': name,
                'value': round(val, 2),
                'shap_value': round(w * val / 100, 4),
                'impact': round(abs(impact), 4),
                'direction': 'positive' if w > 0 else 'negative',
            })

        contributions.sort(key=lambda c: c['impact'], reverse=True)
        top_positive = [c for c in contributions if c['direction'] == 'positive'][:3]
        top_negative = [c for c in contributions if c['direction'] == 'negative'][:3]

        explanation = self._generate_explanation_text(pred, top_positive, top_negative)

        return {
            'prediction': pred,
            'probabilities': {'Low': 0.15, 'Medium': 0.35, 'High': 0.50} if pred == 'High'
                             else {'Low': 0.20, 'Medium': 0.55, 'High': 0.25} if pred == 'Medium'
                             else {'Low': 0.60, 'Medium': 0.30, 'High': 0.10},
            'feature_contributions': contributions,
            'top_positive': top_positive,
            'top_negative': top_negative,
            'explanation_text': explanation,
            'shap_available': False,
            'base_value': 0.33,
        }

    def _generate_explanation_text(self, prediction: str, positives: list, negatives: list) -> str:
        """Generate human-readable explanation."""
        parts = [f"Your productivity is classified as **{prediction}**."]

        if positives:
            boosters = ', '.join([f"{p['feature']} ({p['value']})" for p in positives])
            parts.append(f"Key boosters: {boosters}.")

        if negatives:
            drags = ', '.join([f"{n['feature']} ({n['value']})" for n in negatives])
            parts.append(f"Factors dragging you down: {drags}.")

        if prediction == 'Low':
            parts.append("Try increasing focus sessions and reducing distraction time.")
        elif prediction == 'Medium':
            parts.append("You're on track — focus on consistency to reach High.")

        return ' '.join(parts)
