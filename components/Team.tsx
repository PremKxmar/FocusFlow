/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { teamApi } from '../services/api';
import {
  Users,
  Plus,
  Copy,
  LogIn,
  Trophy,
  BarChart3,
  Target,
  Clock,
  Crown,
  UserPlus,
  LogOut,
  CheckCircle2,
  Zap,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  focus_minutes: number;
  tasks_completed: number;
  productive_minutes: number;
  streak: number;
}

interface TeamData {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  members: TeamMember[];
  total_focus: number;
  total_tasks: number;
  avg_productivity: number;
}



const Team: React.FC = () => {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const data = await teamApi.dashboard();
      setTeam(data);
    } catch (e: any) {
      if (e.message?.includes('not found') || e.message?.includes('404')) {
        setTeam(null);
      } else {
        console.error('Failed to fetch team:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await teamApi.create(teamName);
      setShowCreate(false);
      setTeamName('');
      await fetchTeam();
    } catch (e) {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const joinTeam = async () => {
    if (!inviteCode.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await teamApi.join(inviteCode);
      setShowJoin(false);
      setInviteCode('');
      await fetchTeam();
    } catch (e) {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const leaveTeam = async () => {
    if (!window.confirm('Leave this team?')) return;
    setActionLoading(true);
    try {
      await teamApi.leave();
      setTeam(null);
    } catch (e) {
      console.error('Failed to leave team:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const copyInvite = () => {
    if (team?.invite_code) {
      navigator.clipboard.writeText(team.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // No-team state: show create/join options
  if (!team) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Team Productivity</h2>
            <p className="text-sm text-slate-500">Collaborate and compete with your productivity squad.</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12">
          {/* Create Team Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Plus className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="font-display font-bold text-slate-900 dark:text-white">Create a Team</h3>
            <p className="text-sm text-slate-500">Start a new productivity team and invite members.</p>

            {showCreate ? (
              <div className="space-y-3">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && createTeam()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTeam}
                    disabled={actionLoading || !teamName.trim()}
                    className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                Create Team
              </button>
            )}
          </div>

          {/* Join Team Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <LogIn className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="font-display font-bold text-slate-900 dark:text-white">Join a Team</h3>
            <p className="text-sm text-slate-500">Enter an invite code to join an existing team.</p>

            {showJoin ? (
              <div className="space-y-3">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white font-mono tracking-widest text-center"
                  onKeyDown={(e) => e.key === 'Enter' && joinTeam()}
                  maxLength={8}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowJoin(false)}
                    className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={joinTeam}
                    disabled={actionLoading || !inviteCode.trim()}
                    className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowJoin(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
              >
                Join Team
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Team dashboard
  const sortedMembers = [...team.members].sort((a, b) => b.productive_minutes - a.productive_minutes);
  const token = sessionStorage.getItem('focusflow_token');
  const currentUserId = JSON.parse(atob(token?.split('.')[1] || 'e30=')).id || '';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">{team.name}</h2>
            <p className="text-sm text-slate-500">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTeam}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={copyInvite}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : `Invite: ${team.invite_code}`}
          </button>
          <button
            onClick={leaveTeam}
            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
            title="Leave Team"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Focus', value: `${Math.round(team.total_focus / 60)}h`, icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
          { label: 'Tasks Done', value: team.total_tasks.toString(), icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Avg Productivity', value: `${Math.round(team.avg_productivity)}min`, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Members', value: team.members.length.toString(), icon: UserPlus, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard
          </h3>

          <div className="space-y-2">
            {sortedMembers.map((member, i) => {
              const isMe = member.id === currentUserId;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isMe ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <span className="text-lg w-8 text-center">{medal}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {member.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                      {member.name}
                      {isMe && <span className="text-[10px] text-indigo-500 font-bold">(You)</span>}
                      {member.role === 'admin' && <Crown className="w-3 h-3 text-amber-500" />}
                    </p>
                    <p className="text-[10px] text-slate-400">{member.productive_minutes}min productive</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{member.tasks_completed}</p>
                    <p className="text-[9px] text-slate-400">tasks</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Member Stats
          </h3>

          <div className="space-y-4">
            {sortedMembers.map((member) => {
              const maxProd = Math.max(...sortedMembers.map(m => m.productive_minutes), 1);
              const pct = Math.round((member.productive_minutes / maxProd) * 100);
              return (
                <div key={member.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{member.name}</span>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" />{member.focus_minutes}m focus</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{member.streak}d streak</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Team Activity Feed */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Activity</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {sortedMembers.slice(0, 5).map((member, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span><strong className="text-slate-700 dark:text-slate-300">{member.name}</strong> completed {member.tasks_completed} tasks with {member.focus_minutes}min focus</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
