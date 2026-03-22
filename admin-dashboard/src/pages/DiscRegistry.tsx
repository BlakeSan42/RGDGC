import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Disc3,
  Search,
  Filter,
  AlertTriangle,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { getDiscs, resolveFoundDisc } from '../lib/api';
import type { Disc } from '../lib/types';

function DiscStatusBadge({ status }: { status: Disc['status'] }) {
  const config: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    found: 'bg-yellow-100 text-yellow-700',
    retired: 'bg-gray-100 text-gray-500',
  };
  return <span className={`badge ${config[status] || 'badge'}`}>{status}</span>;
}

export default function DiscRegistry() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [resolveDiscId, setResolveDiscId] = useState<number | null>(null);

  const discsQuery = useQuery({
    queryKey: ['discs', { search, status: statusFilter, page }],
    queryFn: () =>
      getDiscs({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        per_page: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ discId, returnToOwner }: { discId: number; returnToOwner: boolean }) =>
      resolveFoundDisc(discId, returnToOwner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discs'] });
      setResolveDiscId(null);
    },
  });

  const discs = discsQuery.data?.items || [];
  const total = discsQuery.data?.total || 0;
  const totalPages = discsQuery.data?.pages || 1;

  // Stats from total (approximation; in production these would come from the API)
  const totalRegistered = total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Disc Registry</h1>
        <p className="text-sm text-gray-500 mt-1">Track registered discs, lost and found reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center py-4">
          <Disc3 className="w-6 h-6 text-forest-900 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono">{totalRegistered}</p>
          <p className="text-xs text-gray-500">Total Registered</p>
        </div>
        <div className="card text-center py-4">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-red-600">--</p>
          <p className="text-xs text-gray-500">Currently Lost</p>
        </div>
        <div className="card text-center py-4">
          <Eye className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-yellow-600">--</p>
          <p className="text-xs text-gray-500">Found (Pending)</p>
        </div>
        <div className="card text-center py-4">
          <RotateCcw className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-green-600">--</p>
          <p className="text-xs text-gray-500">Return Rate</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search discs by name, mold, color..."
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input w-auto"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {discsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        ) : discs.length === 0 ? (
          <div className="text-center py-16">
            <Disc3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No discs found</p>
            <p className="text-sm text-gray-400 mt-1">Discs registered by players will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-header">Disc</th>
                  <th className="table-header">Mold</th>
                  <th className="table-header">Flight</th>
                  <th className="table-header">Owner</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Last Updated</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discs.map((disc) => (
                  <tr key={disc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: disc.color || '#ccc' }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{disc.name || disc.mold}</p>
                          <p className="text-xs text-gray-400">{disc.manufacturer} - {disc.plastic}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">{disc.mold}</td>
                    <td className="table-cell font-mono text-xs">
                      {disc.speed}/{disc.glide}/{disc.turn}/{disc.fade}
                    </td>
                    <td className="table-cell">
                      {disc.user?.display_name || disc.user?.username || '--'}
                    </td>
                    <td className="table-cell">
                      <DiscStatusBadge status={disc.status} />
                    </td>
                    <td className="table-cell text-gray-500">
                      {disc.lost_at
                        ? `Lost ${new Date(disc.lost_at).toLocaleDateString()}`
                        : disc.found_at
                        ? `Found ${new Date(disc.found_at).toLocaleDateString()}`
                        : new Date(disc.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      {disc.status === 'found' && (
                        <button
                          onClick={() => setResolveDiscId(disc.id)}
                          className="text-xs text-orange-disc-500 hover:underline font-medium"
                        >
                          Resolve
                        </button>
                      )}
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

      {/* Resolve modal */}
      {resolveDiscId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Resolve Found Disc</h2>
            <p className="text-sm text-gray-500 mb-6">
              What happened with this disc?
            </p>
            <div className="space-y-2">
              <button
                onClick={() =>
                  resolveMutation.mutate({ discId: resolveDiscId, returnToOwner: true })
                }
                disabled={resolveMutation.isPending}
                className="btn-primary w-full"
              >
                Returned to Owner
              </button>
              <button
                onClick={() =>
                  resolveMutation.mutate({ discId: resolveDiscId, returnToOwner: false })
                }
                disabled={resolveMutation.isPending}
                className="btn-secondary w-full"
              >
                Unclaimed (Keep in Lost & Found)
              </button>
              <button
                onClick={() => setResolveDiscId(null)}
                className="btn-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
