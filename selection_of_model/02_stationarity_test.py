"""
Step 2: Check Stationarity (ADF & KPSS Tests)
If not stationary, difference the series
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.tsa.stattools import adfuller, kpss
import warnings
warnings.filterwarnings('ignore')

sns.set_style("whitegrid")

print("="*70)
print("STEP 2: CHECK STATIONARITY & DIFFERENCING")
print("="*70)

# Load processed data
daily_data = pd.read_csv('processed_data.csv')
daily_data['date'] = pd.to_datetime(daily_data['date'])
data = daily_data['productive_minutes'].values

print("\n📊 Original Time Series:")
print(f"   Mean: {np.mean(data):.2f}")
print(f"   Std Dev: {np.std(data):.2f}")

# ADF Test
print("\n🧪 Augmented Dickey-Fuller (ADF) Test:")
print("   H0: Series has unit root (NON-stationary)")
print("   H1: Series is stationary")
adf_result = adfuller(data, autolag='AIC')
print(f"   ADF Statistic: {adf_result[0]:.6f}")
print(f"   p-value: {adf_result[1]:.6f}")
print(f"   Critical Values:")
for key, value in adf_result[4].items():
    print(f"      {key}: {value:.3f}")

if adf_result[1] < 0.05:
    print(f"   ✅ Result: REJECT H0 → Series is STATIONARY (p < 0.05)")
    adf_stationary = True
else:
    print(f"   ❌ Result: FAIL TO REJECT H0 → Series is NON-STATIONARY (p >= 0.05)")
    adf_stationary = False

# KPSS Test
print("\n🧪 KPSS Test:")
print("   H0: Series is stationary")
print("   H1: Series has unit root (NON-stationary)")
kpss_result = kpss(data, regression='c', nlags='auto')
print(f"   KPSS Statistic: {kpss_result[0]:.6f}")
print(f"   p-value: {kpss_result[1]:.6f}")
print(f"   Critical Values:")
for key, value in kpss_result[3].items():
    print(f"      {key}: {value:.3f}")

if kpss_result[1] > 0.05:
    print(f"   ✅ Result: FAIL TO REJECT H0 → Series is STATIONARY (p > 0.05)")
    kpss_stationary = True
else:
    print(f"   ❌ Result: REJECT H0 → Series is NON-STATIONARY (p <= 0.05)")
    kpss_stationary = False

# Conclusion
print("\n📋 STATIONARITY CONCLUSION:")
if adf_stationary and kpss_stationary:
    print("   ✅ Series is STATIONARY (both tests agree)")
    d_value = 0
elif not adf_stationary and not kpss_stationary:
    print("   ❌ Series is NON-STATIONARY (both tests agree)")
    d_value = 1
else:
    print("   ⚠️  Series is TREND-STATIONARY (tests disagree)")
    d_value = 1

print(f"\n   → Differencing needed (d value): {d_value}")

# Apply differencing if needed
if d_value == 1:
    print("\n📉 Applying First-Order Differencing...")
    data_diff = np.diff(data, n=1)
    
    # Test differenced series
    print("\n   Differenced Series Statistics:")
    print(f"   Mean: {np.mean(data_diff):.2f}")
    print(f"   Std Dev: {np.std(data_diff):.2f}")
    
    adf_diff = adfuller(data_diff, autolag='AIC')
    print(f"\n   ADF Test on Differenced Series:")
    print(f"   ADF Statistic: {adf_diff[0]:.6f}")
    print(f"   p-value: {adf_diff[1]:.6f}")
    if adf_diff[1] < 0.05:
        print(f"   ✅ Differenced series is STATIONARY")
else:
    data_diff = data

# Plot comparison
fig, axes = plt.subplots(2, 1, figsize=(15, 10))

# Original series
axes[0].plot(daily_data['date'], data, linewidth=2, color='#2E86AB', marker='o', markersize=4)
axes[0].fill_between(daily_data['date'], data, alpha=0.3, color='#2E86AB')
axes[0].set_ylabel('Productive Minutes', fontsize=11, fontweight='bold')
axes[0].set_title('Original Time Series\nADF: NON-STATIONARY, KPSS: NON-STATIONARY → d=1', 
                  fontsize=12, fontweight='bold')
axes[0].grid(True, alpha=0.3)

# Differenced series
if d_value == 1:
    axes[1].plot(daily_data['date'].iloc[1:], data_diff, linewidth=2, color='#A23B72', marker='o', markersize=4)
    axes[1].fill_between(daily_data['date'].iloc[1:], data_diff, alpha=0.3, color='#A23B72')
    axes[1].set_title(f'First-Order Differenced Series (d=1)\nADF: STATIONARY → Ready for ARIMA', 
                     fontsize=12, fontweight='bold')
else:
    axes[1].plot(daily_data['date'], data, linewidth=2, color='#F18F01', marker='o', markersize=4)
    axes[1].set_title('Series is Already Stationary (d=0)', fontsize=12, fontweight='bold')

axes[1].set_xlabel('Date', fontsize=11, fontweight='bold')
axes[1].set_ylabel('Change in Productive Minutes', fontsize=11, fontweight='bold')
axes[1].grid(True, alpha=0.3)

plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig('02_stationarity_test.png', dpi=300, bbox_inches='tight')
print(f"\n✅ Plot saved: 02_stationarity_test.png")
plt.close()

print("\n" + "="*70)
print(f"CONCLUSION: d = {d_value}")
print("="*70)
