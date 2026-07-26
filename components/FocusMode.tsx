/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { focusApi, insightsApi } from '../services/api';
import { Play, Pause, RotateCcw, ShieldCheck, Moon, BellOff, X, CheckCircle2, Ban, Plus, Volume2, VolumeX, Eye, EyeOff, Settings2, ChevronDown, ChevronUp, AlertTriangle, Zap, Brain, ArrowLeft } from 'lucide-react';

// Default blocked apps list
const DEFAULT_BLOCKED_APPS = [
  { name: 'YouTube', category: 'streaming', blocked: true },
  { name: 'Netflix', category: 'streaming', blocked: true },
  { name: 'Instagram', category: 'social', blocked: true },
  { name: 'Twitter/X', category: 'social', blocked: true },
  { name: 'Reddit', category: 'social', blocked: true },
  { name: 'Facebook', category: 'social', blocked: true },
  { name: 'TikTok', category: 'social', blocked: true },
  { name: 'Discord', category: 'messaging', blocked: false },
  { name: 'WhatsApp', category: 'messaging', blocked: false },
  { name: 'Spotify', category: 'entertainment', blocked: false },
  { name: 'Amazon', category: 'shopping', blocked: true },
  { name: 'Flipkart', category: 'shopping', blocked: true },
];

interface BlockedApp {
  name: string;
  category: string;
  blocked: boolean;
}

