import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trophy,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getDashboardStats, getRecentActivity, getWeeklyRounds } from '../lib/api';
import type { DashboardStats, ActivityItem } from '../lib/types';

function StatCard({
  label,
  value,
  growth,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  growth: number;
  icon: typeof Users;
  color: string;
}) {
  const isPositive = growth >= 0;
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-green-600" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-600" />
        )}
        <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{growth}%
        </span>
        <span className="text-xs text-gray-400 ml-1">vs last month</span>
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const typeIcons: Record<string, string> = {
    round_completed: 'bg-green-100 text-green-600',
    event_created: 'bg-blue-100 text-blue-600',
    player_joined: 'bg-purple-100 text-purple-600',
    results_finalized: 'bg-orange-100 text-orange-600',
    disc_lost: 'bg-red-100 text-red-600',
    disc_found: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              typeIcons[item.type] || 'bg-gray-100 text-gray-600'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">{item.message}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(item.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyStats: DashboardStats = {
  active_players: 0,
  upcoming_events: 0,
  rounds_this_week: 0,
  revenue_this_month: 0,
  player_growth: 0,
  event_growth: 0,
  round_growth: 0,
  revenue_growth: 0,
};

export default function Dashboard() {
  const navigate = useNavigate();

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  const activityQuery = useQuery({
    queryKey: ['recent-activity'],
    queryFn: getRecentActivity,
  });

  const weeklyQuery = useQuery({
    queryKey: ['weekly-rounds'],
    queryFn: getWeeklyRounds,
  });

  const stats = statsQuery.data || emptyStats;
  const activity = activityQuery.data || [];
  const weekly = weeklyQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back. Here is what is happening at RGDGC.</p>
        </div>
      </div>

      {/* Stats Error */}
      {statsQuery.isError && (
        <div className="card border-red-200 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">Failed to load dashboard stats. Is the backend running?</p>
          </div>
          <button
            onClick={() => statsQuery.refetch()}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Players"
          value={stats.active_players}
          growth={stats.player_growth}
          icon={Users}
          color="bg-forest-900"
        />
        <StatCard
          label="Upcoming Events"
          value={stats.upcoming_events}
          growth={stats.event_growth}
          icon={Calendar}
          color="bg-blue-600"
        />
        <StatCard
          label="Rounds This Week"
          value={stats.rounds_this_week}
          growth={stats.round_growth}
          icon={Target}
          color="bg-orange-disc-500"
        />
        <StatCard
          label="Revenue (Month)"
          value={`$${stats.revenue_this_month.toLocaleString()}`}
          growth={stats.revenue_growth}
          icon={DollarSign}
          color="bg-purple-600"
        />
      </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/events')}
          className="btn-accent flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
        <button
          onClick={() => navigate('/leagues')}
          className="btn-secondary flex items-center gap-2"
        >
          <Trophy className="w-4 h-4" />
          View Leaderboard
        </button>
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rounds per week chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Rounds Per Week</h2>
          </div>
          {weeklyQuery.isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
            </div>
          ) : weeklyQuery.isError ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400">Failed to load chart data</p>
              <button onClick={() => weeklyQuery.refetch()} className="btn-secondary text-sm flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="rounds" fill="#1B5E20" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <button className="text-xs text-forest-900 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {activityQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-900" />
            </div>
          ) : activityQuery.isError ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-2">Failed to load activity</p>
              <button onClick={() => activityQuery.refetch()} className="text-xs text-forest-900 hover:underline">
                Retry
              </button>
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
          ) : (
            <ActivityFeed items={activity} />
          )}
        </div>
      </div>
    </div>
  );
}
