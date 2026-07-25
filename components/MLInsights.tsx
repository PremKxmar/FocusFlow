/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MLInsights Component
 * Displays LSTM, ARIMA, and Prophet time series predictions with line graphs
 */
import React, { useState, useEffect, useCallback } from 'react';
import { insightsApi } from '../services/api';
import { getCachedData, setCachedData, isCacheFresh, getCacheAgeLabel } from '../services/dataCache';
import {
    Brain,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Activity,
    Cpu,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Clock,
    Zap,
    Target,
    LineChart,
    Sparkles,
    Timer,
    ShieldAlert,
    Lightbulb,
    Minus,
    ChevronRight,
    BrainCircuit,
    Award,
    Gauge
} from 'lucide-react';

interface ModelPrediction {
    model: string;
    forecast: Array<{
        date: string;
        day: string;
        predicted_productive_minutes: number;
        confidence?: number;
        lower_bound?: number;
        upper_bound?: number;
    }>;
    average_predicted: number;
    trend: string;
    confidence: number;
    periods: number;
}

interface ModelInfo {
    name: string;
    type: string;
    description: string;
    predictions: ModelPrediction;
}

interface ModelStatus {
    available: boolean;
    trained: boolean;
    sequence_length?: number;
    order?: number[];
}

interface ForecastData {
    productivityLevel: string;
    nextDayWorkload: number;
    completionProbability: number;
    bestFocusWindow: string;
    distractionTrigger: string;
    trend: 'Up' | 'Down' | 'Stable';
    expectedLoadLevel: string;
    stressRisk: string;
}

interface Pattern {
    type: string;
    title: string;
    description: string;
    icon: string;
}

const ML_CACHE_KEY = 'ml_insights';
const ML_METRICS_CACHE_KEY = 'ml_eval_metrics';

interface MLCacheData {
    models: { lstm: ModelInfo | null; arima: ModelInfo | null; prophet: ModelInfo | null };
    modelStatus: any;
    forecast: ForecastData | null;
    patterns: Pattern[];
}

