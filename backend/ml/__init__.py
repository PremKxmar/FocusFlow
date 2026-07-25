"""
FocusFlow ML Engine
Machine Learning models for productivity prediction and forecasting

Core Models:
- ProductivityClassifier: Random Forest for Low/Medium/High classification
- TimeSeriesForecaster: Ensemble of LSTM, ARIMA, and Prophet
- LSTMForecaster: Deep learning for complex pattern recognition
- ARIMAForecaster: Statistical forecasting for trends and seasonality

Novel Research Models:
- SHAPExplainer: SHAP-based explainable AI for productivity classification
- DigitalFatigueIndex: Real-time cognitive fatigue scoring from behavioral signals
- ContextSwitchAnalyzer: Context-switch cost & attention residue modeling
- ProcrastinationDetector: Sequential pattern mining for procrastination triggers
- AdaptiveEnsembleOptimizer: Dynamic per-user ensemble weight adaptation
- MoodProductivityVAR: Bidirectional mood ↔ productivity VAR / Granger causality

NOTE: All imports are LAZY to avoid slow startup from TensorFlow/Prophet/statsmodels.
Use get_<model>() functions for cached singleton access.
"""

# ─── Lazy module-level imports ────────────────────────────────────────────────
# We do NOT import heavy modules at the top level.  Instead, each class is
# imported on first use through the accessor functions below.  This cuts the
# Flask startup time from ~10-15 s down to <1 s.

__all__ = [
    'DataProcessor',
    'ProductivityClassifier',
    'TimeSeriesForecaster',
    'LSTMForecaster',
    'ARIMAForecaster',
    'SHAPExplainer',
    'DigitalFatigueIndex',
    'ContextSwitchAnalyzer',
    'ProcrastinationDetector',
    'AdaptiveEnsembleOptimizer',
    'MoodProductivityVAR',
]

# ─── Singleton cache for model instances ──────────────────────────────────────
_instances = {}


def get_time_series_forecaster():
    """Return a cached TimeSeriesForecaster singleton (loads models once)."""
    if 'tsf' not in _instances:
        from .time_series_forecaster import TimeSeriesForecaster
        _instances['tsf'] = TimeSeriesForecaster()
    return _instances['tsf']


def get_productivity_classifier():
    """Return a cached ProductivityClassifier singleton."""
    if 'pc' not in _instances:
        from .productivity_classifier import ProductivityClassifier
        _instances['pc'] = ProductivityClassifier()
    return _instances['pc']


def get_shap_explainer():
    """Return a cached SHAPExplainer singleton."""
    if 'shap' not in _instances:
        from .shap_explainer import SHAPExplainer
        _instances['shap'] = SHAPExplainer()
    return _instances['shap']


def get_fatigue_index():
    """Return a cached DigitalFatigueIndex singleton."""
    if 'fatigue' not in _instances:
        from .fatigue_index import DigitalFatigueIndex
        _instances['fatigue'] = DigitalFatigueIndex()
    return _instances['fatigue']


def get_context_switch_analyzer():
    """Return a cached ContextSwitchAnalyzer singleton."""
    if 'ctx' not in _instances:
        from .context_switch import ContextSwitchAnalyzer
        _instances['ctx'] = ContextSwitchAnalyzer()
    return _instances['ctx']


def get_procrastination_detector():
    """Return a cached ProcrastinationDetector singleton."""
    if 'proc' not in _instances:
        from .procrastination_detector import ProcrastinationDetector
        _instances['proc'] = ProcrastinationDetector()
    return _instances['proc']


def get_adaptive_ensemble_optimizer():
    """Return a cached AdaptiveEnsembleOptimizer singleton."""
    if 'ensemble' not in _instances:
        from .adaptive_ensemble import AdaptiveEnsembleOptimizer
        _instances['ensemble'] = AdaptiveEnsembleOptimizer()
    return _instances['ensemble']


def get_mood_productivity_var():
    """Return a cached MoodProductivityVAR singleton."""
    if 'var' not in _instances:
        from .mood_productivity_var import MoodProductivityVAR
        _instances['var'] = MoodProductivityVAR()
    return _instances['var']


def reload_models():
    """Force all cached models to reload (e.g. after retraining)."""
    _instances.clear()
