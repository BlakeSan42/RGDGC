import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Mail,
  Calendar,
  Target,
  Trophy,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { getPlayer } from '../lib/api';

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerId = parseInt(id || '0');

  const playerQuery = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => getPlayer(playerId),
    enabled: playerId > 0,
  });

  const player = playerQuery.data;

  if (playerQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Player not found</p>
        <button onClick={() => navigate('/players')} className="btn-secondary mt-4">
          Back to Players
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/players')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Players
      </button>

      {/* Profile header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-forest-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">
              {(player.display_name || player.username).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-gray-900">
              {player.display_name || player.username}
            </h1>
            <p className="text-sm text-gray-500">@{player.username}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {player.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {new Date(player.created_at).toLocaleDateString()}
              </span>
              {player.wallet_address && (
                <span className="flex items-center gap-1 font-mono text-xs">
                  <Wallet className="w-4 h-4" />
                  {player.wallet_address.slice(0, 6)}...{player.wallet_address.slice(-4)}
                </span>
              )}
            </div>
          </div>
          <span
            className={`badge ${
              player.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {player.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <Target className="w-8 h-8 text-forest-900 mx-auto mb-2" />
          <p className="text-2xl font-bold font-mono text-gray-900">{player.rounds_played}</p>
          <p className="text-sm text-gray-500">Rounds Played</p>
        </div>
        <div className="card text-center">
          <Trophy className="w-8 h-8 text-orange-disc-500 mx-auto mb-2" />
          <p className="text-2xl font-bold font-mono text-gray-900">
            {player.handicap !== null ? player.handicap.toFixed(1) : '--'}
          </p>
          <p className="text-sm text-gray-500">Handicap</p>
        </div>
        <div className="card text-center">
          <span className="inline-block w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <span className="text-purple-700 text-sm font-bold capitalize">
              {player.role.charAt(0).toUpperCase()}
            </span>
          </span>
          <p className="text-2xl font-bold text-gray-900 capitalize">
            {player.role.replace('_', ' ')}
          </p>
          <p className="text-sm text-gray-500">Role</p>
        </div>
      </div>
    </div>
  );
}
