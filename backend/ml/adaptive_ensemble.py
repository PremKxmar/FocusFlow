"""
Adaptive Ensemble Weight Optimizer
Dynamically updates ensemble model weights based on per-user prediction error.

Novel Contribution:
- Existing ensemble (LSTM + ARIMA + Prophet) uses FIXED weights (0.4, 0.3, 0.3).
- This module tracks each model's prediction error per-user and updates weights
  using exponential smoothing (EWMA) of inverse errors.
- Personalized model selection: different users get different model blends.
- Provides model performance comparison and weight evolution history.

Algorithm:
  1. After each prediction day, compare predicted vs actual productive minutes.
  2. Compute error (MAE) for each model.
  3. Update weights using inverse-error exponential weighting:
       w_i = (1/err_i) / sum(1/err_j for all j)
  4. Apply smoothing factor α to avoid drastic weight changes:
       w_new = α * w_computed + (1-α) * w_old
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pickle
import os


class AdaptiveEnsembleOptimizer:
    """
    Tracks ensemble model performance and adapts weights per-user.
    """

    DEFAULT_WEIGHTS = {'lstm': 0.4, 'arima': 0.3, 'prophet': 0.3}
    SMOOTHING_FACTOR = 0.3  # α for EWMA (higher = faster adaptation)
    MIN_WEIGHT = 0.05  # Minimum weight for any model
    MODELS = ['lstm', 'arima', 'prophet']

    def __init__(self, storage_path: str = None):
        self.storage_path = storage_path or os.path.join(
            os.path.dirname(__file__), 'models', 'adaptive_weights.pkl'
        )
        self.user_weights = {}  # user_id -> current weights
        self.error_history = {}  # user_id -> list of {date, errors}
        self.weight_history = {}  # user_id -> list of {date, weights}
        self._load()

    def _load(self):
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, 'rb') as f:
                    data = pickle.load(f)
                    self.user_weights = data.get('user_weights', {})
                    self.error_history = data.get('error_history', {})
                    self.weight_history = data.get('weight_history', {})
        except Exception as e:
            print(f"[AdaptiveEnsemble] Could not load weights: {e}")

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, 'wb') as f:
                pickle.dump({
                    'user_weights': self.user_weights,
                    'error_history': self.error_history,
                    'weight_history': self.weight_history,
                }, f)
        except Exception as e:
            print(f"[AdaptiveEnsemble] Could not save weights: {e}")

    def get_weights(self, user_id: str) -> Dict[str, float]:
        """Get current ensemble weights for a user."""
        return self.user_weights.get(user_id, self.DEFAULT_WEIGHTS.copy())

    def update_weights(self, user_id: str, actual_value: float,
                       predictions: Dict[str, float]) -> Dict:
        """
        Update weights after observing actual vs predicted values.

        Args:
            user_id: User identifier
            actual_value: Actual productive minutes for the day
            predictions: {'lstm': predicted, 'arima': predicted, 'prophet': predicted}

        Returns:
            Updated weights and performance analysis
        """
        current_weights = self.get_weights(user_id)

        # Compute errors for each model
        errors = {}
        for model in self.MODELS:
            pred = predictions.get(model, actual_value)  # Default to actual if missing
            errors[model] = abs(actual_value - pred)

        # Store error history
        if user_id not in self.error_history:
            self.error_history[user_id] = []
        self.error_history[user_id].append({
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'actual': actual_value,
            'predictions': predictions,
            'errors': errors,
        })

        # Compute new weights using inverse-error weighting
        # Add small epsilon to avoid division by zero
        epsilon = 0.1
        inverse_errors = {m: 1.0 / (errors[m] + epsilon) for m in self.MODELS}
        total_inv = sum(inverse_errors.values())
        computed_weights = {m: inverse_errors[m] / total_inv for m in self.MODELS}

        # Apply EWMA smoothing
        new_weights = {}
        for m in self.MODELS:
            smoothed = (self.SMOOTHING_FACTOR * computed_weights[m] +
                        (1 - self.SMOOTHING_FACTOR) * current_weights.get(m, 0.33))
            new_weights[m] = max(self.MIN_WEIGHT, smoothed)

        # Normalize to sum to 1
        total = sum(new_weights.values())
        new_weights = {m: round(w / total, 4) for m, w in new_weights.items()}

        # Store
        self.user_weights[user_id] = new_weights
        if user_id not in self.weight_history:
            self.weight_history[user_id] = []
        self.weight_history[user_id].append({
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'weights': new_weights,
        })

        self._save()

        return {
            'previous_weights': current_weights,
            'new_weights': new_weights,
            'errors': errors,
            'best_model': min(errors, key=errors.get),
            'worst_model': max(errors, key=errors.get),
        }

    def get_performance_report(self, user_id: str) -> Dict:
        """
        Get a performance report for all models for a user.
        """
        history = self.error_history.get(user_id, [])
        current_weights = self.get_weights(user_id)

        if not history:
            return {
                'weights': current_weights,
                'total_updates': 0,
                'model_performance': {m: {'avg_error': 0, 'best_count': 0} for m in self.MODELS},
                'weight_evolution': [],
                'recommendation': 'Not enough data. Weights will adapt as predictions are compared to actual values.',
            }

        # Aggregate errors per model
        model_errors = {m: [] for m in self.MODELS}
        best_counts = {m: 0 for m in self.MODELS}

        for entry in history:
            errors = entry.get('errors', {})
            if errors:
                best_model = min(errors, key=errors.get)
                best_counts[best_model] += 1
                for m in self.MODELS:
                    if m in errors:
                        model_errors[m].append(errors[m])

        model_performance = {}
        for m in self.MODELS:
            errs = model_errors[m]
            model_performance[m] = {
                'avg_error': round(np.mean(errs), 2) if errs else 0,
                'std_error': round(np.std(errs), 2) if errs else 0,
                'max_error': round(max(errs), 2) if errs else 0,
                'min_error': round(min(errs), 2) if errs else 0,
                'best_count': best_counts[m],
                'current_weight': current_weights.get(m, 0.33),
            }

        best_model = max(best_counts, key=best_counts.get)
        recommendation = (
            f'{best_model.upper()} has been the most accurate model ({best_counts[best_model]} times best). '
            f'Current weight: {current_weights[best_model]:.1%}. '
            f'The ensemble adapts automatically — no manual tuning needed.'
        )

        weight_evolution = self.weight_history.get(user_id, [])[-14:]  # Last 14 entries

        return {
            'weights': current_weights,
            'total_updates': len(history),
            'model_performance': model_performance,
            'weight_evolution': weight_evolution,
            'best_model': best_model,
            'recommendation': recommendation,
        }

    def simulate_adaptation(self, weekly_trends: list, predictions_per_model: Dict[str, list]) -> Dict:
        """
        Simulate how weights would have adapted over the given historical data.
        Useful for demonstrating the adaptive mechanism.
        """
        simulated_weights = [self.DEFAULT_WEIGHTS.copy()]
        current = self.DEFAULT_WEIGHTS.copy()

        for i, day_data in enumerate(weekly_trends):
            actual = day_data.get('productive_minutes', 60)
            day_preds = {
                m: predictions_per_model.get(m, [60] * len(weekly_trends))[i]
                if i < len(predictions_per_model.get(m, []))
                else actual
                for m in self.MODELS
            }

            errors = {m: abs(actual - day_preds[m]) for m in self.MODELS}
            epsilon = 0.1
            inv_errors = {m: 1.0 / (errors[m] + epsilon) for m in self.MODELS}
            total_inv = sum(inv_errors.values())
            computed = {m: inv_errors[m] / total_inv for m in self.MODELS}

            for m in self.MODELS:
                current[m] = max(self.MIN_WEIGHT,
                                 self.SMOOTHING_FACTOR * computed[m] + (1 - self.SMOOTHING_FACTOR) * current[m])

            total = sum(current.values())
            current = {m: round(w / total, 4) for m, w in current.items()}
            simulated_weights.append(current.copy())

        return {
            'initial_weights': self.DEFAULT_WEIGHTS,
            'final_weights': current,
            'evolution': simulated_weights,
            'days_simulated': len(weekly_trends),
        }
