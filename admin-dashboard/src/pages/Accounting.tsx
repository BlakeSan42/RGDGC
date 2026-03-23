import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Download, PlusCircle, MinusCircle, Receipt, Users,
  Calendar, FileText, CheckCircle, XCircle,
} from 'lucide-react';
import { cashTreasuryApi, analyticsApi, getEvents } from '../lib/api';

type Tab = 'overview' | 'ledger' | 'collect' | 'expenses' | 'players' | 'budget';

export default function Accounting() {
  const [tab, setTab] = useState<Tab>('overview');
  const queryClient = useQueryClient();

  const { data: balance } = useQuery({ queryKey: ['treasury-balance'], queryFn: cashTreasuryApi.getBalance });
  const { data: ledger } = useQuery({ queryKey: ['treasury-ledger'], queryFn: () => cashTreasuryApi.getLedger({ limit: 50 }) });
  const { data: financial } = useQuery({ queryKey: ['financial-summary'], queryFn: () => analyticsApi.financialSummary(12) });
  const { data: unpaidFees } = useQuery({ queryKey: ['unpaid-fees'], queryFn: analyticsApi.unpaidFees });

  const tabs: { id: Tab; label: string; icon: typeof DollarSign }[] = [
    { id: 'overview', label: 'Overview', icon: DollarSign },
    { id: 'ledger', label: 'Ledger', icon: FileText },
    { id: 'collect', label: 'Collect Fees', icon: PlusCircle },
    { id: 'expenses', label: 'Expenses', icon: MinusCircle },
    { id: 'players', label: 'Player Balances', icon: Users },
    { id: 'budget', label: 'Budget', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Club Accounting</h1>
          <p className="text-gray-500 mt-1">Treasury management, fee collection, and financial tracking</p>
        </div>
        <button
          onClick={() => cashTreasuryApi.exportCsv('2026-01-01', '2026-12-31')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Treasury Balance"
          value={balance ? `$${balance.balance?.toFixed(2) ?? '0.00'}` : '—'}
          icon={DollarSign}
          color="green"
        />
        <SummaryCard
          label="Total Income (YTD)"
          value={financial ? `$${financial.total_income?.toFixed(2) ?? '0.00'}` : '—'}
          icon={TrendingUp}
          color="blue"
        />
        <SummaryCard
          label="Total Expenses (YTD)"
          value={financial ? `$${financial.total_expenses?.toFixed(2) ?? '0.00'}` : '—'}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          label="Unpaid Fees"
          value={unpaidFees ? `${unpaidFees.length ?? 0} players` : '—'}
          icon={AlertTriangle}
          color={unpaidFees?.length > 0 ? 'yellow' : 'gray'}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs?.items?.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab financial={financial} unpaidFees={unpaidFees} />}
      {tab === 'ledger' && <LedgerTab entries={ledger?.entries ?? ledger ?? []} />}
      {tab === 'collect' && <CollectFeesTab queryClient={queryClient} />}
      {tab === 'expenses' && <ExpensesTab queryClient={queryClient} />}
      {tab === 'players' && <PlayerBalancesTab />}
      {tab === 'budget' && <BudgetTab />}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: typeof DollarSign; color: string;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-2 text-gray-900">{value}</p>
    </div>
  );
}

function OverviewTab({ financial, unpaidFees }: { financial: any; unpaidFees: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Income by Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Income by Type</h3>
        {financial?.income_by_type ? (
          <div className="space-y-3">
            {Object.entries(financial.income_by_type)?.items?.map(([type, data]: [string, any]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">${data.total?.toFixed(2) ?? '0.00'}</span>
                  <span className="text-xs text-gray-400 ml-2">({data.count ?? 0})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No income data yet</p>
        )}
      </div>

      {/* Expenses by Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Expenses by Type</h3>
        {financial?.expenses_by_type ? (
          <div className="space-y-3">
            {Object.entries(financial.expenses_by_type)?.items?.map(([type, data]: [string, any]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-red-600">-${data.total?.toFixed(2) ?? '0.00'}</span>
                  <span className="text-xs text-gray-400 ml-2">({data.count ?? 0})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No expenses recorded</p>
        )}
      </div>

      {/* Unpaid Fees Alert */}
      {unpaidFees?.length > 0 && (
        <div className="lg:col-span-2 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">{unpaidFees.length} Unpaid Fees</h3>
          </div>
          <div className="space-y-2">
            {unpaidFees.slice(0, 10)?.items?.map((u: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-yellow-800">{u.username ?? u.display_name ?? `Player #${u.player_id}`}</span>
                <span className="text-yellow-600">{u.event_name} — ${u.amount_owed?.toFixed(2)}</span>
              </div>
            ))}
            {unpaidFees.length > 10 && (
              <p className="text-yellow-600 text-xs">+{unpaidFees.length - 10} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerTab({ entries }: { entries: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Description</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Method</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
            <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No ledger entries yet. Record fees or expenses to get started.</td></tr>
          ) : entries?.items?.map((e: any) => (
            <tr key={e.id} className={e.is_voided ? 'opacity-50 line-through' : 'hover:bg-gray-50'}>
              <td className="px-4 py-3 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  e.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {e.entry_type?.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-900">{e.description}</td>
              <td className="px-4 py-3 text-gray-500 capitalize">{e.payment_method}</td>
              <td className={`px-4 py-3 text-right font-mono font-medium ${e.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {e.amount > 0 ? '+' : ''}{typeof e.amount === 'number' ? `$${e.amount.toFixed(2)}` : e.amount}
              </td>
              <td className="px-4 py-3 text-center">
                {e.is_voided ? (
                  <XCircle className="w-4 h-4 text-red-400 inline" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400 inline" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectFeesTab({ queryClient }: { queryClient: any }) {
  const [eventId, setEventId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [amount, setAmount] = useState('5.00');
  const [method, setMethod] = useState('cash');

  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => getEvents({ limit: 20 }) });

  const collectMutation = useMutation({
    mutationFn: () => cashTreasuryApi.collectFee({
      event_id: Number(eventId),
      player_id: Number(playerId),
      amount: parseFloat(amount),
      payment_method: method,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      setPlayerId('');
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5" />
        Collect Event Fee
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
          <select value={eventId} onChange={e => setEventId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select event...</option>
            {(events ?? [])?.items?.map((e: any) => (
              <option key={e.id} value={e.id}>{e.name} ({e.event_date})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Player ID</label>
          <input type="number" value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Player ID" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="cash">Cash</option>
              <option value="venmo">Venmo</option>
              <option value="zelle">Zelle</option>
              <option value="rgdg_token">$RGDG Token</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => collectMutation.mutate()}
          disabled={!eventId || !playerId || collectMutation.isPending}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {collectMutation.isPending ? 'Recording...' : 'Record Fee Payment'}
        </button>
        {collectMutation.isSuccess && (
          <p className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Fee recorded</p>
        )}
        {collectMutation.isError && (
          <p className="text-red-600 text-sm">{(collectMutation.error as any)?.response?.data?.detail ?? 'Failed to record'}</p>
        )}
      </div>
    </div>
  );
}

function ExpensesTab({ queryClient }: { queryClient: any }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [method, setMethod] = useState('cash');

  const { data: byCategory } = useQuery({
    queryKey: ['expenses-by-category'],
    queryFn: cashTreasuryApi.getExpensesByCategory,
    retry: false,
  });

  const expenseMutation = useMutation({
    mutationFn: () => cashTreasuryApi.recordExpense({
      amount: parseFloat(amount),
      description,
      payment_method: method,
      category,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDescription('');
      setAmount('');
    },
  });

  const categories = ['baskets', 'tee_pads', 'supplies', 'permits', 'insurance', 'merch_cost', 'marketing', 'other'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MinusCircle className="w-5 h-5" />
          Record Expense
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was purchased?" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {categories?.items?.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="cash">Cash</option>
              <option value="venmo">Venmo</option>
              <option value="zelle">Zelle</option>
            </select>
          </div>
          <button
            onClick={() => expenseMutation.mutate()}
            disabled={!description || !amount || expenseMutation.isPending}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {expenseMutation.isPending ? 'Recording...' : 'Record Expense'}
          </button>
          {expenseMutation.isSuccess && <p className="text-green-600 text-sm">Expense recorded</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Expenses by Category</h3>
        {byCategory ? (
          <div className="space-y-3">
            {Object.entries(byCategory)?.items?.map(([cat, data]: [string, any]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{cat.replace(/_/g, ' ')}</span>
                <span className="text-sm font-medium text-red-600">-${data.total?.toFixed(2) ?? '0.00'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No categorized expenses yet</p>
        )}
      </div>
    </div>
  );
}

function PlayerBalancesTab() {
  const { data: balances, isLoading } = useQuery({
    queryKey: ['player-balances'],
    queryFn: cashTreasuryApi.getPlayerBalances,
    retry: false,
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Player Account Balances</h3>
        <p className="text-sm text-gray-500 mt-1">Fees paid minus prizes received. Positive = player paid more than received.</p>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Player</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Fees Paid</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Prizes Won</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(balances ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No player transactions yet</td></tr>
            ) : (balances ?? [])?.items?.map((p: any) => (
              <tr key={p.player_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{p.username ?? p.display_name}</td>
                <td className="px-4 py-3 text-right text-green-600 font-mono">${p.fees_paid?.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-purple-600 font-mono">${p.prizes_won?.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${p.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${p.net_balance?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BudgetTab() {
  const { data: budgetVsActual, isLoading } = useQuery({
    queryKey: ['budget-vs-actual'],
    queryFn: () => cashTreasuryApi.getBudgetVsActual('2026'),
    retry: false,
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Budget vs. Actual (2026 Season)</h3>
        <p className="text-sm text-gray-500 mt-1">Set budgets per category and track variance.</p>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Budgeted</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actual</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Variance</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">% Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(budgetVsActual ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No budgets set. Use the API to set category budgets.</td></tr>
            ) : (budgetVsActual ?? [])?.items?.map((b: any) => {
              const variance = (b.budgeted ?? 0) - (b.actual ?? 0);
              const pctUsed = b.budgeted ? ((b.actual ?? 0) / b.budgeted * 100) : 0;
              return (
                <tr key={b.category} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 capitalize">{b.category?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono">${b.budgeted?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">${b.actual?.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {variance >= 0 ? '+' : ''}{variance?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${pctUsed > 100 ? 'bg-red-500' : pctUsed > 75 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{pctUsed.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
