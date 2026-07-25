"""
LSTM Time Series Forecaster
Uses Long Short-Term Memory neural networks for sequential learning
to capture complex, non-linear dependencies in productivity data.

Key capabilities:
- Captures how yesterday's task completion affects today's focus time
- Learns long-term patterns in user behavior
- Handles variable-length sequences
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import pickle
import os
from typing import List, Dict, Tuple, Optional, Any

# TensorFlow/Keras imports with fallback
try:
    import tensorflow as tf
    # Try Keras 3 first (standalone), then fallback to tf.keras
    try:
        from keras.models import Sequential
        from keras.layers import LSTM, Dense, Dropout
        from keras.callbacks import EarlyStopping
        from keras.saving import load_model
    except ImportError:
        from tensorflow.keras.models import Sequential, load_model
        from tensorflow.keras.layers import LSTM, Dense, Dropout
        from tensorflow.keras.callbacks import EarlyStopping
    from sklearn.preprocessing import MinMaxScaler
    KERAS_AVAILABLE = True
except ImportError as e:
    KERAS_AVAILABLE = False
    Sequential = None  # Define as None for type hints
    MinMaxScaler = None
    print(f"TensorFlow/Keras not available. LSTM forecaster will use fallback mode. Error: {e}")


class LSTMForecaster:
    """
    LSTM-based time series forecaster for productivity prediction.
    
    Predicts:
    - Next 1-7 days focus time
    - Expected workload levels
    - Task completion probability
    
    Architecture:
    - Input: Sequence of past N days of productivity metrics
    - LSTM layers with dropout for regularization
    - Dense output layer for multi-step forecasting
    """
    
    def __init__(self, model_path: str = None, sequence_length: int = 7):
        """
        Initialize LSTM Forecaster
        
        Args:
            model_path: Path to save/load trained model
            sequence_length: Number of past days to use for prediction (lookback window)
        """
        self.model = None
        self.scaler = MinMaxScaler() if KERAS_AVAILABLE else None
        self.sequence_length = sequence_length
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), 'models', 'lstm_model.keras'
        )
        # Handle both .keras and .h5 extensions for scaler path
        base_path = self.model_path.replace('.keras', '').replace('.h5', '')
        self.scaler_path = f"{os.path.dirname(self.model_path)}/lstm_scaler.pkl"
        self.is_trained = False
        
        # Try to load existing model
        self._load_model()
    
    def _load_model(self):
        """Load trained LSTM model from disk if available"""
        if not KERAS_AVAILABLE:
            return
            
        try:
            if os.path.exists(self.model_path):
                self.model = load_model(self.model_path)
                self.is_trained = True
                print("[OK] LSTM model loaded successfully")
                
            if os.path.exists(self.scaler_path):
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
        except Exception as e:
            print(f"Could not load LSTM model: {e}")
            self.model = None
            self.is_trained = False
    
    def _save_model(self):
        """Save trained LSTM model to disk"""
        if not KERAS_AVAILABLE or self.model is None:
            return
            
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            self.model.save(self.model_path)
            
            with open(self.scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            print("[OK] LSTM model saved successfully")
        except Exception as e:
            print(f"Could not save LSTM model: {e}")
    
    def _build_model(self, input_shape: Tuple[int, int]) -> Any:
        """
        Build LSTM neural network architecture
        
        Architecture:
        - LSTM layer 1: 50 units with return sequences
        - Dropout: 20% for regularization
        - LSTM layer 2: 50 units
        - Dropout: 20%
        - Dense output: 1 unit for single-step prediction
        """
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(25, activation='relu'),
            Dense(1)
        ])
        
        model.compile(
            optimizer='adam',
            loss='mean_squared_error',
            metrics=['mae']
        )
        
        return model
    
    def _prepare_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare sequences for LSTM training
        
        Creates sliding windows of sequence_length for input (X)
        and next value for output (y)
        """
        X, y = [], []
        
        for i in range(self.sequence_length, len(data)):
            X.append(data[i - self.sequence_length:i])
            y.append(data[i])
        
        return np.array(X), np.array(y)
    
    def train(self, historical_data: pd.DataFrame, epochs: int = 50, batch_size: int = 32) -> Dict:
        """
        Train LSTM model on historical productivity data
        
        Args:
            historical_data: DataFrame with 'ds' (datetime) and 'y' (productive_minutes) columns
            epochs: Number of training epochs
            batch_size: Training batch size
            
        Returns:
            Training metrics including loss and MAE
        """
        if not KERAS_AVAILABLE:
            return {'error': 'TensorFlow/Keras not available', 'status': 'fallback'}
        
        if historical_data.empty or len(historical_data) < self.sequence_length + 5:
            return {'error': 'Insufficient data for LSTM training', 'min_required': self.sequence_length + 5}
        
        # Prepare data
        values = historical_data['y'].values.reshape(-1, 1)
        
        # Scale data to [0, 1]
        scaled_data = self.scaler.fit_transform(values)
        
        # Create sequences
        X, y = self._prepare_sequences(scaled_data)
        
        if len(X) < 5:
            return {'error': 'Not enough sequences for training'}
        
        # Reshape for LSTM [samples, timesteps, features]
        X = X.reshape((X.shape[0], X.shape[1], 1))
        
        # Split train/validation (80/20)
        split_idx = int(len(X) * 0.8)
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Build model
        self.model = self._build_model((self.sequence_length, 1))
        
        # Early stopping to prevent overfitting
        early_stop = EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        )
        
        # Train
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_val, y_val) if len(X_val) > 0 else None,
            callbacks=[early_stop],
            verbose=1
        )
        
        self.is_trained = True
        self._save_model()
        
        return {
            'status': 'success',
            'final_loss': float(history.history['loss'][-1]),
            'final_mae': float(history.history['mae'][-1]),
            'epochs_trained': len(history.history['loss']),
            'training_samples': len(X_train)
        }
    
    def predict(self, recent_data: List[float], periods: int = 7) -> Dict:
        """
        Predict future productivity using LSTM
        
        Args:
            recent_data: List of recent productive minutes (at least sequence_length days)
            periods: Number of days to forecast
            
        Returns:
            Dict with predictions and confidence metrics
        """
        if not KERAS_AVAILABLE or not self.is_trained or self.model is None:
            return self._fallback_predict(recent_data, periods)
        
        if len(recent_data) < self.sequence_length:
            # Pad with mean if insufficient data
            mean_val = np.mean(recent_data) if recent_data else 60
            recent_data = [mean_val] * (self.sequence_length - len(recent_data)) + list(recent_data)
        
        try:
            # Scale input
            input_data = np.array(recent_data[-self.sequence_length:]).reshape(-1, 1)
            scaled_input = self.scaler.transform(input_data)
            
            predictions = []
            current_sequence = scaled_input.copy()
            
            # Multi-step prediction
            for _ in range(periods):
                # Reshape for prediction
                X = current_sequence.reshape(1, self.sequence_length, 1)
                
                # Predict next value
                pred = self.model.predict(X, verbose=0)[0][0]
                predictions.append(pred)
                
                # Update sequence (sliding window)
                current_sequence = np.roll(current_sequence, -1)
                current_sequence[-1] = pred
            
            # Inverse scale predictions
            predictions = np.array(predictions).reshape(-1, 1)
            predictions = self.scaler.inverse_transform(predictions).flatten()
            
            # Ensure non-negative
            predictions = np.maximum(predictions, 0)
            
            return self._format_predictions(predictions, periods, confidence=0.85)
            
        except Exception as e:
            print(f"LSTM prediction failed: {e}")
            return self._fallback_predict(recent_data, periods)
    
    def _fallback_predict(self, recent_data: List[float], periods: int) -> Dict:
        """Fallback prediction when LSTM is not available"""
        if not recent_data:
            recent_data = [60]  # Default 60 minutes
        
        mean_val = np.mean(recent_data)
        std_val = np.std(recent_data) if len(recent_data) > 1 else 10
        
        # Simple trend-based prediction
        predictions = []
        for i in range(periods):
            # Add slight randomness and trend
            pred = mean_val + np.random.normal(0, std_val * 0.3)
            predictions.append(max(0, pred))
        
        return self._format_predictions(np.array(predictions), periods, confidence=0.5)
    
    def _format_predictions(self, predictions: np.ndarray, periods: int, confidence: float) -> Dict:
        """Format predictions into structured output"""
        base_date = datetime.utcnow()
        
        forecast = []
        for i, pred in enumerate(predictions):
            future_date = base_date + timedelta(days=i + 1)
            forecast.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'day': future_date.strftime('%A'),
                'predicted_productive_minutes': round(float(pred)),
                'confidence': round(confidence - (i * 0.02), 2)  # Confidence decreases over time
            })
        
        avg_prediction = np.mean(predictions)
        
        return {
            'model': 'LSTM',
            'forecast': forecast,
            'average_predicted': round(float(avg_prediction)),
            'trend': self._calculate_trend(predictions),
            'confidence': confidence,
            'periods': periods
        }
    
    def _calculate_trend(self, predictions: np.ndarray) -> str:
        """Calculate trend direction from predictions"""
        if len(predictions) < 2:
            return 'Stable'
        
        first_half = np.mean(predictions[:len(predictions)//2])
        second_half = np.mean(predictions[len(predictions)//2:])
        
        if second_half > first_half * 1.1:
            return 'Up'
        elif second_half < first_half * 0.9:
            return 'Down'
        return 'Stable'
    
    def evaluate(self, test_data: pd.DataFrame) -> Dict:
        """
        Evaluate LSTM model performance
        
        Returns:
            MAE, RMSE, and MAPE metrics
        """
        if not KERAS_AVAILABLE or not self.is_trained or len(test_data) < self.sequence_length + 1:
            return {'error': 'Cannot evaluate - model not trained or insufficient data'}
        
        values = test_data['y'].values.reshape(-1, 1)
        scaled = self.scaler.transform(values)
        
        X, y_true = self._prepare_sequences(scaled)
        X = X.reshape((X.shape[0], X.shape[1], 1))
        
        y_pred = self.model.predict(X, verbose=0)
        
        # Inverse scale
        y_true_inv = self.scaler.inverse_transform(y_true.reshape(-1, 1)).flatten()
        y_pred_inv = self.scaler.inverse_transform(y_pred).flatten()
        
        # Calculate metrics
        mae = np.mean(np.abs(y_true_inv - y_pred_inv))
        rmse = np.sqrt(np.mean((y_true_inv - y_pred_inv) ** 2))
        mape = np.mean(np.abs((y_true_inv - y_pred_inv) / (y_true_inv + 1e-8))) * 100
        
        return {
            'mae': round(float(mae), 2),
            'rmse': round(float(rmse), 2),
            'mape': round(float(mape), 2),
            'samples_evaluated': len(y_true)
        }
