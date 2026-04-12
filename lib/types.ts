export type PlayoffResult =
  | "champion"
  | "runner_up"
  | "semifinal"
  | "quarterfinal"
  | "consolation"
  | "none";

/** Head-to-head record between two managers across all seasons */
export type H2HRecord = {
  wins: number;
  losses: number;
  ties: number;
};

/** All-time career stats for a manager, computed from season standings */
export type ManagerStats = {
  manager_guid: string;
  seasons_played: number;
  total_wins: number;
  total_losses: number;
  total_ties: number;
  win_rate: number;
  championships: number;
  runner_ups: number;
  last_places: number;
  avg_finish: number;
  best_finish: number;
  worst_finish: number;
  total_points_for: number;
};

export type TeamSeason = {
  manager_guid: string;
  team_name: string;
  final_rank: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  playoff_seed: number | null;
  playoff_result: PlayoffResult;
};

export type Season = {
  year: number;
  league_key: string;
  standings: TeamSeason[];
  champion_guid: string | null;
  regular_season_winner_guid: string | null;
  last_place_guid: string | null;
  partial?: boolean;
};

export type Manager = {
  manager_guid: string;
  display_name: string;
  historical_names: string[];
  first_season: number;
  last_season: number;
};

export type LeagueHistory = {
  league_key: string;
  league_name: string;
  num_teams: number;
  seasons_covered: number[];
  fetched_at: string;
  managers: Manager[];
  seasons: Season[];
  /** h2h[guid_a][guid_b] = record of guid_a vs guid_b */
  h2h: Record<string, Record<string, H2HRecord>>;
  leaderboard: ManagerStats[];
};
