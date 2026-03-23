/**
 * Club Leader Analytics Dashboard
 *
 * Everything a club leader needs to manage finances, logistics, membership,
 * performance, and strategy — in one place.
 *
 * Five tabs:
 * 1. Financial — P&L, cash flow, event breakdown, unpaid fees
 * 2. Membership — segments, retention, churn risk
 * 3. Performance — scoring trends, putting stats, course difficulty
 * 4. Operations — event calendar, usage heatmap
 * 5. Strategic — growth drivers, revenue forecast, community health score
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, DollarSign, Users, TrendingUp, Target, Calendar,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { analyticsApi } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────

type Tab = 'financial' | 'membership' | 'performance' | 'operations' | 'strategic';

// ─── Component ──────────────────────────────────────────────────────────

export default function ClubAnalytics() {
  const [activeTab, setActiveTab] = useState<Tab>('financial');

  // Community health score — always visible
  const { data: health } = useQuery({
    queryKey: ['community-health'],
    queryFn: analyticsApi.communityHealth,
    retry: false,
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'financial', label: 'Financial', icon: DollarSign },
    { key: 'membership', label: 'Membership', icon: Users },
    { key: 'performance', label: 'Performance', icon: Target },
    { key: 'operations', label: 'Operations', icon: Calendar },
    { key: 'strategic', label: 'Strategy', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Community Health Score */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-forest-700" />
            Club Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Finances, membership, performance, operations, strategy — all in one place
          </p>
        </div>

        {/* Community Health Score — the one number to watch */}
        {health && (
          <div className={`px-6 py-4 rounded-xl border-2 text-center ${
            health.overall_score >= 60 ? 'bg-green-50 border-green-300' :
            health.overall_score >= 40 ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Community Health</p>
            <p className={`text-3xl font-black mt-1 ${
              health.overall_score >= 60 ? 'text-green-700' :
              health.overall_score >= 40 ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {health.overall_score}
            </p>
            <p className={`text-xs font-medium mt-0.5 capitalize ${
              health.trend === 'improving' ? 'text-green-600' :
              health.trend === 'stable' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {health.trend === 'improving' ? '↑' : health.trend === 'stable' ? '→' : '↓'} {health.trend}
            </p>
          </div>
        )}
      </div>

      {/* Health Components Bar */}
      {health && (
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(health.components).map(([key, comp]: [string, any]) => (
            <div key={key} className="bg-white rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 capitalize">{key}</p>
                <span className={`text-xs font-bold ${
                  comp.score >= 60 ? 'text-green-600' : comp.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                }`}>{comp.score}</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    comp.score >= 60 ? 'bg-green-500' : comp.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(comp.score, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-forest-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'financial' && <FinancialTab />}
      {activeTab === 'membership' && <MembershipTab />}
      {activeTab === 'performance' && <PerformanceTab />}
      {activeTab === 'operations' && <OperationsTab />}
      {activeTab === 'strategic' && <StrategicTab />}
    </div>
  );
}

// ─── Financial Tab ──────────────────────────────────────────────────────

function FinancialTab() {
  const { data: summary } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => analyticsApi.financialSummary(12),
    retry: false,
  });
  const { data: cashflow } = useQuery({
    queryKey: ['cashflow'],
    queryFn: () => analyticsApi.cashFlow(12),
    retry: false,
  });
  const { data: unpaid } = useQuery({
    queryKey: ['unpaid-fees'],
    queryFn: analyticsApi.unpaidFees,
    retry: false,
  });
  const { data: events } = useQuery({
    queryKey: ['event-breakdown'],
    queryFn: () => analyticsApi.eventBreakdown(),
    retry: false,
  });

  return (
    <div className="space-y-6">
      {/* P&L Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Total Income" value={`$${summary.total_income.toLocaleString()}`} icon={ArrowUpRight} color="green" />
          <MetricCard label="Total Expenses" value={`$${summary.total_expenses.toLocaleString()}`} icon={ArrowDownRight} color="red" />
          <MetricCard label="Net Income" value={`$${summary.net_income.toLocaleString()}`} icon={summary.net_income >= 0 ? ArrowUpRight : ArrowDownRight} color={summary.net_income >= 0 ? 'green' : 'red'} />
        </div>
      )}

      {/* Income Breakdown */}
      {summary && summary.income_by_type.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Income by Source</h3>
          <div className="space-y-3">
            {summary.income_by_type.sort((a: any, b: any) => b.amount - a.amount).map((item: any) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm capitalize font-medium">{item.type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-400">({item.count} entries)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40 bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(item.amount / summary.total_income) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold w-24 text-right">${item.amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Flow Trend */}
      {cashflow && cashflow.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Monthly Cash Flow</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {cashflow.map((m: any) => (
              <div key={m.month} className="flex-shrink-0 w-20 text-center">
                <div className="h-24 flex flex-col justify-end gap-0.5 mb-1">
                  <div className="bg-green-400 rounded-t" style={{ height: `${Math.min((m.income / Math.max(...cashflow.map((c: any) => c.income || 1))) * 60, 60)}px` }} />
                  <div className="bg-red-400 rounded-b" style={{ height: `${Math.min((m.expenses / Math.max(...cashflow.map((c: any) => c.expenses || 1))) * 30, 30)}px` }} />
                </div>
                <p className="text-[10px] text-gray-500">{m.label}</p>
                <p className={`text-xs font-bold ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(m.net).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpaid Fees */}
      {unpaid && unpaid.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Unpaid Fees ({unpaid.length})
            </h3>
            <span className="text-sm font-bold text-amber-600">
              ${unpaid.reduce((s: number, u: any) => s + u.amount_owed, 0).toLocaleString()} outstanding
            </span>
          </div>
          <div className="divide-y max-h-60 overflow-y-auto">
            {unpaid.slice(0, 20).map((u: any, i: number) => (
              <div key={i} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{u.display_name || u.username}</span>
                  <span className="text-xs text-gray-400 ml-2">{u.event_name}</span>
                </div>
                <span className="text-sm font-bold text-amber-600">${u.amount_owed}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Breakdown */}
      {events && events.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Event Financial Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Event</th>
                  <th className="pb-2 text-right">Players</th>
                  <th className="pb-2 text-right">Collected</th>
                  <th className="pb-2 text-right">Paid Out</th>
                  <th className="pb-2 text-right">Net</th>
                  <th className="pb-2 text-right">$/Player</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.slice(0, 15).map((e: any) => (
                  <tr key={e.event_id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium">{e.name}</td>
                    <td className="py-2 text-right">{e.players}</td>
                    <td className="py-2 text-right text-green-600">${e.collected.toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">${e.paid_out.toLocaleString()}</td>
                    <td className={`py-2 text-right font-bold ${e.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>${e.net.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500">${e.per_player}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Membership Tab ─────────────────────────────────────────────────────

function MembershipTab() {
  const { data: segments } = useQuery({
    queryKey: ['segments'],
    queryFn: analyticsApi.segments,
    retry: false,
  });
  const { data: churn } = useQuery({
    queryKey: ['churn-risk'],
    queryFn: analyticsApi.churnRisk,
    retry: false,
  });

  const segmentColors: Record<string, string> = {
    core: 'bg-green-500', regular: 'bg-blue-500', casual: 'bg-yellow-500',
    lapsed: 'bg-orange-500', dormant: 'bg-red-500',
  };
  const segmentLabels: Record<string, string> = {
    core: 'Core (4+/mo)', regular: 'Regular (1-3/mo)', casual: 'Casual (<1/mo)',
    lapsed: 'Lapsed (90d)', dormant: 'Dormant (180d)',
  };

  return (
    <div className="space-y-6">
      {/* Segment Breakdown */}
      {segments && (
        <>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(segments.summary).map(([key, count]: [string, any]) => (
              <div key={key} className="bg-white rounded-lg border p-4 text-center">
                <div className={`w-3 h-3 rounded-full ${segmentColors[key]} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{segmentLabels[key]}</p>
              </div>
            ))}
          </div>

          {/* Segment Bar */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-3">Player Distribution</h3>
            <div className="flex rounded-full overflow-hidden h-6">
              {Object.entries(segments.summary).map(([key, count]: [string, any]) => (
                <div
                  key={key}
                  className={`${segmentColors[key]} transition-all`}
                  style={{ width: `${(count / segments.total_players) * 100}%` }}
                  title={`${segmentLabels[key]}: ${count}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Active ←</span>
              <span>→ At Risk</span>
            </div>
          </div>
        </>
      )}

      {/* Churn Risk */}
      {churn && churn.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Churn Risk ({churn.length} players declining)
          </h3>
          <div className="divide-y max-h-80 overflow-y-auto">
            {churn.map((p: any) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.display_name || p.username}</span>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>This month: {p.rounds_this_month}</span>
                    <span>Last: {p.rounds_last_month}</span>
                    <span>2 ago: {p.rounds_2_months_ago}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-bold ${
                  p.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.risk.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Performance Tab ────────────────────────────────────────────────────

function PerformanceTab() {
  const { data: putting } = useQuery({
    queryKey: ['putting-summary'],
    queryFn: analyticsApi.puttingSummary,
    retry: false,
  });
  const { data: scoring } = useQuery({
    queryKey: ['scoring-trends'],
    queryFn: () => analyticsApi.scoringTrends(12),
    retry: false,
  });
  const { data: difficulty } = useQuery({
    queryKey: ['course-difficulty'],
    queryFn: analyticsApi.courseDifficulty,
    retry: false,
  });

  return (
    <div className="space-y-6">
      {/* Putting Stats */}
      {putting && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(putting).map(([zone, stats]: [string, any]) => (
            <div key={zone} className="bg-white rounded-xl border p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{zone.toUpperCase()}</p>
              <p className="text-3xl font-black text-forest-700 mt-2">{stats.make_pct}%</p>
              <p className="text-xs text-gray-400 mt-1">{stats.makes}/{stats.attempts} makes</p>
            </div>
          ))}
        </div>
      )}

      {/* Scoring Trend */}
      {scoring && scoring.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Scoring Trend (12 weeks)</h3>
          <div className="flex gap-1 items-end overflow-x-auto pb-2" style={{ height: 120 }}>
            {scoring.map((w: any) => {
              const maxRounds = Math.max(...scoring.map((s: any) => s.rounds || 1));
              return (
                <div key={w.week} className="flex-shrink-0 w-12 text-center">
                  <div className="bg-forest-200 rounded-t mx-1" style={{ height: `${(w.rounds / maxRounds) * 80}px` }}>
                    <p className="text-[9px] font-bold text-forest-800 pt-0.5">{w.rounds}</p>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">{w.week}</p>
                  {w.avg_score !== 0 && (
                    <p className={`text-[9px] font-bold ${w.avg_score <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {w.avg_score > 0 ? '+' : ''}{w.avg_score}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course Difficulty */}
      {difficulty && difficulty.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Course Difficulty (Avg Score vs Par)</h3>
          <div className="space-y-3">
            {difficulty.map((d: any) => (
              <div key={d.layout_id} className="flex items-center justify-between">
                <span className="text-sm font-medium">Layout {d.layout_id}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{d.rounds_played} rounds</span>
                  <span className={`text-sm font-bold ${
                    d.avg_score_vs_par <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {d.avg_score_vs_par > 0 ? '+' : ''}{d.avg_score_vs_par}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Operations Tab ─────────────────────────────────────────────────────

function OperationsTab() {
  const { data: calendar } = useQuery({
    queryKey: ['event-calendar'],
    queryFn: () => analyticsApi.eventCalendar(3),
    retry: false,
  });
  const { data: heatmap } = useQuery({
    queryKey: ['usage-heatmap'],
    queryFn: analyticsApi.usageHeatmap,
    retry: false,
  });

  return (
    <div className="space-y-6">
      {/* Event Calendar */}
      {calendar && calendar.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Upcoming Events</h3>
          <div className="space-y-3">
            {calendar.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.date ? new Date(e.date).toLocaleDateString() : 'TBD'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{e.registered} registered</p>
                  <p className="text-xs text-green-600">Proj: ${e.projected_revenue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Heatmap */}
      {heatmap && Object.keys(heatmap).length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">When Do People Play?</h3>
          <p className="text-xs text-gray-500 mb-3">Darker = more rounds. Helps with event scheduling.</p>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-0.5 text-[9px]">
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center text-gray-400">{h}</div>
              ))}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <>
                  <div key={day} className="font-medium text-gray-600 pr-1">{day}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const count = heatmap[day]?.[h] || 0;
                    const max = Math.max(1, ...Object.values(heatmap).flatMap((d: any) => Object.values(d) as number[]));
                    const intensity = count / max;
                    return (
                      <div
                        key={`${day}-${h}`}
                        className="w-full aspect-square rounded-sm"
                        style={{ backgroundColor: `rgba(27, 94, 32, ${Math.min(intensity, 1)})` }}
                        title={`${day} ${h}:00 — ${count} rounds`}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Strategic Tab ──────────────────────────────────────────────────────

function StrategicTab() {
  const { data: growth } = useQuery({
    queryKey: ['growth-drivers'],
    queryFn: analyticsApi.growthDrivers,
    retry: false,
  });
  const { data: forecast } = useQuery({
    queryKey: ['revenue-forecast'],
    queryFn: () => analyticsApi.revenueForecast(6),
    retry: false,
  });

  return (
    <div className="space-y-6">
      {/* Revenue Forecast */}
      {forecast && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-2">Revenue Forecast (6 months)</h3>
          <p className="text-xs text-gray-500 mb-4">Based on trailing 3-month average with 2% monthly growth assumption</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Avg Monthly Income</p>
              <p className="text-lg font-bold text-green-700">${forecast.trailing_avg_income.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Avg Monthly Expenses</p>
              <p className="text-lg font-bold text-red-700">${forecast.trailing_avg_expenses.toLocaleString()}</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${forecast.trailing_avg_net >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500">Avg Monthly Net</p>
              <p className={`text-lg font-bold ${forecast.trailing_avg_net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${forecast.trailing_avg_net.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Income</th>
                  <th className="pb-2 text-right">Expenses</th>
                  <th className="pb-2 text-right">Net</th>
                  <th className="pb-2 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {forecast.forecast.map((m: any) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="py-2 font-medium">{m.month}</td>
                    <td className="py-2 text-right text-green-600">${m.projected_income.toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">${m.projected_expenses.toLocaleString()}</td>
                    <td className={`py-2 text-right font-bold ${m.projected_net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${m.projected_net.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right ${m.cumulative_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${m.cumulative_net.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Growth Drivers */}
      {growth && growth.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Growth Drivers (12 months)</h3>
          <p className="text-xs text-gray-500 mb-3">Correlating new signups with events and round volume</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">New Signups</th>
                  <th className="pb-2 text-right">Events Held</th>
                  <th className="pb-2 text-right">Rounds Played</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {growth.map((g: any) => (
                  <tr key={g.month} className="hover:bg-gray-50">
                    <td className="py-2 font-medium">{g.month}</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold ${g.new_signups > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{g.new_signups}</span>
                    </td>
                    <td className="py-2 text-right">{g.events_held}</td>
                    <td className="py-2 text-right">{g.rounds_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Metric Card ───────────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: any; color: 'green' | 'red' | 'blue' | 'gray';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className={`p-5 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide opacity-70 font-semibold">{label}</p>
        <Icon className="w-4 h-4 opacity-50" />
      </div>
      <p className="text-2xl font-black mt-2">{value}</p>
    </div>
  );
}
