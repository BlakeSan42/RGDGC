import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Users,
  Flag,
  DollarSign,
  CalendarPlus,
  Send,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shuffle,
  Target,
  Play,
  Trophy,
  Share2,
  Zap,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import {
  leagueOpsApi,
  getEvents,
  getLeagues,
  getEventCheckins,
  updateEvent,
  finalizeEvent,
} from '../lib/api';
import type { League } from '../lib/types';

// ── Types ──

interface CardAssignment {
  card_number: number;
  starting_hole: number | null;
  players: Array<{
    id: number;
    username: string;
    display_name: string | null;
    handicap: number | null;
  }>;
}

interface CTPResult {
  hole_number: number;
  winner_id: number;
  winner_name: string;
  distance: string;
  pot: number | null;
}

// ── Modals ──

function AssignCardsModal({
  eventId,
  onClose,
  onSubmit,
  isLoading,
}: {
  eventId: number;
  onClose: () => void;
  onSubmit: (data: {
    event_id: number;
    method: string;
    group_size: number;
    shotgun_start: boolean;
  }) => void;
  isLoading: boolean;
}) {
  const [method, setMethod] = useState('random');
  const [groupSize, setGroupSize] = useState(4);
  const [shotgun, setShotgun] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-forest-900" />
            Assign Cards
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="input"
            >
              <option value="random">Random</option>
              <option value="handicap">Handicap Balanced</option>
              <option value="snake">Snake Draft</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Players per Card
            </label>
            <select
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
              className="input"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shotgun}
              onChange={(e) => setShotgun(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">
              Shotgun start (assign starting holes)
            </span>
          </label>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                event_id: eventId,
                method,
                group_size: groupSize,
                shotgun_start: shotgun,
              })
            }
            disabled={isLoading}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Assign Cards
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordCTPModal({
  eventId,
  checkins,
  onClose,
  onSubmit,
  isLoading,
}: {
  eventId: number;
  checkins: Array<{
    user_id: number;
    username: string;
    display_name: string | null;
  }>;
  onClose: () => void;
  onSubmit: (data: {
    event_id: number;
    hole_number: number;
    player_id: number;
    distance_feet: number;
    distance_inches?: number;
  }) => void;
  isLoading: boolean;
}) {
  const [hole, setHole] = useState(1);
  const [playerId, setPlayerId] = useState(checkins[0]?.user_id || 0);
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-disc-500" />
            Record CTP Measurement
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hole
            </label>
            <input
              type="number"
              min={1}
              max={19}
              value={hole}
              onChange={(e) => setHole(Number(e.target.value))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player
            </label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(Number(e.target.value))}
              className="input"
            >
              {checkins.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name || p.username}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feet
              </label>
              <input
                type="number"
                min={0}
                value={feet}
                onChange={(e) => setFeet(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inches
              </label>
              <input
                type="number"
                min={0}
                max={11}
                value={inches}
                onChange={(e) => setInches(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                event_id: eventId,
                hole_number: hole,
                player_id: playerId,
                distance_feet: Number(feet) + (Number(inches) || 0) / 12,
                distance_inches: Number(inches) || undefined,
              })
            }
            disabled={isLoading || !feet}
            className="btn-accent flex items-center gap-2"
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Record
          </button>
        </div>
      </div>
    </div>
  );
}

function AcePayoutModal({
  eventId,
  checkins,
  balance,
  onClose,
  onSubmit,
  isLoading,
}: {
  eventId: number;
  checkins: Array<{
    user_id: number;
    username: string;
    display_name: string | null;
  }>;
  balance: number;
  onClose: () => void;
  onSubmit: (data: {
    player_id: number;
    event_id: number;
    hole_number: number;
  }) => void;
  isLoading: boolean;
}) {
  const [playerId, setPlayerId] = useState(checkins[0]?.user_id || 0);
  const [hole, setHole] = useState(1);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Record Ace Payout
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-sm text-yellow-800 font-medium">
              Payout amount: ${balance.toFixed(2)}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Entire fund balance will be paid out
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player who hit the ace
            </label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(Number(e.target.value))}
              className="input"
            >
              {checkins.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name || p.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hole number
            </label>
            <input
              type="number"
              min={1}
              max={19}
              value={hole}
              onChange={(e) => setHole(Number(e.target.value))}
              className="input"
            />
          </div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({ player_id: playerId, event_id: eventId, hole_number: hole })
            }
            disabled={isLoading || !playerId}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Confirm Payout
          </button>
        </div>
      </div>
    </div>
  );
}

