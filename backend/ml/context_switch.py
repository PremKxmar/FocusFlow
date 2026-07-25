"""
Context-Switch Cost & Attention Residue Modeling
Quantifies the cognitive cost of switching between apps/tasks.

Novel Contribution:
- No productivity app measures the COGNITIVE COST of context switches.
- Based on Sophie Leroy's (2009) "Attention Residue" theory: switching from
  Task A to Task B leaves residual thoughts about A that degrade performance on B.
- Builds an "app transition graph" and computes a Context Switch Penalty Score (CSPS).
- Correlates switching patterns with subsequent productivity decline.

Metrics Produced:
  1. Context Switch Penalty Score (CSPS) — 0 to 100
  2. App Transition Graph — directed graph of app→app transitions with frequencies
  3. Attention Residue Decay — how long it takes to regain focus after a switch
  4. Task Batching Recommendations — suggest grouping similar app usage

Reference:
  Leroy, S. (2009). "Why is it so hard to do my work?" Organizational Behavior and
  Human Decision Processes, 109(2), 168-181.
"""
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import Dict, List, Tuple


class ContextSwitchAnalyzer:
    """
    Analyzes context-switching behavior and computes attention residue metrics.
    """

    # App category clusters for batching recommendations
    APP_CLUSTERS = {
        'Development': ['vscode', 'code', 'terminal', 'github', 'gitlab', 'stackoverflow', 'jupyter'],
        'Communication': ['slack', 'teams', 'zoom', 'discord', 'email', 'gmail', 'outlook'],
        'Creative': ['figma', 'photoshop', 'canva', 'illustrator', 'sketch'],
        'Documentation': ['word', 'docs', 'notion', 'confluence', 'obsidian', 'notes'],
        'Social Media': ['twitter', 'facebook', 'instagram', 'reddit', 'tiktok', 'linkedin'],
        'Entertainment': ['youtube', 'netflix', 'twitch', 'spotify', 'games'],
        'Productivity': ['excel', 'sheets', 'powerpoint', 'trello', 'jira', 'asana'],
    }

    def analyze(self, activities: list, window_hours: int = 8) -> Dict:
        """
        Full context-switch analysis for recent activities.

        Args:
            activities: List of activity dicts with 'app_name', 'timestamp', 'category', 'duration_minutes'
            window_hours: Analysis window (default: 8 hours)

        Returns:
            Comprehensive context-switch analysis
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=window_hours)

        recent = [
            a for a in activities
            if self._parse_dt(a.get('timestamp') or a.get('created_at')) >= cutoff
        ]
        recent.sort(key=lambda a: self._parse_dt(a.get('timestamp') or a.get('created_at')))

        if len(recent) < 2:
            return self._empty_result(window_hours)

        # Build transition graph
        transitions = self._build_transition_graph(recent)
        
        # Compute metrics
        csps = self._compute_csps(recent, transitions)
        residue_analysis = self._analyze_residue_decay(recent)
        category_transitions = self._category_level_transitions(recent)
        costly_switches = self._identify_costly_switches(recent)
        batching = self._generate_batching_recommendations(recent, transitions)
        hourly_switches = self._hourly_switch_rate(recent)

        return {
            'csps': round(csps, 1),
            'csps_label': self._csps_label(csps),
            'total_switches': sum(transitions['counts'].values()),
            'unique_apps': len(set(a.get('app_name', 'Unknown') for a in recent)),
            'transition_graph': {
                'nodes': transitions['nodes'],
                'edges': transitions['top_edges'][:10],  # Top 10 most frequent
            },
            'attention_residue': residue_analysis,
            'category_transitions': category_transitions,
            'costly_switches': costly_switches[:5],
            'batching_recommendations': batching,
            'hourly_switch_rate': hourly_switches,
            'window_hours': window_hours,
            'activities_analyzed': len(recent),
        }

    def _build_transition_graph(self, activities: list) -> Dict:
        """Build a directed transition graph between apps."""
        counts = Counter()
        nodes = set()

        for i in range(1, len(activities)):
            src = activities[i - 1].get('app_name', 'Unknown').lower()
            dst = activities[i].get('app_name', 'Unknown').lower()
            if src != dst:
                counts[(src, dst)] += 1
                nodes.add(src)
                nodes.add(dst)

        # Format edges sorted by frequency
        edges = [
            {'from': src, 'to': dst, 'count': count, 'weight': round(count / max(sum(counts.values()), 1), 3)}
            for (src, dst), count in counts.most_common()
        ]

        return {
            'counts': counts,
            'nodes': list(nodes),
            'top_edges': edges,
        }

    def _compute_csps(self, activities: list, transitions: Dict) -> float:
        """
        Context Switch Penalty Score (0-100).
        
        Factors:
        - Raw switch count (normalized)
        - Category-crossing ratio (productive→distracting switches are costlier)
        - Switch fragmentation (many small bursts = higher penalty)
        """
        total_switches = sum(transitions['counts'].values())
        n = len(activities)

        if n <= 1:
            return 0

        # Factor 1: Switch density (switches per activity entry)
        switch_density = total_switches / (n - 1)  # 0 to 1
        density_score = switch_density * 40  # Max 40 points

        # Factor 2: Category-crossing switches
        cross_category = 0
        productive_to_distracting = 0
        for i in range(1, n):
            prev_cat = activities[i - 1].get('category', 'neutral')
            curr_cat = activities[i].get('category', 'neutral')
            prev_app = activities[i - 1].get('app_name', '').lower()
            curr_app = activities[i].get('app_name', '').lower()
            if prev_app != curr_app:
                if prev_cat != curr_cat:
                    cross_category += 1
                if prev_cat == 'productive' and curr_cat == 'distracting':
                    productive_to_distracting += 1

        cross_ratio = cross_category / max(total_switches, 1)
        p2d_ratio = productive_to_distracting / max(total_switches, 1)
        category_score = (cross_ratio * 20) + (p2d_ratio * 20)  # Max 40 points

        # Factor 3: Fragmentation (very short app sessions)
        short_sessions = sum(1 for a in activities if a.get('duration_minutes', 5) < 5)
        frag_ratio = short_sessions / max(n, 1)
        frag_score = frag_ratio * 20  # Max 20 points

        return min(100, density_score + category_score + frag_score)

    def _analyze_residue_decay(self, activities: list) -> Dict:
        """
        Analyze how long it takes to regain focus after a productive→distracting switch.
        """
        recovery_times = []

        for i in range(1, len(activities)):
            prev = activities[i - 1]
            curr = activities[i]

            # Detect productive → distracting switch
            if prev.get('category') == 'productive' and curr.get('category') == 'distracting':
                # Look ahead for next productive activity
                for j in range(i + 1, len(activities)):
                    if activities[j].get('category') == 'productive':
                        t_start = self._parse_dt(curr.get('timestamp') or curr.get('created_at'))
                        t_recovery = self._parse_dt(activities[j].get('timestamp') or activities[j].get('created_at'))
                        recovery_min = (t_recovery - t_start).total_seconds() / 60
                        if 0 < recovery_min < 120:  # Reasonable range
                            recovery_times.append(recovery_min)
                        break

        if not recovery_times:
            return {
                'avg_recovery_minutes': 0,
                'max_recovery_minutes': 0,
                'recovery_events': 0,
                'insight': 'No productive→distracting→productive sequences detected yet.',
            }

        avg_recovery = np.mean(recovery_times)
        max_recovery = np.max(recovery_times)

        insight = (
            f'After switching to distracting apps, it takes you an average of {avg_recovery:.0f} minutes '
            f'to return to productive work. '
            f'{"This is within healthy range (< 15 min)." if avg_recovery < 15 else "Consider batching distractions to reduce this cost."}'
        )

        return {
            'avg_recovery_minutes': round(avg_recovery, 1),
            'max_recovery_minutes': round(max_recovery, 1),
            'recovery_events': len(recovery_times),
            'insight': insight,
        }

    def _category_level_transitions(self, activities: list) -> List[Dict]:
        """Count transitions between productivity categories."""
        cat_counts = Counter()
        for i in range(1, len(activities)):
            prev = activities[i - 1].get('category', 'neutral')
            curr = activities[i].get('category', 'neutral')
            prev_app = activities[i - 1].get('app_name', '').lower()
            curr_app = activities[i].get('app_name', '').lower()
            if prev_app != curr_app:
                cat_counts[(prev, curr)] += 1

        return [
            {'from': src, 'to': dst, 'count': count}
            for (src, dst), count in cat_counts.most_common()
        ]

    def _identify_costly_switches(self, activities: list) -> List[Dict]:
        """
        Identify the most costly context switches (productive → distracting)
        with the longest recovery time.
        """
        costly = []

        for i in range(1, len(activities)):
            prev = activities[i - 1]
            curr = activities[i]

            if prev.get('category') == 'productive' and curr.get('category') == 'distracting':
                prev_app = prev.get('app_name', 'Unknown')
                curr_app = curr.get('app_name', 'Unknown')
                time_str = self._parse_dt(curr.get('timestamp') or curr.get('created_at')).strftime('%H:%M')

                # Estimate lost productive time
                dist_duration = curr.get('duration_minutes', 5)

                costly.append({
                    'from_app': prev_app,
                    'to_app': curr_app,
                    'time': time_str,
                    'lost_minutes': dist_duration,
                    'severity': 'high' if dist_duration > 15 else 'medium' if dist_duration > 5 else 'low',
                })

        costly.sort(key=lambda c: c['lost_minutes'], reverse=True)
        return costly

    def _generate_batching_recommendations(self, activities: list, transitions: Dict) -> List[Dict]:
        """
        Suggest task batching to reduce context switches.
        """
        recommendations = []
        apps_used = [a.get('app_name', 'Unknown').lower() for a in activities]
        app_counts = Counter(apps_used)

        # Check if user is frequently switching between clusters
        cluster_usage = defaultdict(list)
        for app in app_counts:
            for cluster_name, cluster_apps in self.APP_CLUSTERS.items():
                if any(ca in app for ca in cluster_apps):
                    cluster_usage[cluster_name].append(app)
                    break

        # Find fragmented clusters (used multiple times but interspersed)
        for cluster, apps in cluster_usage.items():
            total_entries = sum(app_counts[a] for a in apps)
            if total_entries >= 3 and len(apps) >= 1:
                recommendations.append({
                    'cluster': cluster,
                    'apps': apps,
                    'suggestion': f'Batch your {cluster} tasks together. You switched to {cluster} apps {total_entries} times — try a single focused block instead.',
                    'potential_savings': f'{min(total_entries * 3, 30)} minutes',
                })

        # Check for frequent productive↔distracting ping-pong
        ping_pong = 0
        for i in range(2, len(activities)):
            cats = [activities[j].get('category') for j in range(i - 2, i + 1)]
            if cats == ['productive', 'distracting', 'productive'] or cats == ['distracting', 'productive', 'distracting']:
                ping_pong += 1

        if ping_pong >= 2:
            recommendations.append({
                'cluster': 'Focus Protection',
                'apps': [],
                'suggestion': f'You had {ping_pong} "ping-pong" switches between productive and distracting apps. Use website blockers during deep work.',
                'potential_savings': f'{ping_pong * 5} minutes',
            })

        return recommendations

    def _hourly_switch_rate(self, activities: list) -> List[Dict]:
        """Compute switches per hour for visualization."""
        hourly = defaultdict(int)
        for i in range(1, len(activities)):
            prev_app = activities[i - 1].get('app_name', '').lower()
            curr_app = activities[i].get('app_name', '').lower()
            if prev_app != curr_app:
                hour = self._parse_dt(activities[i].get('timestamp') or activities[i].get('created_at')).strftime('%H:00')
                hourly[hour] += 1

        return [{'hour': h, 'switches': c} for h, c in sorted(hourly.items())]

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

    def _csps_label(self, csps: float) -> str:
        if csps < 20:
            return 'Excellent focus — minimal switching'
        elif csps < 40:
            return 'Moderate switching — generally manageable'
        elif csps < 60:
            return 'High switching — consider batching similar tasks'
        elif csps < 80:
            return 'Very high switching — significant productivity loss'
        else:
            return 'Extreme switching — severe attention fragmentation'

    def _empty_result(self, window_hours: int) -> Dict:
        return {
            'csps': 0,
            'csps_label': 'No data — start tracking to analyze switching patterns',
            'total_switches': 0,
            'unique_apps': 0,
            'transition_graph': {'nodes': [], 'edges': []},
            'attention_residue': {
                'avg_recovery_minutes': 0, 'max_recovery_minutes': 0,
                'recovery_events': 0, 'insight': 'Not enough data yet.',
            },
            'category_transitions': [],
            'costly_switches': [],
            'batching_recommendations': [],
            'hourly_switch_rate': [],
            'window_hours': window_hours,
            'activities_analyzed': 0,
        }
