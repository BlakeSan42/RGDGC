import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  UserX,
  UserCheck,
} from 'lucide-react';
import { getPlayers, updatePlayerRole, togglePlayerActive } from '../lib/api';
import type { User } from '../lib/types';

function RoleBadge({ role }: { role: User['role'] }) {
  const config: Record<string, { icon: typeof Shield; class: string }> = {
    super_admin: { icon: ShieldAlert, class: 'bg-red-100 text-red-700' },
    admin: { icon: ShieldCheck, class: 'bg-purple-100 text-purple-700' },
    moderator: { icon: Shield, class: 'bg-blue-100 text-blue-700' },
    player: { icon: Users, class: 'bg-gray-100 text-gray-600' },
  };
  const { icon: Icon, class: cls } = config[role] || config.player;
  return (
    <span className={`badge ${cls} gap-1`}>
      <Icon className="w-3 h-3" />
      {role.replace('_', ' ')}
    </span>
  );
}

export default function PlayerManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);

  const playersQuery = useQuery({
    queryKey: ['players', { search, role: roleFilter, page }],
    queryFn: () =>
      getPlayers({
        search: search || undefined,
        role: roleFilter || undefined,
        page,
        per_page: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      updatePlayerRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setRoleModalUser(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      togglePlayerActive(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setMenuOpenId(null);
    },
  });

  const players = playersQuery.data?.items || [];
  const totalPages = playersQuery.data?.pages || 1;
  const total = playersQuery.data?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Players</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage player accounts and roles ({total} total)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="input pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All Roles</option>
          <option value="player">Player</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {playersQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No players found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-header">Player</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Handicap</th>
                  <th className="table-header">Rounds</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header">Status</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {players.map((player) => (
                  <tr
                    key={player.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/players/${player.id}`)}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-forest-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-forest-900 text-xs font-semibold">
                            {(player.display_name || player.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {player.display_name || player.username}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{player.email}</td>
                    <td className="table-cell">
                      <RoleBadge role={player.role} />
                    </td>
                    <td className="table-cell font-mono">
                      {player.handicap !== null ? player.handicap.toFixed(1) : '--'}
                    </td>
                    <td className="table-cell font-mono">{player.rounds_played}</td>
                    <td className="table-cell text-gray-500">
                      {new Date(player.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      {player.is_active ? (
                        <span className="badge bg-green-100 text-green-700">Active</span>
                      ) : (
                        <span className="badge bg-red-100 text-red-700">Disabled</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === player.id ? null : player.id);
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {menuOpenId === player.id && (
                          <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/players/${player.id}`);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRoleModalUser(player);
                                setMenuOpenId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              Change Role
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMutation.mutate({
                                  userId: player.id,
                                  isActive: !player.is_active,
                                });
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                player.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {player.is_active ? (
                                <><UserX className="w-3.5 h-3.5" /> Disable</>
                              ) : (
                                <><UserCheck className="w-3.5 h-3.5" /> Enable</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
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
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary py-1 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1 px-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role change modal */}
      {roleModalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Change Role</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select a new role for{' '}
              <span className="font-medium text-gray-900">
                {roleModalUser.display_name || roleModalUser.username}
              </span>
            </p>
            <div className="space-y-2">
              {(['player', 'moderator', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() =>
                    roleMutation.mutate({ userId: roleModalUser.id, role })
                  }
                  disabled={roleMutation.isPending}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    roleModalUser.role === role
                      ? 'border-forest-500 bg-forest-50'
                      : 'border-gray-200 hover:border-forest-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium capitalize">{role.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setRoleModalUser(null)}
              className="btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
