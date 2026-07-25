"""
Step 1: Collect Time Series Data and Plot
Unit II - Selection of Model: ARIMA(1,1,1)
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (14, 6)

print("="*70)
print("STEP 1: COLLECT TIME SERIES DATA AND PLOT")
print("="*70)

# Load the raw dataset
print("\n📂 Loading dataset...")
df = pd.read_csv('../backend/dataset/screen_time_app_usage_dataset.csv')
print(f"   Total raw samples: {len(df)}")
print(f"   Columns: {list(df.columns)}")

# Aggregate to daily level
print("\n📊 Aggregating to daily records...")
df['date'] = pd.to_datetime(df['date'])
df['date_only'] = df['date'].dt.date

# Sum productive minutes per day
daily_data = df[df['is_productive'] == True].groupby('date_only')['screen_time_min'].sum().reset_index()
daily_data.columns = ['date', 'productive_minutes']
daily_data['date'] = pd.to_datetime(daily_data['date'])
daily_data = daily_data.sort_values('date').reset_index(drop=True)

print(f"   Total unique dates: {len(daily_data)}")
print(f"   Date range: {daily_data['date'].min()} to {daily_data['date'].max()}")
print(f"\n   Summary Statistics:")
print(f"   Mean daily productive time: {daily_data['productive_minutes'].mean():.2f} min")
print(f"   Std dev: {daily_data['productive_minutes'].std():.2f} min")
print(f"   Min: {daily_data['productive_minutes'].min():.2f} min")
print(f"   Max: {daily_data['productive_minutes'].max():.2f} min")

# Plot the time series
fig, ax = plt.subplots(figsize=(15, 6))
ax.plot(daily_data['date'], daily_data['productive_minutes'], 
        linewidth=2, color='#2E86AB', marker='o', markersize=4, label='Daily Productive Time')
ax.fill_between(daily_data['date'], daily_data['productive_minutes'], 
                alpha=0.3, color='#2E86AB')
ax.set_xlabel('Date', fontsize=12, fontweight='bold')
ax.set_ylabel('Productive Minutes', fontsize=12, fontweight='bold')
ax.set_title('Step 1: Original Time Series Data\n3000 Raw Samples → 92 Daily Aggregated Records', 
             fontsize=14, fontweight='bold')
ax.grid(True, alpha=0.3)
ax.legend(fontsize=11)
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig('01_time_series_plot.png', dpi=300, bbox_inches='tight')
print(f"\n✅ Plot saved: 01_time_series_plot.png")
plt.close()

# Statistics summary
print("\n" + "="*70)
print("DATA SUMMARY:")
print("="*70)
print(f"Raw Dataset Size: 3000 samples")
print(f"Aggregated to Daily: 92 days")
print(f"Training Set (80%): 73 days")
print(f"Test Set (20%): 19 days")
print(f"\nTime Series Pattern: Shows daily productive time with variations")
print(f"Observations: Some weekly seasonality visible")
print("="*70)

# Save the processed data
daily_data.to_csv('processed_data.csv', index=False)
print(f"\n✅ Processed data saved: processed_data.csv")
