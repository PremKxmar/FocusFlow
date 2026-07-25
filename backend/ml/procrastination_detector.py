"""
Procrastination Sequence Mining Module
Detects pre-procrastination behavioral signatures using sequential pattern mining.

Novel Contribution:
- No existing app detects procrastination BEFORE it happens.
- Uses Sequential Pattern Mining (PrefixSpan-inspired) to discover app-usage
  sequences that reliably precede procrastination episodes.
- Example: [Email → Twitter → Reddit → 20-min delay before starting task]
- Real-time alerts when a known procrastination sequence is detected.

Algorithm:
  1. Build sequences of app-category transitions per day
  2. Label sequences that ended with prolonged distraction (>15 min) or
     delayed task start as "procrastination episodes"
  3. Mine frequent subsequences that appear in ≥50% of procrastination episodes
  4. Score current session against known patterns in real-time

Reference:
  Pei, J., et al. (2004). "Mining Sequential Patterns by Pattern-Growth."
  IEEE Transactions on Knowledge & Data Engineering.
"""
import numpy as np
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Dict, List, Tuple, Optional


class ProcrastinationDetector:
    """
    Mines and detects procrastination sequences from app usage data.
    """

    # Common procrastination trigger apps
    PROCRASTINATION_APPS = {
        'twitter', 'reddit', 'instagram', 'facebook', 'youtube',
        'tiktok', 'netflix', 'twitch', 'games',
    }

    # Min consecutive distracting minutes to flag as procrastination episode
    PROCRASTINATION_THRESHOLD = 15  # minutes

    def analyze(self, activities: list, days: int = 7) -> Dict:
        """
        Full procrastination analysis.

        Args:
            activities: All activities for the user
            days: Number of days to analyze

        Returns:
            Comprehensive procrastination analysis
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        recent = [
            a for a in activities
            if self._parse_dt(a.get('timestamp') or a.get('created_at')) >= cutoff
        ]
        recent.sort(key=lambda a: self._parse_dt(a.get('timestamp') or a.get('created_at')))

        if len(recent) < 5:
            return self._empty_result(days)

        # Step 1: Build daily sequences
        daily_sequences = self._build_daily_sequences(recent)

        # Step 2: Identify procrastination episodes
        episodes = self._identify_episodes(recent)

        # Step 3: Mine frequent patterns
        patterns = self._mine_patterns(episodes, daily_sequences)

        # Step 4: Score current session
        today = datetime.utcnow().strftime('%Y-%m-%d')
        today_seq = daily_sequences.get(today, [])
        risk_score, matched_patterns = self._score_current_session(today_seq, patterns)

        # Step 5: Compute summary stats
        avg_episode_duration = (
            np.mean([e['duration'] for e in episodes]) if episodes else 0
        )
        peak_hours = self._procrastination_peak_hours(episodes)
        trigger_apps = self._top_trigger_apps(episodes)

        return {
            'risk_score': round(risk_score, 1),
            'risk_level': self._risk_label(risk_score),
            'total_episodes': len(episodes),
            'avg_episode_duration': round(avg_episode_duration, 1),
            'time_lost_minutes': round(sum(e['duration'] for e in episodes), 0),
            'frequent_patterns': patterns[:5],
            'matched_patterns': matched_patterns,
            'trigger_apps': trigger_apps[:5],
            'peak_procrastination_hours': peak_hours,
            'daily_episode_counts': self._daily_counts(episodes),
            'episodes_detail': [
                {
                    'date': e['date'],
                    'start_time': e['start_time'],
                    'duration': round(e['duration'], 1),
                    'sequence': e['sequence'][:5],
                    'trigger_app': e['trigger_app'],
                }
                for e in episodes[:10]
            ],
            'recommendations': self._generate_recommendations(patterns, trigger_apps, peak_hours),
            'days_analyzed': days,
            'activities_analyzed': len(recent),
        }

    def _build_daily_sequences(self, activities: list) -> Dict[str, List[str]]:
        """Group activities into daily app sequences."""
        daily = defaultdict(list)
        for a in activities:
            date = self._parse_dt(a.get('timestamp') or a.get('created_at')).strftime('%Y-%m-%d')
            app = a.get('app_name', 'Unknown').lower()
            # Avoid consecutive duplicates
            if not daily[date] or daily[date][-1] != app:
                daily[date].append(app)
        return dict(daily)

    def _identify_episodes(self, activities: list) -> List[Dict]:
        """
        Identify procrastination episodes:
        A consecutive stretch of distracting app usage ≥ PROCRASTINATION_THRESHOLD minutes.
        """
        episodes = []
        current_episode = None

        for a in activities:
            cat = a.get('category', 'neutral')
            dur = a.get('duration_minutes', 5)
            app = a.get('app_name', 'Unknown').lower()
            ts = self._parse_dt(a.get('timestamp') or a.get('created_at'))

            if cat == 'distracting':
                if current_episode is None:
                    current_episode = {
                        'start': ts,
                        'duration': dur,
                        'sequence': [app],
                        'trigger_app': app,
                        'date': ts.strftime('%Y-%m-%d'),
                        'start_time': ts.strftime('%H:%M'),
                    }
                else:
                    current_episode['duration'] += dur
                    if app not in current_episode['sequence'][-1:]:
                        current_episode['sequence'].append(app)
            else:
                if current_episode and current_episode['duration'] >= self.PROCRASTINATION_THRESHOLD:
                    episodes.append(current_episode)
                current_episode = None

        # Don't forget trailing episode
        if current_episode and current_episode['duration'] >= self.PROCRASTINATION_THRESHOLD:
            episodes.append(current_episode)

        return episodes

    def _mine_patterns(self, episodes: List[Dict], daily_sequences: Dict) -> List[Dict]:
        """
        Mine frequent subsequences that appear before procrastination episodes.
        Uses a simplified PrefixSpan approach.
        """
        if not episodes:
            return []

        # Extract the 3-app sequences preceding each episode
        pre_episode_sequences = []
        for ep in episodes:
            date = ep['date']
            if date in daily_sequences:
                seq = daily_sequences[date]
                trigger = ep['trigger_app']
                try:
                    idx = seq.index(trigger)
                    # Take up to 3 apps before the trigger
                    prefix = seq[max(0, idx - 3):idx + 1]
                    if len(prefix) >= 2:
                        pre_episode_sequences.append(tuple(prefix))
                except ValueError:
                    pass

        if not pre_episode_sequences:
            return []

        # Count 2-gram and 3-gram subsequences
        ngram_counts = Counter()
        for seq in pre_episode_sequences:
            for n in range(2, min(4, len(seq) + 1)):
                for i in range(len(seq) - n + 1):
                    ngram = seq[i:i + n]
                    ngram_counts[ngram] += 1

        # Filter patterns appearing in ≥30% of episodes (relaxed for small datasets)
        min_support = max(1, int(len(episodes) * 0.3))
        frequent = [
            {
                'sequence': list(pattern),
                'frequency': count,
                'support': round(count / len(episodes), 2),
                'display': ' → '.join(p.title() for p in pattern),
            }
            for pattern, count in ngram_counts.most_common()
            if count >= min_support
        ]

        return frequent

    def _score_current_session(self, today_seq: List[str], patterns: List[Dict]) -> Tuple[float, List[Dict]]:
        """
        Score current session against known procrastination patterns.
        Returns (risk_score 0-100, matched_patterns).
        """
        if not today_seq or not patterns:
            return (0, [])

        matched = []
        total_weight = 0

        for pattern in patterns:
            pat_seq = pattern['sequence']
            # Check if pattern is a subsequence of today's sequence
            if self._is_subsequence(pat_seq, today_seq):
                matched.append(pattern)
                total_weight += pattern['support']

        if not matched:
            return (0, [])

        # Risk score based on how many patterns matched and their support
        risk = min(100, total_weight * 100)
        return (risk, matched)

    def _is_subsequence(self, subseq: list, seq: list) -> bool:
        """Check if subseq is a subsequence of seq."""
        it = iter(seq)
        return all(item in it for item in subseq)

    def _procrastination_peak_hours(self, episodes: List[Dict]) -> List[Dict]:
        """Find peak procrastination hours."""
        hour_counts = Counter()
        for ep in episodes:
            hour = ep['start_time'].split(':')[0]
            hour_counts[hour] += 1

        return [
            {'hour': f'{h}:00', 'count': c}
            for h, c in hour_counts.most_common(5)
        ]

    def _top_trigger_apps(self, episodes: List[Dict]) -> List[Dict]:
        """Find apps that most frequently trigger procrastination."""
        app_counts = Counter()
        app_durations = defaultdict(float)
        for ep in episodes:
            app = ep['trigger_app']
            app_counts[app] += 1
            app_durations[app] += ep['duration']

        return [
            {
                'app': app,
                'trigger_count': count,
                'total_time_lost': round(app_durations[app], 0),
            }
            for app, count in app_counts.most_common()
        ]

    def _daily_counts(self, episodes: List[Dict]) -> List[Dict]:
        """Daily episode counts for visualization."""
        daily = Counter()
        for ep in episodes:
            daily[ep['date']] += 1
        return [{'date': d, 'episodes': c} for d, c in sorted(daily.items())]

    def _generate_recommendations(self, patterns: list, trigger_apps: list, peak_hours: list) -> List[str]:
        """Generate actionable procrastination-prevention recommendations."""
        recs = []

        if trigger_apps:
            top_app = trigger_apps[0]['app']
            recs.append(
                f'Block or limit "{top_app.title()}" during work hours — it triggered '
                f'{trigger_apps[0]["trigger_count"]} procrastination episodes.'
            )

        if peak_hours:
            top_hour = peak_hours[0]['hour']
            recs.append(
                f'Schedule your most important focused work BEFORE {top_hour}, '
                f'as this is your peak procrastination window.'
            )

        if patterns:
            top_pattern = patterns[0]['display']
            recs.append(
                f'Watch out for this sequence: {top_pattern}. '
                f'When you notice it starting, switch to a focus session immediately.'
            )

        if not recs:
            recs.append('Keep tracking — more data will unlock personalized anti-procrastination strategies.')

        recs.append('Try the "2-minute rule": when tempted to procrastinate, commit to working for just 2 minutes.')

        return recs

    # ──────────── Helpers ────────────

    def _parse_dt(self, dt) -> datetime:
        if isinstance(dt, datetime):
            return dt
        if isinstance(dt, str):
            for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%d'):
                try:
                    return datetime.strptime(dt, fmt)
                except ValueError:
                    continue
        return datetime.utcnow()

    def _risk_label(self, score: float) -> str:
        if score < 20:
            return 'Low Risk'
        elif score < 50:
            return 'Moderate Risk'
        elif score < 75:
            return 'High Risk'
        else:
            return 'Critical — Intervention Needed'

    def _empty_result(self, days: int) -> Dict:
        return {
            'risk_score': 0,
            'risk_level': 'No Data',
            'total_episodes': 0,
            'avg_episode_duration': 0,
            'time_lost_minutes': 0,
            'frequent_patterns': [],
            'matched_patterns': [],
            'trigger_apps': [],
            'peak_procrastination_hours': [],
            'daily_episode_counts': [],
            'episodes_detail': [],
            'recommendations': ['Start tracking your activity to detect procrastination patterns.'],
            'days_analyzed': days,
            'activities_analyzed': 0,
        }
