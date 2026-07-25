/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { authApi, tasksApi } from '../services/api';
import { 
  Sun, 
  Moon, 
  Bell, 
  Shield, 
  Trash2, 
  Cloud,
  ChevronRight,
  Monitor,
  BellOff,
  Download,
  AlertTriangle,
  Check,
  X,
  Eye,
  EyeOff,
  Clock,
  Volume2,
  VolumeX,
  Key,
  Smartphone,
  Copy,
  Lock
} from 'lucide-react';

interface SettingsProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onLogout?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isDarkMode, setIsDarkMode, onLogout }) => {
  // Notification settings
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return localStorage.getItem('FocusFlow_notif_enabled') !== 'false';
  });
  const [notifSound, setNotifSound] = useState(() => {
    return localStorage.getItem('FocusFlow_notif_sound') !== 'false';
  });
  const [notifFocusReminder, setNotifFocusReminder] = useState(() => {
    return localStorage.getItem('FocusFlow_notif_focus') === 'true';
  });
  const [notifDeadlineAlert, setNotifDeadlineAlert] = useState(() => {
    return localStorage.getItem('FocusFlow_notif_deadline') !== 'false';
  });
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(() => {
    return localStorage.getItem('FocusFlow_notif_weekly') !== 'false';
  });
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Privacy settings
  const [trackingEnabled, setTrackingEnabled] = useState(() => {
    return localStorage.getItem('FocusFlow_tracking_enabled') !== 'false';
  });
  const [activityVisible, setActivityVisible] = useState(() => {
    return localStorage.getItem('FocusFlow_activity_visible') !== 'false';
  });
  const [dataRetentionDays, setDataRetentionDays] = useState(() => {
    return parseInt(localStorage.getItem('FocusFlow_data_retention') || '90');
  });

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification panel open state
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showPrivacyPanel, setShowPrivacyPanel] = useState(false);

  // 2FA state
  const [show2FAPanel, setShow2FAPanel] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASetupStep, setTwoFASetupStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  // Check browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Check 2FA status from user profile
  useEffect(() => {
    const check2FA = async () => {
      try {
        const data = await authApi.getProfile();
        if (data.user?.totp_enabled) {
          setIs2FAEnabled(true);
        }
      } catch (e) { /* ignore */ }
    };
    check2FA();
  }, []);

  // Persist notification settings
  useEffect(() => {
    localStorage.setItem('FocusFlow_notif_enabled', String(notifEnabled));
    localStorage.setItem('FocusFlow_notif_sound', String(notifSound));
    localStorage.setItem('FocusFlow_notif_focus', String(notifFocusReminder));
    localStorage.setItem('FocusFlow_notif_deadline', String(notifDeadlineAlert));
    localStorage.setItem('FocusFlow_notif_weekly', String(notifWeeklyDigest));
  }, [notifEnabled, notifSound, notifFocusReminder, notifDeadlineAlert, notifWeeklyDigest]);

  // Persist privacy settings
  useEffect(() => {
    localStorage.setItem('FocusFlow_tracking_enabled', String(trackingEnabled));
    localStorage.setItem('FocusFlow_activity_visible', String(activityVisible));
    localStorage.setItem('FocusFlow_data_retention', String(dataRetentionDays));
  }, [trackingEnabled, activityVisible, dataRetentionDays]);

  const handleSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const data = await authApi.setup2FA();
      setTotpSecret(data.secret);
      setTotpUri(data.provisioning_uri);
      setTwoFASetupStep('verify');
    } catch (err: any) {
      setTwoFAError(err.message || 'Failed to setup 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      setTwoFAError('Enter a 6-digit code');
      return;
    }
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      await authApi.verify2FA(twoFACode);
      setIs2FAEnabled(true);
      setTwoFASetupStep('idle');
      setTwoFACode('');
      setTotpSecret('');
    } catch (err: any) {
      setTwoFAError(err.message || 'Invalid code. Try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setTwoFAError('Enter your password to disable 2FA');
      return;
    }
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      await authApi.disable2FA(disablePassword);
      setIs2FAEnabled(false);
      setDisablePassword('');
      setTwoFASetupStep('idle');
    } catch (err: any) {
      setTwoFAError(err.message || 'Failed to disable 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        new Notification('FocusFlow', { body: 'Notifications enabled successfully!' });
      }
    }
  };

  const handleExportData = async () => {
    try {
      const [profile, taskData] = await Promise.all([
        authApi.getProfile(),
        tasksApi.getAll()
      ]);

      const exportObj = {
        exportDate: new Date().toISOString(),
        profile: profile.user,
        tasks: taskData.tasks,
        settings: {
          darkMode: isDarkMode,
          notifications: { notifEnabled, notifSound, notifFocusReminder, notifDeadlineAlert, notifWeeklyDigest },
          privacy: { trackingEnabled, activityVisible, dataRetentionDays }
        }
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FocusFlow-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await authApi.deleteAccount();
      // Clear all local data
      localStorage.clear();
      sessionStorage.clear();
      if (onLogout) onLogout();
    } catch (error) {
      console.error('Failed to delete account:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await authApi.clearData(dataRetentionDays);
      alert('Activity history older than ' + dataRetentionDays + ' days has been cleared.');
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <SectionHeader title="Appearance" />
        
        <div className="p-6 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Dark Mode</h4>
              <p className="text-xs text-slate-500">Adjust the visual environment of the workspace.</p>
            </div>
          </div>
          <ToggleSwitch value={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
        </div>

        {/* ===== NOTIFICATIONS SECTION ===== */}
        <SectionHeader title="Notifications" />

        <div
          onClick={() => setShowNotifPanel(!showNotifPanel)}
          className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500 transition-colors">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Notification Preferences</h4>
              <p className="text-xs text-slate-500">Control how and when you receive alerts.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">{notifEnabled ? 'On' : 'Off'}</span>
            <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${showNotifPanel ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {showNotifPanel && (
          <div className="px-6 pb-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/20">
            {/* Browser permission */}
            {notifPermission !== 'granted' && (
              <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-600/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Browser Notifications Disabled</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">Enable to receive focus reminders and deadline alerts</p>
                  </div>
                </div>
                <button
                  onClick={requestNotifPermission}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600"
                >
                  Enable
                </button>
              </div>
            )}

            <NotifToggle
              icon={<Bell className="w-4 h-4" />}
              title="All Notifications"
              description="Master switch for all notification types"
              value={notifEnabled}
              onChange={() => setNotifEnabled(!notifEnabled)}
            />
            <NotifToggle
              icon={notifSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              title="Notification Sounds"
              description="Play sound with notifications"
              value={notifSound}
              onChange={() => setNotifSound(!notifSound)}
              disabled={!notifEnabled}
            />
            <NotifToggle
              icon={<Clock className="w-4 h-4" />}
              title="Focus Session Reminders"
              description="Remind you to start focus sessions"
              value={notifFocusReminder}
              onChange={() => setNotifFocusReminder(!notifFocusReminder)}
              disabled={!notifEnabled}
            />
            <NotifToggle
              icon={<AlertTriangle className="w-4 h-4" />}
              title="Deadline Alerts"
              description="Alert when tasks are approaching deadlines"
              value={notifDeadlineAlert}
              onChange={() => setNotifDeadlineAlert(!notifDeadlineAlert)}
              disabled={!notifEnabled}
            />
            <NotifToggle
              icon={<Bell className="w-4 h-4" />}
              title="Weekly Productivity Digest"
              description="Receive a summary of your weekly performance"
              value={notifWeeklyDigest}
              onChange={() => setNotifWeeklyDigest(!notifWeeklyDigest)}
              disabled={!notifEnabled}
            />
          </div>
        )}

        {/* ===== PRIVACY SECTION ===== */}
        <SectionHeader title="Privacy & Data" />

        <div
          onClick={() => setShowPrivacyPanel(!showPrivacyPanel)}
          className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Privacy & Data Controls</h4>
              <p className="text-xs text-slate-500">Manage tracking, data retention, and exports.</p>
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${showPrivacyPanel ? 'rotate-90' : ''}`} />
        </div>

        {showPrivacyPanel && (
          <div className="px-6 pb-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/20">
            <NotifToggle
              icon={activityVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              title="Activity Tracking"
              description="Allow FocusFlow to monitor your app usage"
              value={trackingEnabled}
              onChange={() => setTrackingEnabled(!trackingEnabled)}
            />
            <NotifToggle
              icon={<Eye className="w-4 h-4" />}
              title="Activity Visibility"
              description="Show your tracked apps in analytics"
              value={activityVisible}
              onChange={() => setActivityVisible(!activityVisible)}
            />

            {/* Data Retention */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <h5 className="font-bold text-sm text-slate-700 dark:text-white">Data Retention Period</h5>
                  <p className="text-[10px] text-slate-500">Auto-delete activity data older than</p>
                </div>
              </div>
              <select
                value={dataRetentionDays}
                onChange={e => setDataRetentionDays(Number(e.target.value))}
                title="Data retention period"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Clear Old Data
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                <Download className="w-4 h-4" />
                Export All Data
              </button>
            </div>
          </div>
        )}

        {/* ===== SECURITY / 2FA SECTION ===== */}
        <SectionHeader title="Security" />

        <div
          onClick={() => setShow2FAPanel(!show2FAPanel)}
          className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500 transition-colors">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Two-Factor Authentication</h4>
              <p className="text-xs text-slate-500">Add an extra layer of security to your account.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${is2FAEnabled ? 'text-emerald-500' : 'text-slate-400'}`}>
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${show2FAPanel ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {show2FAPanel && (
          <div className="px-6 pb-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/20">
            {twoFAError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {twoFAError}
              </div>
            )}

            {!is2FAEnabled && twoFASetupStep === 'idle' && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h5 className="font-bold text-sm text-slate-700 dark:text-white">Setup Authenticator App</h5>
                    <p className="text-[10px] text-slate-500">Use Google Authenticator, Authy, or any TOTP-compatible app</p>
                  </div>
                </div>
                <button
                  onClick={handleSetup2FA}
                  disabled={twoFALoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  <Key className="w-4 h-4" />
                  {twoFALoading ? 'Setting up...' : 'Enable 2FA'}
                </button>
              </div>
            )}

            {!is2FAEnabled && twoFASetupStep === 'verify' && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-600/30 space-y-5">
                <div className="space-y-3">
                  <h5 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    Copy this secret to your authenticator app
                  </h5>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-mono text-slate-700 dark:text-slate-300 tracking-wider break-all">
                      {totpSecret}
                    </code>
                    <button
                      onClick={copySecret}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                      title="Copy secret"
                    >
                      {secretCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    <strong>Provisioning URI:</strong> <span className="font-mono break-all">{totpUri}</span>
                  </p>
                </div>

                <div className="space-y-3">
                  <h5 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    Enter the 6-digit verification code
                  </h5>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={twoFACode}
                      onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-40 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-lg font-mono font-bold tracking-[0.5em] text-slate-800 dark:text-white"
                    />
                    <button
                      onClick={handleVerify2FA}
                      disabled={twoFACode.length !== 6 || twoFALoading}
                      className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      {twoFALoading ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => { setTwoFASetupStep('idle'); setTotpSecret(''); setTwoFACode(''); setTwoFAError(''); }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-bold"
                >
                  Cancel Setup
                </button>
              </div>
            )}

            {is2FAEnabled && (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-600/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-emerald-800 dark:text-emerald-200">2FA is Active</h5>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Your account is protected with two-factor authentication</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Enter password to disable 2FA</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={e => setDisablePassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                      />
                    </div>
                    <button
                      onClick={handleDisable2FA}
                      disabled={!disablePassword || twoFALoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-all"
                    >
                      {twoFALoading ? 'Disabling...' : 'Disable 2FA'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <SettingsRow 
          icon={<Cloud className="text-slate-400" />} 
          title="Cloud Backup" 
          description="Sync across devices via MongoDB." 
          value="Active" 
        />

        {/* ===== DELETE ACCOUNT ===== */}
        <div className="p-6">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-3 text-rose-500 font-bold text-sm hover:underline"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete Account and Data</span>
            </button>
          ) : (
            <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-600/30 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
                <div>
                  <h4 className="font-bold text-rose-800 dark:text-rose-200">Delete Account Permanently</h4>
                  <p className="text-xs text-rose-600 dark:text-rose-400">This will permanently delete your account, all tasks, activities, focus sessions, and ML models. This action cannot be undone.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-rose-600 mb-1 block">Type DELETE to confirm</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-600 rounded-xl text-sm text-slate-800 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Delete My Account'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                  className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-8 bg-indigo-600 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ZapIcon className="w-40 h-40 fill-current" />
        </div>
        <div className="relative z-10 space-y-4">
          <h3 className="text-xl font-display font-bold">FocusFlow Pro</h3>
          <p className="text-indigo-100 text-sm max-w-sm">Unlock advanced time-series modeling, unlimited focus projects, and team collaboration tools.</p>
          <button className="bg-white text-indigo-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-black/10 hover:bg-indigo-50 transition-colors">
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30">
    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
  </div>
);

const ToggleSwitch = ({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${value ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
  >
    <div className={`w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-all ${value ? 'translate-x-6' : 'translate-x-0'}`}>
      {value ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
    </div>
  </button>
);

const NotifToggle = ({ icon, title, description, value, onChange, disabled }: any) => (
  <div className={`flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex items-center gap-3">
      <div className="text-slate-400">{icon}</div>
      <div>
        <h5 className="font-bold text-sm text-slate-700 dark:text-white">{title}</h5>
        <p className="text-[10px] text-slate-500">{description}</p>
      </div>
    </div>
    <ToggleSwitch value={value} onChange={onChange} disabled={disabled} />
  </div>
);

const SettingsRow = ({ icon, title, description, value }: any) => (
  <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group">
    <div className="flex items-center gap-4">
      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500 transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 dark:text-white">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      {value && <span className="text-xs font-bold text-slate-400">{value}</span>}
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
    </div>
  </div>
);

const ZapIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14H12V22L22 10H13V2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default Settings;