const FocusMode: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionType, setSessionType] = useState<'Work' | 'Break'>('Work');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notification & app blocking state
  const [dndEnabled, setDndEnabled] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>(() => {
    const saved = localStorage.getItem('FocusFlow_blocked_apps');
    return saved ? JSON.parse(saved) : DEFAULT_BLOCKED_APPS;
  });
  const [showBlockedApps, setShowBlockedApps] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [blockedCount, setBlockedCount] = useState(0);

  // Distraction detection state
  const [distractionAlert, setDistractionAlert] = useState<{ type: string; message: string; severity: 'warning' | 'critical' } | null>(null);
  const [distractionLog, setDistractionLog] = useState<Array<{ time: Date; type: string }>>([]);
  const [streakWarning, setStreakWarning] = useState(false);
  const [showRefocusPrompt, setShowRefocusPrompt] = useState(false);
  const [distractionPatterns, setDistractionPatterns] = useState<any>(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionDistractions, setSessionDistractions] = useState<Array<{ time: Date; type: string }>>([]);
  const lastDistractionTime = useRef<number>(0);
  const distractionStreakRef = useRef<number>(0);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save blocked apps to localStorage
  useEffect(() => {
    localStorage.setItem('FocusFlow_blocked_apps', JSON.stringify(blockedApps));
  }, [blockedApps]);

  // DND mode: when active, block notifications
  useEffect(() => {
    if (isActive && sessionType === 'Work') {
      setDndEnabled(true);
      setSoundMuted(true);
      // Request notification permission to suppress them
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => setNotificationPermission(perm));
      }
    } else if (!isActive) {
      setDndEnabled(false);
      setSoundMuted(false);
    }
  }, [isActive, sessionType]);

  // Track blocked distraction attempts
  useEffect(() => {
    if (!isActive) {
      setBlockedCount(0);
      return;
    }

    // Intercept visibility changes to count "distraction attempts"
    const handleVisibilityChange = () => {
      if (document.hidden && isActive && sessionType === 'Work') {
        setBlockedCount(prev => prev + 1);
      }
    };

    // Block common keyboard shortcuts that lead to distractions
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isActive || sessionType !== 'Work') return;
      // Block Ctrl+T (new tab), Ctrl+N (new window) during focus
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'n')) {
        e.preventDefault();
        setBlockedCount(prev => prev + 1);
        triggerDistractionAlert('keyboard-shortcut');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isActive, sessionType]);

  // Fetch distraction patterns from backend
  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const data = await insightsApi.getDistractionPatterns();
        setDistractionPatterns(data);
      } catch (e) {
        // Ignore - patterns are optional
      }
    };
    fetchPatterns();
  }, []);

  // Distraction detection: trigger alert popup
  const triggerDistractionAlert = useCallback((type: string) => {
    if (!isActive || sessionType !== 'Work') return;

    const now = Date.now();
    const timeSinceLast = now - lastDistractionTime.current;
    lastDistractionTime.current = now;

    // Log the distraction
    const entry = { time: new Date(), type };
    setDistractionLog(prev => [...prev, entry]);
    setSessionDistractions(prev => [...prev, entry]);

    // Streak detection: if 3+ distractions within 2 minutes
    if (timeSinceLast < 120000) {
      distractionStreakRef.current += 1;
    } else {
      distractionStreakRef.current = 1;
    }

    const severity = distractionStreakRef.current >= 3 ? 'critical' : 'warning';
    const messages: Record<string, string> = {
      'tab-switch': 'You switched away from the app. Stay focused!',
      'keyboard-shortcut': 'Blocked an attempt to open a new tab/window.',
      'idle-detected': 'You seem idle. Need to refocus?',
      'rapid-switching': 'Rapid context switching detected — take a breath.',
    };

    setDistractionAlert({
      type,
      message: distractionStreakRef.current >= 3
        ? `⚠️ Distraction streak! ${distractionStreakRef.current} distractions in quick succession. Take a deep breath and refocus.`
        : messages[type] || 'Distraction detected!',
      severity,
    });

    if (distractionStreakRef.current >= 3) {
      setStreakWarning(true);
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }

    // Auto-dismiss alert after 4 seconds
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setDistractionAlert(null);
      setStreakWarning(false);
    }, severity === 'critical' ? 6000 : 4000);

    // Browser notification for critical
    if (severity === 'critical' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('FocusFlow — Distraction Alert', {
        body: 'Multiple distractions detected! Stay focused on your task.',
        icon: '/favicon.ico',
        tag: 'distraction-alert',
      });
    }
  }, [isActive, sessionType]);

  // Enhanced visibility change handler for distraction detection
  useEffect(() => {
    if (!isActive || sessionType !== 'Work') return;

    let hiddenTime = 0;
    const handleReturn = () => {
      if (!document.hidden && hiddenTime > 0) {
        const awayDuration = (Date.now() - hiddenTime) / 1000;
        if (awayDuration > 5) {
          // User was away for more than 5 seconds — show refocus prompt
          setShowRefocusPrompt(true);
          triggerDistractionAlert('tab-switch');
        }
        hiddenTime = 0;
      } else if (document.hidden) {
        hiddenTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleReturn);
    return () => document.removeEventListener('visibilitychange', handleReturn);
  }, [isActive, sessionType, triggerDistractionAlert]);

  // Idle detection: if no mouse/keyboard activity for 3 minutes during session
  useEffect(() => {
    if (!isActive || sessionType !== 'Work') return;

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        triggerDistractionAlert('idle-detected');
      }, 180000); // 3 minutes
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    resetIdle();

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [isActive, sessionType, triggerDistractionAlert]);

  useEffect(() => {
    // Check for active session on mount
    const checkActiveSession = async () => {
      try {
        const { active, session } = await focusApi.getActiveSession();
        if (active && session) {
          setCurrentSessionId(session.id);
          setIsActive(true);
          const elapsed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
          const remaining = Math.max(0, session.planned_duration * 60 - elapsed);
          setTimeLeft(Math.floor(remaining));
        }
      } catch (error) {
        console.error('Failed to check active session:', error);
      }
    };
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const handleSessionComplete = async () => {
    setIsActive(false);
    setSessionCompleted(true);
    setDndEnabled(false);
    setSoundMuted(false);
    setShowSessionSummary(true);

    // Send completion notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FocusFlow', {
        body: `Focus session completed! You blocked ${blockedCount} distractions.`,
        icon: '/favicon.ico'
      });
    }

    if (currentSessionId) {
      try {
        await focusApi.endSession(true);
        setCurrentSessionId(null);
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
    setTimeout(() => setSessionCompleted(false), 3000);
  };

  const handleStart = async () => {
    try {
      const duration = sessionType === 'Work' ? 25 : 5;
      const { session } = await focusApi.startSession(duration);
      setCurrentSessionId(session.id);
      setIsActive(true);
      setTimeLeft(duration * 60);
      setSessionCompleted(false);
      setBlockedCount(0);
    } catch (error: any) {
      console.error('Failed to start session:', error);
      if (error.message.includes('already have an active')) {
        setIsActive(true);
      }
    }
  };

  const handlePause = async () => {
    setIsActive(false);
  };

  const handleStop = async () => {
    setIsActive(false);
    setTimeLeft(sessionType === 'Work' ? 25 * 60 : 5 * 60);
    setDndEnabled(false);
    setSoundMuted(false);

    if (currentSessionId) {
      try {
        await focusApi.endSession(false);
        setCurrentSessionId(null);
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(sessionType === 'Work' ? 25 * 60 : 5 * 60);
    setCurrentSessionId(null);
    setSessionCompleted(false);
    setDndEnabled(false);
    setSoundMuted(false);
    setBlockedCount(0);
    setDistractionAlert(null);
    setDistractionLog([]);
    setStreakWarning(false);
    setShowRefocusPrompt(false);
    setSessionDistractions([]);
    setShowSessionSummary(false);
    distractionStreakRef.current = 0;
    lastDistractionTime.current = 0;
  };

  const toggleAppBlock = (index: number) => {
    if (isActive) return;
    setBlockedApps(prev => prev.map((app, i) => i === index ? { ...app, blocked: !app.blocked } : app));
  };

  const addBlockedApp = () => {
    if (!newAppName.trim()) return;
    setBlockedApps(prev => [...prev, { name: newAppName.trim(), category: 'custom', blocked: true }]);
    setNewAppName('');
  };

  const removeBlockedApp = (index: number) => {
    if (isActive) return;
    setBlockedApps(prev => prev.filter((_, i) => i !== index));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = sessionType === 'Work' ? 25 * 60 : 5 * 60;
  const progress = (totalSeconds - timeLeft) / totalSeconds;
  const activeBlockedCount = blockedApps.filter(a => a.blocked).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500">
      {sessionCompleted && (
        <div className="fixed top-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right duration-300 z-50">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">Focus session completed! Blocked {blockedCount} distractions.</span>
        </div>
      )}

      {/* Real-time Distraction Alert Popup */}
      {distractionAlert && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 z-50 max-w-md ${
          distractionAlert.severity === 'critical'
            ? 'bg-rose-600 text-white border-2 border-rose-400'
            : 'bg-amber-500 text-white border-2 border-amber-300'
        }`}>
          <div className={`p-2 rounded-full ${distractionAlert.severity === 'critical' ? 'bg-rose-700' : 'bg-amber-600'}`}>
            {distractionAlert.severity === 'critical' ? <Zap className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{distractionAlert.severity === 'critical' ? 'Critical Alert' : 'Distraction Detected'}</p>
            <p className="text-xs opacity-90">{distractionAlert.message}</p>
          </div>
          <button title="Dismiss alert" aria-label="Dismiss alert" onClick={() => setDistractionAlert(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Refocus Prompt Overlay */}
      {showRefocusPrompt && isActive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 mx-auto bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center">
              <Brain className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">Welcome Back!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">You were away from your focus session. Ready to dive back in?</p>
            <div className="text-xs text-slate-400">
              Session distractions so far: <span className="text-rose-500 font-bold">{sessionDistractions.length}</span>
            </div>
            <button
              onClick={() => setShowRefocusPrompt(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Refocus Now
            </button>
          </div>
        </div>
      )}

      {/* Session Distraction Summary */}
      {showSessionSummary && sessionDistractions.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full mx-4 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">Session Summary</h3>
              <p className="text-sm text-slate-500">Distraction analysis for your focus session</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rose-500">{sessionDistractions.length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Distractions</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-indigo-500">{blockedCount}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Blocked</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-500">
                  {Math.max(0, Math.round(100 - (sessionDistractions.length * 5)))}%
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Focus Score</p>
              </div>
            </div>
            {/* Distraction type breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Breakdown</p>
              {Object.entries(
                sessionDistractions.reduce((acc: Record<string, number>, d) => {
                  acc[d.type] = (acc[d.type] || 0) + 1;
                  return acc;
                }, {})
              ).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{type.replace(/-/g, ' ')}</span>
                  <span className="text-xs font-bold text-rose-500">{count as number}x</span>
                </div>
              ))}
            </div>
            {/* Tip from distraction patterns */}
            {distractionPatterns?.top_distractions?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">💡 Tip</p>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                  Your top distractor is "{distractionPatterns.top_distractions[0]?.app_name}". Consider blocking it during focus sessions.
                </p>
              </div>
            )}
            <button
              onClick={() => { setShowSessionSummary(false); setSessionDistractions([]); }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Distraction overlay warning */}
      {isActive && sessionType === 'Work' && (
        <div className="fixed top-0 left-0 right-0 bg-indigo-600 text-white text-center py-1.5 text-xs font-bold z-40 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Focus Shield Active — {activeBlockedCount} apps blocked · {blockedCount} distractions blocked
          {soundMuted && <VolumeX className="w-3.5 h-3.5 ml-2" />}
        </div>
      )}

      <div className="max-w-xl w-full text-center space-y-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Deep Work Protocol</h2>
          <p className="text-slate-500 dark:text-slate-400">Eliminate distractions. Maximize cognitive output.</p>
        </div>

        {/* Session Type Toggle */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => { if (!isActive) { setSessionType('Work'); setTimeLeft(25 * 60); } }}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${sessionType === 'Work'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
          >
            Work (25m)
          </button>
          <button
            onClick={() => { if (!isActive) { setSessionType('Break'); setTimeLeft(5 * 60); } }}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${sessionType === 'Break'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
          >
            Break (5m)
          </button>
        </div>

        {/* Timer UI */}
        <div className="relative w-80 h-80 mx-auto flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="160" cy="160" r="150" className="fill-none stroke-slate-200 dark:stroke-slate-800 stroke-[8]" />
            <circle
              cx="160" cy="160" r="150"
              className={`fill-none stroke-[8] transition-all duration-1000 ease-linear ${sessionType === 'Work' ? 'stroke-indigo-600' : 'stroke-emerald-600'}`}
              style={{ strokeDasharray: '942.48', strokeDashoffset: 942.48 * (1 - progress) }}
            />
          </svg>
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-6xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
              {formatTime(timeLeft)}
            </span>
            <span className={`text-sm font-bold uppercase tracking-widest mt-2 ${sessionType === 'Work' ? 'text-indigo-500' : 'text-emerald-500'}`}>
              {sessionType} Mode
            </span>
            {isActive && blockedCount > 0 && (
              <span className="text-[10px] text-rose-500 font-bold mt-1">{blockedCount} distractions blocked</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-6">
          <button title="Reset timer" aria-label="Reset timer" onClick={handleReset} className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 transition-all">
            <RotateCcw className="w-6 h-6" />
          </button>
          <button
            title={isActive ? "Pause session" : "Start session"}
            aria-label={isActive ? "Pause session" : "Start session"}
            onClick={isActive ? handlePause : handleStart}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ${sessionType === 'Work' ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-emerald-600 shadow-emerald-600/30'}`}
          >
            {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
          </button>
          <button title="Stop session" aria-label="Stop session" onClick={handleStop} className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-4 gap-3">
          <StatusBadge icon={<ShieldCheck className="w-4 h-4" />} label="App Firewall" active={isActive && sessionType === 'Work'} count={activeBlockedCount} />
          <StatusBadge
            icon={<BellOff className="w-4 h-4" />}
            label="DND Mode"
            active={dndEnabled}
            onClick={() => !isActive && setDndEnabled(!dndEnabled)}
          />
          <StatusBadge
            icon={soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            label={soundMuted ? 'Muted' : 'Sound On'}
            active={soundMuted}
            onClick={() => !isActive && setSoundMuted(!soundMuted)}
          />
          <StatusBadge icon={<Ban className="w-4 h-4" />} label="Blocked" active={isActive} count={blockedCount} />
        </div>

        {/* Blocked Apps Manager */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden text-left">
          <button
            onClick={() => setShowBlockedApps(!showBlockedApps)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl text-rose-500">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Blocked Apps & Sites</h4>
                <p className="text-[10px] text-slate-500">{activeBlockedCount} apps will be blocked during focus sessions</p>
              </div>
            </div>
            {showBlockedApps ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showBlockedApps && (
            <div className="px-6 pb-6 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              {/* Add new app */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAppName}
                  onChange={e => setNewAppName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBlockedApp()}
                  placeholder="Add app or website to block..."
                  disabled={isActive}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 disabled:opacity-50"
                />
                <button
                  onClick={addBlockedApp}
                  disabled={isActive || !newAppName.trim()}
                  title="Add blocked app"
                  className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-rose-600 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* App list */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {blockedApps.map((app, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleAppBlock(i)}
                        disabled={isActive}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          app.blocked
                            ? 'bg-rose-500 border-rose-500 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        } disabled:opacity-50`}
                      >
                        {app.blocked && <Ban className="w-3 h-3" />}
                      </button>
                      <span className={`text-sm ${app.blocked ? 'text-slate-800 dark:text-white font-semibold' : 'text-slate-400'}`}>
                        {app.name}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {app.category}
                      </span>
                    </div>
                    {app.category === 'custom' && (
                      <button
                        onClick={() => removeBlockedApp(i)}
                        disabled={isActive}
                        title="Remove app"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Distraction Patterns Insight Panel */}
        {distractionPatterns && (distractionPatterns.peak_hours?.length > 0 || distractionPatterns.top_distractions?.length > 0) && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Distraction Patterns</h4>
                <p className="text-[10px] text-slate-500">Your distraction analysis from the past {distractionPatterns.period || '7 days'}</p>
              </div>
            </div>

            {distractionPatterns.peak_hours?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Peak Distraction Hours</p>
                <div className="flex gap-2 flex-wrap">
                  {distractionPatterns.peak_hours.slice(0, 5).map((h: any, i: number) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg font-bold">
                      {h.time || h.hour || `${i + 1}`} — {h.distracted || h.minutes || 0}min
                    </span>
                  ))}
                </div>
              </div>
            )}

            {distractionPatterns.top_distractions?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top Distractors</p>
                <div className="space-y-1.5">
                  {distractionPatterns.top_distractions.slice(0, 4).map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{d.app_name || `App ${i + 1}`}</span>
                      <span className="text-xs text-slate-400">{d.total_minutes || 0} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Distraction Log (during active session) */}
        {isActive && sessionDistractions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-800 p-4 text-left">
            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Live Distraction Log ({sessionDistractions.length})
            </p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {sessionDistractions.slice(-5).reverse().map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] py-1 px-2 bg-rose-50 dark:bg-rose-500/5 rounded">
                  <span className="text-slate-600 dark:text-slate-400 capitalize">{d.type.replace(/-/g, ' ')}</span>
                  <span className="text-slate-400">{d.time.toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ icon, label, active, count, onClick }: any) => (
  <div
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${onClick ? 'cursor-pointer' : ''} ${
      active ? 'border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-50'
    }`}
  >
    <div className={`p-2 rounded-lg ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full">{count}</span>
    )}
  </div>
);

export default FocusMode;
