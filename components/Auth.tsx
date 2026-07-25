/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { View, UserProfile } from '../types';
import { authApi } from '../services/api';
import { Timer, Mail, Lock, User, ArrowRight, Github, AlertCircle, Key } from 'lucide-react';

interface AuthProps {
  mode: 'LOGIN' | 'SIGNUP';
  onAuthSuccess: (user: UserProfile) => void;
  setView: (view: View) => void;
}

const Auth: React.FC<AuthProps> = ({ mode, onAuthSuccess, setView }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let data;

      if (mode === 'SIGNUP') {
        data = await authApi.register(name, email, password);
      } else {
        data = await authApi.login(email, password, requires2FA ? totpCode : undefined);
      }

      // Check if 2FA is required
      if (data.requires_2fa) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login helper
  const handleDemoLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const data = await authApi.login('demo@focusflow.local', 'demo123');
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError('Demo login failed. Make sure the backend is running and seeded.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 mb-6">
            <Timer className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-1">
            Chronos<span className="text-indigo-500">AI</span>
          </h2>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">
            {mode === 'LOGIN' ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {mode === 'LOGIN' ? 'Log in to your intelligent workspace.' : 'Join FocusFlow and master your productivity.'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'SIGNUP' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                {mode === 'LOGIN' && (
                  <button type="button" className="text-xs text-indigo-500 font-bold hover:underline">Forgot?</button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                />
              </div>
            </div>

            {requires2FA && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">2FA Code</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm tracking-[0.3em] font-mono text-center"
                  />
                </div>
                <p className="text-[10px] text-slate-500 px-1">Open your authenticator app and enter the code</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{mode === 'LOGIN' ? 'Log In' : 'Create Account'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all text-sm font-bold"
            >
              <Timer className="w-4 h-4" />
              <span>Try Demo Account</span>
            </button>

            <button className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-bold">
              <Github className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          {mode === 'LOGIN' ? "Don't have an account?" : "Already have an account?"}
          <button
            onClick={() => setView(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
            className="ml-2 text-indigo-500 font-bold hover:underline"
          >
            {mode === 'LOGIN' ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
