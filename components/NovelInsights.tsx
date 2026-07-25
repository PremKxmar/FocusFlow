/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NovelInsights Component — 6 Novel Research Contributions
 *  1. SHAP Explainable AI
 *  2. Digital Fatigue Index
 *  3. Context-Switch Cost (Attention Residue)
 *  4. Procrastination Sequence Mining
 *  5. Adaptive Ensemble Weights
 *  6. Mood–Productivity Bidirectional VAR
 */
import React, { useState, useEffect, useCallback } from 'react';
import { novelApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh, getCacheAgeLabel } from '../services/dataCache';
import {
  Sparkles,
  Brain,
  Zap,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Eye,
  Shuffle,
  Search,
  Heart,
  Gauge,
  ArrowRight,
  ArrowLeftRight,
  Timer,
  Coffee,
  Lightbulb,
  Shield,
  ChevronRight,
  Info,
} from 'lucide-react';

/* ------------------------------------------------------------------ types -- */
interface ShapFeature {
  feature: string;
  raw_feature?: string;
  value?: number;
  shap_value?: number;
  impact: number;
  direction: string;
}

interface ShapData {
  feature_contributions?: ShapFeature[];
  top_positive?: ShapFeature[];
  top_negative?: ShapFeature[];
  explanation_text?: string;
  prediction?: string;
  probabilities?: Record<string, number>;
  shap_available?: boolean;
  method?: string;
  error?: string;
}

interface FatigueData {
  fatigue_index?: number;
  dfi_score?: number;
  status?: string;
  signals?: Record<string, number>;
  signal_labels?: Record<string, string>;
  recommendation?: string;
  color?: string;
  trend?: string;
  error?: string;
}

interface ContextSwitchData {
  csps?: number;
  total_switches?: number;
  costly_switches?: number;
  attention_residue?: { avg_recovery_minutes?: number };
  top_transitions?: Array<{ from: string; to: string; count: number; cost: string }>;
  recommendations?: string[];
  error?: string;
}

interface ProcrastinationData {
  risk_score?: number;
  risk_level?: string;
  total_episodes?: number;
  episodes_detected?: number;
  trigger_apps?: Array<{ app: string; count: number } | string>;
  peak_procrastination_hours?: Array<{ hour: number; count: number }>;
  peak_hours?: number[];
  frequent_patterns?: Array<{ pattern: string[]; count: number; support: number }>;
  patterns?: Array<{ sequence: string[]; support: number }>;
  recommendations?: string[] | string;
  error?: string;
}

interface EnsembleData {
  weights?: { lstm: number; arima: number; prophet: number };
  report?: {
    total_updates?: number;
    model_ranking?: string[];
    weight_history?: Array<{ lstm: number; arima: number; prophet: number }>;
  };
  error?: string;
}

interface MoodData {
  has_sufficient_data?: boolean;
  observations?: number;
  correlation?: { value?: number; strength?: string; direction?: string; interpretation?: string };
  granger_causality?: {
    mood_causes_productivity?: { significant?: boolean; p_value?: number; best_lag?: number };
    productivity_causes_mood?: { significant?: boolean; p_value?: number; best_lag?: number };
    bidirectional?: boolean;
    interpretation?: string;
  };
  dominant_direction?: { direction?: string; label?: string; explanation?: string };
  var_model?: { forecast?: Array<{ date: string; predicted_mood: number; predicted_productivity: number }> };
  impulse_response?: {
    mood_shock_on_productivity?: number[];
    productivity_shock_on_mood?: number[];
    interpretation?: string;
  };
  insights?: string[];
  aligned_data?: Array<{ date: string; mood: number; productivity: number }>;
  message?: string;
  error?: string;
}

interface OverviewData {
  shap?: ShapData;
  fatigue?: FatigueData;
  context_switch?: ContextSwitchData;
  procrastination?: ProcrastinationData;
  ensemble?: EnsembleData;
  mood_productivity?: MoodData;
}

