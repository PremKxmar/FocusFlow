/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { 
  Zap, 
  Target, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  CheckCircle2,
  Settings,
  BrainCircuit,
  Eye,
  Bell,
  BarChart3,
  Shield
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [style, setStyle] = useState<'Balanced' | 'High-focus' | 'Flexible'>('Balanced');
  
  // Consent toggles
  const [consentScreenTime, setConsentScreenTime] = useState(true);
  const [consentAppCategorization, setConsentAppCategorization] = useState(true);
  const [consentNotifications, setConsentNotifications] = useState(true);
  const [consentAnalytics, setConsentAnalytics] = useState(true);

  const nextStep = () => {
    if (step === 3) {
      // Save consent preferences before moving on
      localStorage.setItem('FocusFlow_tracking_enabled', String(consentScreenTime));
      localStorage.setItem('FocusFlow_activity_visible', String(consentAppCategorization));
      localStorage.setItem('FocusFlow_notif_enabled', String(consentNotifications));
      localStorage.setItem('FocusFlow_analytics_consent', String(consentAnalytics));
      localStorage.setItem('FocusFlow_consent_given', 'true');
      localStorage.setItem('FocusFlow_consent_date', new Date().toISOString());
    }
    if (step < 4) setStep(step + 1);
    else onComplete();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 mb-8">
                <Zap className="w-12 h-12 fill-current" />
              </div>
              <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-4">Welcome to FocusFlow</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                The intelligent productivity system that learns your patterns to help you reach peak performance.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
               <FeatureItem icon={<BrainCircuit className="text-indigo-500" />} text="ML-Based Productivity Forecasting" />
               <FeatureItem icon={<Target className="text-emerald-500" />} text="Deep Work Focused Task Manager" />
               <FeatureItem icon={<ShieldCheck className="text-rose-500" />} text="Distraction Blocking Protocols" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center">
              <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-4">Choose Your Style</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                How do you prefer to tackle your daily tasks?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {(['Balanced', 'High-focus', 'Flexible'] as const).map(s => (
                <button 
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left ${
                    style === s ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${style === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {s === 'Balanced' ? <Clock className="w-5 h-5" /> : s === 'High-focus' ? <Zap className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{s}</h4>
                    <p className="text-xs text-slate-500">Best for {s === 'Balanced' ? 'steady daily progress' : s === 'High-focus' ? 'intense deep work blocks' : 'dynamic schedules'}.</p>
                  </div>
                  {style === s && <CheckCircle2 className="ml-auto w-6 h-6 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center">
              <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-4">Tracking Permissions</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Choose what data FocusFlow can collect to build your personal productivity model.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <ConsentToggle
                icon={<Eye className="w-4 h-4 text-indigo-500" />}
                title="Screen Time Tracking"
                description="Monitor active window time to identify peak activity periods"
                value={consentScreenTime}
                onChange={() => setConsentScreenTime(!consentScreenTime)}
                required
              />
              <ConsentToggle
                icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
                title="App Categorization"
                description="Classify apps as productive or distracting for analytics"
                value={consentAppCategorization}
                onChange={() => setConsentAppCategorization(!consentAppCategorization)}
              />
              <ConsentToggle
                icon={<Bell className="w-4 h-4 text-amber-500" />}
                title="Notification Alerts"
                description="Send focus reminders and deadline notifications"
                value={consentNotifications}
                onChange={() => setConsentNotifications(!consentNotifications)}
              />
              <ConsentToggle
                icon={<Shield className="w-4 h-4 text-rose-500" />}
                title="ML Analytics"
                description="Use your data for LSTM, ARIMA & Prophet predictions"
                value={consentAnalytics}
                onChange={() => setConsentAnalytics(!consentAnalytics)}
              />
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-200 dark:border-indigo-600/30">
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                <strong>Privacy Note:</strong> All data is stored locally and on your private MongoDB instance. You can change these preferences anytime in Settings → Privacy.
              </p>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center">
              <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-4">Almost Ready!</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Your workspace is being calibrated to your {style} style.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center py-12">
               <div className="w-24 h-24 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div>
               <p className="mt-6 text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing Neural Engine...</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col min-h-[580px]">
        
        <div className="flex-1">
          {renderStep()}
        </div>

        <div className="mt-12 flex flex-col gap-4">
          <div className="flex justify-center gap-1.5 mb-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${step === i ? 'w-8 bg-indigo-600' : 'w-1.5 bg-slate-200 dark:bg-slate-800'}`}></div>
            ))}
          </div>
          <button 
            onClick={nextStep}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <span>{step === 4 ? 'Finish Setup' : 'Continue'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          {step < 4 && (
            <button onClick={onComplete} className="text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Skip for now
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

const FeatureItem = ({ icon, text }: any) => (
  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent">
    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
      {icon}
    </div>
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{text}</span>
  </div>
);

const ConsentToggle = ({ icon, title, description, value, onChange, required }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onChange: () => void;
  required?: boolean;
}) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h5 className="font-bold text-sm text-slate-700 dark:text-white truncate">{title}</h5>
          {required && <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded-full shrink-0">Required</span>}
        </div>
        <p className="text-[10px] text-slate-500 truncate">{description}</p>
      </div>
    </div>
    <button
      onClick={required ? undefined : onChange}
      disabled={required}
      className={`shrink-0 ml-3 w-12 h-7 rounded-full p-0.5 transition-all duration-300 ${required ? 'cursor-not-allowed opacity-70' : ''} ${value ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}
    >
      <div className={`w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-all ${value ? 'translate-x-5' : 'translate-x-0'}`}>
        {value ? <CheckCircle2 className="w-3 h-3 text-indigo-600" /> : null}
      </div>
    </button>
  </div>
);

export default Onboarding;
