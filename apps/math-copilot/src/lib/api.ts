import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("math_copilot_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("math_copilot_token");
      localStorage.removeItem("math_copilot_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  level: string;
  sessions_count: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  level: string;
}

export interface MathSession {
  id: string;
  session_type: "solve" | "explore" | "practice";
  subject: string;
  level: string;
  model_name: string;
  input_text: string;
  output_text?: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms?: number;
  is_saved: string;
  saved_title?: string;
  created_at: string;
}

export interface SubjectInfo {
  key: string;
  label: string;
  icon: string;
  color: string;
  topics: string[];
}

export interface ProgressData {
  total_sessions: number;
  sessions_this_week: number;
  subjects_practiced: string[];
  recent_sessions: MathSession[];
  topic_progress: {
    subject: string;
    topic: string;
    problems_solved: number;
    mastery_score: number;
    last_practiced: string;
  }[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; full_name?: string; role?: string; level?: string }) =>
    api.post<TokenResponse>("/auth/register", data),

  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),
};

// ── Math ─────────────────────────────────────────────────────────────────────

export const mathApi = {
  solve: (data: {
    problem: string;
    subject?: string;
    level?: string;
    style?: string;
    model_name?: string;
    max_tokens?: number;
  }) => api.post<MathSession>("/math/solve", data, { timeout: 200_000 }),

  explore: (data: {
    topic: string;
    subject?: string;
    level?: string;
    example_count?: number;
    model_name?: string;
    max_tokens?: number;
  }) => api.post<MathSession>("/math/explore", data, { timeout: 200_000 }),

  practice: (data: {
    subject?: string;
    topic?: string;
    level?: string;
    count?: number;
    difficulty?: string;
    model_name?: string;
    max_tokens?: number;
  }) => api.post<MathSession>("/math/practice", data, { timeout: 200_000 }),

  history: (params?: { limit?: number; session_type?: string }) =>
    api.get<MathSession[]>("/math/history", { params }),

  progress: () => api.get<ProgressData>("/math/progress"),

  subjects: () => api.get<{ subjects: SubjectInfo[] }>("/math/subjects"),
};

export default api;
