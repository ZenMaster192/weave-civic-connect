// src/services/api.ts
// Centralized API connector for Weave Civic Connect
// All calls go through the weaveApi object; auth token is injected automatically.

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────

export type UserRole = "citizen" | "volunteer" | "ngo";
export type IssueStatus = "open" | "in_progress" | "resolved";

export interface AuthToken {
  access_token: string;
  token_type: string;
  user_id: number;
  role: UserRole;
  full_name: string;
  email: string;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  full_name: string;
  role: UserRole;
  skills?: string;
  bio?: string;
  org_name?: string;
  ngo_status?: "pending" | "approved" | "rejected";
  total_resolved: number;
  latitude?: number;
  longitude?: number;
  city?: string;
  created_at: string;
}

export interface Issue {
  id: number;
  uid: string;
  title: string;
  description: string;
  category: string;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  image_url?: string;
  proof_url?: string;
  reporter_id: number;
  reporter_name?: string;
  resolver_id?: number;
  resolver_name?: string;
  assigned_ngo_id?: number;
  required_skills?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface VolunteerMatch {
  issue: Issue;
  distance_km: number;
  skill_match_score: number;
}

export interface NGOMemberStats {
  volunteer_id: number;
  volunteer_name: string;
  total_resolved: number;
  skills?: string;
}

export interface NGOStats {
  total_assigned: number;
  resolved: number;
  in_progress: number;
  open: number;
  resolution_rate: number;
}

// ── Token storage ──────────────────────────────────────────────────────

const TOKEN_KEY = "weave_token";

export function saveToken(token: AuthToken) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function loadToken(): AuthToken | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as AuthToken) : null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return loadToken()?.access_token ?? null;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    skills?: string;
    bio?: string;
    org_name?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
  }) =>
    request<AuthToken>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }, false),

  login: (email: string, password: string) => {
    // OAuth2PasswordRequestForm expects form-encoded body
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return request<AuthToken>("/api/auth/token", {
      method: "POST",
      body: form.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }, false);
  },
};

// ── Users ──────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => request<UserProfile>("/api/users/me"),

  updateMe: (data: Partial<Pick<UserProfile, "full_name" | "bio" | "skills" | "latitude" | "longitude" | "city">>) =>
    request<UserProfile>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getById: (id: number) => request<UserProfile>(`/api/users/${id}`),
};

// ── Issues ─────────────────────────────────────────────────────────────

export const issuesApi = {
  list: (params?: {
    status?: IssueStatus;
    category?: string;
    reporter_id?: number;
    resolver_id?: number;
    assigned_ngo_id?: number;
    city?: string;
    skip?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      });
    }
    return request<Issue[]>(`/api/issues?${qs.toString()}`);
  },

  getById: (id: number) => request<Issue>(`/api/issues/${id}`),

  create: (data: {
    title: string;
    description: string;
    category: string;
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    required_skills?: string;
  }) =>
    request<Issue>("/api/issues", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  uploadImage: (issueId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Issue>(`/api/issues/${issueId}/image`, {
      method: "POST",
      body: form,
    });
  },

  claim: (id: number) =>
    request<Issue>(`/api/issues/${id}/claim`, { method: "PATCH" }),

  resolve: (id: number, proofFile?: File) => {
    const form = new FormData();
    if (proofFile) form.append("proof", proofFile);
    return request<Issue>(`/api/issues/${id}/resolve`, {
      method: "PATCH",
      body: form,
    });
  },
};

// ── Volunteer matching ─────────────────────────────────────────────────

export const matchApi = {
  getNearbyIssues: (radiusKm = 25, limit = 20) =>
    request<VolunteerMatch[]>(
      `/api/match/issues?radius_km=${radiusKm}&limit=${limit}`
    ),
};

// ── NGO ────────────────────────────────────────────────────────────────

export const ngoApi = {
  getMembers: (city?: string) => {
    const qs = city ? `?city=${encodeURIComponent(city)}` : "";
    return request<NGOMemberStats[]>(`/api/ngo/members${qs}`);
  },

  getUnassigned: (city?: string) => {
    const qs = city ? `?city=${encodeURIComponent(city)}` : "";
    return request<Issue[]>(`/api/ngo/unassigned${qs}`);
  },

  assignIssue: (issueId: number) =>
    request<Issue>(`/api/ngo/assign/${issueId}`, { method: "PATCH" }),

  getStats: () => request<NGOStats>("/api/ngo/stats"),
};