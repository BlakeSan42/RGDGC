import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Send,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTreasuryStats, getTransactions, mintTokens, distributePrizes, getLeagues } from '../lib/api';
import type { Transaction } from '../lib/types';

function TxTypeBadge({ type }: { type: Transaction['tx_type'] }) {
  const config: Record<string, { class: string; icon: typeof ArrowUpRight }> = {
    mint: { class: 'bg-green-100 text-green-700', icon: Coins },
    prize_payout: { class: 'bg-purple-100 text-purple-700', icon: Send },
    event_fee: { class: 'bg-blue-100 text-blue-700', icon: ArrowDownLeft },
    transfer: { class: 'bg-gray-100 text-gray-600', icon: ArrowUpRight },
  };
  const { class: cls } = config[type] || config.transfer;
  return (
    <span className={`badge ${cls} capitalize`}>{type.replace('_', ' ')}</span>
  );
}

function StatusDot({ status }: { status: Transaction['status'] }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-green-400',
    pending: 'bg-yellow-400',
    failed: 'bg-red-400',
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />
      <span className="text-xs capitalize">{status}</span>
    </span>
  );
}

// Chart data will be derived from treasury stats once contracts are deployed.
// For now, show current balance as a single data point.
function buildChartData(balance: number): { month: string; balance: number }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      balance: i === 5 ? balance : 0,
    };
  });
}

export default function TreasuryDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [showMintModal, setShowMintModal] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [mintAmount, setMintAmount] = useState('');
  const [mintReason, setMintReason] = useState('');

  const treasuryQuery = useQuery({
    queryKey: ['treasury-stats'],
    queryFn: getTreasuryStats,
  });

  const txQuery = useQuery({
    queryKey: ['transactions', { tx_type: txTypeFilter, page }],
    queryFn: () => getTransactions({ tx_type: txTypeFilter || undefined, page, per_page: 15 }),
    placeholderData: (prev) => prev,
  });

  const leaguesQuery = useQuery({
    queryKey: ['leagues'],
    queryFn: getLeagues,
    placeholderData: [],
  });

  const mintMutation = useMutation({
    mutationFn: () => mintTokens(parseFloat(mintAmount), mintReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowMintModal(false);
      setMintAmount('');
      setMintReason('');
    },
  });

  const distributeMutation = useMutation({
    mutationFn: (leagueId: number) => distributePrizes(leagueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowDistributeModal(false);
    },
  });

  const stats = treasuryQuery.data;
  const transactions = txQuery.data?.items || [];
  const totalPages = txQuery.data?.pages || 1;
  const leagues = leaguesQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Treasury</h1>
          <p className="text-sm text-gray-500 mt-1">$RGDG token management and analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMintModal(true)} className="btn-primary flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Mint Tokens
          </button>
          <button onClick={() => setShowDistributeModal(true)} className="btn-accent flex items-center gap-2">
            <Send className="w-4 h-4" />
            Distribute Prizes
          </button>
        </div>
      </div>

      {/* Stats Error */}
      {treasuryQuery.isError && (
        <div className="card border-red-200 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">Failed to load treasury stats. Blockchain service may be unavailable.</p>
          </div>
          <button
            onClick={() => treasuryQuery.refetch()}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      {treasuryQuery.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-forest-900" />
            <span className="text-sm text-gray-500">Balance</span>
          </div>
          <p className="text-2xl font-bold font-mono text-gray-900">
            {stats?.balance?.toLocaleString() || '--'} <span className="text-sm font-normal text-gray-400">$RGDG</span>
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Total Minted</span>
          </div>
          <p className="text-2xl font-bold font-mono text-gray-900">
            {stats?.total_minted?.toLocaleString() || '--'}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-500">Total Distributed</span>
          </div>
          <p className="text-2xl font-bold font-mono text-gray-900">
            {stats?.total_distributed?.toLocaleString() || '--'}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-disc-500" />
            <span className="text-sm text-gray-500">Pending Payouts</span>
          </div>
          <p className="text-2xl font-bold font-mono text-orange-disc-500">
            {stats?.pending_payouts?.toLocaleString() || '--'}
          </p>
        </div>
      </div>
      )}

      {/* Chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Treasury Balance Over Time</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buildChartData(stats?.balance || 0)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`${value.toLocaleString()} $RGDG`, 'Balance']}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#1B5E20"
                fill="#E8F5E9"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Transaction History</h2>
          <select
            value={txTypeFilter}
            onChange={(e) => { setTxTypeFilter(e.target.value); setPage(1); }}
            className="input w-auto text-sm"
          >
            <option value="">All Types</option>
            <option value="mint">Mint</option>
            <option value="prize_payout">Prize Payout</option>
            <option value="event_fee">Event Fee</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        {txQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        ) : txQuery.isError ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Failed to load transactions</p>
            <button onClick={() => txQuery.refetch()} className="btn-secondary mt-3 inline-flex items-center gap-2 text-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-header">Type</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">TX Hash</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="table-cell"><TxTypeBadge type={tx.tx_type} /></td>
                    <td className="table-cell font-mono font-semibold">
                      {tx.tx_type === 'event_fee' ? '-' : '+'}{tx.amount.toLocaleString()}
                    </td>
                    <td className="table-cell">{tx.user?.display_name || tx.user?.username || '--'}</td>
                    <td className="table-cell"><StatusDot status={tx.status} /></td>
                    <td className="table-cell font-mono text-xs text-gray-400">
                      {tx.tx_hash ? `${tx.tx_hash.slice(0, 10)}...` : '--'}
                    </td>
                    <td className="table-cell text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary py-1 px-2">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-secondary py-1 px-2">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Mint $RGDG Tokens</h2>
              <button onClick={() => setShowMintModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="input"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  value={mintReason}
                  onChange={(e) => setMintReason(e.target.value)}
                  className="input"
                  placeholder="Season prize pool"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowMintModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => mintMutation.mutate()}
                  disabled={!mintAmount || !mintReason || mintMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {mintMutation.isPending ? 'Minting...' : 'Mint Tokens'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribute Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Distribute Prizes</h2>
              <button onClick={() => setShowDistributeModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Select a league to distribute prize payouts to winners.
            </p>
            <div className="space-y-2">
              {leagues.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No leagues available</p>
              ) : (
                leagues.map((league) => (
                  <button
                    key={league.id}
                    onClick={() => distributeMutation.mutate(league.id)}
                    disabled={distributeMutation.isPending}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-forest-300 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium">{league.name}</p>
                    <p className="text-xs text-gray-400">{league.season}</p>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setShowDistributeModal(false)} className="btn-secondary w-full mt-4">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
