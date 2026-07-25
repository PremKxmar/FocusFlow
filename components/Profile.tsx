/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { authApi, tasksApi, focusApi, insightsApi } from '../services/api';
import { 
  User, 
  Mail, 
  Settings, 
  Shield, 
  Zap, 
  TrendingUp,
  Award,
  Edit2,
  ExternalLink,
  Save,
  X,
  Check,
  Clock,
  Target,
  CheckCircle2
} from 'lucide-react';

interface ProfileProps {
  user: UserProfile | null;
  onUserUpdate?: (user: UserProfile) => void;
}

interface UserStats {
  totalTasks: number;
  completedTasks: number;
  totalFocusHours: number;
  avgEfficiency: number;
  rank: string;
  streak: number;
  completionRate: number;
  totalSessions: number;
}

interface Achievement {
  title: string;
  description: string;
  status: string;
  unlocked: boolean;
}

const Profile: React.FC<ProfileProps> = ({ user, onUserUpdate }) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStyle, setEditStyle] = useState<'Balanced' | 'High-focus' | 'Flexible'>('Balanced');
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditStyle(user.style);
      setEditGoals(user.goals || []);
    }
  }, [user]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [taskStats, focusStats, trends] = await Promise.all([
          tasksApi.getStats(),
          focusApi.getStats(30),
          insightsApi.getTrends(30)
        ]);

        const totalTasks = taskStats?.stats?.total || 0;
        const completedTasks = taskStats?.stats?.completed || 0;
        const totalFocusMin = focusStats?.stats?.total_focus_time || 0;
        const totalFocusHours = Math.round(totalFocusMin / 60 * 10) / 10;
        const completionRate = focusStats?.stats?.completion_rate || 0;
        const totalSessions = focusStats?.stats?.total_sessions || 0;

        // Calculate efficiency from productive vs total tracked time
        const totalProductive = trends?.weeklyTrends?.reduce((s: number, d: any) => s + (d.productive_minutes || 0), 0) || 0;
        const totalDistracted = trends?.weeklyTrends?.reduce((s: number, d: any) => s + (d.distracting_minutes || 0), 0) || 0;
        const avgEfficiency = totalProductive + totalDistracted > 0
          ? Math.round(totalProductive / (totalProductive + totalDistracted) * 100)
          : 0;

        // Determine rank
        let rank = 'Beginner';
        if (avgEfficiency >= 90 && completedTasks > 50) rank = 'Elite';
        else if (avgEfficiency >= 75 && completedTasks > 30) rank = 'Advanced';
        else if (avgEfficiency >= 60 && completedTasks > 15) rank = 'Intermediate';
        else if (completedTasks > 5) rank = 'Novice';

        // Calculate streak (consecutive days with activity)
        const streak = trends?.weeklyTrends?.filter((d: any) => (d.productive_minutes || 0) > 0).length || 0;

        setStats({
          totalTasks,
          completedTasks,
          totalFocusHours,
          avgEfficiency,
          rank,
          streak,
          completionRate,
          totalSessions
        });

        // Calculate dynamic achievements
        const dynamicAchievements: Achievement[] = [
          {
            title: 'Deep Work Legend',
            description: `Completed ${totalSessions} focus sessions (10 needed)`,
            status: totalSessions >= 10 ? 'Unlocked' : `${Math.round(totalSessions / 10 * 100)}%`,
            unlocked: totalSessions >= 10
          },
          {
            title: 'Deadline Master',
            description: `${completedTasks} tasks completed (20 needed for unlock)`,
            status: completedTasks >= 20 ? 'Unlocked' : `${Math.round(completedTasks / 20 * 100)}%`,
            unlocked: completedTasks >= 20
          },
          {
            title: 'Consistency King',
            description: `${streak}-day activity streak (7 needed)`,
            status: streak >= 7 ? 'Unlocked' : `${Math.round(streak / 7 * 100)}%`,
            unlocked: streak >= 7
          },
          {
            title: 'Focus Champion',
            description: `${totalFocusHours}h total focus time (10h needed)`,
            status: totalFocusHours >= 10 ? 'Unlocked' : `${Math.round(totalFocusHours / 10 * 100)}%`,
            unlocked: totalFocusHours >= 10
          },
          {
            title: 'Efficiency Expert',
            description: `${avgEfficiency}% efficiency rate (80% needed)`,
            status: avgEfficiency >= 80 ? 'Unlocked' : `${avgEfficiency}%`,
            unlocked: avgEfficiency >= 80
          }
        ];
        setAchievements(dynamicAchievements);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { user: updated } = await authApi.updateProfile({
        name: editName,
        style: editStyle,
        goals: editGoals
      });
      if (onUserUpdate && updated) {
        onUserUpdate(updated);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addGoal = () => {
    if (newGoal.trim() && editGoals.length < 5) {
      setEditGoals([...editGoals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const removeGoal = (index: number) => {
    setEditGoals(editGoals.filter((_, i) => i !== index));
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <User className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-display font-bold shadow-2xl shadow-indigo-500/30 ring-4 ring-white dark:ring-slate-800">
            {(isEditing ? editName : user.name)[0]}
          </div>

          {isEditing ? (
            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block" htmlFor="profile-name">Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block" htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Work Style</label>
                <div className="flex gap-2">
                  {(['Balanced', 'High-focus', 'Flexible'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setEditStyle(style)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        editStyle === style
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Goals</label>
                <div className="space-y-2">
                  {editGoals.map((goal, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300">{goal}</span>
                      <button onClick={() => removeGoal(i)} title="Remove goal" className="p-1 text-slate-400 hover:text-rose-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoal}
                      onChange={e => setNewGoal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addGoal()}
                      placeholder="Add a goal..."
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                    />
                    <button onClick={addGoal} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Add</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditName(user.name); setEditStyle(user.style); setEditGoals(user.goals || []); }}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-2xl text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">{user.name}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-widest">
                    <Zap className="w-3 h-3" />
                    {user.style} Style
                  </div>
                </div>
                {user.goals && user.goals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {user.goals.map((g, i) => (
                      <span key={i} className="text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg font-semibold">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Achievement Card - Dynamic */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
             <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-500">
               <Award className="w-6 h-6" />
             </div>
             <h3 className="font-display font-bold text-slate-900 dark:text-white">Productivity Achievements</h3>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : achievements.map((a, i) => (
              <AchievementItem key={i} title={a.title} description={a.description} status={a.status} unlocked={a.unlocked} />
            ))}
          </div>
        </div>

        {/* Security & Access */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
           <div className="flex items-center gap-4 mb-6">
             <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-500">
               <Shield className="w-6 h-6" />
             </div>
             <h3 className="font-display font-bold text-slate-900 dark:text-white">Privacy & Security</h3>
          </div>
          <div className="space-y-4">
            <SecurityItem title="Two-Factor Auth" status="Disabled" />
            <SecurityItem title="Session History" status="View logs" icon={<ExternalLink className="w-4 h-4" />} />
            <SecurityItem title="Data Portability" status="Export Data" icon={<TrendingUp className="w-4 h-4" />} />
          </div>
        </div>
      </div>

      {/* Stats Summary - Dynamic */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-transparent"></div>
         <div className="relative z-10">
            <h3 className="text-xl font-display font-bold mb-10 flex items-center gap-3">
              <TrendingUp className="text-indigo-400" />
              Usage Intelligence Summary
            </h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <StatItem label="Total Tasks" value={stats?.totalTasks?.toString() || '0'} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
                <StatItem label="Focus Hours" value={`${stats?.totalFocusHours || 0}h`} icon={<Clock className="w-4 h-4 text-indigo-400" />} />
                <StatItem label="Avg Efficiency" value={`${stats?.avgEfficiency || 0}%`} icon={<Target className="w-4 h-4 text-amber-400" />} />
                <StatItem label="Current Rank" value={stats?.rank || 'Beginner'} icon={<Award className="w-4 h-4 text-rose-400" />} />
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

const AchievementItem = ({ title, description, status, unlocked }: any) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
    <div className="flex items-center gap-3">
      {unlocked ? (
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-600" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Target className="w-4 h-4 text-slate-400" />
        </div>
      )}
      <div>
        <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{title}</h5>
        <p className="text-[10px] text-slate-500">{description}</p>
      </div>
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${
      unlocked ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
    }`}>
      {status}
    </span>
  </div>
);

const SecurityItem = ({ title, status, icon }: any) => (
  <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
    <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{title}</span>
    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
      {status}
      {icon}
    </div>
  </button>
);

const StatItem = ({ label, value, icon }: any) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5">
      {icon}
      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-3xl font-display font-bold">{value}</p>
  </div>
);

export default Profile;
