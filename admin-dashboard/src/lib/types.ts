export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  role: 'player' | 'moderator' | 'admin' | 'super_admin';
  wallet_address: string | null;
  handicap: number | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rounds_played: number;
}

export interface Course {
  id: number;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  layouts: Layout[];
}

export interface Layout {
  id: number;
  course_id: number;
  name: string;
  holes: number;
  total_par: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'pro';
}

export interface Hole {
  id: number;
  layout_id: number;
  hole_number: number;
  par: number;
  distance: number;
}

export interface Round {
  id: number;
  user_id: number;
  layout_id: number;
  total_score: number;
  total_strokes: number;
  is_practice: boolean;
  completed_at: string | null;
  created_at: string;
  user?: User;
  layout?: Layout;
}

export interface HoleScore {
  id: number;
  round_id: number;
  hole_id: number;
  strokes: number;
  putts: number;
  ob_strokes: number;
}

export interface League {
  id: number;
  name: string;
  season: string;
  league_type: 'singles' | 'doubles';
  points_rule: 'field_size' | 'fixed';
  drop_worst: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
  created_at: string;
  event_count: number;
  player_count: number;
}

export interface Event {
  id: number;
  league_id: number;
  layout_id: number;
  event_date: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  name: string;
  description: string | null;
  fee_usd: number;
  fee_rgdg: number;
  max_players: number | null;
  created_at: string;
  league?: League;
  layout?: Layout;
  checkin_count: number;
  results_count: number;
}

export interface EventCheckin {
  id: number;
  event_id: number;
  user_id: number;
  checked_in_at: string;
  user: User;
}

export interface Result {
  id: number;
  event_id: number;
  user_id: number;
  total_strokes: number;
  total_score: number;
  position: number;
  points_earned: number;
  dnf: boolean;
  dq: boolean;
  user?: User;
}

export interface Prize {
  id: number;
  league_id: number;
  position: number;
  amount_usd: number;
  amount_rgdg: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  tx_type: 'event_fee' | 'prize_payout' | 'mint' | 'transfer';
  amount: number;
  tx_hash: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  user?: User;
}

export interface Achievement {
  id: number;
  user_id: number;
  achievement_type: string;
  earned_at: string;
}

export interface Disc {
  id: number;
  user_id: number;
  name: string;
  manufacturer: string;
  mold: string;
  plastic: string;
  weight: number;
  color: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  status: 'active' | 'lost' | 'found' | 'retired';
  lost_at: string | null;
  found_at: string | null;
  found_by_user_id: number | null;
  notes: string | null;
  created_at: string;
  user?: User;
  found_by_user?: User;
}

export interface LeaderboardEntry {
  position: number;
  user_id: number;
  username: string;
  display_name: string;
  total_points: number;
  events_played: number;
  best_finish: number;
  avatar_url: string | null;
}

export interface DashboardStats {
  active_players: number;
  upcoming_events: number;
  rounds_this_week: number;
  revenue_this_month: number;
  player_growth: number;
  event_growth: number;
  round_growth: number;
  revenue_growth: number;
}

export interface ActivityItem {
  id: string;
  type: 'round_completed' | 'event_created' | 'player_joined' | 'results_finalized' | 'disc_lost' | 'disc_found';
  message: string;
  timestamp: string;
  user?: { username: string; avatar_url: string | null };
}

export interface WeeklyRounds {
  week: string;
  rounds: number;
}

export interface TreasuryStats {
  balance: number;
  total_minted: number;
  total_distributed: number;
  pending_payouts: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
