"""
ML Model Training Script
Trains LSTM, ARIMA, and Prophet models on the screen time dataset
"""
import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime

# Fix encoding for Windows console
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.lstm_forecaster import LSTMForecaster
from ml.arima_forecaster import ARIMAForecaster
from ml.time_series_forecaster import TimeSeriesForecaster

def load_dataset():
    """Load and preprocess the screen time dataset"""
    dataset_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                 'dataset', 'screen_time_app_usage_dataset.csv')
    
    print(f"[INFO] Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    
    print(f"[INFO] Dataset shape: {df.shape}")
    print(f"[INFO] Columns: {list(df.columns)}")
    
    return df

def prepare_timeseries_data(df):
    """
    Prepare time series data for model training
    Aggregates daily productive time per user
    """
    # Parse date column
    df['date'] = pd.to_datetime(df['date'])
    df['date_only'] = df['date'].dt.date
    
    # Filter productive apps and aggregate daily
    productive_df = df[df['is_productive'] == True].copy()
    
    # Aggregate daily productive time
    daily_productive = productive_df.groupby('date_only').agg({
        'screen_time_min': 'sum'
    }).reset_index()
    
    daily_productive.columns = ['ds', 'y']
    daily_productive['ds'] = pd.to_datetime(daily_productive['ds'])
    
    # Sort by date
    daily_productive = daily_productive.sort_values('ds').reset_index(drop=True)
    
    print(f"\n[INFO] Prepared time series data:")
    print(f"   - Date range: {daily_productive['ds'].min()} to {daily_productive['ds'].max()}")
    print(f"   - Total days: {len(daily_productive)}")
    print(f"   - Avg productive minutes/day: {daily_productive['y'].mean():.2f}")
    
    return daily_productive

def train_all_models(timeseries_df):
    """Train all three models"""
    results = {}
    models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    os.makedirs(models_dir, exist_ok=True)
    
    # Split data: 80% train, 20% test
    split_idx = int(len(timeseries_df) * 0.8)
    train_data = timeseries_df[:split_idx].copy()
    test_data = timeseries_df[split_idx:].copy()
    
    print(f"\n[INFO] Data split: {len(train_data)} train, {len(test_data)} test samples")
    
    # 1. Train LSTM
    print("\n" + "="*50)
    print("[TRAINING] LSTM Model...")
    print("="*50)
    try:
        lstm = LSTMForecaster(
            model_path=os.path.join(models_dir, 'lstm_forecaster.h5'),
            sequence_length=7
        )
        lstm_result = lstm.train(train_data, epochs=50, batch_size=32)
        results['lstm'] = lstm_result
        print(f"[SUCCESS] LSTM Training Result: {lstm_result}")
        
        # Evaluate
        if lstm.is_trained:
            eval_result = lstm.evaluate(test_data)
            results['lstm_eval'] = eval_result
            print(f"[EVAL] LSTM Evaluation: {eval_result}")
    except Exception as e:
        print(f"[ERROR] LSTM training failed: {e}")
        results['lstm'] = {'error': str(e), 'status': 'fallback_mode'}
    
    # 2. Train ARIMA
    print("\n" + "="*50)
    print("[TRAINING] ARIMA Model...")
    print("="*50)
    try:
        arima = ARIMAForecaster(
            model_path=os.path.join(models_dir, 'arima_model.pkl')
        )
        arima_result = arima.train(train_data)
        results['arima'] = arima_result
        print(f"[SUCCESS] ARIMA Training Result: {arima_result}")
        
        # Evaluate
        if arima.is_trained:
            eval_result = arima.evaluate(test_data)
            results['arima_eval'] = eval_result
            print(f"[EVAL] ARIMA Evaluation: {eval_result}")
    except Exception as e:
        print(f"[ERROR] ARIMA training failed: {e}")
        results['arima'] = {'error': str(e)}
    
    # 3. Train Prophet
    print("\n" + "="*50)
    print("[TRAINING] Prophet Model...")
    print("="*50)
    try:
        forecaster = TimeSeriesForecaster(model_path=models_dir)
        prophet_result = forecaster._train_prophet(train_data)
        results['prophet'] = prophet_result
        print(f"[SUCCESS] Prophet Training Result: {prophet_result}")
        
        # Evaluate
        if forecaster.prophet_model is not None:
            eval_result = forecaster._evaluate_prophet(test_data)
            results['prophet_eval'] = eval_result
            print(f"[EVAL] Prophet Evaluation: {eval_result}")
    except Exception as e:
        print(f"[ERROR] Prophet training failed: {e}")
        results['prophet'] = {'error': str(e)}
    
    return results

def print_summary(results):
    """Print training summary"""
    print("\n" + "="*60)
    print("TRAINING SUMMARY")
    print("="*60)
    
    for model in ['lstm', 'arima', 'prophet']:
        print(f"\n{model.upper()}:")
        if model in results:
            train_result = results[model]
            if 'error' in train_result:
                print(f"  [X] Training failed: {train_result['error']}")
            else:
                print(f"  [OK] Training: {train_result.get('status', 'completed')}")
                
        eval_key = f'{model}_eval'
        if eval_key in results:
            eval_result = results[eval_key]
            if 'error' not in eval_result:
                print(f"  [METRICS] MAE: {eval_result.get('mae', 'N/A')}")
                print(f"  [METRICS] RMSE: {eval_result.get('rmse', 'N/A')}")
                print(f"  [METRICS] MAPE: {eval_result.get('mape', 'N/A')}%")
    
    print("\n" + "="*60)
    print("[COMPLETE] Models saved to backend/ml/saved_models/")
    print("="*60)

def main():
    print("\n" + "FocusFlow ML Model Training Script")
    print("="*60)
    
    # Load dataset
    df = load_dataset()
    
    # Prepare time series data
    ts_data = prepare_timeseries_data(df)
    
    # Train all models
    results = train_all_models(ts_data)
    
    # Print summary
    print_summary(results)
    
    return results

if __name__ == "__main__":
    main()
