/**
 * FocusFlow API Service
 * Handles all backend API calls with JWT authentication
 */

// @ts-ignore
const _rawUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Every endpoint below is written relative to the API root, so VITE_API_URL has
 * to resolve to exactly `<origin>/api`. Deployments get this wrong in both
 * directions - omitting `/api` entirely, or pasting a full endpoint URL - and
 * either mistake 404s every request with no obvious cause. Normalise instead of
 * trusting the value.
 */
const normaliseApiBase = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    const apiIndex = trimmed.indexOf('/api');
    // Already contains /api: cut anything after it (e.g. a pasted /api/auth/login).
    if (apiIndex !== -1) return trimmed.slice(0, apiIndex + '/api'.length);
    // Bare origin: append the missing /api.
    return `${trimmed}/api`;
};

const API_BASE_URL = normaliseApiBase(_rawUrl);

// Token management - uses sessionStorage so token clears when browser closes
let authToken: string | null = sessionStorage.getItem('focusflow_token');

export const setAuthToken = (token: string | null) => {
    authToken = token;
    if (token) {
        sessionStorage.setItem('focusflow_token', token);
    } else {
        sessionStorage.removeItem('focusflow_token');
    }
};

export const getAuthToken = () => authToken;

// API request helper
const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<any> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
};

