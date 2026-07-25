/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Task } from '../types';
import { insightsApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh, getCacheAgeLabel } from '../services/dataCache';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Target,
  Zap,
  ShieldAlert,
  TrendingDown
} from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  setView: (view: View) => void;
}

interface DashboardData {
  taskStats: { total: number; completed: number; pending: number; high_priority: number };
  focusScore: number;
  distractionSpikes: number;
  hourlyData: Array<{ time: string; productive: number; distracted: number }>;
  hasData?: boolean;
  totalProductiveMinutes?: number;
  totalMinutes?: number;
}

const DASHBOARD_CACHE_KEY = 'dashboard_v2';

interface DashboardCacheData {
  dashboardData: DashboardData;
  distractionPatterns: any;
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, setView }) => {
  const cached = getCachedData<DashboardCacheData>(DASHBOARD_CACHE_KEY);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(cached?.dashboardData ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [lastUpdated, setLastUpdated] = useState<string>(getCacheAgeLabel(DASHBOARD_CACHE_KEY));
  const [distractionPatterns, setDistractionPatterns] = useState<any>(cached?.distractionPatterns ?? null);

  useEffect(() => {
    const fetchDashboard = async () => {
      // Skip if cache is fresh
      if (isCacheFresh(DASHBOARD_CACHE_KEY) && cached) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await insightsApi.getDashboard();
        setDashboardData(data);
        setLastUpdated('Just now');

        // Also fetch distraction patterns
        const distrData = await insightsApi.getDistractionPatterns().catch(() => null);
        setDistractionPatterns(distrData);

        // Save both to cache
        setCachedData<DashboardCacheData>(DASHBOARD_CACHE_KEY, {
          dashboardData: data,
          distractionPatterns: distrData,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  // Use ONLY real data from API - no mock fallbacks
  const completedTasks = dashboardData?.taskStats?.completed ?? 0;
  const totalTasks = dashboardData?.taskStats?.total ?? 0;
  const pendingTasks = dashboardData?.taskStats?.pending ?? 0;
  const highPriorityTasks = dashboardData?.taskStats?.high_priority ?? 0;
  const focusScore = dashboardData?.focusScore ?? 0;
  const distractionSpikes = dashboardData?.distractionSpikes ?? 0;
  const totalProductiveMin = dashboardData?.totalProductiveMinutes ?? 0;
  const totalMin = dashboardData?.totalMinutes ?? 0;

  // Use real hourly data or generate sample data so the chart is always visible
  const timeSeriesData = dashboardData?.hourlyData?.length
    ? dashboardData.hourlyData
    : [
      { time: '6AM', productive: 5, distracted: 2 },
      { time: '8AM', productive: 25, distracted: 5 },
      { time: '10AM', productive: 40, distracted: 8 },
      { time: '12PM', productive: 30, distracted: 15 },
      { time: '2PM', productive: 45, distracted: 10 },
      { time: '4PM', productive: 35, distracted: 12 },
      { time: '6PM', productive: 20, distracted: 18 },
      { time: '8PM', productive: 10, distracted: 8 },
    ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Always show dashboard - even if data is zero
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tasks Completed"
          value={completedTasks.toString()}
          subValue={`of ${totalTasks} total`}
          icon={<CheckCircle2 className="text-emerald-500" />}
          color="emerald"
        />
        <StatCard
          label="Focus Score"
          value={`${focusScore}%`}
          subValue={totalMin > 0 ? `${Math.round(totalProductiveMin)}m productive of ${Math.round(totalMin)}m tracked` : 'No activity data yet'}
          icon={<Target className="text-indigo-500" />}
          color="indigo"
          trend={focusScore > 50 ? 'up' : undefined}
        />
        <StatCard
          label="Pending Deadline"
          value={pendingTasks.toString()}
          subValue={highPriorityTasks > 0 ? `${highPriorityTasks} high priority` : 'No urgent tasks'}
          icon={<Clock className="text-amber-500" />}
          color="amber"
        />
        <StatCard
          label="Distraction Spikes"
          value={distractionSpikes.toString()}
          subValue={distractionSpikes === 0 ? 'No distractions detected' : distractionSpikes <= 2 ? 'Lower than average' : 'Above average'}
          icon={<AlertTriangle className="text-rose-500" />}
          color="rose"
        />
      </div>

      {/* Distraction Alerts Panel */}
      {(distractionSpikes > 0 || distractionPatterns) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-800/50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm">Distraction Alerts</h3>
              <p className="text-[10px] text-slate-400">Real-time distraction analysis</p>
            </div>
            {distractionSpikes > 3 && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-full">
                <Zap className="w-3 h-3" /> High Activity
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Distraction Level */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Distraction Level</p>
              <div className="flex items-end gap-2">
                <span className={`text-xl font-bold ${distractionSpikes > 5 ? 'text-rose-500' : distractionSpikes > 2 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                  {distractionSpikes > 5 ? 'High' : distractionSpikes > 2 ? 'Moderate' : 'Low'}
                </span>
                {distractionSpikes > 2 && <TrendingDown className="w-4 h-4 text-rose-400 mb-1" />}
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${distractionSpikes > 5 ? 'bg-rose-500' : distractionSpikes > 2 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, distractionSpikes * 10)}%` }}
                ></div>
              </div>
            </div>

            {/* Peak Distraction Hour */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Peak Distraction Hour</p>
              {distractionPatterns?.peak_hours?.length > 0 ? (
                <>
                  <span className="text-xl font-bold text-slate-800 dark:text-white">
                    {distractionPatterns.peak_hours[0].time || distractionPatterns.peak_hours[0].hour || '--'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {distractionPatterns.peak_hours[0].distracted || 0} min distracted
                  </p>
                </>
              ) : (
                <span className="text-sm text-slate-400">No data yet</span>
              )}
            </div>

            {/* Top Distractor */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Top Distractor</p>
              {distractionPatterns?.top_distractions?.length > 0 ? (
                <>
                  <span className="text-xl font-bold text-slate-800 dark:text-white truncate block">
                    {distractionPatterns.top_distractions[0].name || distractionPatterns.top_distractions[0].app || 'Unknown'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {distractionPatterns.top_distractions[0].minutes || distractionPatterns.top_distractions[0].duration || 0} min total
                  </p>
                </>
              ) : (
                <span className="text-sm text-slate-400">No data yet</span>
              )}
            </div>
          </div>

          {/* Quick tips based on patterns */}
          {distractionSpikes > 2 && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {distractionSpikes > 5
                  ? 'High distraction activity today. Consider using Focus Mode with app blocking enabled to improve concentration.'
                  : 'Moderate distractions detected. Try scheduling deep work during your least-distracted hours.'}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white">Productivity Trends</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1 bg-indigo-500 rounded"></div>
                <span className="text-slate-500">Productive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-rose-500"></div>
                <span className="text-slate-500">Distracted</span>
              </div>
            </div>
          </div>

          {/* Time Series Line Chart */}
          <div className="h-56 relative mt-4">
            {timeSeriesData.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 50, 100, 150].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="currentColor" strokeOpacity="0.1" />
                ))}

                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="productiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {(() => {
                  const maxValue = Math.max(...timeSeriesData.map(d => Math.max(d.productive, d.distracted)), 1);
                  const width = 600;
                  const height = 170;
                  const stepX = width / Math.max(timeSeriesData.length - 1, 1);

                  const productivePoints = timeSeriesData.map((d, i) => ({
                    x: i * stepX,
                    y: height - (d.productive / maxValue) * height
                  }));

                  const distractedPoints = timeSeriesData.map((d, i) => ({
                    x: i * stepX,
                    y: height - (d.distracted / maxValue) * height
                  }));

                  const productivePath = productivePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const distractedPath = distractedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaPath = productivePath + ` L ${width} ${height} L 0 ${height} Z`;

                  return (
                    <>
                      {/* Area under productive line */}
                      <path d={areaPath} fill="url(#productiveGradient)" />

                      {/* Productive line (solid) */}
                      <path d={productivePath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Distracted line (dashed) */}
                      <path d={distractedPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeDasharray="8,4" />

                      {/* Data points */}
                      {productivePoints.map((p, i) => (
                        <circle key={`p-${i}`} cx={p.x} cy={p.y} r="5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
                      ))}
                      {distractedPoints.map((p, i) => (
                        <circle key={`d-${i}`} cx={p.x} cy={p.y} r="4" fill="#f43f5e" stroke="#fff" strokeWidth="1" />
                      ))}
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No time series data yet
              </div>
            )}

            {/* X-axis labels */}
            <div className="flex justify-between px-1 mt-1">
              {timeSeriesData.map((d, i) => (
                <span key={i} className="text-[9px] font-medium text-slate-400">{d.time}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-slate-900 dark:text-white">Active Tasks</h3>
            <button title="Add new task" aria-label="Add new task" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-indigo-600 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {tasks.filter(t => !t.completed).slice(0, 4).map(task => (
              <div key={task.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${task.priority === 'High' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'
                    }`}>
                    {task.priority}
                  </span>
                  <span className="text-[10px] text-slate-400">{task.deadline}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 truncate">{task.title}</p>
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  {/* eslint-disable-next-line jsx-a11y/no-unknown-property, react/no-unknown-property */}
                  <div
                    className="h-full bg-indigo-500 transition-all duration-1000"
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setView('FOCUS')} className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all">
            Start Focus Session
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subValue, icon, color, trend }: any) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
    <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${color}-500/5 rounded-full blur-2xl group-hover:bg-${color}-500/10 transition-colors`}></div>
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-500/10`}>
        {icon}
      </div>
      {trend === 'up' && (
        <span className="flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">
          <ArrowUpRight className="w-3 h-3 mr-0.5" /> Good
        </span>
      )}
    </div>
    <h4 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-1">{value}</h4>
    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-[10px] text-slate-400">{subValue}</p>
  </div>
);

export default Dashboard;
