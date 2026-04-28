// src/services/api.ts
// Centralized API connector for Weave Civic Connect
// All calls go through the weaveApi object; auth token is injected automatically.

// ── With Vite proxy configured, use relative paths in dev.
// In production, set VITE_API_URL to your deployed backend URL.
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
  is_email_verified?: boolean;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_email_verified: boolean;
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
  impact_score: number;
}

export interface NGOStats {
  total_assigned: number;
  resolved: number;
  in_progress: number;
  open: number;
  resolution_rate: number;
}

export interface DispatchRequest {
  id: number;
  issue_id: number;
  volunteer_id: number;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  score: number;
  created_at: string;
  expires_at: string;
  issue: Issue;
}

export interface Review {
  id: number;
  issue_id: number;
  reviewer_id: number;
  volunteer_id: number;
  rating: number;
  review_text: string;
  after_image_url?: string;
  created_at: string;
}

export interface NGOMembershipRequest {
  id: number;
  volunteer_id: number;
  volunteer_name: string;
  ngo_id: number;
  ngo_name: string;
  initiated_by: "VOLUNTEER" | "NGO";
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  desc: string;
  color: string;
  read: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  name: string;
  xp: number;
  rating: number;
  tier: string;
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
    ...(options.body instanceof FormData || options.body instanceof URLSearchParams
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
    request<AuthToken>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      false
    ),

  login: (email: string, password: string) => {
    // OAuth2PasswordRequestForm expects form-encoded body
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return request<AuthToken>(
      "/api/auth/token",
      {
        method: "POST",
        body: form,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
      false
    );
  },

  verifyEmail: (email: string, otp: string) =>
    request<{ detail: string }>(
      "/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      },
      false
    ),

  resendOtp: (email: string) =>
    request<{ detail: string }>(
      "/api/auth/resend-otp",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
      false
    ),
};

// ── Users ──────────────────────────────────────────────────────────────

export const usersApi = {
  me: () => request<UserProfile>("/api/users/me"),

  updateMe: (
    data: Partial<
      Pick<
        UserProfile,
        | "full_name"
        | "bio"
        | "skills"
        | "latitude"
        | "longitude"
        | "city"
        | "org_name"
      >
    >
  ) =>
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
  getNearbyIssues: (radiusKm = 25, limit = 20, lat?: number, lng?: number) =>{
    const coords = lat != null && lng != null ? `&lat=${lat}&lng=${lng}` : "";
    return request<VolunteerMatch[]>(
      `/api/match/issues?radius_km=${radiusKm}&limit=${limit}${coords}`
    );
  },
};

export const dispatchApi = {
  dispatchIssue: (issueId: number, limit = 5) =>
    request<{ message: string }>(`/api/issues/${issueId}/dispatch?limit=${limit}`, { method: "POST" }),
    
  getPending: () => request<DispatchRequest[]>("/api/volunteer/dispatch/pending"),
  
  accept: (dispatchId: number) =>
    request<Issue>(`/api/volunteer/dispatch/${dispatchId}/accept`, { method: "POST" }),
    
  getActiveIssue: () => request<Issue | null>("/api/volunteer/active-issue"),
};

// ── Reviews ────────────────────────────────────────────────────────────

export const reviewApi = {
  submit: (issueId: number, rating: number, reviewText: string, afterImage?: File) => {
    const form = new FormData();
    form.append("rating", String(rating));
    form.append("review_text", reviewText);
    if (afterImage) form.append("after_image", afterImage);
    return request<Review>(`/api/issues/${issueId}/review`, { method: "POST", body: form });
  },
  
  get: (issueId: number) => request<Review | null>(`/api/issues/${issueId}/review`),
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

  forceAssignMember: (issueId: number, volunteerId: number) =>
    request<{ message: string }>(`/api/ngo/issues/${issueId}/assign-member?volunteer_id=${volunteerId}`, { method: "POST" }),

  getStats: () => request<NGOStats>("/api/ngo/stats"),
  
  discoverVolunteers: (city?: string) => {
    const qs = city ? `?city=${encodeURIComponent(city)}` : "";
    return request<NGOMemberStats[]>(`/api/ngo/discover-volunteers${qs}`);
  },
  
  inviteVolunteer: (volunteerId: number) =>
    request<{ message: string }>(`/api/ngo/membership/invite?volunteer_id=${volunteerId}`, { method: "POST" }),
    
  applyMembership: (ngoId: number) =>
    request<{ message: string }>(`/api/ngo/membership/apply?ngo_id=${ngoId}`, { method: "POST" }),
    
  getRequests: () => request<NGOMembershipRequest[]>("/api/ngo/membership/requests"),
  
  approveRequest: (reqId: number) =>
    request<{ message: string }>(`/api/ngo/membership/${reqId}/approve`, { method: "POST" }),
    
  getMembersActivity: () => request<Issue[]>("/api/ngo/members/activity"),
};

// ── System ─────────────────────────────────────────────────────────────

export const systemApi = {
  getNotifications: () => request<Notification[]>("/api/notifications"),
  
  getLeaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),
  
  markNotificationRead: (id: number) => 
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
};

// ── Geocode ────────────────────────────────────────────────────────────

export interface GeocodeResult {
  address: string;
  city: string;
  display_name: string;
  error?: string;
}

export const geocodeApi = {
  reverse: (lat: number, lng: number) =>
    request<GeocodeResult>(
      `/api/geocode/reverse?lat=${lat}&lng=${lng}`,
      {},
      false  // no auth required
    ),
};
