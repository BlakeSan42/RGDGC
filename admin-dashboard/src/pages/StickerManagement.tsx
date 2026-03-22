import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Package,
  BarChart3,
  RefreshCw,
  Loader2,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import {
  getStickerStats,
  generateStickerBatch,
  getBatchCsv,
  getBatchInventory,
  validateStickerCode,
} from '../lib/api';

interface StickerStats {
  total_stickers: number;
  available: number;
  claimed: number;
  distributed: number;
  batch_count: number;
  recent_claims: Array<{ code: string; claimed_at: string | null }>;
}

interface BatchGenerateResult {
  batch_id: string;
  batch_name: string;
  quantity: number;
  first_code: string;
  last_code: string;
  codes: Array<{ code: string; url: string; short_url: string }>;
  csv_download_url: string;
}

interface BatchInventory {
  batch_id: string;
  batch_name: string;
  total: number;
  available: number;
  claimed: number;
  distributed: number;
  stickers: Array<{
    disc_code: string;
    status: string;
    claimed_by: string | null;
    claimed_at: string | null;
  }>;
}

interface ValidateResult {
  valid: boolean;
  available: boolean;
  claimed?: boolean;
  message: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    claimed: 'bg-blue-100 text-blue-700',
    distributed: 'bg-yellow-100 text-yellow-700',
    void: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function StickerManagement() {
  const queryClient = useQueryClient();

  // --- State ---
  const [batchQuantity, setBatchQuantity] = useState(100);
  const [batchName, setBatchName] = useState('');
  const [lastGenerated, setLastGenerated] = useState<BatchGenerateResult | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);

