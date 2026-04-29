export type ThemeMode = "dark" | "light";

export type MatchStatus = "live" | "upcoming" | "completed" | "ongoing" | "inactive" | "draft";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Organizer" | "Admin" | "Coach" | "Staff";
  avatar: string;
  notifications: number;
}

export interface Organization {
  id: string;
  name: string;
  country: string;
  city: string;
  website: string;
  plan: string;
  memberSince: string;
}

export interface Tournament {
  id: string;
  name: string;
  sport: "Football";
  type: "Group Stage" | "Knockout" | "Hybrid";
  location: string;
  venue: string;
  startDate: string;
  endDate: string;
  teamsCount: number;
  matchesCount: number;
  liveMatches: number;
  status: "ongoing" | "upcoming" | "completed" | "archived";
  prizePool?: string;
}

export interface Team {
  id: string;
  name: string;
  group: string;
  coach: string;
  stadium: string;
  country: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface Player {
  id: string;
  fullName: string;
  teamId: string;
  team: string;
  position: "GK" | "DF" | "MF" | "FW";
  nationality: string;
  age: number;
  number: number;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  value: string;
}

export interface MatchEvent {
  minute: string;
  type: "goal" | "card" | "sub" | "info";
  player: string;
  detail?: string;
  team: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  tournament: string;
  round: string;
  date: string;
  time: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  liveMinute?: number;
  events?: MatchEvent[];
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  surface: "Natural Grass" | "Artificial Turf";
  status: "active" | "maintenance" | "inactive";
  dimensions: string;
  lighting: "Yes" | "No";
  accessibility: string;
}

export interface StandingRow {
  position: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface StatisticBlock {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  mine?: boolean;
}

export interface MessageThread {
  id: string;
  name: string;
  online?: boolean;
  unread: number;
  preview: string;
  updatedAt: string;
  messages: Message[];
}

export interface SubscriptionPlan {
  name: string;
  priceMonthly: number;
  status: "active" | "inactive";
  features: string[];
  usage: {
    tournaments: string;
    teams: string;
    storage: string;
  };
}

export interface SettingsState {
  theme: ThemeMode;
  density: "compact" | "comfortable";
  accent: "lime" | "teal" | "blue";
  quietHours: {
    enabled: boolean;
    from: string;
    to: string;
  };
}

