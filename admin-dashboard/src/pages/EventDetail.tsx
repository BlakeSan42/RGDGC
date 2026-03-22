import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Users,
  Trophy,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getEvent,
  getEventCheckins,
  getEventResults,
  submitEventResults,
  finalizeEvent,
} from '../lib/api';
import type { Result } from '../lib/types';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'upcoming':
      return <Clock className="w-5 h-5 text-blue-500" />;
    case 'active':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'completed':
      return <Trophy className="w-5 h-5 text-gray-500" />;
    case 'cancelled':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return null;
  }
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const eventId = parseInt(id || '0');

  const [resultEntries, setResultEntries] = useState<
    Array<{ user_id: number; total_strokes: number; dnf: boolean; dq: boolean }>
  >([]);
  const [showResultForm, setShowResultForm] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId),
    enabled: eventId > 0,
  });

  const checkinsQuery = useQuery({
    queryKey: ['event-checkins', eventId],
    queryFn: () => getEventCheckins(eventId),
    enabled: eventId > 0,
  });

  const resultsQuery = useQuery({
    queryKey: ['event-results', eventId],
    queryFn: () => getEventResults(eventId),
    enabled: eventId > 0,
  });

  const submitMutation = useMutation({
    mutationFn: (results: Partial<Result>[]) => submitEventResults(eventId, results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-results', eventId] });
      setShowResultForm(false);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-results', eventId] });
    },
  });

  const event = eventQuery.data;
  const checkins = checkinsQuery.data || [];
  const results = resultsQuery.data || [];

  if (eventQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-900" />
      </div>
    );
  }

  if (eventQuery.isError) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Failed to load event</p>
        <p className="text-sm text-gray-400 mt-1">Check that the backend is running at the configured API URL.</p>
        <div className="flex justify-center gap-3 mt-4">
          <button onClick={() => navigate('/events')} className="btn-secondary">
            Back to Events
          </button>
          <button onClick={() => eventQuery.refetch()} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Event not found</p>
        <button onClick={() => navigate('/events')} className="btn-secondary mt-4">
          Back to Events
        </button>
      </div>
    );
  }

  const handleStartResultEntry = () => {
    const entries = checkins.map((c) => ({
      user_id: c.user_id,
      total_strokes: 0,
      dnf: false,
      dq: false,
    }));
    setResultEntries(entries);
    setShowResultForm(true);
  };

  const handleSubmitResults = () => {
    const sorted = [...resultEntries]
      .filter((r) => !r.dnf && !r.dq)
      .sort((a, b) => a.total_strokes - b.total_strokes);

    const resultsWithPosition = resultEntries.map((entry) => {
      if (entry.dnf || entry.dq) {
        return { ...entry, position: 0, points_earned: 0 };
      }
      const position = sorted.findIndex((s) => s.user_id === entry.user_id) + 1;
      return { ...entry, position };
    });

    submitMutation.mutate(resultsWithPosition);
  };

  const handleExport = () => {
    const csv = [
      'Position,Player,Strokes,Score,Points,Status',
      ...results.map(
        (r) =>
          `${r.position},${r.user?.display_name || r.user?.username},${r.total_strokes},${r.total_score},${r.points_earned},${r.dnf ? 'DNF' : r.dq ? 'DQ' : 'Complete'}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name.replace(/\s+/g, '_')}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-gray-900">{event.name}</h1>
              <StatusIcon status={event.status} />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(event.event_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {event.league && (
                <span className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {event.league.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {checkins.length} checked in
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {event.status === 'active' && results.length === 0 && (
              <button onClick={handleStartResultEntry} className="btn-accent">
                Enter Results
              </button>
            )}
            {event.status === 'active' && results.length > 0 && (
              <button
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending}
                className="btn-primary"
              >
                {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize Results'}
              </button>
            )}
            {results.length > 0 && (
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-ins */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-forest-900" />
            Check-ins ({checkins.length})
          </h2>
          {checkinsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-900" />
            </div>
          ) : checkins.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No check-ins yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {checkins.map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-forest-100 rounded-full flex items-center justify-center">
                      <span className="text-forest-900 text-xs font-semibold">
                        {checkin.user.display_name?.charAt(0) || checkin.user.username.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {checkin.user.display_name || checkin.user.username}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(checkin.checked_in_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-disc-500" />
            Results ({results.length})
          </h2>
          {resultsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-900" />
            </div>
          ) : results.length === 0 && !showResultForm ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No results submitted yet
            </p>
          ) : showResultForm ? (
            <div className="space-y-3">
              {resultEntries.map((entry, idx) => {
                const checkin = checkins.find((c) => c.user_id === entry.user_id);
                return (
                  <div key={entry.user_id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24 truncate">
                      {checkin?.user.display_name || checkin?.user.username || `Player ${entry.user_id}`}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={entry.total_strokes || ''}
                      onChange={(e) => {
                        const updated = [...resultEntries];
                        updated[idx] = { ...updated[idx], total_strokes: parseInt(e.target.value) || 0 };
                        setResultEntries(updated);
                      }}
                      className="input w-20"
                      placeholder="Strokes"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={entry.dnf}
                        onChange={(e) => {
                          const updated = [...resultEntries];
                          updated[idx] = { ...updated[idx], dnf: e.target.checked };
                          setResultEntries(updated);
                        }}
                      />
                      DNF
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={entry.dq}
                        onChange={(e) => {
                          const updated = [...resultEntries];
                          updated[idx] = { ...updated[idx], dq: e.target.checked };
                          setResultEntries(updated);
                        }}
                      />
                      DQ
                    </label>
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowResultForm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResults}
                  disabled={submitMutation.isPending}
                  className="btn-primary"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Results'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results
                .sort((a, b) => a.position - b.position)
                .map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          result.position === 1
                            ? 'bg-yellow-100 text-yellow-700'
                            : result.position === 2
                            ? 'bg-gray-100 text-gray-600'
                            : result.position === 3
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        {result.dnf ? 'DNF' : result.dq ? 'DQ' : result.position}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {result.user?.display_name || result.user?.username}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {result.total_strokes} strokes ({result.total_score >= 0 ? '+' : ''}{result.total_score})
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-semibold text-forest-900">
                      {result.points_earned} pts
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
