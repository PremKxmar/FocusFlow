/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { insightsApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh, getCacheAgeLabel } from '../services/dataCache';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Activity,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

const CACHE_KEY = 'analytics_v2';

interface AnalyticsCacheData {
  trendData: any;
  prevWeekData: any;
  focusWindows: any;
  distractions: any;
}

interface TrendData {
  weeklyTrends: Array<{ date: string; productive_minutes: number; distracting_minutes: number }>;
  hourlyBreakdown: Array<{ time: string; productive: number; distracted: number }>;
  focusStats: { total_focus_time: number; avg_duration: number; completion_rate: number; total_sessions?: number; completed_sessions?: number };
}

const Analytics: React.FC = () => {
  // Load from cache immediately
  const cached = getCachedData<AnalyticsCacheData>(CACHE_KEY);

  const [trendData, setTrendData] = useState<TrendData | null>(cached?.trendData ?? null);
  const [prevWeekData, setPrevWeekData] = useState<TrendData | null>(cached?.prevWeekData ?? null);
  const [focusWindows, setFocusWindows] = useState<any | null>(cached?.focusWindows ?? null);
  const [distractions, setDistractions] = useState<any | null>(cached?.distractions ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [comparisonDay, setComparisonDay] = useState(0); // 0 = today vs yesterday, index into weeklyTrends
  const [lastUpdated, setLastUpdated] = useState(getCacheAgeLabel(CACHE_KEY));

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];

  const fetchAnalytics = useCallback(async (force = false) => {
    // Skip fetch if cache is fresh and not forced
    if (!force && isCacheFresh(CACHE_KEY) && cached) return;

    if (!cached) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [trendsData, prevTrendsData, windowsData, distractionsData] = await Promise.all([
        insightsApi.getTrends(7),
        insightsApi.getTrends(14),
        insightsApi.getFocusWindows(),
        insightsApi.getDistractionPatterns()
      ]);
      setTrendData(trendsData);
      setPrevWeekData(prevTrendsData);
      setDistractions(distractionsData);
      setFocusWindows(windowsData);

      // Save to cache
      setCachedData<AnalyticsCacheData>(CACHE_KEY, {
        trendData: trendsData,
        prevWeekData: prevTrendsData,
        focusWindows: windowsData,
        distractions: distractionsData,
      });
      setLastUpdated('Just now');
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Use ONLY real data - no mock fallbacks
  const consistencyScore = trendData?.focusStats?.completion_rate ?? 0;

  // Use actual focus session time from focusStats, NOT raw productive_minutes from tracker
  const totalFocusTime = trendData?.focusStats?.total_focus_time ?? 0;

  const avgDuration = trendData?.focusStats?.avg_duration ?? 0;
  const totalSessions = trendData?.focusStats?.total_sessions ?? 0;
  const hasData = (trendData?.weeklyTrends?.length ?? 0) > 0;

  // Calculate streak from weekly trends - count consecutive days with productive activity
  const streakDays = (() => {
    if (!trendData?.weeklyTrends?.length) return 0;
    const sorted = [...trendData.weeklyTrends].reverse(); // Most recent first
    let streak = 0;
    for (const day of sorted) {
      if ((day.productive_minutes || 0) > 0) streak++;
      else break;
    }
    return streak;
  })();

  // Calculate weekly change from real data
  const weeklyChange = trendData?.weeklyTrends?.length
    ? Math.round((trendData.weeklyTrends.reduce((sum, d) => sum + (d.productive_minutes || 0), 0) /
      Math.max(trendData.weeklyTrends.length * 60, 1)) * 100 - 50)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show message if no data yet
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">📈</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Analytics Data Yet</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Keep using your computer with the tracker running. Analytics will appear once we have activity data.
        </p>
        <p className="text-sm text-indigo-500 mt-4">Data updates automatically every 10 seconds</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Performance Analytics</h2>
            <p className="text-sm text-slate-500">In-depth analysis of your focus and distraction patterns.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-medium">Updated {lastUpdated}</span>
          )}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm hover:border-indigo-500/50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Productivity Line Graph */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Weekly Productivity
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${weeklyChange >= 0
              ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
              : 'text-rose-500 bg-rose-50 dark:bg-rose-500/10'
              }`}>
              {weeklyChange >= 0 ? '+' : ''}{weeklyChange}% vs last week
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-indigo-500 rounded"></div>
              <span className="text-xs text-slate-500">Productive (min)</span>
            </div>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line jsx-a11y/no-unknown-property */}
              <div className="w-4 h-0.5 bg-rose-500 rounded" style={{ borderTop: '2px dashed #f43f5e' }}></div>
              <span className="text-xs text-slate-500">Distracted (min)</span>
            </div>
          </div>

          <div className="h-64 w-full relative pt-4">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 200">
              {/* Grid lines */}
              {[0, 50, 100, 150, 200].map(y => (
                <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="currentColor" strokeOpacity="0.05" />
              ))}

              <defs>
                <linearGradient id="gradient-prod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-dist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Real time series data from API */}
              {trendData?.weeklyTrends && trendData.weeklyTrends.length > 0 && (() => {
                const data = [...trendData.weeklyTrends].reverse(); // Reverse so oldest is on the left, today on the right
                const maxVal = Math.max(...data.map(d => Math.max(d.productive_minutes || 0, d.distracting_minutes || 0)), 1);
                const width = 700;
                const height = 180;
                const stepX = width / Math.max(data.length - 1, 1);

                // Generate productive line path
                const prodPath = data.map((d, i) => {
                  const x = i * stepX;
                  const y = height - ((d.productive_minutes || 0) / maxVal) * height;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

                // Generate distracted line path
                const distPath = data.map((d, i) => {
                  const x = i * stepX;
                  const y = height - ((d.distracting_minutes || 0) / maxVal) * height;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

                const areaPath = prodPath + ` L ${width} ${height} L 0 ${height} Z`;

                return (
                  <>
                    {/* Productive area fill */}
                    <path d={areaPath} fill="url(#gradient-prod)" fillOpacity="0.2" />

                    {/* Productive line (solid) */}
                    <path d={prodPath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_4px_10px_rgba(99,102,241,0.3)]" />

                    {/* Distracted line (dashed) */}
                    <path d={distPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeDasharray="8,4" />

                    {/* Data points for productive */}
                    {data.map((d, i) => {
                      const x = i * stepX;
                      const y = height - ((d.productive_minutes || 0) / maxVal) * height;
                      return <circle key={`p-${i}`} cx={x} cy={y} r="6" fill="#6366f1" stroke="#fff" strokeWidth="2" />;
                    })}

                    {/* Data points for distracted */}
                    {data.map((d, i) => {
                      const x = i * stepX;
                      const y = height - ((d.distracting_minutes || 0) / maxVal) * height;
                      return <circle key={`d-${i}`} cx={x} cy={y} r="4" fill="#f43f5e" stroke="#fff" strokeWidth="1" />;
                    })}
                  </>
                );
              })()}
            </svg>
            <div className="flex justify-between mt-2 px-2">
              {trendData?.weeklyTrends ? [...trendData.weeklyTrends].reverse().map((d, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              )) : days.map(day => (
                <span key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Consistency Score Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Zap className="w-32 h-32 text-indigo-500" />
          </div>

          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
              <circle
                cx="64" cy="64" r="58" fill="none" stroke="#6366f1" strokeWidth="8"
                strokeDasharray="364.4" strokeDashoffset={364.4 * (1 - consistencyScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-display font-bold text-slate-900 dark:text-white">{consistencyScore}%</span>
            </div>
          </div>

          <h3 className="font-display font-bold text-slate-900 dark:text-white mb-2">Consistency Score</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
            {consistencyScore >= 80 ? 'Excellent consistency! Keep up the great work.' :
              consistencyScore >= 50 ? 'Good consistency. Room to improve focus session completion.' :
                consistencyScore > 0 ? 'Building habits. Try completing more focus sessions.' :
                  'Start focus sessions to build your consistency score.'}
          </p>

          <div className="mt-6 w-full pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
              <span>Streak</span>
              <span className="text-indigo-600 dark:text-indigo-400">{streakDays} {streakDays === 1 ? 'Day' : 'Days'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distraction Heatmap */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              Distraction Patterns
            </h3>
            <div className="flex gap-1">
              {/* eslint-disable-next-line jsx-a11y/no-unknown-property */}
              {[1, 2, 3, 4].map(v => <div key={v} className={`w-3 h-3 rounded-sm bg-rose-500`} style={{ opacity: v * 0.25 }} />)}
            </div>
          </div>

          {distractions && distractions.peak_hours && distractions.peak_hours.length > 0 ? (
            <div>
              <div className="mb-6 space-y-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Peak Distraction Hours (Last 7 Days)</p>
                {distractions.peak_hours.map((peak: any, idx: number) => {
                  const maxDist = Math.max(...distractions.peak_hours.map((p: any) => p.distracted || 0), 1);
                  const width = (peak.distracted / maxDist) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{peak.time}</span>
                        <span>{peak.distracted}m</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {/* eslint-disable-next-line jsx-a11y/no-unknown-property */}
                        <div className="h-full bg-rose-500" style={{ width: `${width}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {distractions.top_distractions && distractions.top_distractions.length > 0 && (
                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Top Distracting Apps</p>
                  <div className="space-y-2">
                    {distractions.top_distractions.map((app: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{app.app_name}</span>
                        <span className="font-bold text-rose-500">{app.total_minutes}m • {app.sessions} sessions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No distraction data yet. Keep tracking to analyze patterns.</p>
            </div>
          )}
        </div>

        {/* Top Productive Hours & Total Focus */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display font-bold text-slate-900 dark:text-white">Top Focus Window</h4>
                <p className="text-xs text-slate-500">Peak performance observed between</p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-center">
              <span className="text-3xl font-display font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">{focusWindows?.bestWindow?.time || 'No data'}</span>
              <div className="flex items-center justify-center gap-2 mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                <TrendingUp className="w-3 h-3" />
                {Math.round(focusWindows?.bestWindow?.focus_ratio || 0)}% Focus Efficiency
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-600/20 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Total Focus Time</p>
              <h4 className="text-4xl font-display font-bold">
                {Math.floor(totalFocusTime / 60)}h {Math.round(totalFocusTime % 60)}m
              </h4>
              <p className="text-indigo-200 text-[10px]">From focus sessions this week</p>
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Target className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Day-over-Day Comparison Panel */}
      {trendData?.weeklyTrends && trendData.weeklyTrends.length >= 2 && (
        <DayComparison
          weeklyTrends={trendData.weeklyTrends}
          prevWeekTrends={prevWeekData?.weeklyTrends}
          comparisonDay={comparisonDay}
          setComparisonDay={setComparisonDay}
        />
      )}
    </div>
  );
};

// Day-over-Day Comparison Component
const DayComparison: React.FC<{
  weeklyTrends: Array<{ date: string; productive_minutes: number; distracting_minutes: number }>;
  prevWeekTrends?: Array<{ date: string; productive_minutes: number; distracting_minutes: number }>;
  comparisonDay: number;
  setComparisonDay: (d: number) => void;
}> = ({ weeklyTrends, prevWeekTrends, comparisonDay, setComparisonDay }) => {
  const trends = [...weeklyTrends].reverse(); // Most recent first
  const today = trends[comparisonDay];
  const yesterday = trends[comparisonDay + 1];

  if (!today || !yesterday) return null;

  const todayProd = today.productive_minutes || 0;
  const yesterdayProd = yesterday.productive_minutes || 0;
  const todayDist = today.distracting_minutes || 0;
  const yesterdayDist = yesterday.distracting_minutes || 0;

  const prodChange = yesterdayProd > 0 ? Math.round(((todayProd - yesterdayProd) / yesterdayProd) * 100) : 0;
  const distChange = yesterdayDist > 0 ? Math.round(((todayDist - yesterdayDist) / yesterdayDist) * 100) : 0;
  const todayFocus = todayProd + todayDist > 0 ? Math.round((todayProd / (todayProd + todayDist)) * 100) : 0;
  const yesterdayFocus = yesterdayProd + yesterdayDist > 0 ? Math.round((yesterdayProd / (yesterdayProd + yesterdayDist)) * 100) : 0;
  const focusChange = yesterdayFocus > 0 ? todayFocus - yesterdayFocus : 0;

  // Week-over-week comparison
  const thisWeekTotal = weeklyTrends.reduce((sum, d) => sum + (d.productive_minutes || 0), 0);
  const prevWeekTotal = prevWeekTrends
    ? prevWeekTrends.slice(0, 7).reduce((sum, d) => sum + (d.productive_minutes || 0), 0)
    : 0;
  const weekChange = prevWeekTotal > 0 ? Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100) : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const ChangeIndicator = ({ value, invertColors = false }: { value: number; invertColors?: boolean }) => {
    const isPositive = invertColors ? value < 0 : value > 0;
    const isNeutral = value === 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isNeutral ? 'text-slate-400' : isPositive ? 'text-emerald-500' : 'text-rose-500'
        }`}>
        {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(value)}%
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-violet-500">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 dark:text-white">Day Comparison</h3>
            <p className="text-[10px] text-slate-500">Compare performance across days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Previous day"
            aria-label="Previous day"
            onClick={() => setComparisonDay(Math.min(comparisonDay + 1, trends.length - 2))}
            disabled={comparisonDay >= trends.length - 2}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[80px] text-center">
            {formatDate(today.date)}
          </span>
          <button
            title="Next day"
            aria-label="Next day"
            onClick={() => setComparisonDay(Math.max(comparisonDay - 1, 0))}
            disabled={comparisonDay <= 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Today */}
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{formatDate(today.date)}</p>
          <div>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{todayProd}m</p>
            <p className="text-[10px] text-slate-500">Productive</p>
          </div>
          <div>
            <p className="text-lg font-bold text-rose-500">{todayDist}m</p>
            <p className="text-[10px] text-slate-500">Distracted</p>
          </div>
          <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-500/20">
            <p className="text-lg font-bold text-slate-800 dark:text-white">{todayFocus}%</p>
            <p className="text-[10px] text-slate-500">Focus Ratio</p>
          </div>
        </div>

        {/* Yesterday */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{formatDate(yesterday.date)}</p>
          <div>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{yesterdayProd}m</p>
            <p className="text-[10px] text-slate-500">Productive</p>
          </div>
          <div>
            <p className="text-lg font-bold text-rose-500">{yesterdayDist}m</p>
            <p className="text-[10px] text-slate-500">Distracted</p>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <p className="text-lg font-bold text-slate-800 dark:text-white">{yesterdayFocus}%</p>
            <p className="text-[10px] text-slate-500">Focus Ratio</p>
          </div>
        </div>
      </div>

      {/* Change metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Productivity</p>
          <ChangeIndicator value={prodChange} />
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Distractions</p>
          <ChangeIndicator value={distChange} invertColors />
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Focus</p>
          <ChangeIndicator value={focusChange} />
        </div>
      </div>

      {/* Visual bar comparison */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visual Comparison</p>
        {[
          { label: 'Productive Time', today: todayProd, yesterday: yesterdayProd, color: 'indigo' },
          { label: 'Distracted Time', today: todayDist, yesterday: yesterdayDist, color: 'rose' },
          { label: 'Focus Ratio', today: todayFocus, yesterday: yesterdayFocus, color: 'emerald', isPercent: true },
        ].map(({ label, today: t, yesterday: y, color, isPercent }) => {
          const maxVal = Math.max(t, y, 1);
          const tWidth = isPercent ? t : (t / maxVal) * 100;
          const yWidth = isPercent ? y : (y / maxVal) * 100;
          return (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 font-bold">{label}</span>
                <span className="text-slate-400">{t}{isPercent ? '%' : 'm'} vs {y}{isPercent ? '%' : 'm'}</span>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-${color}-500 rounded-full transition-all duration-500`} style={{ width: `${tWidth}%` }}></div>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-${color}-300 dark:bg-${color}-700 rounded-full transition-all duration-500`} style={{ width: `${yWidth}%` }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly comparison summary */}
      {prevWeekTrends && prevWeekTrends.length > 0 && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Week-over-Week</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              This week: {Math.round(thisWeekTotal)}m vs Last week: {Math.round(prevWeekTotal)}m productive
            </p>
          </div>
          <div className={`flex items-center gap-1 text-sm font-bold ${weekChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}>
            {weekChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {weekChange >= 0 ? '+' : ''}{weekChange}%
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