  // --- Queries ---
  const statsQuery = useQuery<StickerStats>({
    queryKey: ['sticker-stats'],
    queryFn: getStickerStats,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const inventoryQuery = useQuery<BatchInventory>({
    queryKey: ['batch-inventory', viewingBatchId],
    queryFn: () => getBatchInventory(viewingBatchId!),
    enabled: !!viewingBatchId,
  });

  // --- Mutations ---
  const generateMutation = useMutation({
    mutationFn: ({ quantity, name }: { quantity: number; name: string }) =>
      generateStickerBatch(quantity, name),
    onSuccess: (data) => {
      setLastGenerated(data);
      setBatchName('');
      queryClient.invalidateQueries({ queryKey: ['sticker-stats'] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (code: string) => validateStickerCode(code),
    onSuccess: (data) => setValidateResult(data),
  });

  // Auto-refresh recent claims
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['sticker-stats'] });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const stats = statsQuery.data;
  const claimRate = stats && stats.total_stickers > 0
    ? ((stats.claimed / stats.total_stickers) * 100).toFixed(1)
    : '0.0';

  const handleGenerate = () => {
    if (!batchName.trim()) return;
    generateMutation.mutate({ quantity: batchQuantity, name: batchName.trim() });
  };

  const handleDownloadCsv = async (batchId: string) => {
    try {
      const blob = await getBatchCsv(batchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Error handled by query client
    }
  };

  const handleValidate = () => {
    if (!searchCode.trim()) return;
    setValidateResult(null);
    validateMutation.mutate(searchCode.trim().toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Sticker Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate sticker batches, track inventory, and monitor claims
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card text-center py-4">
          <Package className="w-6 h-6 text-forest-900 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono">{stats?.total_stickers ?? '--'}</p>
          <p className="text-xs text-gray-500">Total Generated</p>
        </div>
        <div className="card text-center py-4">
          <CheckCircle className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-blue-600">{stats?.claimed ?? '--'}</p>
          <p className="text-xs text-gray-500">Claimed</p>
        </div>
        <div className="card text-center py-4">
          <Tag className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-green-600">{stats?.available ?? '--'}</p>
          <p className="text-xs text-gray-500">Unclaimed</p>
        </div>
        <div className="card text-center py-4">
          <XCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-yellow-600">{stats?.distributed ?? '--'}</p>
          <p className="text-xs text-gray-500">Distributed</p>
        </div>
        <div className="card text-center py-4">
          <BarChart3 className="w-6 h-6 text-orange-disc-500 mx-auto mb-1" />
          <p className="text-xl font-bold font-mono text-orange-disc-500">{claimRate}%</p>
          <p className="text-xs text-gray-500">Claim Rate</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate Batch */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-forest-900" />
            Generate Batch
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="batchName" className="block text-sm font-medium text-gray-700 mb-1">
                Batch Name
              </label>
              <input
                id="batchName"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Spring 2026 Order"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="batchQty" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                id="batchQty"
                type="number"
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                min={1}
                max={1000}
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Max 1,000 per batch</p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !batchName.trim()}
              className="btn-primary w-full bg-orange-disc-500 hover:bg-orange-disc-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Batch'
              )}
            </button>

            {generateMutation.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to generate batch. Please try again.
              </div>
            )}

            {lastGenerated && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  Batch generated successfully!
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Batch ID: <span className="font-mono">{lastGenerated.batch_id}</span>
                </p>
                <p className="text-xs text-green-600">
                  Codes: {lastGenerated.quantity} ({lastGenerated.first_code} ... {lastGenerated.last_code})
                </p>
                <button
                  onClick={() => handleDownloadCsv(lastGenerated.batch_id)}
                  className="mt-3 btn-secondary text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Search */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-forest-900" />
            Code Lookup
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="stickerCode" className="block text-sm font-medium text-gray-700 mb-1">
                Disc Code
              </label>
              <div className="flex gap-2">
                <input
                  id="stickerCode"
                  value={searchCode}
                  onChange={(e) => {
                    setSearchCode(e.target.value.toUpperCase());
                    setValidateResult(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                  placeholder="e.g. RGDG-A3K7"
                  className="input flex-1 font-mono"
                />
                <button
                  onClick={handleValidate}
                  disabled={validateMutation.isPending || !searchCode.trim()}
                  className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Validate'
                  )}
                </button>
              </div>
            </div>

            {validateMutation.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Code not found or invalid.
              </div>
            )}

            {validateResult && (
              <div
                className={`p-4 rounded-lg border ${
                  validateResult.valid && validateResult.available
                    ? 'bg-green-50 border-green-200'
                    : validateResult.valid && validateResult.claimed
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {validateResult.valid ? (
                    <CheckCircle
                      className={`w-5 h-5 ${
                        validateResult.available ? 'text-green-600' : 'text-blue-600'
                      }`}
                    />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-medium text-sm">
                    {searchCode}
                  </span>
                  <StatusBadge
                    status={
                      !validateResult.valid
                        ? 'void'
                        : validateResult.claimed
                        ? 'claimed'
                        : 'available'
                    }
                  />
                </div>
                <p className="text-sm text-gray-600 ml-7">{validateResult.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batch Inventory Viewer */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-forest-900" />
            Batch Inventory
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={viewingBatchId || ''}
              onChange={(e) => setViewingBatchId(e.target.value || null)}
              placeholder="Enter Batch ID..."
              className="input text-sm font-mono w-64"
            />
            {lastGenerated && !viewingBatchId && (
              <button
                onClick={() => setViewingBatchId(lastGenerated.batch_id)}
                className="btn-secondary text-xs whitespace-nowrap"
              >
                View Last Batch
              </button>
            )}
          </div>
        </div>

        {inventoryQuery.isLoading && viewingBatchId && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        )}

        {inventoryQuery.isError && viewingBatchId && (
          <div className="text-center py-8">
            <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Batch not found or failed to load.</p>
          </div>
        )}

        {inventoryQuery.data && viewingBatchId && (
          <>
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-gray-500">
                <span className="font-medium text-gray-900">{inventoryQuery.data.batch_name}</span>{' '}
                ({inventoryQuery.data.batch_id})
              </span>
              <span className="text-green-600">{inventoryQuery.data.available} available</span>
              <span className="text-blue-600">{inventoryQuery.data.claimed} claimed</span>
              <span className="text-yellow-600">{inventoryQuery.data.distributed} distributed</span>
              <button
                onClick={() => handleDownloadCsv(viewingBatchId)}
                className="ml-auto btn-secondary text-xs flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="table-header">Code</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Claimed By</th>
                    <th className="table-header">Claimed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryQuery.data.stickers.map((sticker) => (
                    <tr key={sticker.disc_code} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-mono text-sm">{sticker.disc_code}</td>
                      <td className="table-cell">
                        <StatusBadge status={sticker.status} />
                      </td>
                      <td className="table-cell text-gray-600">
                        {sticker.claimed_by || '--'}
                      </td>
                      <td className="table-cell text-gray-500">
                        {sticker.claimed_at
                          ? new Date(sticker.claimed_at).toLocaleDateString()
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!viewingBatchId && !inventoryQuery.isLoading && (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Enter a Batch ID to view its inventory.</p>
            <p className="text-xs text-gray-400 mt-1">
              Batch IDs look like BATCH-20260322-A1B2C3
            </p>
          </div>
        )}
      </div>

      {/* Recent Claims */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 text-forest-900 ${statsQuery.isFetching ? 'animate-spin' : ''}`} />
            Recent Claims
          </h2>
          <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
        </div>

        {statsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        ) : stats?.recent_claims && stats.recent_claims.length > 0 ? (
          <div className="space-y-2">
            {stats.recent_claims.map((claim, i) => (
              <div
                key={`${claim.code}-${i}`}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span className="font-mono text-sm font-medium">{claim.code}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {claim.claimed_at
                    ? new Date(claim.claimed_at).toLocaleString()
                    : '--'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No recent claims yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
