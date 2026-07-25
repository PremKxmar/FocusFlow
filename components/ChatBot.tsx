/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { insightsApi } from '../services/api';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Lightbulb,
  Target,
  TrendingUp,
  Clock,
  Trash2
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ProductivityContext {
  focusScore?: number;
  tasksCompleted?: number;
  totalTasks?: number;
  distractionSpikes?: number;
  topFocusWindow?: string;
  weeklyProductiveMinutes?: number;
  streakDays?: number;
}

const SYSTEM_PROMPT = `You are FocusFlow, a productivity coaching assistant. You help users:
- Improve focus and deep work habits
- Manage tasks and priorities effectively
- Reduce distractions and build better routines
- Understand their productivity patterns
- Set and achieve productivity goals

Be concise, actionable, and encouraging. Use bullet points for clarity.
When the user shares their productivity data, give specific, personalized advice.
Keep responses under 200 words unless asked for detail.`;

const SUGGESTED_PROMPTS = [
  { icon: Target, text: 'How can I improve my focus score?' },
  { icon: TrendingUp, text: 'Analyze my productivity patterns' },
  { icon: Clock, text: 'What\'s the best time for deep work?' },
  { icon: Lightbulb, text: 'Give me tips to reduce distractions' },
];

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('FocusFlow_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { return []; }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [productivityContext, setProductivityContext] = useState<ProductivityContext>({});
  const [contextLoaded, setContextLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch user's productivity data for context
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const [dashboard, trends] = await Promise.all([
          insightsApi.getDashboard().catch(() => null),
          insightsApi.getTrends(7).catch(() => null),
        ]);

        const ctx: ProductivityContext = {};
        if (dashboard) {
          ctx.focusScore = dashboard.focusScore;
          ctx.tasksCompleted = dashboard.taskStats?.completed;
          ctx.totalTasks = dashboard.taskStats?.total;
          ctx.distractionSpikes = dashboard.distractionSpikes;
        }
        if (trends?.weeklyTrends) {
          ctx.weeklyProductiveMinutes = trends.weeklyTrends.reduce(
            (sum: number, d: any) => sum + (d.productive_minutes || 0), 0
          );
        }
        setProductivityContext(ctx);
        setContextLoaded(true);
      } catch {
        setContextLoaded(true);
      }
    };
    fetchContext();
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('FocusFlow_chat_history', JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateResponse = async (userMessage: string): Promise<string> => {
    // Build context string from productivity data
    const contextStr = contextLoaded && Object.keys(productivityContext).length > 0
      ? `\n\nUser's current productivity data:
- Focus Score: ${productivityContext.focusScore ?? 'N/A'}%
- Tasks Completed: ${productivityContext.tasksCompleted ?? 0} of ${productivityContext.totalTasks ?? 0}
- Distraction Spikes: ${productivityContext.distractionSpikes ?? 0}
- Weekly Productive Minutes: ${productivityContext.weeklyProductiveMinutes ?? 0}
Use this data to personalize your response.`
      : '';

    // Build conversation history (last 10 messages for context)
    const history = messages.slice(-10).map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const fullPrompt = `${SYSTEM_PROMPT}${contextStr}\n\nConversation:\n${history}\nUser: ${userMessage}\nAssistant:`;

    try {
      // Use backend Gemini endpoint or fall back to rule-based responses
      const data = await insightsApi.chat(userMessage, fullPrompt);
      if (data) {
        return data.response || data.reply || data.message;
      }
    } catch {
      // Backend not available - fall through to local responses
    }

    // Intelligent fallback responses based on keywords
    return generateLocalResponse(userMessage);
  };

  const generateLocalResponse = (message: string): string => {
    const lower = message.toLowerCase();
    const { focusScore, tasksCompleted, totalTasks, distractionSpikes, weeklyProductiveMinutes } = productivityContext;

    if (lower.includes('focus score') || lower.includes('improve focus')) {
      return `Based on your data, here are personalized tips to improve your focus:

${focusScore !== undefined ? `• Your current focus score is **${focusScore}%**. ${focusScore < 50 ? 'This needs improvement.' : focusScore < 75 ? 'Good, but room to grow.' : 'Excellent work!'}` : ''}
• **Use the Pomodoro technique** — 25 min focus + 5 min break
• **Block distracting apps** during work sessions using Focus Mode
• **Schedule deep work** during your peak productivity hours
${distractionSpikes !== undefined && distractionSpikes > 3 ? `• You had **${distractionSpikes} distraction spikes** today — try reducing context switching` : ''}
• Start with your hardest task first (eat the frog)`;
    }

    if (lower.includes('pattern') || lower.includes('analyze') || lower.includes('productivity')) {
      return `Here's your productivity analysis:

${tasksCompleted !== undefined ? `• **Tasks**: ${tasksCompleted}/${totalTasks} completed (${totalTasks ? Math.round((tasksCompleted/totalTasks)*100) : 0}% completion rate)` : '• Track tasks to see completion data'}
${weeklyProductiveMinutes !== undefined ? `• **Weekly Productive Time**: ${Math.round(weeklyProductiveMinutes)} minutes (${Math.round(weeklyProductiveMinutes/60)}h)` : ''}
${focusScore !== undefined ? `• **Focus Score**: ${focusScore}%` : ''}
${distractionSpikes !== undefined ? `• **Distraction Spikes**: ${distractionSpikes} today` : ''}

**Recommendations:**
• ${weeklyProductiveMinutes !== undefined && weeklyProductiveMinutes < 300 ? 'Aim for at least 5 hours of productive time this week' : 'Great productive output! Maintain this momentum'}
• Review your Analytics page for detailed day-by-day comparison`;
    }

    if (lower.includes('deep work') || lower.includes('best time')) {
      return `Finding your optimal deep work time:

• **Check your Analytics page** → Performance Analytics shows your peak productivity hours
• Most people focus best in the **morning (9-11 AM)** or **late afternoon (3-5 PM)**
• **Block 2-3 hours** for uninterrupted deep work
• Turn on **Focus Mode** with app blocking during these windows
• Avoid scheduling meetings during your peak hours

Use the "Focus Windows" feature in Analytics to see your personal best times based on tracked data.`;
    }

    if (lower.includes('distraction') || lower.includes('procrastinat')) {
      return `Strategies to beat distractions:

${distractionSpikes !== undefined && distractionSpikes > 0 ? `• You have **${distractionSpikes} distraction spikes** — let's reduce this!` : ''}
• **Enable Focus Mode** — it blocks apps and tracks distraction attempts
• **2-Minute Rule**: If a task takes <2 min, do it now. Otherwise, schedule it
• **Environment design**: Remove phone from workspace, use noise-canceling headphones
• **Batch social media** into specific time slots (e.g., 12 PM and 6 PM)
• **Use the Pomodoro timer** — knowing a break is coming reduces urge to check phone`;
    }

    if (lower.includes('task') || lower.includes('priorit')) {
      return `Task management tips:

${tasksCompleted !== undefined ? `• You've completed **${tasksCompleted} of ${totalTasks}** tasks — ${totalTasks && tasksCompleted/totalTasks > 0.7 ? 'great progress!' : 'keep pushing!'}` : ''}
• **Eisenhower Matrix**: Categorize by Urgent/Important
• **3-Task Rule**: Pick 3 must-do tasks each morning
• **Time-block** your calendar for specific task categories
• Break large tasks into **sub-tasks under 30 minutes**
• Use the Task Manager to set priorities and deadlines`;
    }

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return `Hey! 👋 I'm your FocusFlow productivity coach.

I can help you with:
• Analyzing your productivity patterns
• Improving your focus score
• Finding your best deep work times
• Reducing distractions
• Managing tasks effectively

What would you like to work on?`;
    }

    // Default response
    return `Great question! Here are some general productivity tips:

• **Track consistently** — use FocusFlow's tracker to build a data baseline
• **Review weekly** — check your Reports page every Sunday
• **Set 3 daily goals** — use the Task Manager with priorities
• **Focus sessions** — aim for at least 3 Pomodoro sessions per day
• **Celebrate wins** — acknowledge completed tasks and streaks

Want me to analyze something specific? Try asking about your focus score, distraction patterns, or task completion rate.`;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateResponse(trimmed);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('FocusFlow_chat_history');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Productivity Coach</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              AI-powered productivity insights
              {contextLoaded && Object.keys(productivityContext).length > 0 && (
                <span className="ml-1 text-emerald-500">• Context loaded</span>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            title="Clear chat"
            aria-label="Clear chat"
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center">
              <Bot className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">How can I help you today?</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                I'm your AI productivity coach. Ask me anything about improving focus, managing tasks, or building better habits.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt.text); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all text-left"
                >
                  <prompt.icon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line.startsWith('•') || line.startsWith('-') ? (
                          <div className="flex items-start gap-1.5 my-0.5">
                            <span className="mt-0.5">•</span>
                            <span>{line.replace(/^[•-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                          </div>
                        ) : (
                          <>
                            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                            {i < msg.content.split('\n').length - 1 && <br />}
                          </>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about productivity, focus, tasks..."
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          title="Send message"
          aria-label="Send message"
          className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
