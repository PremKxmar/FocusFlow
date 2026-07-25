/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { insightsApi, tasksApi, focusApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh, getCacheAgeLabel } from '../services/dataCache';
import {
  FileText,
  Download,
  Share2,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Clock,
  Target,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

type ReportPeriod = 'weekly' | 'monthly';

interface ReportData {
  period: string;
  periodLabel: string;
  tasksCompleted: number;
  tasksCreated: number;
  completionRate: number;
  totalFocusTime: string;
  totalFocusMinutes: number;
  avgSessionDuration: string;
  productiveTime: string;
  distractedTime: string;
  focusScore: number;
  avgDailyFocus: string;
  topCategory: string;
  streakDays: number;
}

const REPORT_CACHE_PREFIX = 'reports';

const Reports: React.FC = () => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [generatedReports, setGeneratedReports] = useState<Array<{ title: string; date: string; type: string; data?: any }>>([]);
  const [lastUpdated, setLastUpdated] = useState('');

  const getCacheKey = () => `${REPORT_CACHE_PREFIX}_${period}_${period === 'weekly' ? weekOffset : monthOffset}`;

  useEffect(() => {
    const cacheKey = getCacheKey();
    const cached = getCachedData<ReportData>(cacheKey);
    if (cached) {
      setReport(cached);
      setIsLoading(false);
      setLastUpdated(getCacheAgeLabel(cacheKey));
    }
    fetchReport();
  }, [period, weekOffset, monthOffset]);

  const fetchReport = async (force = false) => {
    const cacheKey = getCacheKey();
    if (!force && isCacheFresh(cacheKey) && getCachedData(cacheKey)) {
      return;
    }

    if (!report) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const days = period === 'weekly' ? 7 : 30;

      // Fetch data from multiple sources
      const [weeklyReport, taskStats, focusStats, trends] = await Promise.all([
        insightsApi.getWeeklyReport().catch(() => ({ report: null })),
        tasksApi.getStats().catch(() => ({ stats: null })),
        focusApi.getStats(days).catch(() => null),
        insightsApi.getTrends(days).catch(() => null),
      ]);

      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      if (period === 'weekly') {
        periodEnd = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000);
        periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);
        periodStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      }

      const periodLabel = period === 'weekly'
        ? `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const completedTasks = taskStats?.stats?.completed || weeklyReport?.report?.tasksCompleted || 0;
      const totalTasks = taskStats?.stats?.total || weeklyReport?.report?.tasksCreated || 0;
      // focusApi.getStats returns { stats: { total_focus_time, total_sessions, avg_duration, ... } }
      const focusData = focusStats?.stats || focusStats || {};
      const focusMins = focusData.total_focus_time || 0;
      const sessCount = focusData.total_sessions || 0;
      const completionRate = focusData.completion_rate || 0;

      // Also get productive/distracted time from trends
      const trendProdMins = trends?.weeklyTrends?.reduce((s: number, d: any) => s + (d.productive_minutes || 0), 0) || 0;
      const trendDistMins = trends?.weeklyTrends?.reduce((s: number, d: any) => s + (d.distracting_minutes || 0), 0) || 0;

      // Compute streak from trends data
      const computedStreak = (() => {
        if (!trends?.weeklyTrends?.length) return 0;
        const sorted = [...trends.weeklyTrends].reverse();
        let streak = 0;
        for (const day of sorted) {
          if ((day.productive_minutes || 0) > 0) streak++;
          else break;
        }
        return streak;
      })();

      const reportData: ReportData = {
        period: `${days} days`,
        periodLabel,
        tasksCompleted: completedTasks,
        tasksCreated: totalTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        totalFocusTime: formatMinutes(Math.round(focusMins)),
        totalFocusMinutes: Math.round(focusMins),
        avgSessionDuration: sessCount > 0 ? formatMinutes(Math.round(focusMins / sessCount)) : '0m',
        productiveTime: weeklyReport?.report?.productiveTime || formatMinutes(Math.round(trendProdMins)),
        distractedTime: weeklyReport?.report?.distractedTime || formatMinutes(Math.round(trendDistMins)),
        focusScore: weeklyReport?.report?.focusScore || (trendProdMins + trendDistMins > 0
          ? Math.round((trendProdMins / (trendProdMins + trendDistMins)) * 100)
          : 0),
        avgDailyFocus: formatMinutes(Math.round(focusMins / days)),
        topCategory: 'Development',
        streakDays: computedStreak,
      };

      setReport(reportData);
      setCachedData(getCacheKey(), reportData);
      setLastUpdated('Just now');
    } catch (error) {
      console.error('Failed to fetch report:', error);
      setReport(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleExportCSV = () => {
    if (!report) return;

    const csvContent = `Metric,Value
