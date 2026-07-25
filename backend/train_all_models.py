"""
Train all ML models (LSTM, ARIMA, Prophet) with the dataset
Saves in the correct format expected by the forecasters
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys
import pickle
import warnings
warnings.filterwarnings('ignore')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("🚀 FocusFlow ML MODEL TRAINING (v2)")
print("=" * 60)

# Load the dataset
dataset_path = 'dataset/screen_time_app_usage_dataset.csv'
print(f"\n📂 Loading dataset: {dataset_path}")

df = pd.read_csv(dataset_path)
print(f"   Loaded {len(df)} rows")

# Prepare time series data
print("\n📈 Preparing time series data...")
if 'date' in df.columns:
    df['date'] = pd.to_datetime(df['date'])
    df['date_only'] = df['date'].dt.date

# Find usage column
usage_col = None
for col in ['usage_minutes', 'duration_minutes', 'Usage_minutes', 'screen_time']:
    if col in df.columns:
        usage_col = col
        break

if usage_col:
    daily_data = df.groupby('date_only')[usage_col].sum().reset_index()
    daily_data.columns = ['ds', 'y']
else:
    daily_data = df.groupby('date_only').size().reset_index()
    daily_data.columns = ['ds', 'y']
    daily_data['y'] = daily_data['y'] * 10

daily_data['ds'] = pd.to_datetime(daily_data['ds'])
print(f"   Created {len(daily_data)} daily records")

train_size = int(len(daily_data) * 0.8)
train_data = daily_data[:train_size]

model_dir = 'ml/models'
os.makedirs(model_dir, exist_ok=True)

# ============ TRAIN LSTM ============
print("\n" + "=" * 60)
print("🧠 TRAINING LSTM MODEL")
print("=" * 60)

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from sklearn.preprocessing import MinMaxScaler
    
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(train_data[['y']])
    
    sequence_length = 7
    X, y = [], []
    for i in range(sequence_length, len(scaled_data)):
        X.append(scaled_data[i-sequence_length:i, 0])
        y.append(scaled_data[i, 0])
    
    X, y = np.array(X), np.array(y)
    X = X.reshape((X.shape[0], X.shape[1], 1))
    
    model = Sequential([
        LSTM(50, activation='relu', input_shape=(sequence_length, 1), return_sequences=True),
        Dropout(0.2),
        LSTM(50, activation='relu'),
        Dropout(0.2),
        Dense(25, activation='relu'),
        Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    
    print("   Training LSTM...")
    history = model.fit(X, y, epochs=50, batch_size=16, verbose=0, validation_split=0.1)
    
    # Save model
    model.save(f'{model_dir}/lstm_model.keras')
    
    # Save scaler using pickle (not joblib)
    with open(f'{model_dir}/lstm_scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
    
    print(f"   ✅ LSTM trained! Final loss: {history.history['loss'][-1]:.4f}")
    
except Exception as e:
    print(f"   ❌ LSTM training failed: {e}")

# ============ TRAIN ARIMA ============
print("\n" + "=" * 60)
print("📊 TRAINING ARIMA MODEL")
print("=" * 60)

try:
    from statsmodels.tsa.arima.model import ARIMA
    
    print("   Fitting ARIMA(1,1,1)...")
    arima_model = ARIMA(train_data['y'].values, order=(1, 1, 1))
    arima_result = arima_model.fit()
    
    # Save in the format expected by ARIMAForecaster
    with open(f'{model_dir}/arima_model.pkl', 'wb') as f:
        pickle.dump({
            'model_fit': arima_result,
            'order': (1, 1, 1),
            'seasonal_order': (1, 0, 1, 7),
            'training_data': train_data['y']
        }, f)
    
    print(f"   ✅ ARIMA trained! AIC: {arima_result.aic:.2f}")
    
except Exception as e:
    print(f"   ❌ ARIMA training failed: {e}")

# ============ TRAIN PROPHET ============
print("\n" + "=" * 60)
print("🔮 TRAINING PROPHET MODEL")
print("=" * 60)

try:
    from prophet import Prophet
    
    prophet_df = train_data[['ds', 'y']].copy()
    
    print("   Fitting Prophet...")
    prophet_model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05
    )
    prophet_model.fit(prophet_df)
    
    # Save using pickle
    with open(f'{model_dir}/prophet_model.pkl', 'wb') as f:
        pickle.dump(prophet_model, f)
    
    print(f"   ✅ Prophet trained!")
    
except Exception as e:
    print(f"   ❌ Prophet training failed: {e}")

print("\n" + "=" * 60)
print("✅ MODEL TRAINING COMPLETE!")
print("=" * 60)
print("\nRestart the backend to use the trained models.")