const MLInsights: React.FC = () => {
    // Load from cache immediately
    const cached = getCachedData<MLCacheData>(ML_CACHE_KEY);
    const cachedMetrics = getCachedData<any>(ML_METRICS_CACHE_KEY);

    const [models, setModels] = useState<{
        lstm: ModelInfo | null;
        arima: ModelInfo | null;
        prophet: ModelInfo | null;
    }>(cached?.models ?? { lstm: null, arima: null, prophet: null });
    const [modelStatus, setModelStatus] = useState<{
        lstm: ModelStatus;
        arima: ModelStatus;
        prophet: ModelStatus;
    } | null>(cached?.modelStatus ?? null);
    const [forecast, setForecast] = useState<ForecastData | null>(cached?.forecast ?? null);
    const [patterns, setPatterns] = useState<Pattern[]>(cached?.patterns ?? []);
    const [isLoading, setIsLoading] = useState(!cached);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [evalMetrics, setEvalMetrics] = useState<{
        metrics: Record<string, { mae: number; rmse: number; mape: number; r2: number; accuracy: number; status: string }>;
        best_model: string;
        evaluation_samples: number;
        training_samples: number;
    } | null>(cachedMetrics ?? null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(getCacheAgeLabel(ML_CACHE_KEY));

    // Graph dimensions
    const graphWidth = 700;
    const graphHeight = 250;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = graphWidth - padding.left - padding.right;
    const chartHeight = graphHeight - padding.top - padding.bottom;

    useEffect(() => {
        fetchMLData();
    }, []);

    const fetchMLData = async (force = false) => {
        // Skip if cache is fresh and not forced
        if (!force && isCacheFresh(ML_CACHE_KEY) && cached) return;

        if (!cached) setIsLoading(true);
        else setIsRefreshing(true);
        setError(null);

        try {
            // Fetch all data in parallel
            const [realtimeResponse, forecastData, patternsData] = await Promise.all([
                insightsApi.getRealtimePredictions().catch(() => null),
                insightsApi.getForecast().catch(() => null),
                insightsApi.getBehavioralPatterns().catch(() => ({ patterns: [] }))
            ]);

            let newModels = models;
            let newModelStatus = modelStatus;

            // Set forecast and patterns
            if (forecastData) setForecast(forecastData);
            if (patternsData?.patterns) setPatterns(patternsData.patterns);

            if (realtimeResponse?.status === 'success' && realtimeResponse.models) {
                newModels = {
                    lstm: realtimeResponse.models.lstm,
                    arima: realtimeResponse.models.arima,
                    prophet: realtimeResponse.models.prophet,
                };
                newModelStatus = realtimeResponse;
                setModels(newModels);
                setModelStatus(newModelStatus);
            } else {
                // Fallback to compare models if realtime not available
                const compareResponse = await insightsApi.compareModels();
                newModels = {
                    lstm: compareResponse.models?.lstm || null,
                    arima: compareResponse.models?.arima || null,
                    prophet: compareResponse.models?.prophet || null,
                };
                setModels(newModels);
            }

            // Save to cache
            setCachedData<MLCacheData>(ML_CACHE_KEY, {
                models: newModels,
                modelStatus: newModelStatus,
                forecast: forecastData,
                patterns: patternsData?.patterns || [],
            });
            setLastUpdated('Just now');
        } catch (err: any) {
            console.error('ML fetch error:', err);
            // Try fallback without error
            try {
                const compareResponse = await insightsApi.compareModels();
                setModels({
                    lstm: compareResponse.models?.lstm || null,
                    arima: compareResponse.models?.arima || null,
                    prophet: compareResponse.models?.prophet || null,
                });
            } catch {
                setError('Insufficient data for ML predictions');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleTrainModels = async () => {
        setIsTraining(true);
        try {
            await insightsApi.trainModels();
            await fetchMLData();
            await fetchEvalMetrics();
        } catch (err: any) {
            setError(err.message || 'Training failed');
        } finally {
            setIsTraining(false);
        }
    };

    const fetchEvalMetrics = async (force = false) => {
        if (!force && isCacheFresh(ML_METRICS_CACHE_KEY) && cachedMetrics) return;

        setMetricsLoading(true);
        try {
            const data = await insightsApi.getEvaluationMetrics();
            setEvalMetrics(data);
            setCachedData(ML_METRICS_CACHE_KEY, data);
        } catch {
            // Metrics may not be available with insufficient data — that's ok
        } finally {
            setMetricsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvalMetrics();
    }, []);

    const getModelColor = (model: string) => {
        switch (model) {
            case 'lstm': return { main: '#6366f1', light: 'rgba(99, 102, 241, 0.1)' };
            case 'arima': return { main: '#10b981', light: 'rgba(16, 185, 129, 0.1)' };
            case 'prophet': return { main: '#f59e0b', light: 'rgba(245, 158, 11, 0.1)' };
            default: return { main: '#64748b', light: 'rgba(100, 116, 139, 0.1)' };
        }
    };

    const getTrendIcon = (trend: string) => {
        if (trend === 'Up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
        if (trend === 'Down') return <TrendingUp className="w-4 h-4 text-rose-500 rotate-180" />;
        return <Activity className="w-4 h-4 text-slate-400" />;
    };

    // Get max value for scaling the graph
    const getMaxPrediction = () => {
        let max = 100;
        ['lstm', 'arima', 'prophet'].forEach((modelKey) => {
            const model = models[modelKey as keyof typeof models];
            if (model?.predictions?.forecast) {
                model.predictions.forecast.forEach((day) => {
                    if (day.predicted_productive_minutes > max) {
                        max = day.predicted_productive_minutes;
                    }
                });
            }
        });
        return Math.ceil(max / 50) * 50 + 50; // Round up to nearest 50 + padding
    };

    // Convert data point to SVG coordinates
    const getX = (index: number) => {
        return padding.left + (index / 6) * chartWidth;
    };

    const getY = (value: number, maxVal: number) => {
        return padding.top + chartHeight - (value / maxVal) * chartHeight;
    };

    // Generate path for a model
    const generateLinePath = (forecast: Array<{ predicted_productive_minutes: number }>, maxVal: number) => {
        if (!forecast || forecast.length === 0) return '';

        const points = forecast.map((day, i) => {
            const x = getX(i);
            const y = getY(day.predicted_productive_minutes, maxVal);
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    };

    // Generate area path for a model
    const generateAreaPath = (forecast: Array<{ predicted_productive_minutes: number }>, maxVal: number) => {
        if (!forecast || forecast.length === 0) return '';

        const points = forecast.map((day, i) => {
            const x = getX(i);
            const y = getY(day.predicted_productive_minutes, maxVal);
            return `${x},${y}`;
        });

        const lastX = getX(forecast.length - 1);
        const firstX = getX(0);
        const bottomY = padding.top + chartHeight;

        return `M ${points.join(' L ')} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                    <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-slate-500">Loading ML Models...</p>
                </div>
            </div>
        );
    }

    const maxVal = getMaxPrediction();
    const days = models.lstm?.predictions?.forecast ||
        models.arima?.predictions?.forecast ||
        models.prophet?.predictions?.forecast || [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
                            <LineChart className="w-6 h-6" />
                        </div>
                        Time Series Forecasting
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">LSTM, ARIMA & Prophet model predictions</p>
                </div>
                <div className="flex gap-2">
                    {lastUpdated && (
                        <span className="text-[10px] text-slate-400 font-medium">Updated {lastUpdated}</span>
                    )}
                    <button
                        onClick={() => fetchMLData(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                    <button
                        onClick={handleTrainModels}
                        disabled={isTraining}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        <Zap className={`w-4 h-4 ${isTraining ? 'animate-pulse' : ''}`} />
                        <span>{isTraining ? 'Training...' : 'Train Models'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <p className="text-rose-700 dark:text-rose-400">{error}</p>
                </div>
            )}

            {/* Predictive Analytics Summary */}
            {forecast && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Core Prediction Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-600/30">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-8">
                                <span className="text-xs font-bold uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                                    24H Forecasting
                                </span>
                                <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                            </div>

                            <div className="mb-auto">
                                <p className="text-white/70 text-sm font-medium mb-1">Tomorrow's Productivity Forecast</p>
                                <h3 className="text-4xl font-display font-bold mb-4">{forecast.productivityLevel} Output</h3>
                                <div className="flex items-center gap-2 text-indigo-100 font-semibold">
                                    {forecast.trend === 'Up' ? <TrendingUp className="w-5 h-5" /> :
                                        forecast.trend === 'Down' ? <TrendingDown className="w-5 h-5" /> :
                                            <Minus className="w-5 h-5" />}
                                    <span>{forecast.completionProbability}% Prob. Task Completion</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10">
                                <div>
                                    <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-1">Expected Load</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-16 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-white" style={{ width: `${forecast.nextDayWorkload}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold">{forecast.expectedLoadLevel}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-1">Stress Risk</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-16 bg-white/20 rounded-full overflow-hidden">
                                            <div className={`h-full ${forecast.stressRisk === 'Low' ? 'bg-emerald-400 w-1/4' : forecast.stressRisk === 'Medium' ? 'bg-amber-400 w-1/2' : 'bg-rose-400 w-3/4'}`}></div>
                                        </div>
                                        <span className="text-xs font-bold">{forecast.stressRisk}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Focus Window Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                                <Timer className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-display font-bold text-slate-900 dark:text-white">Peak Focus Window</h4>
                                <p className="text-xs text-slate-500">Based on Time-Series analysis</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <p className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-2">
                                {forecast.bestFocusWindow}
                            </p>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Optimal Cognitive state</p>
                        </div>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-indigo-500" />
                                <p className="text-sm text-slate-600 dark:text-slate-400">Next 7 days show a <span className="text-indigo-600 dark:text-indigo-400 font-bold">{forecast.trend?.toLowerCase()} trend</span> in focus duration.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-5 h-5 text-rose-500" />
                                <p className="text-sm text-slate-600 dark:text-slate-400">Main distraction: <span className="font-bold">{forecast.distractionTrigger}</span>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Time Series Graph */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-500" />
                        7-Day Productivity Forecast
                    </h3>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                            LSTM
                        </span>
                        <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            ARIMA
                        </span>
                        <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            Prophet
                        </span>
                    </div>
                </div>

                {/* SVG Time Series Chart */}
                <div className="overflow-x-auto">
                    <svg
                        width="100%"
                        height={graphHeight}
                        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                        className="min-w-[600px]"
                    >
                        <defs>
                            {/* Gradients for area fill */}
                            <linearGradient id="lstmGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.4)" />
                                <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                            </linearGradient>
                            <linearGradient id="arimaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                                <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                            </linearGradient>
                            <linearGradient id="prophetGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.4)" />
                                <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                            </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                            <g key={i}>
                                <line
                                    x1={padding.left}
                                    y1={padding.top + ratio * chartHeight}
                                    x2={graphWidth - padding.right}
                                    y2={padding.top + ratio * chartHeight}
                                    stroke="#e2e8f0"
                                    strokeWidth="1"
                                    strokeDasharray={i === 4 ? "0" : "4,4"}
                                />
                                <text
                                    x={padding.left - 10}
                                    y={padding.top + ratio * chartHeight + 4}
                                    textAnchor="end"
                                    fill="#94a3b8"
                                    fontSize="11"
                                >
                                    {Math.round(maxVal * (1 - ratio))}
                                </text>
                            </g>
                        ))}

                        {/* X-axis labels */}
                        {days.map((day, i) => (
                            <text
                                key={i}
                                x={getX(i)}
                                y={graphHeight - 8}
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize="11"
                            >
                                {day.day?.slice(0, 3) || `D${i + 1}`}
                            </text>
                        ))}

                        {/* Area fills */}
                        {models.lstm?.predictions?.forecast && (
                            <path
                                d={generateAreaPath(models.lstm.predictions.forecast, maxVal)}
                                fill="url(#lstmGradient)"
                            />
                        )}
                        {models.arima?.predictions?.forecast && (
                            <path
                                d={generateAreaPath(models.arima.predictions.forecast, maxVal)}
                                fill="url(#arimaGradient)"
                            />
                        )}
                        {models.prophet?.predictions?.forecast && (
                            <path
                                d={generateAreaPath(models.prophet.predictions.forecast, maxVal)}
                                fill="url(#prophetGradient)"
                            />
                        )}

                        {/* Lines */}
                        {models.lstm?.predictions?.forecast && (
                            <path
                                d={generateLinePath(models.lstm.predictions.forecast, maxVal)}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                        {models.arima?.predictions?.forecast && (
                            <path
                                d={generateLinePath(models.arima.predictions.forecast, maxVal)}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                        {models.prophet?.predictions?.forecast && (
                            <path
                                d={generateLinePath(models.prophet.predictions.forecast, maxVal)}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Data points */}
                        {models.lstm?.predictions?.forecast?.map((day, i) => (
                            <g key={`lstm-${i}`}>
                                <circle
                                    cx={getX(i)}
                                    cy={getY(day.predicted_productive_minutes, maxVal)}
                                    r="6"
                                    fill="#6366f1"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                                <title>LSTM: {day.predicted_productive_minutes} min</title>
                            </g>
                        ))}
                        {models.arima?.predictions?.forecast?.map((day, i) => (
                            <g key={`arima-${i}`}>
                                <circle
                                    cx={getX(i)}
                                    cy={getY(day.predicted_productive_minutes, maxVal)}
                                    r="6"
                                    fill="#10b981"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                                <title>ARIMA: {day.predicted_productive_minutes} min</title>
                            </g>
                        ))}
                        {models.prophet?.predictions?.forecast?.map((day, i) => (
                            <g key={`prophet-${i}`}>
                                <circle
                                    cx={getX(i)}
                                    cy={getY(day.predicted_productive_minutes, maxVal)}
                                    r="6"
                                    fill="#f59e0b"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                                <title>Prophet: {day.predicted_productive_minutes} min</title>
                            </g>
                        ))}

                        {/* Y-axis label */}
                        <text
                            x={15}
                            y={graphHeight / 2}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="11"
                            transform={`rotate(-90, 15, ${graphHeight / 2})`}
                        >
                            Minutes
                        </text>
                    </svg>
                </div>

                <div className="text-xs text-slate-400 text-center mt-4">
                    Predicted Productive Minutes per Day
                </div>
            </div>

            {/* Model Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['lstm', 'arima', 'prophet'] as const).map((modelKey) => {
                    const status = modelStatus?.[modelKey];
                    const model = models[modelKey];
                    const colors = getModelColor(modelKey);

                    return (
                        <div
                            key={modelKey}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                {/* eslint-disable-next-line react/no-unknown-property */}
                                <div className="p-3 rounded-xl" style={{ backgroundColor: colors.light }}>
                                    {modelKey === 'lstm' && <Brain className="w-5 h-5" style={{ color: colors.main }} />}
                                    {modelKey === 'arima' && <BarChart3 className="w-5 h-5" style={{ color: colors.main }} />}
                                    {modelKey === 'prophet' && <Activity className="w-5 h-5" style={{ color: colors.main }} />}
                                </div>
                                <div className="flex items-center gap-2">
                                    {status?.trained ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
                                            <CheckCircle2 className="w-3 h-3" /> Trained
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
                                            <Clock className="w-3 h-3" /> Fallback
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                                {modelKey.toUpperCase()}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {modelKey === 'lstm' && 'Deep Learning - Sequential Patterns'}
                                {modelKey === 'arima' && 'Statistical - Trend & Seasonality'}
                                {modelKey === 'prophet' && 'Additive - Weekly Patterns'}
                            </p>

                            {model?.predictions && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                                                {model.predictions.average_predicted}
                                                <span className="text-sm text-slate-400 ml-1">min</span>
                                            </p>
                                            <p className="text-xs text-slate-500">Avg daily prediction</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {getTrendIcon(model.predictions.trend)}
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                {model.predictions.trend}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Confidence</span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            {Math.round((model.predictions.confidence || 0.5) * 100)}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        {/* eslint-disable-next-line react/no-unknown-property */}
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${(model.predictions.confidence || 0.5) * 100}%`,
                                                backgroundColor: colors.main
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Evaluation Metrics Panel */}
            {evalMetrics && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <Gauge className="w-5 h-5 text-indigo-500" />
                            Model Evaluation Metrics
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{evalMetrics.training_samples} train / {evalMetrics.evaluation_samples} test samples</span>
                            <button
                                onClick={() => fetchEvalMetrics(true)}
                                disabled={metricsLoading}
                                title="Refresh metrics"
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Best Model Badge */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-200 dark:border-amber-600/30 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                            <Award className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Best Performing Model</p>
                            <p className="text-lg font-display font-bold text-amber-800 dark:text-amber-200">
                                {evalMetrics.best_model.toUpperCase()}
                                <span className="text-sm font-normal text-amber-600 ml-2">
                                    — Lowest RMSE ({evalMetrics.metrics[evalMetrics.best_model]?.rmse})
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Metrics Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800">
                                    <th className="text-left py-3 px-4 font-bold text-slate-500">Model</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500" title="Mean Absolute Error">MAE ↓</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500" title="Root Mean Squared Error">RMSE ↓</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500" title="Mean Absolute Percentage Error">MAPE ↓</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500" title="R-Squared">R² ↑</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500">Accuracy</th>
                                    <th className="text-right py-3 px-4 font-bold text-slate-500">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(['lstm', 'arima', 'prophet'] as const).map((modelKey) => {
                                    const m = evalMetrics.metrics[modelKey];
                                    if (!m) return null;
                                    const isBest = modelKey === evalMetrics.best_model;
                                    const colors = getModelColor(modelKey);
                                    return (
                                        <tr key={modelKey} className={`border-b border-slate-100 dark:border-slate-800 ${isBest ? 'bg-amber-50/50 dark:bg-amber-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.main }}></div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        {modelKey.toUpperCase()}
                                                    </span>
                                                    {isBest && <Award className="w-3.5 h-3.5 text-amber-500" />}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: colors.main }}>
                                                {m.mae}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: colors.main }}>
                                                {m.rmse}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: colors.main }}>
                                                {m.mape}%
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: colors.main }}>
                                                {m.r2}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{ width: `${m.accuracy}%`, backgroundColor: colors.main }}
                                                        ></div>
                                                    </div>
                                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-12 text-right">
                                                        {m.accuracy}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${m.status === 'trained' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'}`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Metric Explanations */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'MAE', desc: 'Mean Absolute Error — average magnitude of errors' },
                            { label: 'RMSE', desc: 'Root Mean Squared Error — penalizes large errors more' },
                            { label: 'MAPE', desc: 'Mean Absolute Percentage Error — error as % of actual' },
                            { label: 'R²', desc: 'Coefficient of Determination — variance explained (higher is better)' },
                            { label: 'Accuracy', desc: '100 - MAPE — overall prediction accuracy' },
                        ].map((metric) => (
                            <div key={metric.label} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{metric.label}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{metric.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detailed Predictions Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-500" />
                    Detailed Forecast Comparison
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="text-left py-3 px-4 font-bold text-slate-500">Day</th>
                                <th className="text-left py-3 px-4 font-bold text-slate-500">Date</th>
                                <th className="text-right py-3 px-4 font-bold text-indigo-500">LSTM</th>
                                <th className="text-right py-3 px-4 font-bold text-emerald-500">ARIMA</th>
                                <th className="text-right py-3 px-4 font-bold text-amber-500">Prophet</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-500">Ensemble Avg</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                                const lstm = models.lstm?.predictions?.forecast?.[idx];
                                const arima = models.arima?.predictions?.forecast?.[idx];
                                const prophet = models.prophet?.predictions?.forecast?.[idx];
                                const lstmVal = lstm?.predicted_productive_minutes || 0;
                                const arimaVal = arima?.predicted_productive_minutes || 0;
                                const prophetVal = prophet?.predicted_productive_minutes || 0;
                                const avg = Math.round((lstmVal + arimaVal + prophetVal) / 3);

                                return (
                                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                                            {lstm?.day || arima?.day || prophet?.day || `Day ${idx + 1}`}
                                        </td>
                                        <td className="py-3 px-4 text-slate-500">
                                            {(lstm?.date || arima?.date || prophet?.date || '').split('-').slice(1).join('/')}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {lstmVal} min
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            {arimaVal} min
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                            {prophetVal} min
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50">
                                            {avg} min
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Behavioral Patterns */}
            {patterns.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-indigo-500" />
                        Behavioral Patterns Detected
                    </h3>
                    <div className="space-y-4">
                        {patterns.map((pattern, index) => (
                            <div key={index} className="group flex items-center gap-6 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-default border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    {pattern.icon === 'Lightbulb' && <Lightbulb className="w-5 h-5 text-yellow-500" />}
                                    {pattern.icon === 'Timer' && <Timer className="w-5 h-5 text-indigo-500" />}
                                    {pattern.icon === 'ShieldAlert' && <ShieldAlert className="w-5 h-5 text-rose-500" />}
                                    {!['Lightbulb', 'Timer', 'ShieldAlert'].includes(pattern.icon) && <Lightbulb className="w-5 h-5 text-yellow-500" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200">{pattern.title}</h5>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${pattern.type === 'Warning' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20'}`}>
                                            {pattern.type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{pattern.description}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Model Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoCard
                    icon={<Brain className="w-5 h-5 text-indigo-500" />}
                    title="LSTM"
                    subtitle="Long Short-Term Memory"
                    description="Deep learning model that captures complex non-linear patterns and sequential dependencies. Best for learning how past behavior affects future productivity."
                    color="indigo"
                />
                <InfoCard
                    icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
                    title="ARIMA"
                    subtitle="AutoRegressive Integrated Moving Average"
                    description="Statistical model for smooth trends and seasonality. Uses past values, differencing for stationarity, and moving averages for forecasting."
                    color="emerald"
                />
                <InfoCard
                    icon={<Activity className="w-5 h-5 text-amber-500" />}
                    title="Prophet"
                    subtitle="Facebook's Additive Model"
                    description="Handles weekly/yearly seasonality and holiday effects. Robust to missing data and shifts in trends. Great for business time series."
                    color="amber"
                />
            </div>
        </div>
    );
};

const InfoCard = ({ icon, title, subtitle, description, color }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    description: string;
    color: string;
}) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md transition-all">
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</div>
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{title}</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{subtitle}</p>
            </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
);

export default MLInsights;