// ============ AUTH API ============
export const authApi = {
    register: async (name: string, email: string, password: string, style?: string, goals?: string[]) => {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, style, goals }),
        });
        if (data.token) {
            setAuthToken(data.token);
        }
        return data;
    },

    login: async (email: string, password: string, totp_code?: string) => {
        const body: any = { email, password };
        if (totp_code) body.totp_code = totp_code;
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (data.token) {
            setAuthToken(data.token);
        }
        return data;
    },

    getProfile: async () => {
        return await apiRequest('/auth/profile');
    },

    updateProfile: async (updates: { name?: string; style?: string; goals?: string[] }) => {
        return await apiRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    logout: () => {
        setAuthToken(null);
    },

    // 2FA methods
    setup2FA: async () => {
        return await apiRequest('/auth/2fa/setup', { method: 'POST' });
    },

    verify2FA: async (code: string) => {
        return await apiRequest('/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    },

    disable2FA: async (password: string) => {
        return await apiRequest('/auth/2fa/disable', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    },

    deleteAccount: async () => {
        return await apiRequest('/auth/account', { method: 'DELETE' });
    },

    clearData: async (retentionDays: number) => {
        return await apiRequest('/auth/clear-data', {
            method: 'POST',
            body: JSON.stringify({ retention_days: retentionDays }),
        });
    },
};

// ============ TASKS API ============
export const tasksApi = {
    getAll: async (completed?: boolean) => {
        const query = completed !== undefined ? `?completed=${completed}` : '';
        return await apiRequest(`/tasks${query}`);
    },

    create: async (task: {
        title: string;
        deadline?: string;
        category?: string;
        priority?: string;
    }) => {
        return await apiRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify(task),
        });
    },

    update: async (taskId: string, updates: {
        title?: string;
        deadline?: string;
        category?: string;
        priority?: string;
        completed?: boolean;
        progress?: number;
    }) => {
        return await apiRequest(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    delete: async (taskId: string) => {
        return await apiRequest(`/tasks/${taskId}`, {
            method: 'DELETE',
        });
    },

    getStats: async () => {
        return await apiRequest('/tasks/stats');
    },
};

// ============ ACTIVITIES API ============
export const activitiesApi = {
    log: async (appName: string, durationMinutes: number, category?: string) => {
        return await apiRequest('/activities', {
            method: 'POST',
            body: JSON.stringify({
                app_name: appName,
                duration_minutes: durationMinutes,
                category,
            }),
        });
    },

    logBatch: async (activities: Array<{
        app_name: string;
        duration_minutes: number;
        category?: string;
        timestamp?: string;
    }>) => {
        return await apiRequest('/activities/batch', {
            method: 'POST',
            body: JSON.stringify({ activities }),
        });
    },

    getHistory: async (days: number = 7) => {
        return await apiRequest(`/activities?days=${days}`);
    },

    getDailySummary: async (date?: string) => {
        const query = date ? `?date=${date}` : '';
        return await apiRequest(`/activities/summary${query}`);
    },

    getWeeklyTrends: async () => {
        return await apiRequest('/activities/weekly');
    },

    getHourlyBreakdown: async (days: number = 7) => {
        return await apiRequest(`/activities/hourly?days=${days}`);
    },
};

// ============ FOCUS API ============
export const focusApi = {
    startSession: async (durationMinutes: number = 25) => {
        return await apiRequest('/focus/start', {
            method: 'POST',
            body: JSON.stringify({ duration: durationMinutes }),
        });
    },

    endSession: async (completed: boolean = true) => {
        return await apiRequest('/focus/end', {
            method: 'POST',
            body: JSON.stringify({ completed }),
        });
    },

    getActiveSession: async () => {
        return await apiRequest('/focus/active');
    },

    getHistory: async (days: number = 30) => {
        return await apiRequest(`/focus/history?days=${days}`);
    },

    getStats: async (days: number = 7) => {
        return await apiRequest(`/focus/stats?days=${days}`);
    },
};

// ============ INSIGHTS API ============
export const insightsApi = {
    getDashboard: async () => {
        return await apiRequest('/insights/dashboard');
    },

    getForecast: async () => {
        return await apiRequest('/insights/forecast');
    },

    getTrends: async (days: number = 7) => {
        return await apiRequest(`/insights/trends?days=${days}`);
    },

    getBehavioralPatterns: async () => {
        return await apiRequest('/insights/behavioral-patterns');
    },

    getWeeklyReport: async () => {
        return await apiRequest('/insights/reports/weekly');
    },

    // ML Model APIs
    getMLStatus: async () => {
        return await apiRequest('/insights/ml/status');
    },

    trainModels: async () => {
        return await apiRequest('/insights/ml/train', {
            method: 'POST',
        });
    },

    compareModels: async () => {
        return await apiRequest('/insights/ml/compare');
    },

    getEvaluationMetrics: async () => {
        return await apiRequest('/insights/ml/evaluation-metrics');
    },

    getModelForecast: async (model: 'lstm' | 'arima' | 'prophet' | 'ensemble', periods: number = 7) => {
        return await apiRequest(`/insights/ml/forecast/${model}?periods=${periods}`);
    },

    // Analytics APIs
    getFocusWindows: async () => {
        return await apiRequest('/insights/focus-windows');
    },

    getDistractionPatterns: async () => {
        return await apiRequest('/insights/distraction-patterns');
    },

    getTopApps: async (days: number = 7, category?: string) => {
        const query = category ? `?days=${days}&category=${category}` : `?days=${days}`;
        return await apiRequest(`/insights/top-apps${query}`);
    },

    getRealtimePredictions: async () => {
        return await apiRequest('/insights/ml/realtime-predictions');
    },

    seedDemoData: async () => {
        return await apiRequest('/insights/seed-demo-data', {
            method: 'POST',
        });
    },

    chat: async (message: string, context: string) => {
        return await apiRequest('/insights/chat', {
            method: 'POST',
            body: JSON.stringify({ message, context }),
        });
    },
};

// ============ TRACKER API ============
export const trackerApi = {
    start: async () => {
        return await apiRequest('/tracker/start', {
            method: 'POST',
        });
    },

    stop: async () => {
        return await apiRequest('/tracker/stop', {
            method: 'POST',
        });
    },

    status: async () => {
        return await apiRequest('/tracker/status');
    },
};

// ============ WELLNESS / MOOD ============
export const wellnessApi = {
    logMood: async (data: { mood: number; energy: number; stress: number; sleep_hours: number; note?: string }) => {
        return await apiRequest('/insights/mood/log', { method: 'POST', body: JSON.stringify(data) });
    },
    getMoodHistory: async (days = 14) => {
        return await apiRequest(`/insights/mood/history?days=${days}`);
    },
    getCorrelation: async () => {
        return await apiRequest('/insights/mood/correlation');
    },
};

// ============ TEAM ============
export const teamApi = {
    create: async (name: string) => {
        return await apiRequest('/team/create', { method: 'POST', body: JSON.stringify({ name }) });
    },
    join: async (invite_code: string) => {
        return await apiRequest('/team/join', { method: 'POST', body: JSON.stringify({ invite_code }) });
    },
    leave: async () => {
        return await apiRequest('/team/leave', { method: 'POST' });
    },
    dashboard: async () => {
        return await apiRequest('/team/dashboard');
    },
};

// ============ HEALTH CHECK ============
export const healthCheck = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
};

// ============ NOVEL RESEARCH FEATURES ============
export const novelApi = {
    /** Get all 6 novel feature results in one call */
    getOverview: async () => {
        return await apiRequest('/novel/overview');
    },

    /** SHAP Explainable AI */
    getShap: async () => {
        return await apiRequest('/novel/shap');
    },

    /** Digital Fatigue Index */
    getFatigue: async () => {
        return await apiRequest('/novel/fatigue');
    },

    /** Context-Switch Cost & Attention Residue */
    getContextSwitch: async () => {
        return await apiRequest('/novel/context-switch');
    },

    /** Procrastination Sequence Mining */
    getProcrastination: async () => {
        return await apiRequest('/novel/procrastination');
    },

    /** Adaptive Ensemble Weights */
    getEnsembleWeights: async () => {
        return await apiRequest('/novel/ensemble-weights');
    },

    /** Simulate ensemble adaptation */
    simulateEnsemble: async (days: number = 14) => {
        return await apiRequest('/novel/ensemble-weights/simulate', {
            method: 'POST',
            body: JSON.stringify({ days }),
        });
    },

    /** Mood–Productivity VAR / Granger Causality */
    getMoodProductivity: async () => {
        return await apiRequest('/novel/mood-productivity');
    },
};

// Export all APIs
export default {
    auth: authApi,
    tasks: tasksApi,
    activities: activitiesApi,
    focus: focusApi,
    insights: insightsApi,
    wellness: wellnessApi,
    team: teamApi,
    novel: novelApi,
    healthCheck,
};