/* ============================================================ Component ==== */
const NOVEL_CACHE_KEY = 'novel_insights';

const NovelInsights: React.FC = () => {
  const cached = getCachedData<OverviewData>(NOVEL_CACHE_KEY);

  const [data, setData] = useState<OverviewData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState(getCacheAgeLabel(NOVEL_CACHE_KEY));

  const loadData = useCallback(async (force = false) => {
    if (!force && isCacheFresh(NOVEL_CACHE_KEY) && cached) return;

    if (!cached) setLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await novelApi.getOverview();
      setData(result);
      setCachedData(NOVEL_CACHE_KEY, result);
      setLastUpdated('Just now');
    } catch (err) {
      console.error('Failed to load novel insights', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs = [
    { label: 'SHAP AI', icon: Eye, color: 'indigo' },
    { label: 'Fatigue', icon: Gauge, color: 'orange' },
    { label: 'Context Switch', icon: Shuffle, color: 'cyan' },
    { label: 'Procrastination', icon: Search, color: 'rose' },
    { label: 'Ensemble', icon: BarChart3, color: 'emerald' },
    { label: 'Mood–Prod', icon: Heart, color: 'purple' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-slate-400 text-sm">Computing novel insights…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Novel Research Insights</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">6 conference-paper-level contributions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-medium">Updated {lastUpdated}</span>
          )}
          <button onClick={() => loadData(true)} disabled={isRefreshing} title="Refresh data" className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === i
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content panels */}
      {activeTab === 0 && <SHAPPanel data={data?.shap} />}
      {activeTab === 1 && <FatiguePanel data={data?.fatigue} />}
      {activeTab === 2 && <ContextSwitchPanel data={data?.context_switch} />}
      {activeTab === 3 && <ProcrastinationPanel data={data?.procrastination} />}
      {activeTab === 4 && <EnsemblePanel data={data?.ensemble} />}
      {activeTab === 5 && <MoodProductivityPanel data={data?.mood_productivity} />}
    </div>
  );
};

/* ============================================================ Card Shell === */
const Card: React.FC<{ title: string; subtitle?: string; icon: React.ElementType; gradient: string; children: React.ReactNode }> = ({
  title, subtitle, icon: Icon, gradient, children,
}) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
    <div className={`p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-gradient-to-r ${gradient}`}>
      <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const MetricBox: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color = 'indigo' }) => (
  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

const Pill: React.FC<{ text: string; color?: string }> = ({ text, color = 'slate' }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-${color}-100 dark:bg-${color}-500/10 text-${color}-700 dark:text-${color}-300`}>
    {text}
  </span>
);

/* ============================================================= 1. SHAP ==== */
const SHAPPanel: React.FC<{ data?: ShapData }> = ({ data }) => {
  if (!data) return <EmptyState msg="SHAP analysis unavailable" />;

  const features = data.feature_contributions || [];
  const topPos = data.top_positive || [];
  const topNeg = data.top_negative || [];
  const maxAbs = Math.max(...features.map((f) => Math.abs(f.impact)), 0.01);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="SHAP Feature Contributions" subtitle={data.method || 'TreeExplainer'} icon={Eye} gradient="from-indigo-600 to-indigo-500">
        <div className="space-y-3">
          {features.slice(0, 10).map((f, i) => {
            const pct = (Math.abs(f.impact) / maxAbs) * 100;
            const positive = (f.shap_value ?? f.impact) >= 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{f.feature.replace(/_/g, ' ')}</span>
                  <span className={positive ? 'text-emerald-600' : 'text-rose-500'}>{positive ? '+' : ''}{(f.shap_value ?? f.impact).toFixed(3)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Explanation" subtitle={data.prediction ? `Predicted: ${data.prediction}` : 'Natural-language summary'} icon={Lightbulb} gradient="from-amber-500 to-orange-500">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-5">{data.explanation_text || 'No explanation available.'}</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Top Boosters</p>
            {topPos.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 text-slate-600 dark:text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {f.feature.replace(/_/g, ' ')}
              </div>
            ))}
            {topPos.length === 0 && <p className="text-xs text-slate-400">—</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-500 mb-2 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Top Drags</p>
            {topNeg.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 text-slate-600 dark:text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {f.feature.replace(/_/g, ' ')}
              </div>
            ))}
            {topNeg.length === 0 && <p className="text-xs text-slate-400">—</p>}
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ============================================================ 2. Fatigue === */
const FatiguePanel: React.FC<{ data?: FatigueData }> = ({ data }) => {
  if (!data) return <EmptyState msg="Fatigue index unavailable" />;

  const idx = data.dfi_score ?? data.fatigue_index ?? 0;
  const status = data.status || 'unknown';
  const signals = data.signals || {};

  const statusColors: Record<string, string> = {
    Fresh: 'emerald', Moderate: 'amber', Fatigued: 'orange', 'Burnout Risk': 'rose', unknown: 'slate',
  };
  const clr = statusColors[status] || 'slate';

  const signalLabels: Record<string, string> = {
    session_decay: 'Session Decay',
    switch_rate: 'App Switch Rate',
    productivity_shift: 'Productivity Drop',
    time_since_break: 'Break Gap',
    distraction_slope: 'Distraction Trend',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Gauge */}
      <Card title="Digital Fatigue Index" subtitle="Real-time cognitive load" icon={Gauge} gradient="from-orange-500 to-red-500">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor"
                className={`text-${clr}-500`}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(idx / 100) * 314} 314`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{idx}</span>
              <span className={`text-xs font-semibold text-${clr}-600 dark:text-${clr}-400`}>{status}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Signals */}
      <Card title="Behavioral Signals" subtitle="5-component decomposition" icon={Activity} gradient="from-cyan-500 to-blue-500">
        <div className="space-y-3">
          {Object.entries(signals).map(([key, val]) => {
            const v = typeof val === 'number' ? val : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{signalLabels[key] || key}</span>
                  <span className="font-mono text-slate-900 dark:text-white">{(v * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${v * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recommendation */}
      <Card title="Recommendation" subtitle="AI-powered guidance" icon={Coffee} gradient="from-emerald-500 to-teal-500">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <Lightbulb className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
            {data.recommendation || 'Log more data to receive personalized break recommendations.'}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MetricBox label="Current" value={idx} color={clr as any} />
          <MetricBox label="Threshold" value="70" color="amber" />
          <MetricBox label="Goal" value="<40" color="emerald" />
        </div>
      </Card>
    </div>
  );
};

/* ================================================== 3. Context-Switch ====== */
const ContextSwitchPanel: React.FC<{ data?: ContextSwitchData }> = ({ data }) => {
  if (!data) return <EmptyState msg="Context-switch analysis unavailable" />;

  const csps = data.csps ?? 0;
  const transitions = data.top_transitions || [];
  const recommendations = data.recommendations || [];
  const residue = data.attention_residue || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* CSPS score + stats */}
      <Card title="Context-Switch Penalty Score" subtitle="Attention residue modeling" icon={Shuffle} gradient="from-cyan-600 to-teal-500">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <MetricBox label="CSPS" value={csps} color="cyan" />
          <MetricBox label="Total Switches" value={data.total_switches ?? 0} color="slate" />
          <MetricBox label="Costly" value={data.costly_switches ?? 0} sub="prod→distr" color="rose" />
        </div>
        {residue.avg_recovery_minutes !== undefined && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Average recovery time after a costly switch: <strong>{residue.avg_recovery_minutes?.toFixed(1)} min</strong>
          </div>
        )}
      </Card>

      {/* Transitions + Recommendations */}
      <Card title="Top App Transitions" subtitle="Most frequent context switches" icon={ArrowLeftRight} gradient="from-violet-500 to-purple-500">
        <div className="space-y-2 mb-4">
          {transitions.slice(0, 6).map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{t.from}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{t.to}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${t.cost === 'high' ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  : t.cost === 'medium' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                {t.count}x
              </span>
            </div>
          ))}
          {transitions.length === 0 && <p className="text-xs text-slate-400">No transitions recorded yet.</p>}
        </div>
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommendations</p>
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-500" />
                {r}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* =============================================== 4. Procrastination ======== */
const ProcrastinationPanel: React.FC<{ data?: ProcrastinationData }> = ({ data }) => {
  if (!data) return <EmptyState msg="Procrastination analysis unavailable" />;

  const risk = data.risk_score ?? 0;
  const riskColor = risk < 30 ? 'emerald' : risk < 60 ? 'amber' : 'rose';

  const totalEpisodes = data.total_episodes ?? data.episodes_detected ?? 0;
  const triggerApps = (data.trigger_apps || []).map((t: any) => typeof t === 'string' ? t : t.app || t.name || '');
  const peakHours = data.peak_procrastination_hours?.map((h: any) => h.hour ?? h) ?? data.peak_hours ?? [];
  const patterns = data.frequent_patterns ?? data.patterns ?? [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : data.recommendations ? [data.recommendations] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Risk score */}
      <Card title="Procrastination Risk" subtitle="Sequence-mined score" icon={AlertTriangle} gradient="from-rose-600 to-pink-500">
        <div className="flex flex-col items-center gap-3">
          <div className={`text-5xl font-bold text-${riskColor}-600 dark:text-${riskColor}-400`}>{risk}</div>
          <p className="text-sm text-slate-500">out of 100</p>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${risk < 30 ? 'from-emerald-400 to-emerald-500' : risk < 60 ? 'from-amber-400 to-orange-500' : 'from-rose-400 to-red-500'
              } rounded-full transition-all`} style={{ width: `${risk}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <MetricBox label="Episodes" value={totalEpisodes} color="rose" />
            <MetricBox label="Peak Hour" value={peakHours[0] != null ? `${peakHours[0]}:00` : '—'} color="amber" />
          </div>
        </div>
      </Card>

      {/* Trigger Apps */}
      <Card title="Trigger Apps" subtitle="Apps preceding procrastination" icon={Search} gradient="from-amber-500 to-yellow-500">
        <div className="space-y-2">
          {triggerApps.filter(Boolean).slice(0, 8).map((app: string, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className={`w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300`}>
                {i + 1}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">{app}</span>
            </div>
          ))}
          {(!triggerApps || triggerApps.filter(Boolean).length === 0) && (
            <p className="text-xs text-slate-400">No procrastination triggers detected.</p>
          )}
        </div>
      </Card>

      {/* Patterns + Recommendations */}
      <Card title="Mined Patterns" subtitle="Frequent sequences" icon={Brain} gradient="from-purple-600 to-violet-500">
        <div className="space-y-3 mb-4">
          {patterns.slice(0, 4).map((p: any, i: number) => {
            const seq = p.sequence || p.pattern || [];
            return (
              <div key={i} className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                <div className="flex items-center gap-1 flex-wrap mb-1">
                  {seq.map((s: string, j: number) => (
                    <React.Fragment key={j}>
                      <span className="text-xs font-mono px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-purple-700 dark:text-purple-300">{s}</span>
                      {j < seq.length - 1 && <ArrowRight className="w-3 h-3 text-purple-400" />}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400">Support: {((p.support ?? 0) * 100).toFixed(0)}%</p>
              </div>
            );
          })}
          {patterns.length === 0 && <p className="text-xs text-slate-400">Not enough episodes for pattern mining.</p>}
        </div>
        {recommendations.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommendations</p>
            {recommendations.map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 mb-1.5">
                <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-purple-500" />
                {r}
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
};

/* ============================================ 5. Adaptive Ensemble ========= */
const EnsemblePanel: React.FC<{ data?: EnsembleData }> = ({ data }) => {
  if (!data) return <EmptyState msg="Ensemble weight data unavailable" />;

  const w = data.weights || { lstm: 0.4, arima: 0.3, prophet: 0.3 };
  const report = data.report || {};
  const ranking = report.model_ranking || ['lstm', 'arima', 'prophet'];
  const history = report.weight_history || [];

  const models = [
    { key: 'lstm', label: 'LSTM', color: 'indigo', desc: 'Deep learning' },
    { key: 'arima', label: 'ARIMA', color: 'emerald', desc: 'Statistical' },
    { key: 'prophet', label: 'Prophet', color: 'amber', desc: 'Seasonal' },
  ] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Current weights */}
      <Card title="Adaptive Ensemble Weights" subtitle="Per-user weight optimization" icon={BarChart3} gradient="from-emerald-600 to-teal-500">
        <div className="space-y-4 mb-5">
          {models.map((m) => {
            const val = (w as any)[m.key] ?? 0;
            return (
              <div key={m.key}>
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-white">{m.label}</span>
                    <span className="text-xs text-slate-400 ml-2">{m.desc}</span>
                  </div>
                  <span className={`font-mono font-bold text-${m.color}-600 dark:text-${m.color}-400`}>{(val * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-${m.color}-500 rounded-full transition-all`} style={{ width: `${val * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
          <span className="text-slate-500">Total Updates</span>
          <span className="font-mono font-bold text-slate-800 dark:text-white">{report.total_updates ?? 0}</span>
        </div>
      </Card>

      {/* Ranking + history */}
      <Card title="Model Performance Ranking" subtitle="Based on prediction error" icon={TrendingUp} gradient="from-blue-600 to-indigo-500">
        <div className="space-y-3 mb-5">
          {ranking.map((name, i) => (
            <div key={name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                  : i === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300'
                }`}>
                #{i + 1}
              </div>
              <span className="text-sm font-medium text-slate-800 dark:text-white uppercase">{name}</span>
              <span className="ml-auto text-xs font-mono text-slate-500">{((w as any)[name] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Weight History (last {Math.min(history.length, 5)})</p>
            <div className="space-y-1">
              {history.slice(-5).map((h, i) => (
                <div key={i} className="flex gap-3 text-xs font-mono text-slate-500">
                  <span className="text-indigo-500">L:{(h.lstm * 100).toFixed(0)}%</span>
                  <span className="text-emerald-500">A:{(h.arima * 100).toFixed(0)}%</span>
                  <span className="text-amber-500">P:{(h.prophet * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

/* ======================================== 6. Mood–Productivity VAR ========= */
const MoodProductivityPanel: React.FC<{ data?: MoodData }> = ({ data }) => {
  if (!data) return <EmptyState msg="Mood–productivity analysis unavailable" />;

  if (!data.has_sufficient_data) {
    return (
      <Card title="Mood–Productivity VAR" subtitle="Bidirectional modeling" icon={Heart} gradient="from-purple-600 to-pink-500">
        <div className="flex flex-col items-center gap-3 py-6">
          <Info className="w-10 h-10 text-purple-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-md">
            {data.message || `Need at least 7 days of paired mood + productivity data. Currently have ${data.observations ?? 0}.`}
          </p>
          <p className="text-xs text-slate-400">Log your mood daily in the Wellness tab to unlock this analysis.</p>
        </div>
      </Card>
    );
  }

  const corr = data.correlation || {};
  const gc = data.granger_causality || {};
  const dom = data.dominant_direction || {};
  const irf = data.impulse_response || {};
  const forecast = data.var_model?.forecast || [];
  const aligned = data.aligned_data || [];
  const insights = data.insights || [];

  const m2p = gc.mood_causes_productivity || {};
  const p2m = gc.productivity_causes_mood || {};

  const directionIcon = dom.direction === 'mood_drives_productivity' ? <ArrowRight className="w-4 h-4" />
    : dom.direction === 'productivity_drives_mood' ? <ArrowRight className="w-4 h-4 rotate-180" />
      : dom.direction === 'bidirectional' ? <ArrowLeftRight className="w-4 h-4" />
        : <Activity className="w-4 h-4" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dominant direction */}
        <Card title="Causal Direction" subtitle="Granger causality result" icon={Heart} gradient="from-purple-600 to-pink-500">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              {directionIcon}
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{dom.label || 'Unknown'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{dom.explanation}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className={`p-2.5 rounded-xl text-center ${m2p.significant ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
              <p className="text-xs text-slate-500 mb-1">Mood → Prod</p>
              <p className={`text-sm font-bold ${m2p.significant ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                p={m2p.p_value?.toFixed(3) ?? '—'}
              </p>
              <p className="text-xs text-slate-400">{m2p.significant ? 'Significant' : 'Not sig.'}</p>
            </div>
            <div className={`p-2.5 rounded-xl text-center ${p2m.significant ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
              <p className="text-xs text-slate-500 mb-1">Prod → Mood</p>
              <p className={`text-sm font-bold ${p2m.significant ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                p={p2m.p_value?.toFixed(3) ?? '—'}
              </p>
              <p className="text-xs text-slate-400">{p2m.significant ? 'Significant' : 'Not sig.'}</p>
            </div>
          </div>
        </Card>

        {/* Correlation */}
        <Card title="Correlation Analysis" subtitle={`r = ${corr.value?.toFixed(3) ?? '—'}`} icon={TrendingUp} gradient="from-blue-600 to-cyan-500">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{corr.value?.toFixed(2) ?? '—'}</div>
            <Pill text={`${corr.strength || '—'} ${corr.direction || ''}`} color={corr.strength === 'strong' ? 'emerald' : corr.strength === 'moderate' ? 'amber' : 'slate'} />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{corr.interpretation || '—'}</p>

          {/* Mini time-series */}
          {aligned.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Recent Trend</p>
              <div className="flex items-end gap-0.5 h-16">
                {aligned.slice(-14).map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                    <div className="w-full bg-indigo-400 rounded-sm" style={{ height: `${(d.mood / 5) * 100}%` }} title={`Mood: ${d.mood}`} />
                    <div className="w-full bg-emerald-400 rounded-sm" style={{ height: `${d.productivity}%` }} title={`Prod: ${d.productivity}%`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-400 rounded-sm" /> Mood</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-400 rounded-sm" /> Productivity</div>
              </div>
            </div>
          )}
        </Card>

        {/* Forecast & IRF */}
        <Card title="VAR Forecast" subtitle="3-day bidirectional prediction" icon={Sparkles} gradient="from-fuchsia-500 to-purple-600">
          {forecast.length > 0 ? (
            <div className="space-y-3 mb-4">
              {forecast.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-mono text-slate-500 w-20">{f.date}</span>
                  <div className="flex-1">
                    <div className="flex gap-3 text-xs">
                      <span className="text-indigo-600 dark:text-indigo-400">Mood: {f.predicted_mood}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Prod: {f.predicted_productivity}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-4">Forecast unavailable.</p>
          )}

          {irf.interpretation && (
            <div className="p-3 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-500/10 border border-fuchsia-200 dark:border-fuchsia-500/20">
              <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 mb-1">Impulse Response</p>
              <p className="text-xs text-fuchsia-600 dark:text-fuchsia-400">{irf.interpretation}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Insights row */}
      {insights.length > 0 && (
        <Card title="Key Insights" subtitle={`${data.observations} observations`} icon={Lightbulb} gradient="from-amber-500 to-orange-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

/* ============================================================ Empty State == */
const EmptyState: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
    <AlertTriangle className="w-8 h-8 mb-3" />
    <p className="text-sm">{msg}</p>
  </div>
);

export default NovelInsights;
