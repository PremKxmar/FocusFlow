/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { View, VIEW_TITLES } from '../types';
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
  // Labels come from VIEW_TITLES so the sidebar and the page header cannot drift apart.
  const item = (id: View, icon: typeof LayoutDashboard) => ({ id, label: VIEW_TITLES[id], icon });

  const menuItems = [
    item('DASHBOARD', LayoutDashboard),
    item('TASKS', CheckSquare),
    item('ANALYTICS', BarChart3),
    item('ML_INSIGHTS', BrainCircuit),
    item('NOVEL_INSIGHTS', Sparkles),
    item('FOCUS', Target),
    item('REPORTS', FileText),
    item('CHATBOT', MessageSquare),
    item('WELLNESS', Heart),
    item('TEAM', Users),
  ];

  const bottomItems = [
    item('PROFILE', User),
    item('SETTINGS', Settings),
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
          <Timer className="w-6 h-6" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
          Focus<span className="text-indigo-500">Flow</span>
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