function RecurringEventModal({
  leagues,
  onClose,
  onSubmit,
  isLoading,
}: {
  leagues: League[];
  onClose: () => void;
  onSubmit: (data: {
    league_id: number;
    layout_id: number;
    name_template: string;
    day_of_week: number;
    hour: number;
    entry_fee: number;
    weeks_ahead: number;
  }) => void;
  isLoading: boolean;
}) {
  const [leagueId, setLeagueId] = useState(leagues[0]?.id || 0);
  const [layoutId, setLayoutId] = useState(1);
  const [nameTemplate, setNameTemplate] = useState('Sunday Singles {date}');
  const [dayOfWeek, setDayOfWeek] = useState(6);
  const [hour, setHour] = useState(14);
  const [entryFee, setEntryFee] = useState(5);
  const [weeksAhead, setWeeksAhead] = useState(4);

  const dayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-blue-600" />
            Setup Recurring Events
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              League
            </label>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(Number(e.target.value))}
              className="input"
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.season})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Name Template
            </label>
            <input
              type="text"
              value={nameTemplate}
              onChange={(e) => setNameTemplate(e.target.value)}
              className="input"
              placeholder="Sunday Singles {date}"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use {'{date}'} for auto date (e.g. "Mar 22")
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="input"
              >
                {dayNames.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="input"
              >
                {Array.from({ length: 12 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={h}>
                    {h > 12 ? `${h - 12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Layout ID
              </label>
              <input
                type="number"
                min={1}
                value={layoutId}
                onChange={(e) => setLayoutId(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entry Fee ($)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weeks Ahead
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={weeksAhead}
                onChange={(e) => setWeeksAhead(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                league_id: leagueId,
                layout_id: layoutId,
                name_template: nameTemplate,
                day_of_week: dayOfWeek,
                hour,
                entry_fee: entryFee,
                weeks_ahead: weeksAhead,
              })
            }
            disabled={isLoading || !leagueId}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Create Events
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function LeagueDayOps() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAssignCards, setShowAssignCards] = useState(false);
  const [showRecordCTP, setShowRecordCTP] = useState(false);
  const [showAcePayout, setShowAcePayout] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [assignedCards, setAssignedCards] = useState<CardAssignment[]>([]);
  const [cardsExpanded, setCardsExpanded] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Auto-dismiss status messages after 5 seconds
  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Load active/upcoming events
  const eventsQuery = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => getEvents({ status: 'active', per_page: 10 }),
  });
  const upcomingQuery = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => getEvents({ status: 'upcoming', per_page: 10 }),
  });

  const leaguesQuery = useQuery({
    queryKey: ['leagues'],
    queryFn: () => getLeagues(),
  });

  const allEvents = [
    ...(eventsQuery.data?.items || []),
    ...(upcomingQuery.data?.items || []),
  ].sort(
    (a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  // Load data for selected event
  const checkinsQuery = useQuery({
    queryKey: ['event-checkins', selectedEventId],
    queryFn: () =>
      selectedEventId
        ? getEventCheckins(selectedEventId)
        : Promise.resolve([]),
    enabled: !!selectedEventId,
  });

  const ctpQuery = useQuery({
    queryKey: ['ctp-results', selectedEventId],
    queryFn: () =>
      selectedEventId
        ? leagueOpsApi.getCTPResults(selectedEventId)
        : Promise.resolve([]),
    enabled: !!selectedEventId,
  });

  const aceFundQuery = useQuery({
    queryKey: ['ace-fund'],
    queryFn: () => leagueOpsApi.getAceFundBalance(),
  });

  // ── Mutations ──

  const assignCardsMutation = useMutation({
    mutationFn: leagueOpsApi.assignCards,
    onSuccess: (data) => {
      setShowAssignCards(false);
      setAssignedCards(data);
      setCardsExpanded(true);
      showStatus('success', `Assigned ${data.length} cards!`);
      queryClient.invalidateQueries({ queryKey: ['card-assignments'] });
    },
    onError: () => showStatus('error', 'Failed to assign cards'),
  });

  const notifyCardsMutation = useMutation({
    mutationFn: leagueOpsApi.notifyCards,
    onSuccess: () => showStatus('success', 'Push notifications sent!'),
    onError: () => showStatus('error', 'Failed to send notifications'),
  });

  const recordCTPMutation = useMutation({
    mutationFn: leagueOpsApi.recordCTP,
    onSuccess: () => {
      setShowRecordCTP(false);
      showStatus('success', 'CTP measurement recorded!');
      queryClient.invalidateQueries({
        queryKey: ['ctp-results', selectedEventId],
      });
    },
    onError: () => showStatus('error', 'Failed to record CTP'),
  });

  const collectAceMutation = useMutation({
    mutationFn: () =>
      selectedEventId
        ? leagueOpsApi.collectAceFund(selectedEventId)
        : Promise.reject(),
    onSuccess: (data: { total?: number; collected_from?: number }) => {
      showStatus(
        'success',
        `Collected $${data.total?.toFixed(2) || '?'} from ${data.collected_from || '?'} players`
      );
      queryClient.invalidateQueries({ queryKey: ['ace-fund'] });
    },
    onError: () => showStatus('error', 'Failed to collect ace fund'),
  });

  const acePayoutMutation = useMutation({
    mutationFn: leagueOpsApi.payoutAceFund,
    onSuccess: (data: { player?: string; hole?: number; payout?: number }) => {
      setShowAcePayout(false);
      showStatus(
        'success',
        `ACE! Paid $${data.payout?.toFixed(2) || '?'} to ${data.player || '?'} on hole ${data.hole || '?'}`
      );
      queryClient.invalidateQueries({ queryKey: ['ace-fund'] });
    },
    onError: () => showStatus('error', 'Failed to process ace payout'),
  });

  const startEventMutation = useMutation({
    mutationFn: (eventId: number) =>
      updateEvent(eventId, { status: 'active' as const }),
    onSuccess: () => {
      showStatus('success', 'Event started!');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => showStatus('error', 'Failed to start event'),
  });

  const finalizeEventMutation = useMutation({
    mutationFn: (eventId: number) => finalizeEvent(eventId),
    onSuccess: () => {
      showStatus('success', 'Event finalized! Points calculated.');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => showStatus('error', 'Failed to finalize event'),
  });

  const recurringMutation = useMutation({
    mutationFn: leagueOpsApi.setupRecurring,
    onSuccess: (data) => {
      setShowRecurring(false);
      showStatus(
        'success',
        `Created ${data.created} upcoming events!`
      );
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => showStatus('error', 'Failed to create recurring events'),
  });

  const handleCopyResults = async () => {
    if (!selectedEventId) return;
    try {
      const result = await leagueOpsApi.shareResults(selectedEventId);
      await navigator.clipboard.writeText(result.text);
      showStatus('success', 'Results copied to clipboard!');
    } catch {
      showStatus('error', 'Failed to copy results');
    }
  };

  const handleCopyStandings = async (leagueId: number) => {
    try {
      const result = await leagueOpsApi.shareStandings(leagueId);
      await navigator.clipboard.writeText(result.text);
      showStatus('success', 'Standings copied to clipboard!');
    } catch {
      showStatus('error', 'Failed to copy standings');
    }
  };

  const rawCheckins = checkinsQuery.data || [];
  // Flatten checkin data for modals that expect { user_id, username, display_name }
  const checkins = rawCheckins.map((c) => ({
    ...c,
    username: c.user?.username ?? '',
    display_name: c.user?.display_name ?? null,
  }));
  const ctpResults = (ctpQuery.data || []) as CTPResult[];
  const aceFund = aceFundQuery.data;
  const selectedEvent = allEvents.find((e) => e.id === selectedEventId);
  const leagues = leaguesQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-forest-900" />
            League Day Ops
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Card assignments, CTP tracking, ace fund, event actions, sharing
          </p>
        </div>
        <button
          onClick={() => setShowRecurring(true)}
          disabled={leagues.length === 0}
          className="btn-secondary flex items-center gap-2"
        >
          <CalendarPlus className="w-4 h-4" />
          Setup Recurring Events
        </button>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            statusMsg.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Event selector + quick event actions */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Event
            </label>
            <select
              value={selectedEventId ?? ''}
              onChange={(e) => {
                setSelectedEventId(
                  e.target.value ? Number(e.target.value) : null
                );
                setAssignedCards([]);
              }}
              className="input"
            >
              <option value="">-- Choose an event --</option>
              {allEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name || `Event #${ev.id}`} --{' '}
                  {new Date(ev.event_date).toLocaleDateString()} ({ev.status})
                </option>
              ))}
            </select>
          </div>
          {selectedEvent && (
            <div className="flex gap-2 flex-shrink-0">
              {selectedEvent.status === 'upcoming' && (
                <button
                  onClick={() => startEventMutation.mutate(selectedEventId!)}
                  disabled={startEventMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {startEventMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Event
                </button>
              )}
              {selectedEvent.status === 'active' && (
                <button
                  onClick={() =>
                    finalizeEventMutation.mutate(selectedEventId!)
                  }
                  disabled={finalizeEventMutation.isPending}
                  className="btn-accent flex items-center gap-2"
                >
                  {finalizeEventMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  Finalize Event
                </button>
              )}
            </div>
          )}
        </div>
        {selectedEvent && (
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {checkins.length} checked in
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedEvent.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : selectedEvent.status === 'upcoming'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedEvent.status === 'completed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
              }`}
            >
              {selectedEvent.status}
            </span>
            {selectedEvent.fee_usd > 0 && (
              <span>${selectedEvent.fee_usd} entry</span>
            )}
          </div>
        )}
      </div>

      {selectedEventId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card Assignments */}
          <div className="card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-forest-900" />
                Card Assignments
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAssignCards(true)}
                  disabled={checkins.length < 2}
                  className="btn-primary text-sm py-1 px-3"
                >
                  Assign
                </button>
                {assignedCards.length > 0 && (
                  <button
                    onClick={() =>
                      notifyCardsMutation.mutate(selectedEventId)
                    }
                    disabled={notifyCardsMutation.isPending}
                    className="btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Notify
                  </button>
                )}
              </div>
            </div>
            <div className="p-4">
              {assignedCards.length > 0 ? (
                <div>
                  <button
                    onClick={() => setCardsExpanded(!cardsExpanded)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3"
                  >
                    {cardsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {assignedCards.length} cards assigned
                  </button>
                  {cardsExpanded && (
                    <div className="space-y-3">
                      {assignedCards.map((card) => (
                        <div
                          key={card.card_number}
                          className="border border-gray-100 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-forest-900">
                              Card {card.card_number}
                            </span>
                            {card.starting_hole && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Hole {card.starting_hole}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {card.players.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-gray-700">
                                  {p.display_name || p.username}
                                </span>
                                {p.handicap !== null &&
                                  p.handicap !== undefined && (
                                    <span className="text-xs text-gray-400 font-mono">
                                      HC {typeof p.handicap === 'number' ? p.handicap.toFixed(1) : p.handicap}
                                    </span>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : checkins.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No players checked in yet
                </p>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  {checkins.length} players ready. Click "Assign" to create
                  cards.
                </p>
              )}
            </div>
          </div>

          {/* CTP Tracking */}
          <div className="card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-orange-disc-500" />
                Closest to Pin
              </h2>
              <button
                onClick={() => setShowRecordCTP(true)}
                disabled={checkins.length === 0}
                className="btn-accent text-sm py-1 px-3"
              >
                Record
              </button>
            </div>
            <div className="p-4">
              {ctpResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No CTP measurements recorded yet
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="pb-2">Hole</th>
                      <th className="pb-2">Winner</th>
                      <th className="pb-2">Distance</th>
                      <th className="pb-2 text-right">Pot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ctpResults.map((r) => (
                      <tr key={r.hole_number}>
                        <td className="py-2 font-bold text-forest-900">
                          {r.hole_number}
                        </td>
                        <td className="py-2 text-sm">{r.winner_name}</td>
                        <td className="py-2 text-sm text-gray-500">
                          {r.distance}
                        </td>
                        <td className="py-2 text-sm text-right font-medium text-green-700">
                          {r.pot ? `$${r.pot.toFixed(0)}` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Ace Fund */}
          <div className="card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Ace Fund
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => collectAceMutation.mutate()}
                  disabled={
                    collectAceMutation.isPending || checkins.length === 0
                  }
                  className="btn-secondary text-sm py-1 px-3"
                >
                  Collect ($1/player)
                </button>
                <button
                  onClick={() => setShowAcePayout(true)}
                  disabled={
                    !aceFund || aceFund.balance <= 0 || checkins.length === 0
                  }
                  className="btn-primary text-sm py-1 px-3 flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Payout
                </button>
              </div>
            </div>
            <div className="p-4">
              {aceFund ? (
                <div className="text-center">
                  <p className="text-3xl font-bold text-forest-900">
                    ${aceFund.balance.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{aceFund.note}</p>
                  <div className="flex justify-center gap-8 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Collected:</span>{' '}
                      <span className="font-semibold">
                        ${aceFund.total_collected.toFixed(0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Paid out:</span>{' '}
                      <span className="font-semibold">
                        ${aceFund.total_paid_out.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-4">
                  <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="p-4 border-b">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                Share & Actions
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Copy results */}
              <button
                onClick={handleCopyResults}
                disabled={
                  !selectedEvent || selectedEvent.status === 'upcoming'
                }
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Event Results
              </button>

              {/* Copy standings per league */}
              {leagues.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Season Standings
                  </p>
                  <div className="space-y-2">
                    {leagues
                      .filter((l) => l.is_active)
                      .map((league) => (
                        <button
                          key={league.id}
                          onClick={() => handleCopyStandings(league.id)}
                          className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          Copy {league.name} Standings
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-1">
                Copies formatted text with results, CTP, and ace fund -- paste
                into Facebook, iMessage, etc.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAssignCards && selectedEventId && (
        <AssignCardsModal
          eventId={selectedEventId}
          onClose={() => setShowAssignCards(false)}
          onSubmit={(data) => assignCardsMutation.mutate(data)}
          isLoading={assignCardsMutation.isPending}
        />
      )}
      {showRecordCTP && selectedEventId && (
        <RecordCTPModal
          eventId={selectedEventId}
          checkins={checkins}
          onClose={() => setShowRecordCTP(false)}
          onSubmit={(data) => recordCTPMutation.mutate(data)}
          isLoading={recordCTPMutation.isPending}
        />
      )}
      {showAcePayout && selectedEventId && aceFund && (
        <AcePayoutModal
          eventId={selectedEventId}
          checkins={checkins}
          balance={aceFund.balance}
          onClose={() => setShowAcePayout(false)}
          onSubmit={(data) => acePayoutMutation.mutate(data)}
          isLoading={acePayoutMutation.isPending}
        />
      )}
      {showRecurring && (
        <RecurringEventModal
          leagues={leagues}
          onClose={() => setShowRecurring(false)}
          onSubmit={(data) => recurringMutation.mutate(data)}
          isLoading={recurringMutation.isPending}
        />
      )}
    </div>
  );
}
