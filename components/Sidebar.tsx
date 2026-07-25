/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { View } from '../types';
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  BrainCircuit,
  Target,
  FileText,
  MessageSquare,
  Heart,
  Users,
  Settings,
  User,
  LogOut,
  Timer,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout }) => {
  const menuItems = [
    { id: 'DASHBOARD' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'TASKS' as View, label: 'Task Manager', icon: CheckSquare },
    { id: 'ANALYTICS' as View, label: 'Analytics', icon: BarChart3 },
    { id: 'ML_INSIGHTS' as View, label: 'ML Insights', icon: BrainCircuit },
    { id: 'NOVEL_INSIGHTS' as View, label: 'Novel Research', icon: Sparkles },
    { id: 'FOCUS' as View, label: 'Focus Mode', icon: Target },
    { id: 'REPORTS' as View, label: 'Reports', icon: FileText },
    { id: 'CHATBOT' as View, label: 'AI Coach', icon: MessageSquare },
    { id: 'WELLNESS' as View, label: 'Wellness', icon: Heart },
    { id: 'TEAM' as View, label: 'Team', icon: Users },
  ];

  const bottomItems = [
    { id: 'PROFILE' as View, label: 'Profile', icon: User },
    { id: 'SETTINGS' as View, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
          <Timer className="w-6 h-6" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
          Chronos<span className="text-indigo-500">AI</span>
        </span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === item.id
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
            <span className="text-sm">{item.label}</span>
            {currentView === item.id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.id
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all mt-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
