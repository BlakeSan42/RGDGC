// ── User ──
export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "player" | "guest";
  handicap: number | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// ── Course ──
export interface Course {
  id: number;
  name: string;
  location: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  photo_url: string | null;
}

export interface Layout {
  id: number;
  course_id: number;
  name: string;
  holes: number;
  total_par: number;
  total_distance: number | null;
  difficulty: string | null;
  is_default: boolean;
}

export interface Hole {
  id: number;
  hole_number: number;
  par: number;
  distance: number | null;
  description: string | null;
}

export interface LayoutDetail extends Layout {
  hole_list: Hole[];
}

export interface CourseDetail extends Course {
  layouts: Layout[];
}

// ── Scoring ──
export interface Round {
  id: number;
  user_id: number;
  layout_id: number;
  started_at: string;
  completed_at: string | null;
  total_score: number | null;
  total_strokes: number | null;
  is_practice: boolean;
  weather: string | null;
}

export interface HoleScore {
  id: number;
  hole_id: number;
  strokes: number;
  putts: number | null;
  ob_strokes: number;
  fairway_hit: boolean | null;
}

export interface RoundDetail extends Round {
  scores: HoleScore[];
}

// ── League ──
export interface League {
  id: number;
  name: string;
  description: string | null;
  season: string | null;
  league_type: string;
  points_rule: string;
  drop_worst: number;
  is_active: boolean;
}

export interface LeagueEvent {
  id: number;
  league_id: number;
  name: string | null;
  event_date: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  num_players: number | null;
  entry_fee: number | null;
  notes: string | null;
}

export interface EventResult {
  id: number;
  event_id: number;
  user_id: number;
  player_name?: string;
  total_strokes: number;
  total_score: number;
  position: number | null;
  points_earned: number | null;
  dnf: boolean;
  dq: boolean;
}

export interface EventCheckin {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  checked_in_at: string;
}

export interface EventDetail extends LeagueEvent {
  league_name?: string;
  course_name?: string;
  layout_name?: string;
  format?: string;
  entry_fee_rgdg?: number;
  checkin_count?: number;
  max_players?: number;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  player_name: string;
  total_points: number;
  events_played: number;
  wins: number;
  podiums: number;
  average_points: number;
  best_finish: number | null;
}

// ── Putting ──
export interface PuttAttempt {
  distance_meters: number;
  zone: "c1" | "c1x" | "c2";
  made: boolean;
  elevation_change?: number;
  wind_speed?: number;
  wind_direction?: number;
  chain_hit?: boolean;
  result_type?: string;
  putt_style?: "spin" | "push" | "spush" | "turbo";
  disc_used?: string;
  pressure?: "casual" | "league" | "tournament";
  round_id?: number;
}

export interface PuttingStats {
  total_attempts: number;
  total_makes: number;
  make_percentage: number;
  c1_percentage: number;
  c1x_percentage: number;
  c2_percentage: number;
  by_distance: Record<string, { attempts: number; makes: number; pct: number }>;
}

export interface PuttProbability {
  distance_meters: number;
  distance_feet: number;
  zone: string;
  make_probability: number;
  tour_average: number;
  personal_average: number | null;
  wind_adjustment: number | null;
  elevation_adjustment: number | null;
}

// ── Disc Management ──
export interface RegisteredDisc {
  id: string;
  disc_code: string;
  manufacturer: string;
  mold: string;
  plastic: string;
  weight_grams: number;
  color: string;
  photo_url: string | null;
  status: "active" | "lost" | "found" | "retired";
  notes: string;
  registered_at: string;
}

export interface DiscFoundReport {
  id: string;
  disc_code: string;
  finder_name: string;
  found_location: string;
  message: string;
  found_at: string;
  resolved: boolean;
}

export interface DiscRegistrationData {
  manufacturer: string;
  mold: string;
  plastic: string;
  weight_grams: number;
  color: string;
  notes: string;
}

// ── Achievements ──
export interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: string; // Ionicon name
  earned_at: string | null;
  progress?: number; // 0-1 for in-progress achievements
  category: 'scoring' | 'putting' | 'league' | 'social' | 'milestone';
}

export interface PlayerProfile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  handicap: number | null;
  member_since: string;
  total_rounds: number;
  average_score: number | null;
  best_round: number | null;
  c1x_percentage: number | null;
  achievements_count: number;
  recent_achievements: Achievement[];
}

// ── Leaderboard Extended ──
export interface SeasonStanding extends LeaderboardEntry {
  rank_change: number; // positive = moved up, negative = moved down, 0 = same
  dropped_events: number[];
  avatar_url: string | null;
}

export interface PuttingLeader {
  rank: number;
  player_id: number;
  player_name: string;
  avatar_url: string | null;
  c1x_percentage: number;
  c2_percentage: number;
  total_putts: number;
  strokes_gained_putting: number;
  best_round_putting: number | null;
}

export interface CourseRecord {
  layout_id: number;
  layout_name: string;
  course_name: string;
  best_score: number;
  best_strokes: number;
  record_holder: string;
  record_holder_id: number;
  date: string;
  aces: AceRecord[];
}

export interface AceRecord {
  player_name: string;
  player_id: number;
  hole_number: number;
  distance: number | null;
  date: string;
  disc_used: string | null;
}

export interface PlayerComparison {
  player: PlayerProfile;
  scoring: {
    average_score: number | null;
    best_round: number | null;
    under_par_rounds: number;
    aces: number;
    total_rounds: number;
  };
  putting: {
    c1x_percentage: number | null;
    c2_percentage: number | null;
    strokes_gained_putting: number | null;
  };
  league: {
    season_points: number;
    wins: number;
    podiums: number;
    best_finish: number | null;
  };
}

export interface HeadToHeadResult {
  event_id: number;
  event_name: string;
  event_date: string;
  player1_position: number | null;
  player1_score: number;
  player2_position: number | null;
  player2_score: number;
}

// ── Score Display ──
export type ScoreRelativeToPar = number; // negative = under par

export function getScoreColor(relativeToPar: number): string {
  if (relativeToPar <= -2) return "#7B1FA2"; // eagle
  if (relativeToPar === -1) return "#1B5E20"; // birdie
  if (relativeToPar === 0) return "#424242"; // par
  if (relativeToPar === 1) return "#E65100"; // bogey
  return "#B71C1C"; // double+
}

export function getScoreLabel(relativeToPar: number): string {
  if (relativeToPar <= -3) return "Albatross";
  if (relativeToPar === -2) return "Eagle";
  if (relativeToPar === -1) return "Birdie";
  if (relativeToPar === 0) return "Par";
  if (relativeToPar === 1) return "Bogey";
  if (relativeToPar === 2) return "Double";
  return `+${relativeToPar}`;
}
