/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { insightsApi, wellnessApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh } from '../services/dataCache';
import {
  Heart,
  Smile,
  Meh,
  Frown,
  CloudRain,
  Sun,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Moon
} from 'lucide-react';

type MoodLevel = 1 | 2 | 3 | 4 | 5;

interface MoodEntry {
  date: string;
  mood: MoodLevel;
  energy: MoodLevel;
  stress: MoodLevel;
  sleep_hours: number;
  note?: string;
}

interface CorrelationData {
  mood_productivity: number;
  stress_productivity: number;
  sleep_productivity: number;
  energy_productivity: number;
  insights: string[];
  weekly_summary: {
    avg_mood: number;
    avg_stress: number;
    avg_energy: number;
    avg_sleep: number;
    avg_productivity: number;
    mood_trend: 'up' | 'down' | 'stable';
  };
}

const MOOD_ICONS = [
  { level: 1, icon: CloudRain, label: 'Very Low', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  { level: 2, icon: Frown, label: 'Low', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  { level: 3, icon: Meh, label: 'Okay', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-500/10' },
  { level: 4, icon: Smile, label: 'Good', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { level: 5, icon: Sun, label: 'Great', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
];



const WELLNESS_CACHE_KEY = 'wellness';

interface WellnessCacheData {
  moodHistory: MoodEntry[];
  correlation: CorrelationData | null;
  productivityData: any;
}

const Wellness: React.FC = () => {
  const cached = getCachedData<WellnessCacheData>(WELLNESS_CACHE_KEY);

  const [todayMood, setTodayMood] = useState<MoodLevel | null>(null);
  const [todayEnergy, setTodayEnergy] = useState<MoodLevel>(3);
  const [todayStress, setTodayStress] = useState<MoodLevel>(3);
  const [sleepHours, setSleepHours] = useState(7);
  const [moodNote, setMoodNote] = useState('');
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>(cached?.moodHistory ?? []);
  const [correlation, setCorrelation] = useState<CorrelationData | null>(cached?.correlation ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [productivityData, setProductivityData] = useState<any>(cached?.productivityData ?? null);

  useEffect(() => {
    // Restore today's entry from cached history
    if (cached?.moodHistory) {
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = cached.moodHistory.find((e) => e.date === today);
      if (todayEntry) {
        setTodayMood(todayEntry.mood);
        setTodayEnergy(todayEntry.energy);
        setTodayStress(todayEntry.stress);
        setSleepHours(todayEntry.sleep_hours);
        setMoodNote(todayEntry.note || '');
      }
    }

    const fetchAll = async () => {
      // Skip if cache is fresh
      if (isCacheFresh(WELLNESS_CACHE_KEY) && cached) {
        setIsLoading(false);
        return;
      }

      try {
        const [historyRes, correlationRes, dashboardData] = await Promise.all([
          wellnessApi.getMoodHistory(14).catch(() => ({ entries: [] })),
          wellnessApi.getCorrelation().catch(() => null),
          insightsApi.getDashboard().catch(() => null),
        ]);

        setMoodHistory(historyRes.entries || []);
        setCorrelation(correlationRes);
        setProductivityData(dashboardData);

        // Save to cache
        setCachedData<WellnessCacheData>(WELLNESS_CACHE_KEY, {
          moodHistory: historyRes.entries || [],
          correlation: correlationRes,
          productivityData: dashboardData,
        });

        // Check if today's mood already logged
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = (historyRes.entries || []).find((e: MoodEntry) => e.date === today);
        if (todayEntry) {
          setTodayMood(todayEntry.mood);
          setTodayEnergy(todayEntry.energy);
          setTodayStress(todayEntry.stress);
          setSleepHours(todayEntry.sleep_hours);
          setMoodNote(todayEntry.note || '');
        }
      } catch (e) {
        console.error('Failed to fetch wellness data:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const saveMood = async () => {
    if (!todayMood) return;
    setIsSaving(true);
    try {
      await wellnessApi.logMood({
        mood: todayMood,
        energy: todayEnergy,
        stress: todayStress,
        sleep_hours: sleepHours,
        note: moodNote,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Refresh history and correlation
      const [historyRes, correlationRes] = await Promise.all([
        wellnessApi.getMoodHistory(14).catch(() => ({ entries: [] })),
        wellnessApi.getCorrelation().catch(() => null),
      ]);
      setMoodHistory(historyRes.entries || []);
      setCorrelation(correlationRes);
    } catch (e) {
      console.error('Failed to save mood:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const getCorrelationColor = (value: number) => {
    if (value > 0.5) return 'text-emerald-500';
    if (value > 0.2) return 'text-emerald-400';
    if (value > -0.2) return 'text-slate-400';
    if (value > -0.5) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getCorrelationLabel = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return 'Strong';
    if (abs > 0.4) return 'Moderate';
    if (abs > 0.2) return 'Weak';
    return 'None';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-pink-600 rounded-xl text-white shadow-lg shadow-pink-600/20">
          <Heart className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Mental Health & Wellness</h2>
          <p className="text-sm text-slate-500">Track mood, stress, and their correlation with productivity.</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Today's mood logged successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Check-in Card */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-pink-500" />
            Daily Check-in
          </h3>

          {/* Mood selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">How are you feeling?</p>
            <div className="flex justify-between gap-1">
              {MOOD_ICONS.map((m) => (
                <button
                  key={m.level}
                  title={m.label}
                  aria-label={m.label}
                  onClick={() => setTodayMood(m.level as MoodLevel)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all flex-1 ${todayMood === m.level
                      ? `${m.bg} ring-2 ring-offset-1 ring-current ${m.color} scale-110`
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'
                    }`}
                >
                  <m.icon className="w-6 h-6" />
                  <span className="text-[9px] font-bold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy Level */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Energy
              </p>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{todayEnergy}/5</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={todayEnergy}
              onChange={(e) => setTodayEnergy(Number(e.target.value) as MoodLevel)}
              aria-label="Energy level"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Stress Level */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" /> Stress
              </p>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{todayStress}/5</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={todayStress}
              onChange={(e) => setTodayStress(Number(e.target.value) as MoodLevel)}
              aria-label="Stress level"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          {/* Sleep Hours */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Moon className="w-3 h-3 text-indigo-500" /> Sleep
              </p>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{sleepHours}h</span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={sleepHours}
              onChange={(e) => setSleepHours(Number(e.target.value))}
              aria-label="Sleep hours"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Note */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Note (optional)</p>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="How's your day going?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 resize-none"
            />
          </div>

          <button
            onClick={saveMood}
            disabled={!todayMood || isSaving}
            className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 transition-all"
          >
            {isSaving ? 'Saving...' : 'Log Today\'s Mood'}
          </button>
        </div>

        {/* Correlation Analysis Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Correlation Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <Brain className="w-4 h-4 text-purple-500" />
              Stress-Productivity Correlation
            </h3>

            {correlation ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Mood → Productivity', value: correlation.mood_productivity, icon: Smile, expectedSign: '+' },
                    { label: 'Stress → Productivity', value: correlation.stress_productivity, icon: AlertTriangle, expectedSign: '-' },
                    { label: 'Sleep → Productivity', value: correlation.sleep_productivity, icon: Moon, expectedSign: '+' },
                    { label: 'Energy → Productivity', value: correlation.energy_productivity, icon: Zap, expectedSign: '+' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center space-y-1">
                      <item.icon className={`w-5 h-5 mx-auto ${getCorrelationColor(item.value)}`} />
                      <p className={`text-lg font-bold ${getCorrelationColor(item.value)}`}>
                        {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{getCorrelationLabel(item.value)}</p>
                      <p className="text-[9px] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* Weekly Summary */}
                {correlation.weekly_summary && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Weekly Summary</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: 'Mood', value: correlation.weekly_summary.avg_mood?.toFixed(1), max: 5 },
                        { label: 'Energy', value: correlation.weekly_summary.avg_energy?.toFixed(1), max: 5 },
                        { label: 'Stress', value: correlation.weekly_summary.avg_stress?.toFixed(1), max: 5 },
                        { label: 'Sleep', value: `${correlation.weekly_summary.avg_sleep?.toFixed(1)}h`, max: 12 },
                        { label: 'Productivity', value: `${Math.round(correlation.weekly_summary.avg_productivity || 0)}m`, max: 500 },
                      ].map((item, i) => (
                        <div key={i} className="text-center">
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{item.value}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span className="text-slate-500">Mood Trend:</span>
                      {correlation.weekly_summary.mood_trend === 'up' ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Improving</span>
                      ) : correlation.weekly_summary.mood_trend === 'down' ? (
                        <span className="text-rose-500 font-bold flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> Declining</span>
                      ) : (
                        <span className="text-slate-400 font-bold flex items-center gap-0.5"><Minus className="w-3 h-3" /> Stable</span>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Insights */}
                {correlation.insights && correlation.insights.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Wellness Insights</p>
                    {correlation.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <Heart className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-600 dark:text-slate-300">{insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <Heart className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-sm">Log your mood for a few days to see correlations.</p>
                <p className="text-xs">We need at least 3 days of data to calculate patterns.</p>
              </div>
            )}
          </div>

          {/* Mood History Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Mood History (14 Days)
            </h3>

            {moodHistory.length > 0 ? (
              <div className="space-y-4">
                {/* Visual chart */}
                <div className="flex items-end gap-1 h-32">
                  {moodHistory.slice(-14).map((entry, i) => {
                    const moodInfo = MOOD_ICONS.find(m => m.level === entry.mood) || MOOD_ICONS[2];
                    const height = (entry.mood / 5) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${entry.date}: ${moodInfo.label}`}>
                        <div
                          className={`w-full rounded-t-lg transition-all ${entry.mood >= 4 ? 'bg-emerald-400' : entry.mood >= 3 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                          style={{ height: `${height}%` }}
                        ></div>
                        <span className="text-[8px] text-slate-400 -rotate-45">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stress overlay line - shown as dots */}
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-400 rounded-sm"></div>
                    <span className="text-slate-500">Good mood</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-400 rounded-sm"></div>
                    <span className="text-slate-500">Okay</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-rose-400 rounded-sm"></div>
                    <span className="text-slate-500">Low mood</span>
                  </div>
                </div>

                {/* Recent entries */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {moodHistory.slice(-5).reverse().map((entry, i) => {
                    const moodInfo = MOOD_ICONS.find(m => m.level === entry.mood) || MOOD_ICONS[2];
                    return (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <moodInfo.icon className={`w-4 h-4 ${moodInfo.color}`} />
                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span>Energy: {entry.energy}/5</span>
                          <span>Stress: {entry.stress}/5</span>
                          <span>Sleep: {entry.sleep_hours}h</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">No mood data yet. Start logging daily to see trends.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wellness;
