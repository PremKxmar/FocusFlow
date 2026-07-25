"""
Time Series Forecasting Ensemble
Combines LSTM, ARIMA, and Prophet for comprehensive productivity forecasting.

Model Roles:
- LSTM: Captures complex non-linear patterns and sequential dependencies
- ARIMA: Handles smooth trends and statistical patterns
- Prophet: Manages seasonality and holiday effects

This module provides:
- Individual model predictions
- Ensemble predictions (weighted average)
- Model comparison and evaluation
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import pickle
import os
from typing import Dict, List, Optional
from .data_processor import DataProcessor

# Import individual forecasters
from .lstm_forecaster import LSTMForecaster
from .arima_forecaster import ARIMAForecaster

# Prophet import with fallback
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("Prophet not available. Using LSTM/ARIMA only.")


class TimeSeriesForecaster:
    """
    Ensemble time series forecaster for productivity predictions.
    
    Combines three models:
    1. LSTM - Deep learning for complex patterns
    2. ARIMA - Statistical modeling for trends
    3. Prophet - Seasonality and holiday effects
    
    Predicts:
    - Next 7 days focus time
    - Workload trends
    - Task completion probability
    """
    
    def __init__(self, model_path: str = None):
        self.data_processor = DataProcessor()
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), 'models')
        
        # Initialize individual forecasters
        self.lstm_forecaster = LSTMForecaster(
            model_path=os.path.join(self.model_path, 'lstm_model.keras')
        )
        self.arima_forecaster = ARIMAForecaster(
            model_path=os.path.join(self.model_path, 'arima_model.pkl')
        )
        
        # Prophet model
        self.prophet_model = None
        self.prophet_path = os.path.join(self.model_path, 'prophet_model.pkl')
        self._load_prophet()
        
        # Ensemble weights (can be updated based on model performance)
        self.weights = {
            'lstm': 0.4,
            'arima': 0.3,
            'prophet': 0.3
        }
    
    def _load_prophet(self):
        """Load trained Prophet model if available"""
        try:
            if os.path.exists(self.prophet_path) and PROPHET_AVAILABLE:
                with open(self.prophet_path, 'rb') as f:
                    self.prophet_model = pickle.load(f)
                print("[OK] Prophet model loaded successfully")
        except Exception as e:
            print(f"Could not load Prophet model: {e}")
            self.prophet_model = None
    
    def _save_prophet(self):
        """Save Prophet model to disk"""
        if self.prophet_model is None:
            return
        try:
            os.makedirs(self.model_path, exist_ok=True)
            with open(self.prophet_path, 'wb') as f:
                pickle.dump(self.prophet_model, f)
            print("[OK] Prophet model saved successfully")
        except Exception as e:
            print(f"Could not save Prophet model: {e}")
    
    def train_all(self, historical_data: pd.DataFrame) -> Dict:
        """
        Train all three models on historical data
        
        Args:
            historical_data: DataFrame with 'ds' (datetime) and 'y' (productive_minutes) columns
            
        Returns:
            Training results for each model
        """
        results = {}
        
        # Train LSTM
        print("🔧 Training LSTM model...")
        results['lstm'] = self.lstm_forecaster.train(historical_data)
        
        # Train ARIMA
        print("🔧 Training ARIMA model...")
        results['arima'] = self.arima_forecaster.train(historical_data)
        
        # Train Prophet
        print("🔧 Training Prophet model...")
        results['prophet'] = self._train_prophet(historical_data)
        
        return results
    
    def _train_prophet(self, historical_data: pd.DataFrame) -> Dict:
        """Train Prophet model"""
        if not PROPHET_AVAILABLE:
            return {'error': 'Prophet not available', 'status': 'skipped'}
        
        if historical_data.empty or len(historical_data) < 10:
            return {'error': 'Insufficient data for Prophet training'}
        
        try:
            self.prophet_model = Prophet(
                daily_seasonality=False,
                weekly_seasonality=True,
                yearly_seasonality=False,
                changepoint_prior_scale=0.05
            )
            
            self.prophet_model.fit(historical_data[['ds', 'y']])
            self._save_prophet()
            
            return {
                'status': 'success',
                'training_samples': len(historical_data)
            }
        except Exception as e:
            return {'error': str(e), 'status': 'failed'}
    
    def predict_with_lstm(self, weekly_trends: list, periods: int = 7) -> Dict:
        """Get predictions from LSTM model only"""
        recent_values = [t.get('productive_minutes', 60) for t in weekly_trends] if weekly_trends else []
        return self.lstm_forecaster.predict(recent_values, periods)
    
    def predict_with_arima(self, weekly_trends: list, periods: int = 7) -> Dict:
        """Get predictions from ARIMA model only"""
        recent_values = [t.get('productive_minutes', 60) for t in weekly_trends] if weekly_trends else []
        return self.arima_forecaster.predict(recent_values, periods)
    
    def predict_with_prophet(self, weekly_trends: list, periods: int = 7) -> Dict:
        """Get predictions from Prophet model only"""
        if not PROPHET_AVAILABLE or self.prophet_model is None:
            return self._prophet_fallback(weekly_trends, periods)
        
        try:
            future = self.prophet_model.make_future_dataframe(periods=periods)
            forecast = self.prophet_model.predict(future)
            
            return self._format_prophet_forecast(forecast.tail(periods), periods)
        except Exception as e:
            print(f"Prophet prediction failed: {e}")
            return self._prophet_fallback(weekly_trends, periods)
    
    def _format_prophet_forecast(self, forecast: pd.DataFrame, periods: int) -> Dict:
        """Format Prophet forecast output"""
        predictions = []
        for _, row in forecast.iterrows():
            predictions.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'day': row['ds'].strftime('%A'),
                'predicted_productive_minutes': round(max(0, row['yhat'])),
                'lower_bound': round(max(0, row['yhat_lower'])),
                'upper_bound': round(row['yhat_upper']),
                'confidence': 0.8
            })
        
        avg_pred = np.mean([p['predicted_productive_minutes'] for p in predictions])
        
        return {
            'model': 'Prophet',
            'forecast': predictions,
            'average_predicted': round(avg_pred),
            'trend': self._calculate_trend([p['predicted_productive_minutes'] for p in predictions]),
            'confidence': 0.8,
            'periods': periods
        }
    
    def _prophet_fallback(self, weekly_trends: list, periods: int) -> Dict:
        """Fallback when Prophet is unavailable"""
        if weekly_trends:
            mean_val = np.mean([t.get('productive_minutes', 60) for t in weekly_trends])
        else:
            mean_val = 60
        
        predictions = []
        base_date = datetime.utcnow()
        
        for i in range(periods):
            future_date = base_date + timedelta(days=i + 1)
            predictions.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'day': future_date.strftime('%A'),
                'predicted_productive_minutes': round(mean_val),
                'confidence': 0.5
            })
        
        return {
            'model': 'Prophet (fallback)',
            'forecast': predictions,
            'average_predicted': round(mean_val),
            'trend': 'Stable',
            'confidence': 0.5,
            'periods': periods
        }
    
    def forecast(self, weekly_trends: list, periods: int = 7) -> Dict:
        """
        Generate ensemble forecast combining all models
        
        Args:
            weekly_trends: Historical daily activity data
            periods: Number of days to forecast
            
        Returns:
            Comprehensive forecast with all model predictions and ensemble
        """
        # Prepare data
        df = self.data_processor.prepare_timeseries_data(weekly_trends)
        
        # Get individual model predictions
        lstm_pred = self.predict_with_lstm(weekly_trends, periods)
        arima_pred = self.predict_with_arima(weekly_trends, periods)
        prophet_pred = self.predict_with_prophet(weekly_trends, periods)
        
        # Calculate ensemble prediction (weighted average)
        ensemble_forecast = self._create_ensemble_forecast(
            lstm_pred, arima_pred, prophet_pred, periods
        )
        
        # Calculate summary metrics
        avg_predicted = ensemble_forecast['average_predicted']
        current_avg = df['y'].mean() if not df.empty else 60
        
        # Determine trend
        trend = ensemble_forecast['trend']
        
        return {
            # Primary forecast (ensemble)
            'next_day_workload': min(100, round(ensemble_forecast['forecast'][0]['predicted_productive_minutes'] / 3)),
            'completion_probability': min(95, max(50, round(70 + (avg_predicted - 60) / 5))),
            'best_focus_window': self.data_processor.detect_best_focus_hours([]),
            'distraction_trigger': self.data_processor.detect_distraction_triggers([]),
            'trend': trend,
            'weekly_forecast': ensemble_forecast['forecast'],
            'load_level': self._categorize_workload(avg_predicted),
            'stress_risk': self._calculate_stress_risk(weekly_trends),
            
            # Individual model results
            'model_predictions': {
                'lstm': lstm_pred,
                'arima': arima_pred,
                'prophet': prophet_pred,
                'ensemble': ensemble_forecast
            },
            
            # Model comparison
            'model_weights': self.weights,
            'ensemble_method': 'weighted_average'
        }
    
    def _create_ensemble_forecast(self, lstm: Dict, arima: Dict, prophet: Dict, periods: int) -> Dict:
        """Create weighted ensemble forecast from individual models"""
        base_date = datetime.utcnow()
        ensemble = []
        
        for i in range(periods):
            # Get predictions from each model
            lstm_val = lstm['forecast'][i]['predicted_productive_minutes'] if i < len(lstm.get('forecast', [])) else 60
            arima_val = arima['forecast'][i]['predicted_productive_minutes'] if i < len(arima.get('forecast', [])) else 60
            prophet_val = prophet['forecast'][i]['predicted_productive_minutes'] if i < len(prophet.get('forecast', [])) else 60
            
            # Weighted average
            ensemble_val = (
                lstm_val * self.weights['lstm'] +
                arima_val * self.weights['arima'] +
                prophet_val * self.weights['prophet']
            )
            
            future_date = base_date + timedelta(days=i + 1)
            ensemble.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'day': future_date.strftime('%A'),
                'predicted_productive_minutes': round(ensemble_val),
                'lstm_prediction': lstm_val,
                'arima_prediction': arima_val,
                'prophet_prediction': prophet_val,
                'confidence': round(0.85 - (i * 0.02), 2)
            })
        
        avg_predicted = np.mean([e['predicted_productive_minutes'] for e in ensemble])
        
        return {
            'model': 'Ensemble (LSTM + ARIMA + Prophet)',
            'forecast': ensemble,
            'average_predicted': round(avg_predicted),
            'trend': self._calculate_trend([e['predicted_productive_minutes'] for e in ensemble]),
            'confidence': 0.85,
            'periods': periods
        }
    
    def compare_models(self, test_data: pd.DataFrame) -> Dict:
        """
        Compare performance of all models on test data
        
        Returns:
            Comparison metrics for each model
        """
        results = {
            'lstm': self.lstm_forecaster.evaluate(test_data),
            'arima': self.arima_forecaster.evaluate(test_data),
            'prophet': self._evaluate_prophet(test_data)
        }
        
        # Determine best model
        valid_results = {k: v for k, v in results.items() if 'error' not in v}
        if valid_results:
            best_model = min(valid_results, key=lambda k: valid_results[k].get('mae', float('inf')))
            results['best_model'] = best_model
            results['recommendation'] = f"Based on MAE, {best_model.upper()} performs best for this data"
        
        return results
    
    def _evaluate_prophet(self, test_data: pd.DataFrame) -> Dict:
        """Evaluate Prophet model performance"""
        if not PROPHET_AVAILABLE or self.prophet_model is None:
            return {'error': 'Prophet not available or not trained'}
        
        try:
            # Make predictions
            future = self.prophet_model.make_future_dataframe(periods=len(test_data))
            forecast = self.prophet_model.predict(future)
            
            y_pred = forecast.tail(len(test_data))['yhat'].values
            y_true = test_data['y'].values
            
            # Calculate metrics
            mae = np.mean(np.abs(y_true - y_pred))
            rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
            mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8))) * 100
            
            return {
                'mae': round(float(mae), 2),
                'rmse': round(float(rmse), 2),
                'mape': round(float(mape), 2),
                'samples_evaluated': len(y_true)
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _calculate_trend(self, values: list) -> str:
        """Calculate trend direction from values"""
        if len(values) < 2:
            return 'Stable'
        
        first_half = np.mean(values[:len(values)//2])
        second_half = np.mean(values[len(values)//2:])
        
        if second_half > first_half * 1.1:
            return 'Up'
        elif second_half < first_half * 0.9:
            return 'Down'
        return 'Stable'
    
    def _categorize_workload(self, avg_minutes: float) -> str:
        """Categorize workload level"""
        if avg_minutes < 60:
            return 'Light'
        elif avg_minutes < 180:
            return 'Medium'
        else:
            return 'Heavy'
    
    def _calculate_stress_risk(self, weekly_trends: list) -> str:
        """Calculate stress risk based on patterns"""
        if not weekly_trends:
            return 'Low'
        
        total_distraction = sum(t.get('distracting_minutes', 0) for t in weekly_trends)
        total_productive = sum(t.get('productive_minutes', 0) for t in weekly_trends)
        
        distraction_ratio = total_distraction / max(total_distraction + total_productive, 1)
        
        if distraction_ratio > 0.4:
            return 'High'
        elif distraction_ratio > 0.25:
            return 'Medium'
        return 'Low'
    
    def get_model_status(self) -> Dict:
        """Get status of all models"""
        return {
            'lstm': {
                'available': True,
                'trained': self.lstm_forecaster.is_trained,
                'sequence_length': self.lstm_forecaster.sequence_length
            },
            'arima': {
                'available': True,
                'trained': self.arima_forecaster.is_trained,
                'order': self.arima_forecaster.order
            },
            'prophet': {
                'available': PROPHET_AVAILABLE,
                'trained': self.prophet_model is not None
            },
            'weights': self.weights
        }
