/**
 * KSA Intelligence Dashboard — Admin Only
 *
 * Three sections:
 * 1. Overview — KSA financial snapshot, key metrics, risk indicators
 * 2. Knowledge Base Management — CRUD articles, manage timeline
 * 3. Tow Tracking — Incident database, statistics, export
 *
 * Security: Requires admin/super_admin role (enforced by AdminRoute + backend)
 * All data persisted in PostgreSQL, queried via /api/v1/ksa/* and /api/v1/tow-*
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, BookOpen, CarFront, Plus, FileText, AlertTriangle,
  TrendingUp, DollarSign, Users,
  Download, Eye, Pin, Pencil,
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────

interface KSAArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  tags: string[];
  source_urls: string[];
  key_facts: string[];
  is_pinned: boolean;
  read_count: number;
  created_at: string;
  updated_at: string;
}

interface TowStats {
  total_incidents: number;
  disc_golfer_incidents: number;
  contested: number;
  hearings_won: number;
  tdlr_fee_exceeded: number;
  average_tow_fee: number;
  tdlr_max_fee: number;
  tdlr_max_storage: number;
  tdlr_drop_fee: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

// ─── KSA Financial Constants (from 990 research) ────────────────────────

const KSA_FINANCIALS = {
  ein: '74-1891991',
  status: '501(c)(4)',
  revenue_2024: 1048921,
  expenses_2024: 1565650,
  net_loss_2024: -516729,
  assets_2024: 3123778,
  cash_2024: 2092894,
  liabilities_2024: 3500,
  assessment_per_unit: 41,
  equivalent_units: 23354,
  member_associations: 29,
  employees: 0,
  bbb_rating: 'F',
  retained_surplus: 1007694,
  years_of_surplus: 10,
  expense_spike_pct: 55.1,
  management_company: 'Kingwood Association Management (KAM)',
  managing_agent: 'Ethel McCormick',
  towing_company: 'EMC Towing',
  towing_company_phone: '(281) 399-5100',
  tdlr_max_tow: 272,
  tdlr_drop_fee: 135,
};

const SIMULATION_RESULTS = {
  social_impact: { thriving: 25.4, stable: 46.8, struggling: 26.2, failed: 1.6 },
  median_youth_employed: 60,
  median_wages_5yr: 666694,
  median_economic_impact: 3400000,
  median_social_score: 69.5,
  legal_expected_recovery: 1366645,
  legal_settlement_rate: 57,
  player_personas: 8,
  tow_prevented_per_year: 217,
  money_saved_per_year: 58888,
  app_downloads_median: 1725,
};

// ─── Component ──────────────────────────────────────────────────────────

export default function KSAIntel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'articles' | 'towing'>('overview');

  const { data: articles } = useQuery<KSAArticle[]>({
    queryKey: ['ksa-articles'],
    queryFn: () => api.get('/ksa/articles?limit=100').then(r => r.data),
    retry: false,
  });

  const { data: categories } = useQuery<CategoryCount[]>({
    queryKey: ['ksa-categories'],
    queryFn: () => api.get('/ksa/categories').then(r => r.data),
    retry: false,
  });

  const { data: towStats } = useQuery<TowStats>({
    queryKey: ['tow-stats'],
    queryFn: () => api.get('/tow-incidents/stats').then(r => r.data),
    retry: false,
  });

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: Shield },
    { key: 'articles' as const, label: 'Knowledge Base', icon: BookOpen },
    { key: 'towing' as const, label: 'Tow Tracking', icon: CarFront },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-forest-700" />
            KSA Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Secure admin panel — KSA research, knowledge base, tow tracking
          </p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-xs font-semibold text-red-700">ADMIN ONLY</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
      {activeTab === 'overview' && <OverviewTab towStats={towStats} />}
      {activeTab === 'articles' && <ArticlesTab articles={articles || []} categories={categories || []} />}
      {activeTab === 'towing' && <TowingTab towStats={towStats} />}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────

function OverviewTab({ towStats: _towStats }: { towStats?: TowStats }) {
  const f = KSA_FINANCIALS;
  const s = SIMULATION_RESULTS;

  return (
    <div className="space-y-6">
      {/* KSA Financial Snapshot */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-forest-600" />
          KSA Financial Snapshot (2024 Form 990)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Revenue" value={`$${(f.revenue_2024 / 1e6).toFixed(2)}M`} />
          <StatCard label="Expenses" value={`$${(f.expenses_2024 / 1e6).toFixed(2)}M`} alert />
          <StatCard label="Net Loss" value={`-$${Math.abs(f.net_loss_2024 / 1e3).toFixed(0)}K`} alert />
          <StatCard label="Total Assets" value={`$${(f.assets_2024 / 1e6).toFixed(2)}M`} />
          <StatCard label="Cash Reserves" value={`$${(f.cash_2024 / 1e6).toFixed(2)}M`} />
          <StatCard label="Retained Surplus" value={`$${(f.retained_surplus / 1e6).toFixed(2)}M`} alert />
          <StatCard label="Employees" value={`${f.employees}`} />
          <StatCard label="BBB Rating" value={f.bbb_rating} alert />
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Key Risk:</strong> 2024 expenses spiked {f.expense_spike_pct}% with no public explanation.
            Article VIII requires surplus return — ${(f.retained_surplus / 1e3).toFixed(0)}K retained across {f.years_of_surplus} surplus years.
          </p>
        </div>
      </div>

      {/* Monte Carlo Results */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          RGPC Simulation Results
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Social Impact Score" value={`${s.median_social_score}/100`} />
          <StatCard label="Youth Employed (5yr)" value={`${s.median_youth_employed}`} />
          <StatCard label="Wages Paid (5yr)" value={`$${(s.median_wages_5yr / 1e3).toFixed(0)}K`} />
          <StatCard label="Economic Impact" value={`$${(s.median_economic_impact / 1e6).toFixed(1)}M`} />
          <StatCard label="Success Rate" value={`${s.social_impact.thriving + s.social_impact.stable}%`} />
          <StatCard label="Failure Rate" value={`${s.social_impact.failed}%`} />
          <StatCard label="Tows Prevented/yr" value={`${s.tow_prevented_per_year}`} />
          <StatCard label="Money Saved/yr" value={`$${(s.money_saved_per_year / 1e3).toFixed(0)}K`} />
        </div>
      </div>

      {/* Key Relationships */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          Key People & Entities
        </h2>
        <div className="space-y-3">
          <PersonCard name={f.managing_agent} role="KSA Managing Agent / KAM Owner" risk="Conflict of interest — owns contractor while sitting on board" />
          <PersonCard name="Delores Price" role="KSA Board President / Parks Foundation Principal" risk="Dual role — same person controls nonprofit and 501(c)(3)" />
          <PersonCard name="Bob Rehak" role="KSA Parks Committee (10+ yrs) / PDGA #67126 / ReduceFlooding.com" risk="" ally />
          <PersonCard name="Fred Flickinger" role="Houston Council District E / Runs Median Madness / Econ Dev Committee" risk="" ally />
          <PersonCard name="EMC Towing (TJ Knox)" role={`Tow contractor — ${f.towing_company_phone}`} risk={`Max fee: $${f.tdlr_max_tow} | Drop fee: $${f.tdlr_drop_fee}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Articles Tab ───────────────────────────────────────────────────────

function ArticlesTab({ articles, categories }: { articles: KSAArticle[]; categories: CategoryCount[] }) {
  const totalReads = articles.reduce((sum, a) => sum + a.read_count, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Articles" value={`${articles.length}`} />
        <StatCard label="Total Reads" value={`${0 /* TODO */.toLocaleString()}`} />
        <StatCard label="Categories Used" value={`${categories.length}/8`} />
        <StatCard label="Pinned" value={`${articles.filter(a => a.is_pinned).length}`} />
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-3">Articles by Category</h3>
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.category} className="flex items-center justify-between">
              <span className="text-sm capitalize">{cat.category.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-forest-600 h-2 rounded-full"
                    style={{ width: `${Math.min((cat.count / Math.max(articles.length, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{cat.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Article list */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-900">All Articles</h3>
          <button className="flex items-center gap-1 px-3 py-1.5 bg-forest-600 text-white rounded-lg text-sm hover:bg-forest-700">
            <Plus className="w-4 h-4" /> New Article
          </button>
        </div>
        <div className="divide-y">
          {articles.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No articles yet. Seed the knowledge base from the research docs.</p>
            </div>
          ) : (
            articles.map(article => (
              <div key={article.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {article.is_pinned && <Pin className="w-3 h-3 text-forest-600" />}
                    <span className="font-medium text-gray-900">{article.title}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{article.summary}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded capitalize">{article.category}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {article.read_count}
                    </span>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Towing Tab ─────────────────────────────────────────────────────────

function TowingTab({ towStats }: { towStats?: TowStats }) {
  const stats = towStats || {
    total_incidents: 0, disc_golfer_incidents: 0, contested: 0,
    hearings_won: 0, tdlr_fee_exceeded: 0, average_tow_fee: 0,
    tdlr_max_fee: 272, tdlr_max_storage: 22.85, tdlr_drop_fee: 135,
  };

  const contestRate = stats.total_incidents > 0 ? (stats.contested / stats.total_incidents * 100) : 0;
  const winRate = stats.contested > 0 ? (stats.hearings_won / stats.contested * 100) : 0;
  const dgPct = stats.total_incidents > 0 ? (stats.disc_golfer_incidents / stats.total_incidents * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={`${stats.total_incidents}`} />
        <StatCard label="Disc Golfers Towed" value={`${stats.disc_golfer_incidents} (${dgPct.toFixed(0)}%)`} alert={dgPct > 50} />
        <StatCard label="Contested" value={`${stats.contested} (${contestRate.toFixed(0)}%)`} />
        <StatCard label="Hearings Won" value={`${stats.hearings_won} (${winRate.toFixed(0)}%)`} />
        <StatCard label="Avg Tow Fee" value={`$${stats.average_tow_fee.toFixed(0)}`} alert={stats.average_tow_fee > stats.tdlr_max_fee} />
        <StatCard label="TDLR Max Fee" value={`$${stats.tdlr_max_fee}`} />
        <StatCard label="TDLR Fee Exceeded" value={`${stats.tdlr_fee_exceeded}`} alert={stats.tdlr_fee_exceeded > 0} />
        <StatCard label="Drop Fee Max" value={`$${stats.tdlr_drop_fee}`} />
      </div>

      {/* Simulation Impact */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-3">Tow Alert System Impact (1,000 Simulations)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-700">1,289</p>
            <p className="text-xs text-red-600 mt-1">Tow incidents/year (without app)</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">217</p>
            <p className="text-xs text-green-600 mt-1">Prevented (with app)</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">$58,888</p>
            <p className="text-xs text-blue-600 mt-1">Saved/year</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Top beneficiaries:</strong> Weekend Warriors ($32K/yr) and Houston Travelers ($9.5K/yr)
            — non-residents without K-stickers who face 15-25% tow risk per parking event.
          </p>
        </div>
      </div>

      {/* TDLR Quick Reference */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-3">Texas TDLR Fee Limits (Quick Reference)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Max tow (≤10K lbs)</p>
            <p className="font-bold">$272</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Drop fee</p>
            <p className="font-bold">$135</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Daily storage</p>
            <p className="font-bold">$22.85</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Not hooked up</p>
            <p className="font-bold text-green-700">FREE release</p>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-forest-600 text-white rounded-lg text-sm hover:bg-forest-700">
          <Download className="w-4 h-4" /> Export Incident Data (CSV)
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
          <FileText className="w-4 h-4" /> Generate Legal Report
        </button>
      </div>
    </div>
  );
}

// ─── Reusable Components ────────────────────────────────────────────────

function StatCard({ label, value, alert, ally }: {
  label: string; value: string; alert?: boolean; ally?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${
      alert ? 'bg-red-50 border-red-200' : ally ? 'bg-green-50 border-green-200' : 'bg-white'
    }`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${alert ? 'text-red-700' : ally ? 'text-green-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function PersonCard({ name, role, risk, ally }: {
  name: string; role: string; risk: string; ally?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${ally ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-sm text-gray-600">{role}</p>
        </div>
        {ally && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">ALLY</span>}
      </div>
      {risk && <p className={`text-xs mt-1 ${ally ? 'text-green-600' : 'text-red-600'}`}>{risk}</p>}
    </div>
  );
}
