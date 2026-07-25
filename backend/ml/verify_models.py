"""
Verify that trained models are loaded correctly
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.time_series_forecaster import TimeSeriesForecaster

def verify_models():
    print("\n" + "="*60)
    print("MODEL VERIFICATION")
    print("="*60)
    
    # Check saved model files
    saved_models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    print(f"\nSaved Models Directory: {saved_models_dir}")
    
    if os.path.exists(saved_models_dir):
        files = os.listdir(saved_models_dir)
        print(f"Files found: {len(files)}")
        for f in files:
            size = os.path.getsize(os.path.join(saved_models_dir, f))
            print(f"  - {f} ({size:,} bytes)")
    else:
        print("  [ERROR] saved_models directory not found!")
        return
    
    # Load forecaster and check status
    print("\n" + "-"*60)
    print("Loading TimeSeriesForecaster...")
    print("-"*60)
    
    forecaster = TimeSeriesForecaster()
    status = forecaster.get_model_status()
    
    print(f"\nLSTM:")
    print(f"  - Trained: {status['lstm']['trained']}")
    print(f"  - Available: {status['lstm']['available']}")
    
    print(f"\nARIMA:")
    print(f"  - Trained: {status['arima']['trained']}")
    print(f"  - Available: {status['arima']['available']}")
    print(f"  - Order: {status['arima'].get('order', 'N/A')}")
    
    print(f"\nProphet:")
    print(f"  - Trained: {status['prophet']['trained']}")
    print(f"  - Available: {status['prophet']['available']}")
    
    print(f"\nEnsemble Weights: {status['weights']}")
    
    # Test a prediction
    print("\n" + "-"*60)
    print("Testing Predictions...")
    print("-"*60)
    
    # Sample weekly trends for testing
    sample_trends = [
        {'productive_minutes': 180, 'distracting_minutes': 60},
        {'productive_minutes': 200, 'distracting_minutes': 50},
        {'productive_minutes': 150, 'distracting_minutes': 80},
        {'productive_minutes': 220, 'distracting_minutes': 40},
        {'productive_minutes': 190, 'distracting_minutes': 55},
        {'productive_minutes': 100, 'distracting_minutes': 90},
        {'productive_minutes': 80, 'distracting_minutes': 100},
    ]
    
    full_forecast = forecaster.forecast(sample_trends, periods=3)
    
    print(f"\n3-Day Forecast:")
    if 'weekly_forecast' in full_forecast:
        for day in full_forecast['weekly_forecast'][:3]:
            print(f"  {day.get('day', 'N/A')}: {day.get('predicted_productive_minutes', 'N/A')} min")
    
    print(f"\nModel Predictions Used:")
    mp = full_forecast.get('model_predictions', {})
    print(f"  - LSTM: {mp.get('lstm', {}).get('model', 'N/A')}")
    print(f"  - ARIMA: {mp.get('arima', {}).get('model', 'N/A')}")
    print(f"  - Prophet: {mp.get('prophet', {}).get('model', 'N/A')}")
    
    print("\n" + "="*60)
    print("VERIFICATION COMPLETE")
    print("="*60)

if __name__ == "__main__":
    verify_models()
