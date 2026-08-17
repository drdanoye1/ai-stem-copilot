import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 120_000,   // 2 min — AI model calls can take 30-60s
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

// ── Error helpers ─────────────────────────────────────────────────────────────

/**
 * Extract a user-safe message from an axios error.
 * Raw API/provider details are never exposed — only the sanitised message
 * the backend placed in detail.message, or a generic fallback.
 */
export function getErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Something went wrong. Please try again.";
  const e = err as Record<string, unknown>;

  // Backend structured error: { detail: { code, message } }
  const detail = (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  if (detail && typeof detail === "object" && "message" in (detail as object)) {
    return (detail as { message: string }).message;
  }
  // Backend plain string detail
  if (typeof detail === "string" && detail.length < 120) return detail;

  // HTTP status-based fallback
  const status = (e as { response?: { status?: number } }).response?.status;
  if (status === 503) return "The AI service is temporarily busy. Please try again in a few moments.";
  if (status === 429) return "The AI service is temporarily busy. Please try again in a few moments.";
  if (status === 500) return "Something went wrong. Please try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have permission to perform this action.";

  // Network / timeout
  const code = (e as { code?: string }).code;
  if (code === "ECONNABORTED" || code === "ERR_NETWORK") return "Connection timed out. Please check your network and try again.";

  return "Something went wrong. Please try again.";
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  level: string;
  // Optional, only meaningful for levels with sub-tiers (middle_school,
  // high_school, college, university) — e.g. "grade_9", "year_2". Lets an
  // account (especially a parent tracking a learner's educational path)
  // record a precise grade/year, not just the broad Education Level.
  grade_year?: string | null;
  // Curriculum ground truth — see lib/personalization-taxonomy.ts for the
  // full registry. curriculum_track only applies to the handful of
  // curricula with a real sub-track (e.g. IB DP SL/HL, Cambridge IGCSE
  // Core/Extended).
  curriculum?: string | null;
  curriculum_track?: string | null;
  // Gates the onboarding wizard — true for every account that existed
  // before the wizard shipped (backfilled by migration 006).
  has_completed_onboarding?: boolean;
  plan?: string;          // "free" | "pro" | "enterprise" — set by admin
  // Personalization context — see AI Personalization Context Engine. All
  // optional on the frontend type (rather than required, as the backend's
  // UserOut has them) because login/register/oauth responses build a User
  // object by hand from a slimmer TokenResponse that doesn't carry these —
  // they only arrive once /auth/me is fetched. Treat undefined the same as
  // "not yet chosen" (career_interest/learning_goal) or "on" (personalization_enabled).
  career_interest?: string | null;
  career_specialization?: string | null;
  learning_goal?: string | null;
  personalization_enabled?: boolean;
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

export interface VizHint {
  type: "function_graph" | "parametric" | "statistics_chart" | "surface_3d" | "geometry" | "number_line" | "none";
  title?: string;
  // function_graph
  expressions?: string[];
  x_range?: [number, number];
  y_range?: [number, number];
  labels?: string[];
  // statistics_chart
  chart_type?: "bar" | "histogram" | "normal_dist" | "scatter";
  data?: number[];
  categories?: string[];
  // surface_3d
  expression?: string;
  // geometry
  geogebra_applet?: string;
  geogebra_commands?: string;
}

export interface MathSession {
  id: string;
  session_type: "solve" | "explore" | "practice" | "theory";
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
  save_title?: string;
  token_count?: number;
  extra?: {
    visualization_hints?: VizHint;
    theory_level?: string;
    curriculum?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface LearningObjective {
  objective: string;
  bloom: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  description: string;
}

export interface ObjectivesResponse {
  topic: string;
  objectives: LearningObjective[];
}

export interface VizCard {
  title: string;
  description: string;
  hint: VizHint;
}
export interface VisualizeResponse {
  topic: string;
  charts: VizCard[];
}

export interface SimParam {
  name: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}
export interface SimObservation {
  parameter: string;
  effect: string;
}
export interface SimulateResponse {
  topic: string;
  expression: string;
  parameters: SimParam[];
  x_range: [number, number];
  y_label?: string;
  description: string;
  key_insight: string;
  what_to_observe: SimObservation[];
}

export interface Application {
  title: string;
  field: string;
  icon: string;
  problem: string;
  math_connection: string;
  formula?: string;
  example: string;
  careers: string[];
  image_url?: string;
}
export interface ApplicationsResponse {
  topic: string;
  applications: Application[];
}

export interface ScenarioResponse {
  topic: string;
  problem_prompt: string;
  problem_description: string;
  problem_equations?: string[];
  problem_image_url: string;
  solution_prompt: string;
  solution_description: string;
  solution_equations?: string[];
  solution_image_url: string;
}


export interface MentorMessage {
  role: "user" | "assistant" | "mentor";
  content: string;
  svg_diagram?: string;
  created_at?: string;
}

/** MentorSession — shape returned by /math/mentor endpoints */
export interface MentorSession {
  session_id: string;
  topic: string;
  subject: string;
  level: string;
  curriculum?: string;
  messages: MentorMessage[];
  turn_count: number;
  is_complete: boolean;
  completion_insight?: string;
}

export interface MentorConversation {
  id: string;
  subject: string;
  level: string;
  messages: MentorMessage[];
  created_at: string;
}

export interface ProgressData {
  streak: number;
  all_sessions: MathSession[];
  saved_sessions: MathSession[];
}

export interface DataPoint {
  label: string;
  value: number;
  year?: number;
}

export interface DataResult {
  source: string;
  indicator: string;
  indicator_name?: string;
  country?: string;
  location?: string;
  unit?: string;
  data: DataPoint[];
  analysis?: string;
  stats: { mean: number; median: number; std: number; min: number; max: number; count: number };
  regression: { r_squared: number; slope: number; intercept: number };
}
// ── Data Explorer type aliases ────────────────────────────────────────────────
export type RealDataPoint = DataPoint;
export type FetchDataResponse = DataResult;
export interface AnalyzeDataResponse {
  analysis: string;
  insights?: string[];
  summary?: string;
}
export interface DataSource {
  key: string;
  label: string;
  icon?: string;
  description?: string;
  proOnly?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number;
  created_at: string;
}

export interface ProjectStep {
  step: number;
  instruction: string;
  hint?: string;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
}

export interface DiscoveryProject {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  tags: string[];
  difficulty: number;
  estimated_hours: number;
  steps_json: ProjectStep[];
  rubric_json: RubricCriterion[];
  created_at?: string;
}

export interface RubricScore {
  criterion: string;
  score: number;
  comment: string;
}

export interface ProjectFeedback {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  rubric_scores: RubricScore[];
  next_steps?: string;
}

export interface ProjectSubmission {
  project_id: string;
  student_work: string;
  feedback?: string;
  score?: number;
}

// ── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; full_name: string; level: string }) =>
    api.post<TokenResponse>("/auth/register", data),

  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),

  updateProfile: (data: {
    full_name?: string;
    level?: string;
    grade_year?: string;
    curriculum?: string;
    curriculum_track?: string;
    has_completed_onboarding?: boolean;
    career_interest?: string;
    career_specialization?: string;
    learning_goal?: string;
    personalization_enabled?: boolean;
  }) => api.patch<User>("/auth/profile", data),

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post("/auth/reset-password", { token, password }),
};

// ── Math API ─────────────────────────────────────────────────────────────────

export interface ParentSummary {
  learner_email: string;
  learner_name: string;
  learner_level: string;
  member_since: string;
  total_sessions: number;
  sessions_this_week: number;
  daily_activity: Array<{ date: string; sessions: number }>;
  subject_breakdown: Array<{ subject: string; count: number }>;
  recent_sessions: Array<{
    id: string;
    session_type: string;
    input_text?: string;
    created_at: string;
  }>;
}

export interface SubjectInfo {
  key: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

export const mathApi = {
  solve: (data: {
    problem: string; subject: string; level: string;
    sublevel?: string; style?: string; curriculum?: string; curriculum_track?: string; ai_mode?: string; max_tokens?: number;
  }) => api.post<MathSession>("/math/solve", data),

  explore: (data: {
    topic: string; subject: string; level: string;
    sublevel?: string; curriculum?: string; curriculum_track?: string; ai_mode?: string;
    example_count?: number; max_tokens?: number;
  }) => api.post<MathSession>("/math/explore", data),

  practice: (data: {
    topic: string; subject: string; level: string;
    sublevel?: string; curriculum?: string; curriculum_track?: string; difficulty?: string;
    count?: number; ai_mode?: string; max_tokens?: number;
  }) => api.post<MathSession>("/math/practice", data),

  theory: (data: {
    topic: string; subject: string; level: string;
    sublevel?: string; theory_level?: string; curriculum?: string; curriculum_track?: string; ai_mode?: string; max_tokens?: number;
  }) => api.post<MathSession>("/math/theory", data),

  objectives: (data: {
    topic: string; subject: string; level: string;
    curriculum?: string; curriculum_track?: string; ai_mode?: string; max_tokens?: number;
  }) => api.post<ObjectivesResponse>("/math/objectives", data),

  reformulate: (data: {
    topic?: string; subject: string; level: string;
    curriculum?: string; curriculum_track?: string; context?: string; ai_mode?: string; raw_input?: string;
  }) => api.post<{ suggestions: string[] }>("/math/reformulate", data),

  scenario: (data: {
    topic: string; subject: string; level: string;
    ai_mode?: string; max_tokens?: number; curriculum?: string; curriculum_track?: string;
    image_mode?: string;  // "diagram" (default) | "creative"
  }) => api.post<ScenarioResponse>("/math/scenario", data),

  visualize: (data: {
    topic: string; subject: string; level: string; curriculum?: string; curriculum_track?: string; ai_mode?: string; max_tokens?: number;
  }) => api.post<VisualizeResponse>("/math/visualize", data),

  simulate: (data: {
    topic: string; subject: string; level: string; ai_mode?: string; curriculum?: string; curriculum_track?: string; max_tokens?: number;
  }) => api.post<SimulateResponse>("/math/simulate", data),

  applications: (data: {
    topic: string; subject: string; level: string; curriculum?: string; curriculum_track?: string; ai_mode?: string; image_mode?: string; max_tokens?: number;
  }) => api.post<ApplicationsResponse>("/math/applications", data),

  mentor: {
    start: (data: { subject: string; level: string }) =>
      api.post<MentorConversation>("/math/mentor/start", data),
    send: (id: string, data: { message: string; ai_mode?: string }) =>
      api.post<MentorConversation>(`/math/mentor/${id}/message`, data),
    list: () => api.get<MentorConversation[]>("/math/mentor"),
  },

  progress: () => api.get<ProgressData>("/math/progress"),

  saveSession: (id: string, title: string) =>
    api.post(`/math/sessions/${id}/save`, { title }),

  unsaveSession: (id: string) =>
    api.delete(`/math/sessions/${id}/save`),

  deleteSession: (id: string) =>
    api.delete(`/math/sessions/${id}`),

  savedSessions: () => api.get<MathSession[]>("/math/sessions/saved"),

  getSaved: (params?: { limit?: number; subject?: string }) =>
    api.get<MathSession[]>("/math/sessions/saved", { params }),

  subjects: () => api.get<{ subjects: SubjectInfo[] }>("/math/subjects"),

  parentSummary: (email?: string) =>
    api.get<ParentSummary>("/math/parent-summary", { params: email ? { email } : undefined }),
};

// ── Data API ──────────────────────────────────────────────────────────────────


// ── Standalone Mentor API (matches mentor/page.tsx interface) ─────────────────

export const mentorApi = {
  start: (data: { topic: string; subject: string; level: string; curriculum?: string; curriculum_track?: string; ai_mode?: string }) =>
    api.post<MentorSession>("/math/mentor/start", data),
  respond: (data: { session_id: string; user_message: string; ai_mode?: string }) =>
    api.post<MentorSession>("/math/mentor/respond", {
      session_id: data.session_id,
      user_message: data.user_message,
      ai_mode: data.ai_mode,
    }),
  list: () => api.get<MentorSession[]>("/math/mentor"),
};

// ── AR/VR Curriculum, Interpretation & Career Context Layer ───────────────────

export interface ArVrInterpretationSections {
  your_result: string;
  mathematical_meaning: string;
  at_your_level: string;
  curriculum_connection: string;
  career_connection: string;
  real_world_application: string;
  career_skill_developed: string;
  try_this_next: string;
}

export interface ArVrInterpretation {
  experience_key: string;
  topic: string;
  education_level?: string;
  curriculum?: string;
  curriculum_track?: string | null;
  career_interest?: string;
  sections: ArVrInterpretationSections;
}

export const arVrApi = {
  interpret: (data: {
    experience_key: string;
    topic: string;
    subject?: string;
    result_summary: string;
    computed_values?: Record<string, unknown>;
    level?: string;
    curriculum?: string;
    curriculum_track?: string;
    ai_mode?: string;
  }) => api.post<ArVrInterpretation>("/ar-vr/interpret", data),
};

export const dataApi = {
  worldBank: (indicator: string, country: string, startYear?: number, endYear?: number) =>
    api.get<DataResult>("/data/world-bank", { params: { indicator, country, start_year: startYear, end_year: endYear } }),

  imf: (indicator: string, country: string) =>
    api.get<DataResult>("/data/imf", { params: { indicator, country } }),

  openMeteo: (latitude: number, longitude: number, variable?: string) =>
    api.get<DataResult>("/data/open-meteo", { params: { latitude, longitude, variable } }),

  nasa: (latitude: number, longitude: number, parameter?: string) =>
    api.get<DataResult>("/data/nasa-power", { params: { latitude, longitude, parameter } }),

  who: (indicator: string, country?: string) =>
    api.get<DataResult>("/data/who", { params: { indicator, country } }),

  fetch: (params: {
    source: string; indicator: string; country?: string; city?: string; years?: number;
  }) => api.post<DataResult>("/math/data/fetch", params),

  analyze: (data: {
    source: string; indicator?: string; indicator_name?: string;
    location?: string; unit?: string;
    data: DataPoint[]; question?: string; subject?: string; model_name?: string;
  }) =>
    api.post<AnalyzeDataResponse>("/math/data/analyze", data),
};

// ── Projects API ──────────────────────────────────────────────────────────────

export const projectsApi = {
  list: (subject?: string, level?: string) =>
    api.get<DiscoveryProject[]>("/math/projects", { params: { subject, level } }),

  get: (id: string) => api.get<DiscoveryProject>(`/math/projects/${id}`),

  submit: (projectId: string, studentWork: string, modelName?: string) =>
    api.post<ProjectFeedback>(`/math/projects/${projectId}/submit`, {
      work_text: studentWork,
      model_name: modelName ?? "gpt-4o",
    }),
};

// ── Personalized Learning Goals, Objectives & Outcomes Plan API ───────────────

export interface LearningGoal {
  id: string;
  curriculum_goal: string;
  learning_objective: string;
  expected_outcome: string;
  application_outcome: string;
  cognitive_target: string;
  success_criterion: string;
  subject: string;
  topic?: string | null;
  career_competency_key?: string | null;
  sort_order: number;
}

export interface LearningPlan {
  id: string;
  learning_aim: string;
  status: string;
  created_at: string;
  goals: LearningGoal[];
}

export const goalsApi = {
  generate: () => api.post<LearningPlan>("/goals/generate"),
  getActive: () => api.get<LearningPlan | null>("/goals/active"),
};

// ── Academic Outcomes, Mastery & Competency Measurement Framework API ─────────

export interface StructuredPracticeProblem {
  id: string;
  problem_text: string;
  difficulty: string;
  subject: string;
  topic?: string | null;
}

export interface PracticeSubmitResult {
  is_correct: boolean;
  grading_method: string;
  solution_steps: string;
  correct_answer: string;
  mastery_state: string;
}

export interface MasteryTopic {
  subject: string;
  topic: string;
  mastery_state: string;
  evidence_count: number;
  independent_correct_count: number;
  last_evidence_at?: string | null;
}

export interface CareerCompetencySummary {
  career_competency_key: string;
  mastery_state: string;
  evidence_count: number;
  independent_correct_count: number;
  last_evidence_at?: string | null;
}

export interface MasteryOverview {
  topics: MasteryTopic[];
  career_competencies: CareerCompetencySummary[];
}

export interface EvidenceEvent {
  id: string;
  source: string;
  subject: string;
  topic?: string | null;
  bloom_level: string;
  independence_level: string;
  confidence: string;
  is_correct?: boolean | null;
  created_at?: string | null;
}

// ── Academic Outcomes / Mastery Dashboard (Part III) ───────────────────────────

export interface TrendWeek {
  week_start: string;
  evidence_count: number;
  independent_correct_count: number;
}

export interface OutcomesDashboard {
  learner_name: string;
  learner_email: string;
  topics: MasteryTopic[];
  career_competencies: CareerCompetencySummary[];
  trends: TrendWeek[];
}

export interface Insight {
  strengths: string;
  opportunities: string;
  next_steps: string;
  generated_at?: string | null;
  model_name: string;
  from_cache: boolean;
}

export const outcomesApi = {
  generateStructuredPractice: (data: {
    subject?: string; topic?: string; level?: string; difficulty?: string;
    curriculum?: string; curriculum_track?: string; ai_mode?: string;
  }) => api.post<StructuredPracticeProblem[]>("/outcomes/practice/structured", data),

  submitPracticeAnswer: (problemId: string, data: { submitted_answer: string; revealed_solution_first?: boolean }) =>
    api.post<PracticeSubmitResult>(`/outcomes/practice/${problemId}/submit`, data),

  getMastery: (learnerEmail?: string) =>
    api.get<MasteryOverview>("/outcomes/mastery", { params: learnerEmail ? { learner_email: learnerEmail } : undefined }),

  getEvidence: (subject: string, topic?: string, learnerEmail?: string) =>
    api.get<EvidenceEvent[]>("/outcomes/evidence", { params: { subject, topic, learner_email: learnerEmail } }),

  getDashboard: (learnerEmail?: string) =>
    api.get<OutcomesDashboard>("/outcomes/dashboard", { params: learnerEmail ? { learner_email: learnerEmail } : undefined }),

  getInsights: (opts?: { learnerEmail?: string; force?: boolean; modelName?: string }) =>
    api.post<Insight>("/outcomes/insights", {
      learner_email: opts?.learnerEmail,
      force: opts?.force ?? false,
      ai_mode: opts?.modelName ?? "smart",
    }),
};

// ── Model Capability Registry (admin/developer visibility) ────────────────────
// Real provider/deployment identities behind each public AI Mode / Image Mode.
// Admin-only — see backend/app/routers/admin.py and services/model_registry.py.

export interface ModelDeployment {
  id: string;
  provider: string;
  model_family: string;
  deployment_id: string;
  capability_class: string;
  public_mode: string | null;
  public_label: string | null;
  status: string;
  priority: string;
  cost_class: string;
  latency_class: string;
  capability_ratings: Record<string, unknown>;
  kind: "text" | "image";
}

export const adminApi = {
  getModels: () =>
    api.get<{ deployments: ModelDeployment[] }>("/admin/models"),
};
