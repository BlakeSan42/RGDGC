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
import type { DashboardStats, ActivityItem, WeeklyRounds } from '../lib/types';

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

// Mock data for when the API is not yet available
const mockStats: DashboardStats = {
  active_players: 47,
  upcoming_events: 3,
  rounds_this_week: 128,
  revenue_this_month: 2450,
  player_growth: 12,
  event_growth: 8,
  round_growth: -3,
  revenue_growth: 15,
};

const mockActivity: ActivityItem[] = [
  { id: '1', type: 'round_completed', message: 'JakePutt22 completed a round on White layout (-3)', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: '2', type: 'player_joined', message: 'New player DiscDave registered', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', type: 'event_created', message: 'Sunday Singles #14 created for Mar 30', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', type: 'results_finalized', message: 'Dubs Night #12 results finalized', timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: '5', type: 'disc_found', message: 'Found disc reported: Green Destroyer on hole 7', timestamp: new Date(Date.now() - 28800000).toISOString() },
];

const mockWeekly: WeeklyRounds[] = [
  { week: 'Feb 10', rounds: 82 },
  { week: 'Feb 17', rounds: 95 },
  { week: 'Feb 24', rounds: 78 },
  { week: 'Mar 3', rounds: 110 },
  { week: 'Mar 10', rounds: 124 },
  { week: 'Mar 17', rounds: 128 },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    placeholderData: mockStats,
  });

  const activityQuery = useQuery({
    queryKey: ['recent-activity'],
    queryFn: getRecentActivity,
    placeholderData: mockActivity,
  });

  const weeklyQuery = useQuery({
    queryKey: ['weekly-rounds'],
    queryFn: getWeeklyRounds,
    placeholderData: mockWeekly,
  });

  const stats = statsQuery.data || mockStats;
  const activity = activityQuery.data || mockActivity;
  const weekly = weeklyQuery.data || mockWeekly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back. Here is what is happening at RGDGC.</p>
        </div>
      </div>

      {/* Stats Grid */}
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
        </div>

        {/* Activity feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <button className="text-xs text-forest-900 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
          ) : (
            <ActivityFeed items={activity} />
          )}
        </div>
      </div>
    </div>
  );
}
