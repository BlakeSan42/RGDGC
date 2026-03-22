import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  MoreVertical,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getEvents, getLeagues, createEvent, cancelEvent } from '../lib/api';
import type { Event, League } from '../lib/types';

function StatusBadge({ status }: { status: Event['status'] }) {
  const classes: Record<string, string> = {
    upcoming: 'badge-upcoming',
    active: 'badge-active',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled',
  };
  return <span className={classes[status] || 'badge'}>{status}</span>;
}

function CreateEventModal({
  leagues,
  onClose,
  onSubmit,
}: {
  leagues: League[];
  onClose: () => void;
  onSubmit: (data: Partial<Event>) => void;
}) {
  const [name, setName] = useState('');
  const [leagueId, setLeagueId] = useState<number | ''>('');
  const [eventDate, setEventDate] = useState('');
  const [feeUsd, setFeeUsd] = useState('0');
  const [maxPlayers, setMaxPlayers] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      league_id: leagueId === '' ? undefined : leagueId,
      event_date: eventDate,
      fee_usd: parseFloat(feeUsd),
      max_players: maxPlayers ? parseInt(maxPlayers) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Create Event</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Sunday Singles #15"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value ? parseInt(e.target.value) : '')}
              className="input"
            >
              <option value="">No league</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.season})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeUsd}
                onChange={(e) => setFeeUsd(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
              <input
                type="number"
                min="1"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className="input"
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Event</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EventManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [leagueFilter, setLeagueFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const eventsQuery = useQuery({
    queryKey: ['events', { status: statusFilter, league_id: leagueFilter, page }],
    queryFn: () =>
      getEvents({
        status: statusFilter || undefined,
        league_id: leagueFilter ? parseInt(leagueFilter) : undefined,
        page,
        per_page: 15,
      }),
    placeholderData: (prev) => prev,
  });

  const leaguesQuery = useQuery({
    queryKey: ['leagues'],
    queryFn: getLeagues,
    placeholderData: [],
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreate(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setMenuOpenId(null);
    },
  });

  const events = eventsQuery.data?.items || [];
  const totalPages = eventsQuery.data?.pages || 1;
  const leagues = leaguesQuery.data || [];

  const filtered = search
    ? events.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.league?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-1">Manage league events and results</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-accent flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
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
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={leagueFilter}
            onChange={(e) => { setLeagueFilter(e.target.value); setPage(1); }}
            className="input w-auto"
          >
            <option value="">All Leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {eventsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No events found</p>
            <p className="text-sm text-gray-400 mt-1">Create your first event to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-header">Event</th>
                  <th className="table-header">League</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Check-ins</th>
                  <th className="table-header">Fee</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    <td className="table-cell font-medium text-gray-900">{event.name}</td>
                    <td className="table-cell">{event.league?.name || '--'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {event.checkin_count}
                        {event.max_players ? `/${event.max_players}` : ''}
                      </div>
                    </td>
                    <td className="table-cell font-mono">
                      {event.fee_usd > 0 ? `$${event.fee_usd}` : 'Free'}
                    </td>
                    <td className="table-cell">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === event.id ? null : event.id);
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {menuOpenId === event.id && (
                          <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/events/${event.id}`);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              View Details
                            </button>
                            {event.status === 'upcoming' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelMutation.mutate(event.id);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                Cancel Event
                              </button>
                            )}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
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

      {showCreate && (
        <CreateEventModal
          leagues={leagues}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
