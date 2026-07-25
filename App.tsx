/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { View, Task, UserProfile } from './types';
import { authApi, tasksApi, getAuthToken, setAuthToken } from './services/api';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TaskManager from './components/TaskManager';
import Analytics from './components/Analytics';
import MLInsights from './components/MLInsights';
import FocusMode from './components/FocusMode';
import Reports from './components/Reports';
import ChatBot from './components/ChatBot';
import Wellness from './components/Wellness';
import Team from './components/Team';
import Settings from './components/Settings';
import Profile from './components/Profile';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import NovelInsights from './components/NovelInsights';
import { Sun, Moon } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<View>('LOGIN');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Import trackerApi
  const startTrackerForUser = async () => {
    try {
      const { trackerApi } = await import('./services/api');
      await trackerApi.start();
      console.log('🎯 Tracker started for logged-in user');
    } catch (error) {
      console.log('Tracker not available or already running');
    }
  };

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const { user: userData } = await authApi.getProfile();
          setUser(userData);
          setView('DASHBOARD');

          // Load tasks
          const { tasks: taskData } = await tasksApi.getAll();
          setTasks(taskData);

          // Start tracker for this user
          startTrackerForUser();
        } catch (error) {
          // Token invalid, clear it
          setAuthToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogin = async (u: UserProfile) => {
    setUser(u);
    setView('ONBOARDING');

    // Start tracker for this user
    startTrackerForUser();

    // Load tasks after login
    try {
      const { tasks: taskData } = await tasksApi.getAll();
      setTasks(taskData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    setTasks([]);
    setView('LOGIN');
  };

  const handleTasksUpdate = (newTasks: Task[]) => {
    setTasks(newTasks);
  };

  const renderView = () => {
    switch (view) {
      case 'LOGIN':
      case 'SIGNUP':
        return <Auth mode={view} onAuthSuccess={handleLogin} setView={setView} />;
      case 'ONBOARDING':
        return <Onboarding onComplete={() => setView('DASHBOARD')} />;
      case 'DASHBOARD':
        return <Dashboard tasks={tasks} setView={setView} />;
      case 'TASKS':
        return <TaskManager tasks={tasks} setTasks={handleTasksUpdate} />;
      case 'ANALYTICS':
        return <Analytics />;
      case 'INSIGHTS':
      case 'ML_INSIGHTS':
        return <MLInsights />;
      case 'NOVEL_INSIGHTS':
        return <NovelInsights />;
      case 'FOCUS':
        return <FocusMode />;
      case 'REPORTS':
        return <Reports />;
      case 'CHATBOT':
        return <ChatBot />;
      case 'WELLNESS':
        return <Wellness />;
      case 'TEAM':
        return <Team />;
      case 'SETTINGS':
        return <Settings isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onLogout={handleLogout} />;
      case 'PROFILE':
        return <Profile user={user} onUserUpdate={(u: UserProfile) => setUser(u)} />;
      default:
        return <Dashboard tasks={tasks} setView={setView} />;
    }
  };

  const isAuthView = view === 'LOGIN' || view === 'SIGNUP' || view === 'ONBOARDING';

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {!isAuthView ? (
        <div className="flex h-screen overflow-hidden">
          <Sidebar currentView={view} setView={setView} onLogout={handleLogout} />
          <main className="flex-1 overflow-y-auto relative p-4 md:p-8">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white capitalize">
                  {view === 'DASHBOARD' ? `Welcome Back, ${user?.name?.split(' ')[0] || 'User'}` : view.toLowerCase().replace('_', ' ')}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/50 transition-all"
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <div
                  onClick={() => setView('PROFILE')}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 cursor-pointer hover:scale-105 transition-transform"
                >
                  {user?.name?.[0] || 'U'}
                </div>
              </div>
            </div>
            {renderView()}
          </main>
        </div>
      ) : (
        renderView()
      )}
    </div>
  );
};

export default App;
