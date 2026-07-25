"""
Digital Fatigue Index (DFI) Module
Computes a real-time composite fatigue score from behavioral signals.

Novel Contribution:
- No existing productivity app predicts WHEN a user is about to burn out during
  a work session. Current tools only report fatigue after it happens.
- DFI combines multiple behavioral decay signals into a single 0-100 index.
- Proactive break recommendations are triggered when DFI exceeds thresholds.

Signals Fused:
  1. Session Duration Decay — focus sessions getting progressively shorter
  2. App-Switch Acceleration — increasing rate of context switches = rising fatigue
  3. Productivity Ratio Shift — productive-to-distracted ratio declining intra-day
  4. Time Since Last Break — prolonged continuous work without rest
  5. Distraction Frequency Slope — distraction count trending up over sliding window

Output:
  DFI ∈ [0, 100]
    0-25:  Fresh (green)
   25-50:  Moderate (yellow) — consider a short break
   50-75:  Fatigued (orange) — break recommended
   75-100: Burnout risk (red) — immediate rest needed

Reference:
  Mark, G., Gudith, D., & Klocke, U. (2008). "The Cost of Interrupted Work."
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class DigitalFatigueIndex:
    """
    Computes the Digital Fatigue Index from activity and focus session data.
    """

    # Weights for each signal (sum = 1.0)
    WEIGHTS = {
        'session_decay': 0.20,
        'switch_rate': 0.25,
        'productivity_shift': 0.25,
        'time_since_break': 0.15,
        'distraction_slope': 0.15,
    }

    # Thresholds for break recommendations
    THRESHOLDS = {
        'fresh': 25,
        'moderate': 50,
        'fatigued': 75,
        'burnout': 100,
    }

    def compute(self, activities: list, focus_sessions: list,
                window_hours: int = 4) -> Dict:
        """
        Compute the DFI from recent activity and session data.

        Args:
            activities: List of activity dicts with 'timestamp', 'app_name', 'category', 'duration_minutes'
            focus_sessions: List of focus session dicts with 'actual_duration', 'created_at', 'completed'
            window_hours: How many recent hours to analyze (default 4)

        Returns:
            Comprehensive fatigue analysis dict
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=window_hours)

        # Filter to recent window
        recent_activities = [
            a for a in activities
            if self._parse_dt(a.get('timestamp') or a.get('created_at')) >= cutoff
        ]
        recent_sessions = [
            s for s in focus_sessions
            if self._parse_dt(s.get('created_at')) >= cutoff
        ]

        # Compute individual signals
        signals = {}
        signals['session_decay'] = self._session_duration_decay(recent_sessions)
        signals['switch_rate'] = self._app_switch_rate(recent_activities)
        signals['productivity_shift'] = self._productivity_ratio_shift(recent_activities)
        signals['time_since_break'] = self._time_since_break(recent_activities, recent_sessions, now)
        signals['distraction_slope'] = self._distraction_frequency_slope(recent_activities)

        # Weighted composite
        dfi = sum(signals[k] * self.WEIGHTS[k] for k in self.WEIGHTS)
        dfi = min(100, max(0, round(dfi, 1)))

        # Determine status and recommendation
        status, recommendation, color = self._get_recommendation(dfi)

        # Trend: compare first-half vs second-half of window
        mid = cutoff + timedelta(hours=window_hours / 2)
        first_half = [a for a in recent_activities if self._parse_dt(a.get('timestamp') or a.get('created_at')) < mid]
        second_half = [a for a in recent_activities if self._parse_dt(a.get('timestamp') or a.get('created_at')) >= mid]
        
        first_prod = sum(1 for a in first_half if a.get('category') == 'productive')
        second_prod = sum(1 for a in second_half if a.get('category') == 'productive')
        trend = 'rising' if second_prod < first_prod else 'falling' if second_prod > first_prod else 'stable'

        return {
            'dfi_score': dfi,
            'status': status,
            'color': color,
            'recommendation': recommendation,
            'trend': trend,
            'signals': {
                'session_decay': round(signals['session_decay'], 1),
                'switch_rate': round(signals['switch_rate'], 1),
                'productivity_shift': round(signals['productivity_shift'], 1),
                'time_since_break': round(signals['time_since_break'], 1),
                'distraction_slope': round(signals['distraction_slope'], 1),
            },
            'signal_labels': {
                'session_decay': 'Session Duration Decay',
                'switch_rate': 'App-Switch Acceleration',
                'productivity_shift': 'Productivity Ratio Shift',
                'time_since_break': 'Time Since Last Break',
                'distraction_slope': 'Distraction Frequency Slope',
            },
            'window_hours': window_hours,
            'activities_analyzed': len(recent_activities),
            'sessions_analyzed': len(recent_sessions),
        }

    # ──────────── Signal Extractors ────────────

    def _session_duration_decay(self, sessions: list) -> float:
        """
        Score 0-100: Are focus sessions getting shorter over time?
        Compares average duration of first-half sessions vs second-half.
        """
        if len(sessions) < 2:
            return 20  # Neutral with slight bias

        durations = [s.get('actual_duration', s.get('duration', 25)) for s in sessions]
        mid = len(durations) // 2
        first_avg = np.mean(durations[:mid]) if mid > 0 else durations[0]
        second_avg = np.mean(durations[mid:])

        if first_avg == 0:
            return 30

        decay_ratio = (first_avg - second_avg) / first_avg
        # decay_ratio > 0 means sessions are getting shorter (fatigue)
        score = 50 + decay_ratio * 100  # Map [-1, 1] → [0, 100]-ish
        return min(100, max(0, score))

    def _app_switch_rate(self, activities: list) -> float:
        """
        Score 0-100: How rapidly is the user switching between apps?
        More switches per unit time = higher fatigue signal.
        """
        if len(activities) < 3:
            return 15

        # Count transitions (when app changes)
        transitions = 0
        sorted_acts = sorted(activities, key=lambda a: self._parse_dt(a.get('timestamp') or a.get('created_at')))
        for i in range(1, len(sorted_acts)):
            if sorted_acts[i].get('app_name', '') != sorted_acts[i - 1].get('app_name', ''):
                transitions += 1

        # Normalize: 0 transitions = 0, 20+ transitions in window = 100
        rate = (transitions / max(len(activities) - 1, 1)) * 100
        return min(100, rate)

    def _productivity_ratio_shift(self, activities: list) -> float:
        """
        Score 0-100: Is the productive-to-distracted ratio declining?
        High score = ratio is declining (fatigue setting in).
        """
        if len(activities) < 4:
            return 25

        sorted_acts = sorted(activities, key=lambda a: self._parse_dt(a.get('timestamp') or a.get('created_at')))
        mid = len(sorted_acts) // 2
        first_half = sorted_acts[:mid]
        second_half = sorted_acts[mid:]

        def prod_ratio(acts):
            prod = sum(a.get('duration_minutes', 5) for a in acts if a.get('category') == 'productive')
            total = sum(a.get('duration_minutes', 5) for a in acts)
            return prod / max(total, 1)

        r1 = prod_ratio(first_half)
        r2 = prod_ratio(second_half)

        # If ratio dropped from 0.8 to 0.4, that's a big decline
        decline = r1 - r2  # Positive = declining productivity
        score = 50 + decline * 100
        return min(100, max(0, score))

    def _time_since_break(self, activities: list, sessions: list, now: datetime) -> float:
        """
        Score 0-100: How long since the last break (gap) in activity?
        Continuous work > 90 min without break = HIGH fatigue signal.
        """
        if not activities and not sessions:
            return 10  # No data = probably resting

        # Find the most recent gap > 10 minutes between consecutive activities
        all_times = []
        for a in activities:
            t = self._parse_dt(a.get('timestamp') or a.get('created_at'))
            dur = a.get('duration_minutes', 5)
            all_times.append((t, dur))

        if not all_times:
            return 10

        all_times.sort(key=lambda x: x[0])

        last_break = all_times[0][0]  # Start of window
        for i in range(1, len(all_times)):
            gap = (all_times[i][0] - (all_times[i - 1][0] + timedelta(minutes=all_times[i - 1][1]))).total_seconds() / 60
            if gap >= 10:  # 10+ min gap = break
                last_break = all_times[i][0]

        minutes_since_break = (now - last_break).total_seconds() / 60

        # 0 min = 0 score, 90+ min = 100 score
        score = min(100, (minutes_since_break / 90) * 100)
        return max(0, score)

    def _distraction_frequency_slope(self, activities: list) -> float:
        """
        Score 0-100: Is distraction frequency increasing over the window?
        Uses linear regression slope on a sliding count.
        """
        if len(activities) < 4:
            return 20

        sorted_acts = sorted(activities, key=lambda a: self._parse_dt(a.get('timestamp') or a.get('created_at')))

        # Split into 4 bins and count distractions in each
        bin_size = max(1, len(sorted_acts) // 4)
        bins = []
        for i in range(0, len(sorted_acts), bin_size):
            chunk = sorted_acts[i:i + bin_size]
            dist_count = sum(1 for a in chunk if a.get('category') == 'distracting')
            bins.append(dist_count)

        if len(bins) < 2:
            return 20

        # Simple slope: positive = increasing distractions
        x = np.arange(len(bins))
        slope = np.polyfit(x, bins, 1)[0]

        # Map slope to 0-100: slope of 0 = 30, slope of 3+ = 100
        score = 30 + slope * 25
        return min(100, max(0, score))

    # ──────────── Helpers ────────────

    def _parse_dt(self, dt) -> datetime:
        """Parse datetime from various formats."""
        if isinstance(dt, datetime):
            return dt
        if isinstance(dt, str):
            for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%d'):
                try:
                    return datetime.strptime(dt, fmt)
                except ValueError:
                    continue
        return datetime.utcnow()

    def _get_recommendation(self, dfi: float):
        """Return (status, recommendation, color) based on DFI score."""
        if dfi < 25:
            return ('Fresh', 'You are in a great state to focus. Keep going!', 'green')
        elif dfi < 50:
            return ('Moderate', 'Consider a 5-minute micro-break to maintain performance.', 'yellow')
        elif dfi < 75:
            return ('Fatigued', 'Take a 15-minute break. Walk, stretch, or hydrate.', 'orange')
        else:
            return ('Burnout Risk', 'Immediate rest recommended. Extended work is counterproductive at this fatigue level.', 'red')