Period,${report.periodLabel}
Report Type,${period === 'weekly' ? 'Weekly' : 'Monthly'}
Tasks Completed,${report.tasksCompleted}
Tasks Created,${report.tasksCreated}
Completion Rate,${report.completionRate}%
Total Focus Time,${report.totalFocusTime}
Avg Session Duration,${report.avgSessionDuration}
Avg Daily Focus,${report.avgDailyFocus}
Productive Time,${report.productiveTime}
Distracted Time,${report.distractedTime}
Focus Score,${report.focusScore}%`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FocusFlow-${period}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = () => {
    if (!report) return;
    const newReport = {
      title: `${period === 'weekly' ? 'Weekly' : 'Monthly'} Summary — ${report.periodLabel}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      type: period === 'weekly' ? 'Weekly' : 'Monthly',
      data: { ...report },
    };
    setGeneratedReports(prev => [newReport, ...prev]);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (period === 'weekly') {
      setWeekOffset(prev => direction === 'prev' ? prev + 1 : Math.max(0, prev - 1));
    } else {
      setMonthOffset(prev => direction === 'prev' ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Report Data Yet</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Start using FocusFlow to track tasks and focus sessions. Reports will be generated automatically from your activity data.
        </p>
        <button onClick={() => fetchReport(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const completionVelocity = report
    ? (report.tasksCompleted / (period === 'weekly' ? 7 : 30)).toFixed(1)
    : '0';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with period selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Performance Reports</h2>
          <p className="text-sm text-slate-500">Historical review and long-term trend analysis.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Period Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => { setPeriod('weekly'); setWeekOffset(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === 'weekly' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Weekly
            </button>
            <button
              onClick={() => { setPeriod('monthly'); setMonthOffset(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === 'monthly' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
          </div>

          {/* Period Navigation */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2">
            <button onClick={() => navigatePeriod('prev')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="Previous period">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[120px] text-center">
              {report?.periodLabel || 'Current'}
            </span>
            <button
              onClick={() => navigatePeriod('next')}
              disabled={(period === 'weekly' && weekOffset === 0) || (period === 'monthly' && monthOffset === 0)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ReportCard
          title="Completion Velocity"
          value={`${completionVelocity} tasks/day`}
          description={`${report?.tasksCompleted || 0} of ${report?.tasksCreated || 0} tasks completed`}
          icon={<TrendingUp className="text-emerald-500" />}
          metric={`${report?.completionRate || 0}% rate`}
        />
        <ReportCard
          title="Deep Work Volume"
          value={report?.totalFocusTime || '0h'}
          description="Total focus time in sessions"
          icon={<Clock className="text-indigo-500" />}
          metric={`Avg ${report?.avgDailyFocus || '0m'}/day`}
        />
        <ReportCard
          title="Focus Score"
          value={`${report?.focusScore || 0}%`}
          description="Overall focus effectiveness"
          icon={<Target className="text-amber-500" />}
          metric={report?.avgSessionDuration ? `${report.avgSessionDuration} avg session` : ''}
        />
        <ReportCard
          title="Distraction Cost"
          value={report?.distractedTime || '0h'}
          description="Estimated productivity lost"
          icon={<AlertCircle className="text-rose-500" />}
          metric="Unproductive time"
        />
      </div>

      {/* Focus Score Visual */}
      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
          <h3 className="font-display font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            {period === 'weekly' ? 'Weekly' : 'Monthly'} Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <BreakdownItem label="Tasks Done" value={report.tasksCompleted} total={report.tasksCreated} color="emerald" />
            <BreakdownItem label="Focus Time" value={report.totalFocusMinutes} total={period === 'weekly' ? 7 * 480 : 30 * 480} color="indigo" suffix="min" />
            <BreakdownItem label="Focus Score" value={report.focusScore} total={100} color="amber" suffix="%" />
            <BreakdownItem label="Streak" value={report.streakDays} total={period === 'weekly' ? 7 : 30} color="purple" suffix=" days" />
          </div>
        </div>
      )}

      {/* Generated Reports List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-bold text-slate-900 dark:text-white">Generated Summaries</h3>
          <button
            onClick={handleGenerateReport}
            disabled={!report}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
        <div className="space-y-4">
          {generatedReports.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">No reports generated yet</p>
              <p className="text-xs">Click "Generate Report" to create a summary snapshot</p>
            </div>
          )}
          {generatedReports.map((r, idx) => (
            <ReportListItem
              key={idx}
              title={r.title}
              date={r.date}
              type={r.type}
              onExport={() => {
                if (!r.data) return;
                const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `FocusFlow-report-${r.type.toLowerCase()}-${idx}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ReportCard = ({ title, value, description, icon, metric }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</div>
      {metric && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">{metric}</span>}
    </div>
    <h4 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-1">{value}</h4>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
    <p className="text-[10px] text-slate-400 mt-2">{description}</p>
  </div>
);

const BreakdownItem = ({ label, value, total, color, suffix }: { label: string; value: number; total: number; color: string; suffix?: string }) => {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-white">{value}{suffix || ''}</p>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorMap[color] || 'bg-indigo-500'} transition-all duration-700`} style={{ width: `${pct}%` }}></div>
      </div>
      <p className="text-[10px] text-slate-400">{pct}% of target</p>
    </div>
  );
};

const ReportListItem = ({ title, date, type, onExport }: any) => (
  <div className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <FileText className="w-5 h-5 text-indigo-500" />
      </div>
      <div>
        <h5 className="font-bold text-slate-800 dark:text-slate-200">{title}</h5>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{date}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className={`font-bold ${type === 'Weekly' ? 'text-indigo-500' : 'text-amber-500'}`}>{type} Report</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button title="Download report" aria-label="Download report" onClick={onExport} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
        <Download className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export default Reports;
