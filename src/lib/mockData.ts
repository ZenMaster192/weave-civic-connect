// Mock in-memory + localStorage data so the prototype feels end-to-end.
export type Role = "citizen" | "volunteer" | "ngo";
export type IssueStatus = "unresolved" | "assigned" | "in_progress" | "resolved";

export type MockUser = {
  name: string;
  role: Role;
  email: string;
  org?: string;
  tier?: "Seed" | "Thread" | "Weaver" | "Catalyst" | "Luminary";
  xp?: number;
};

export type Issue = {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  location: string;
  lat: number;
  lng: number;
  beforeImage: string;
  afterImage?: string;
  status: IssueStatus;
  citizen: string;
  volunteer?: string;
  createdAt: string;
  resolvedAt?: string;
  rating?: number;
  review?: string;
};

const SESSION_KEY = "weave_session";

export function setSession(u: MockUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}
export function getSession(): MockUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export const TIERS = ["Seed", "Thread", "Weaver", "Catalyst", "Luminary"] as const;
export const tierFor = (xp: number) =>
  xp >= 2000 ? "Luminary" : xp >= 1000 ? "Catalyst" : xp >= 400 ? "Weaver" : xp >= 100 ? "Thread" : "Seed";

export const SKILLS = [
  "Plumbing", "Electrical", "Teaching", "Waste Management", "IT Support",
  "Construction", "Healthcare", "Emergency Response", "Animal Rescue",
  "Carpentry", "Sanitation", "Tree Care", "Road Repair", "Community Outreach",
];

export const MOCK_ISSUES: Issue[] = [
  {
    id: "ISS-001",
    title: "Overflowing garbage near market",
    description: "Pile of garbage uncleared for 4 days, attracting stray dogs.",
    category: "Sanitation",
    keywords: ["garbage", "waste", "market", "stray"],
    location: "MG Road Market, Pune",
    lat: 18.5204, lng: 73.8567,
    beforeImage: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&q=70",
    status: "in_progress",
    citizen: "Anjali Mehta",
    volunteer: "Ravi Kumar",
    createdAt: "2025-04-12T09:14:00Z",
  },
  {
    id: "ISS-002",
    title: "Broken streetlight on Lane 4",
    description: "Streetlight has been out for 2 weeks, road is unsafe at night.",
    category: "Electrical",
    keywords: ["streetlight", "electrical", "safety"],
    location: "Koregaon Park Lane 4, Pune",
    lat: 18.5362, lng: 73.8939,
    beforeImage: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=70",
    status: "unresolved",
    citizen: "Anjali Mehta",
    createdAt: "2025-04-15T18:42:00Z",
  },
  {
    id: "ISS-003",
    title: "Pothole near school entrance",
    description: "Large pothole causing daily accidents to scooter riders.",
    category: "Road Repair",
    keywords: ["pothole", "road", "school"],
    location: "Aundh Main Rd, Pune",
    lat: 18.5590, lng: 73.8076,
    beforeImage: "https://images.unsplash.com/photo-1597007030739-6d2e7172ee6c?w=800&q=70",
    afterImage: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800&q=70",
    status: "resolved",
    citizen: "Anjali Mehta",
    volunteer: "Priya Shah",
    createdAt: "2025-04-02T10:20:00Z",
    resolvedAt: "2025-04-09T16:00:00Z",
    rating: 5,
    review: "Quick and clean work, road feels much safer now.",
  },
  {
    id: "ISS-004",
    title: "Stray dog injured near park",
    description: "Limping dog needs urgent rescue and vet care.",
    category: "Animal Rescue",
    keywords: ["animal", "rescue", "dog"],
    location: "Sahakar Nagar Park, Pune",
    lat: 18.4810, lng: 73.8533,
    beforeImage: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=800&q=70",
    status: "assigned",
    citizen: "Rahul Bose",
    volunteer: "Ravi Kumar",
    createdAt: "2025-04-17T07:05:00Z",
  },
];

export const MOCK_NGO_MEMBERS = [
  { name: "Ravi Kumar", role: "Field Lead", xp: 1240, tier: "Catalyst", avatar: "RK" },
  { name: "Priya Shah", role: "Volunteer", xp: 820, tier: "Weaver", avatar: "PS" },
  { name: "Imran Sheikh", role: "Volunteer", xp: 410, tier: "Weaver", avatar: "IS" },
  { name: "Neha Joshi", role: "Volunteer", xp: 240, tier: "Thread", avatar: "NJ" },
  { name: "Arjun Patil", role: "New", xp: 60, tier: "Seed", avatar: "AP" },
];

export const MOCK_LEADERBOARD = [
  { name: "Sara Khan", xp: 2480, rating: 4.9, tier: "Luminary" },
  { name: "Ravi Kumar", xp: 1240, rating: 4.7, tier: "Catalyst" },
  { name: "Priya Shah", xp: 820, rating: 4.8, tier: "Weaver" },
  { name: "Imran Sheikh", xp: 410, rating: 4.5, tier: "Weaver" },
  { name: "Neha Joshi", xp: 240, rating: 4.3, tier: "Thread" },
];
