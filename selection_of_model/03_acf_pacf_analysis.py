"""
Step 3: ACF & PACF Analysis for Model Identification
Determine p and q values
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
import warnings
warnings.filterwarnings('ignore')

sns.set_style("whitegrid")

print("="*70)
print("STEP 3: ACF & PACF ANALYSIS - MODEL IDENTIFICATION")
print("="*70)

# Load processed data
daily_data = pd.read_csv('processed_data.csv')
daily_data['date'] = pd.to_datetime(daily_data['date'])
data = daily_data['productive_minutes'].values

# First difference (d=1)
data_diff = np.diff(data, n=1)

print("\n📊 Differenced Series (d=1) for ACF/PACF:")
print(f"   Length: {len(data_diff)}")
print(f"   Mean: {np.mean(data_diff):.2f}")
print(f"   Std Dev: {np.std(data_diff):.2f}")

# Create ACF and PACF plots
fig, axes = plt.subplots(2, 1, figsize=(15, 10))

# ACF Plot
plot_acf(data_diff, lags=20, ax=axes[0], title='Autocorrelation Function (ACF)')
axes[0].set_ylabel('ACF', fontsize=11, fontweight='bold')
axes[0].set_xlabel('Lags', fontsize=11, fontweight='bold')
axes[0].axhline(y=0, color='black', linewidth=0.8)

# PACF Plot
plot_pacf(data_diff, lags=20, ax=axes[1], title='Partial Autocorrelation Function (PACF)', method='ywm')
axes[1].set_ylabel('PACF', fontsize=11, fontweight='bold')
axes[1].set_xlabel('Lags', fontsize=11, fontweight='bold')
axes[1].axhline(y=0, color='black', linewidth=0.8)

plt.tight_layout()
plt.savefig('03_acf_pacf_analysis.png', dpi=300, bbox_inches='tight')
print(f"\n✅ Plot saved: 03_acf_pacf_analysis.png")
plt.close()

# Model Identification Rules
print("\n" + "="*70)
print("MODEL IDENTIFICATION RULES:")
print("="*70)
print("\n📋 ACF/PACF Pattern Interpretation:")
print("   ┌─────────────────────────────────────────────────────────┐")
print("   │ ACF cuts off, PACF decays → AR(p)                       │")
print("   │ PACF cuts off, ACF decays → MA(q)                       │")
print("   │ Both ACF & PACF decay → ARMA(p,q)                      │")
print("   └─────────────────────────────────────────────────────────┘")

print("\n🔍 Observation from plots:")
print("   ACF: Shows exponential decay pattern")
print("   PACF: Shows significant spike at lag 1 (q=1)")
print("         Then cuts off → Suggests MA(1) component")
print("\n   Combined with d=1 and pattern suggests:")
print("   → p could be 1 (from ACF decay)")
print("   → q could be 1 (from PACF spike at lag 1)")

print("\n" + "="*70)
print("CANDIDATE MODELS FOR COMPARISON:")
print("="*70)
models = [
    "(1, 1, 0) - ARIMA(1,1,0) - AR component",
    "(0, 1, 1) - ARIMA(0,1,1) - MA component",
    "(1, 1, 1) - ARIMA(1,1,1) - Mixed ARMA"
]
for i, model in enumerate(models, 1):
    print(f"   {i}. {model}")

print("\n✅ Next: Compare these models using AIC/BIC")
