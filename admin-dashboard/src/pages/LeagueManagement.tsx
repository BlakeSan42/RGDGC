import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  Star,
  X,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import {
  getLeagues,
  createLeague,
  getLeagueLeaderboard,
} from '../lib/api';
import type { League } from '../lib/types';

function CreateLeagueModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: Partial<League>) => void;
}) {
  const [name, setName] = useState('');
  const [season, setSeason] = useState('Spring 2026');
  const [leagueType, setLeagueType] = useState<'singles' | 'doubles'>('singles');
  const [pointsRule, setPointsRule] = useState<'field_size' | 'fixed'>('field_size');
  const [dropWorst, setDropWorst] = useState('2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      season,
      league_type: leagueType,
      points_rule: pointsRule,
      drop_worst: parseInt(dropWorst),
      start_date: startDate,
      end_date: endDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Create League</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Sunday Singles" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)} className="input" placeholder="Spring 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={leagueType} onChange={(e) => setLeagueType(e.target.value as 'singles' | 'doubles')} className="input">
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Rule</label>
              <select value={pointsRule} onChange={(e) => setPointsRule(e.target.value as 'field_size' | 'fixed')} className="input">
                <option value="field_size">Field Size</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drop Worst N Events</label>
            <input type="number" min="0" value={dropWorst} onChange={(e) => setDropWorst(e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" required />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create League</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeagueCard({ league }: { league: League }) {
  const [expanded, setExpanded] = useState(false);

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', league.id],
    queryFn: () => getLeagueLeaderboard(league.id),
    enabled: expanded,
  });

  const leaderboard = leaderboardQuery.data || [];

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              league.is_active ? 'bg-forest-100 text-forest-900' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{league.name}</h3>
            <p className="text-sm text-gray-500">{league.season}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(league.start_date).toLocaleDateString()} - {new Date(league.end_date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {league.player_count} players
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5" />
                {league.event_count} events
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${league.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {league.is_active ? 'Active' : 'Ended'}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-gray-100"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Details row */}
      <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-gray-500">
        <span>Type: <strong className="text-gray-700 capitalize">{league.league_type}</strong></span>
        <span>Points: <strong className="text-gray-700 capitalize">{league.points_rule.replace('_', ' ')}</strong></span>
        <span>Drop worst: <strong className="text-gray-700">{league.drop_worst}</strong></span>
      </div>

      {/* Leaderboard */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <Award className="w-4 h-4" />
            Season Standings
          </h4>
          {leaderboardQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-forest-900" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No standings yet</p>
          ) : (
            <div className="space-y-1">
              {leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.user_id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        entry.position === 1
                          ? 'bg-yellow-100 text-yellow-700'
                          : entry.position === 2
                          ? 'bg-gray-100 text-gray-600'
                          : entry.position === 3
                          ? 'bg-orange-100 text-orange-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {entry.position}
                    </span>
                    <span className="text-sm text-gray-700">{entry.display_name || entry.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{entry.events_played} events</span>
                    <span className="font-mono font-semibold text-forest-900">
                      {entry.total_points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeagueManagement() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const leaguesQuery = useQuery({
    queryKey: ['leagues'],
    queryFn: getLeagues,
    placeholderData: [],
  });

  const createMutation = useMutation({
    mutationFn: createLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      setShowCreate(false);
    },
  });

  const leagues = leaguesQuery.data || [];
  const activeLeagues = leagues.filter((l) => l.is_active);
  const pastLeagues = leagues.filter((l) => !l.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Leagues</h1>
          <p className="text-sm text-gray-500 mt-1">Manage league seasons and standings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-accent flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create League
        </button>
      </div>

      {leaguesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
        </div>
      ) : leagues.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No leagues yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first league to get started.</p>
        </div>
      ) : (
        <>
          {activeLeagues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Active Leagues
              </h2>
              <div className="space-y-4">
                {activeLeagues.map((league) => (
                  <LeagueCard key={league.id} league={league} />
                ))}
              </div>
            </div>
          )}
          {pastLeagues.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Past Leagues
              </h2>
              <div className="space-y-4">
                {pastLeagues.map((league) => (
                  <LeagueCard key={league.id} league={league} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateLeagueModal
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
