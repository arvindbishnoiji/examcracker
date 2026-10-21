import { APP_CONFIG } from './config';
import { getFreshIdToken } from './firebase';
import { sanitizeQuestionForClient } from './validation';
import type {
  AdminOverviewResponse,
  AnalysisResponse,
  Announcement,
  BootstrapResponse,
  ClassLevel,
  ContentExam,
  ContentKind,
  CourseCatalogItem,
  Enrollment,
  ExamAttempt,
  ExamTrack,
  LeaderboardEntry,
  LessonProgress,
  QuestionReviewItem,
  StudentProfile,
  TestCardItem,
  TestQuestion,
  TestResultSummary,
  PublicSiteConfigResponse,
  SiteSettingKey,
  SiteSettingRow,
  AdminActivityEntry,
  AdminAnalyticsResponse,
  AdminEnrollmentRow,
  AdminEnrollmentListResponse,
  AdminStudentDirectoryResponse,
  EnrollmentBulkResult,
  EnrollmentHistoryEvent,
  EnrollmentRule,
  EnrollmentScope,
  LibraryItem,
  LibraryItemType,
} from '@/types';

export class ApiError extends Error {
  status: number;
  detail?: string;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, detail?: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

let sessionExpiredHandler: (() => void) | null = null;

export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null;
  };
}

async function requestApi<T>(
  route: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    publicRoute?: boolean;
    retryOn401?: boolean;
    baseUrl?: string;
  } = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    publicRoute = false,
    retryOn401 = true,
  } = options;

  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  // All application data is served by the same-origin Cloudflare API, which
  // accesses D1 through the bound database. Firebase remains the auth provider.
  const baseUrl = options.baseUrl || APP_CONFIG.apiBaseUrl;
  const url = `${baseUrl}${normalizedRoute}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!publicRoute) {
    const token = await getFreshIdToken(false);
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(
      'Unable to reach the Exam Cracker server. Check your internet connection and try again.',
      0,
      msg
    );
  }

  if (response.status === 401 && !publicRoute && retryOn401) {
    try {
      const refreshedToken = await getFreshIdToken(true);
      headers.Authorization = `Bearer ${refreshedToken}`;
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      if (sessionExpiredHandler) sessionExpiredHandler();
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
  }

  let payload: Record<string, unknown> = {};
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { raw: text } as Record<string, unknown>;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && sessionExpiredHandler) {
      sessionExpiredHandler();
    }
    const errMsg =
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const detail = typeof payload.detail === 'string' ? payload.detail : undefined;
    throw new ApiError(errMsg, response.status, detail, payload);
  }

  return payload as unknown as T;
}

function redactCourseCatalogList(items: CourseCatalogItem[]): CourseCatalogItem[] {
  return (items || []).map((item) => {
    const copy: CourseCatalogItem = { ...item };
    const hasAccessCode = Boolean(
      copy.hasAccessCode ||
        copy.access_code ||
        (copy.metadata &&
          ((copy.metadata as Record<string, unknown>).requiresAccessCode ||
            (copy.metadata as Record<string, unknown>).hasAccessCode))
    );
    delete copy.access_code;
    (copy as unknown as Record<string, unknown>).hasAccessCode = hasAccessCode;

    if (
      copy.kind === 'test' &&
      copy.metadata &&
      Array.isArray((copy.metadata as { questions?: TestQuestion[] }).questions)
    ) {
      const questions = (copy.metadata as { questions: TestQuestion[] }).questions;
      copy.metadata = {
        ...copy.metadata,
        questions: questions.map((q, idx) => sanitizeQuestionForClient(q, idx)),
      };
    }
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Public & Student API endpoints
// ---------------------------------------------------------------------------

export async function checkApiHealth(): Promise<{
  ok: boolean;
  service: string;
  firebaseProjectId: string;
}> {
  return requestApi('/health', { publicRoute: true });
}

export async function getStudentProfile(): Promise<StudentProfile | null> {
  const res = await requestApi<{ profile: StudentProfile | null }>('/profile');
  return res.profile || null;
}

export async function saveStudentProfile(input: {
  displayName: string;
  exam: ExamTrack;
  classLevel: ClassLevel;
  avatarUrl?: string | null;
}): Promise<StudentProfile> {
  const res = await requestApi<{ profile: StudentProfile }>('/profile', {
    method: 'POST',
    body: {
      displayName: input.displayName.trim(),
      exam: input.exam,
      classLevel: input.classLevel,
      avatarUrl: input.avatarUrl,
    },
  });
  return res.profile;
}

export async function getBootstrapData(): Promise<BootstrapResponse> {
  const res = await requestApi<BootstrapResponse>('/bootstrap');
  return {
    needsOnboarding: Boolean(res.needsOnboarding),
    profile: res.profile || null,
    content: redactCourseCatalogList(res.content || []),
    announcements: res.announcements || [],
    enrollments: res.enrollments || undefined,
  };
}

export async function getCatalogContent(params: {
  kind?: ContentKind;
  exam?: ExamTrack;
  classLevel?: ClassLevel;
  parentId?: string;
}): Promise<CourseCatalogItem[]> {
  const query = new URLSearchParams();
  if (params.kind) query.set('kind', params.kind);
  if (params.exam) query.set('exam', params.exam);
  if (params.classLevel) query.set('class', params.classLevel);
  if (params.parentId) query.set('parentId', params.parentId);
  const qs = query.toString();
  const res = await requestApi<{ items: CourseCatalogItem[] }>(
    `/content${qs ? `?${qs}` : ''}`
  );
  return redactCourseCatalogList(res.items || []);
}

export async function checkParentEnrollmentOnServer(
  parentId: string
): Promise<{ enrolled: boolean; lectures: CourseCatalogItem[] }> {
  try {
    const lectures = await getCatalogContent({ kind: 'lecture', parentId });
    return { enrolled: true, lectures };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { enrolled: false, lectures: [] };
    }
    throw err;
  }
}

export async function enrollInBatchOrSeries(input: {
  itemType: 'batch' | 'series';
  itemId: string;
  accessCode?: string;
}): Promise<{ enrolled: boolean; enrollment: Enrollment }> {
  const body: Record<string, string> = {
    itemType: input.itemType,
    itemId: input.itemId,
  };
  if (input.accessCode !== undefined && input.accessCode.trim() !== '') {
    body.accessCode = input.accessCode.trim();
  }
  const res = await requestApi<{ enrolled?: boolean; enrollment: Enrollment }>(
    '/enrollments',
    {
      method: 'POST',
      body,
    }
  );
  return {
    enrolled: true,
    enrollment: res.enrollment,
  };
}

export async function saveLessonProgress(input: {
  lectureId: string;
  watchedSeconds: number;
  completed: boolean;
}): Promise<LessonProgress> {
  const res = await requestApi<{ progress: LessonProgress }>('/progress', {
    method: 'POST',
    body: {
      lectureId: input.lectureId,
      watchedSeconds: Math.max(0, Math.round(input.watchedSeconds)),
      completed: Boolean(input.completed),
    },
  });
  return res.progress;
}

export async function getStudentTests(): Promise<TestCardItem[]> {
  const res = await requestApi<{ items: TestCardItem[] }>('/tests');
  return res.items || [];
}

export async function getTestForAttempt(testId: string): Promise<{
  test: TestCardItem;
  questions: TestQuestion[];
}> {
  const res = await requestApi<{
    test: TestCardItem;
    questions: TestQuestion[];
  }>(`/tests/${encodeURIComponent(testId)}`);
  return {
    test: res.test,
    questions: (res.questions || []).map((q, idx) => sanitizeQuestionForClient(q, idx)),
  };
}

export async function submitTestAttempt(
  testId: string,
  answers: Record<string, string>
): Promise<{
  attempt: ExamAttempt;
  result: TestResultSummary;
  review: QuestionReviewItem[];
}> {
  return requestApi(`/tests/${encodeURIComponent(testId)}/submit`, {
    method: 'POST',
    body: { answers },
  });
}

export async function getSubmittedTestResult(testId: string): Promise<{
  attempt: ExamAttempt;
  result: TestResultSummary;
  review: QuestionReviewItem[];
}> {
  return requestApi(`/tests/${encodeURIComponent(testId)}/result`);
}

export async function getTestLeaderboard(testId: string): Promise<{
  testId: string | null;
  items: LeaderboardEntry[];
}> {
  const query = new URLSearchParams();
  if (testId) query.set('testId', testId);
  const qs = query.toString();
  return requestApi(`/leaderboard${qs ? `?${qs}` : ''}`);
}

export async function getStudentAnalysis(): Promise<AnalysisResponse> {
  return requestApi<AnalysisResponse>('/analysis');
}

// ---------------------------------------------------------------------------
// Admin API endpoints (server-verified against arvinddarabishnoi@gmail.com)
// ---------------------------------------------------------------------------

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  return requestApi<AdminOverviewResponse>('/admin/overview');
}

export async function getAdminStudents(): Promise<StudentProfile[]> {
  const res = await requestApi<{ items: StudentProfile[] }>('/admin/students');
  return res.items || [];
}

export async function getAdminContentList(params?: {
  kind?: ContentKind | '';
  exam?: ContentExam | '';
  classLevel?: ClassLevel | '';
}): Promise<CourseCatalogItem[]> {
  const query = new URLSearchParams();
  if (params?.kind) query.set('kind', params.kind);
  if (params?.exam) query.set('exam', params.exam);
  if (params?.classLevel) query.set('class', params.classLevel);
  const qs = query.toString();
  const res = await requestApi<{ items: CourseCatalogItem[] }>(
    `/admin/content${qs ? `?${qs}` : ''}`
  );
  return res.items || [];
}

export interface AdminContentPayload {
  kind: ContentKind;
  title: string;
  description: string;
  exam: ContentExam;
  classes: ClassLevel[];
  active: boolean;
  accessCode?: string | null;
  metadata: Record<string, unknown>;
}

export async function createAdminContent(
  payload: AdminContentPayload
): Promise<CourseCatalogItem> {
  const res = await requestApi<{ item: CourseCatalogItem }>('/admin/content', {
    method: 'POST',
    body: payload,
  });
  return res.item;
}

export async function updateAdminContent(
  id: string,
  payload: AdminContentPayload
): Promise<CourseCatalogItem> {
  const res = await requestApi<{ item: CourseCatalogItem }>(
    `/admin/content/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: payload,
    }
  );
  return res.item;
}

export async function disableAdminContent(id: string): Promise<{
  item: { id: string; kind: ContentKind; title: string; active: boolean };
  disabled: boolean;
}> {
  return requestApi(`/admin/content/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getAdminAnnouncements(): Promise<Announcement[]> {
  const res = await requestApi<{ items: Announcement[] }>('/admin/announcements');
  return res.items || [];
}

export interface AdminAnnouncementPayload {
  title: string;
  body: string;
  audience: string;
  active: boolean;
  scheduledAt?: string | null;
}

export async function createAdminAnnouncement(
  payload: AdminAnnouncementPayload
): Promise<Announcement> {
  const res = await requestApi<{ item: Announcement }>('/admin/announcements', {
    method: 'POST',
    body: {
      title: payload.title.trim(),
      body: payload.body.trim(),
      audience: payload.audience || 'All',
      active: payload.active,
      scheduledAt: payload.scheduledAt || null,
    },
  });
  return res.item;
}

export async function updateAdminAnnouncement(
  id: string,
  payload: AdminAnnouncementPayload
): Promise<Announcement> {
  const res = await requestApi<{ item: Announcement }>(
    `/admin/announcements/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: {
        title: payload.title.trim(),
        body: payload.body.trim(),
        audience: payload.audience || 'All',
        active: payload.active,
        scheduledAt: payload.scheduledAt || null,
      },
    }
  );
  return res.item;
}

// ---------------------------------------------------------------------------
// Persisted site configuration (admin CMS)
// ---------------------------------------------------------------------------

export async function getPublicSiteConfig(): Promise<PublicSiteConfigResponse> {
  try {
    return await requestApi<PublicSiteConfigResponse>('/public/site', {
      publicRoute: true,
      retryOn401: false,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return { config: {}, publishedAt: {}, degraded: true };
    }
    throw error;
  }
}

export async function getAdminSiteSettings(): Promise<SiteSettingRow[]> {
  const res = await requestApi<{ items: SiteSettingRow[] }>('/admin/site-settings');
  return res.items || [];
}

export async function saveAdminSiteSettingDraft<TPayload = unknown>(
  key: SiteSettingKey,
  draft: TPayload
): Promise<SiteSettingRow> {
  const res = await requestApi<{ item: SiteSettingRow }>(
    `/admin/site-settings/${encodeURIComponent(key)}`,
    { method: 'PATCH', body: { draft } }
  );
  return res.item;
}

export async function publishAdminSiteSetting(key: SiteSettingKey): Promise<SiteSettingRow> {
  const res = await requestApi<{ item: SiteSettingRow }>(
    `/admin/site-settings/${encodeURIComponent(key)}/publish`,
    { method: 'POST', body: {} }
  );
  return res.item;
}

export async function resetAdminSiteSetting(key: SiteSettingKey): Promise<{ reset: boolean }> {
  return requestApi(`/admin/site-settings/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

export async function getAdminActivity(limit = 100): Promise<AdminActivityEntry[]> {
  const res = await requestApi<{ items: AdminActivityEntry[] }>(
    `/admin/activity?limit=${encodeURIComponent(String(limit))}`
  );
  return res.items || [];
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsResponse> {
  return requestApi<AdminAnalyticsResponse>('/admin/analytics');
}

export async function searchAdminStudents(params?: {
  query?: string;
  exam?: 'JEE' | 'NEET' | '';
  classLevel?: '11' | '12' | '';
  page?: number;
  pageSize?: number;
}): Promise<AdminStudentDirectoryResponse> {
  const query = new URLSearchParams();
  if (params?.query) query.set('query', params.query);
  if (params?.exam) query.set('exam', params.exam);
  if (params?.classLevel) query.set('class', params.classLevel);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return requestApi<AdminStudentDirectoryResponse>(`/admin/students${qs ? `?${qs}` : ''}`);
}

export async function getAdminEnrollmentList(params?: {
  query?: string;
  item?: string;
  itemId?: string;
  itemType?: 'batch' | 'series' | '';
  status?: 'active' | 'revoked' | 'all';
  page?: number;
  pageSize?: number;
}): Promise<AdminEnrollmentListResponse> {
  const query = new URLSearchParams();
  if (params?.query) query.set('query', params.query);
  if (params?.item) query.set('item', params.item);
  if (params?.itemId) query.set('itemId', params.itemId);
  if (params?.itemType) query.set('itemType', params.itemType);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  const res = await requestApi<AdminEnrollmentListResponse>(
    `/admin/enrollments${qs ? `?${qs}` : ''}`
  );
  return {
    items: res.items || [],
    total: res.total || 0,
    page: res.page || params?.page || 1,
    pageSize: res.pageSize || params?.pageSize || 25,
    counts: res.counts || { active: 0, revoked: 0, total: 0 },
    degraded: res.degraded,
  };
}

/** Backwards-compatible helper used by the student directory panel. */
export async function getAdminEnrollments(params?: {
  student?: string;
  item?: string;
}): Promise<AdminEnrollmentRow[]> {
  const res = await getAdminEnrollmentList({
    query: params?.student,
    item: params?.item,
    page: 1,
    pageSize: 100,
  });
  return res.items;
}

export async function createAdminEnrollment(input: {
  studentUid: string;
  itemType: 'batch' | 'series';
  itemId: string;
  respectEligibility?: boolean;
  overrideEligibility?: boolean;
  expiresAt?: string | null;
}): Promise<AdminEnrollmentRow> {
  const res = await requestApi<{ item: AdminEnrollmentRow }>('/admin/enrollments', {
    method: 'POST',
    body: input,
  });
  return res.item;
}

export interface BulkEnrollInput {
  itemType: 'batch' | 'series';
  itemId: string;
  mode: 'selected' | 'all' | 'filter';
  studentUids?: string[];
  exam?: 'JEE' | 'NEET' | '';
  classLevel?: '11' | '12' | '';
  includeFuture?: boolean;
  respectEligibility?: boolean;
  confirmAll?: boolean;
  expiresAt?: string | null;
  dryRun?: boolean;
}

export async function bulkEnrollStudents(input: BulkEnrollInput): Promise<EnrollmentBulkResult> {
  return requestApi<EnrollmentBulkResult>('/admin/enrollments/bulk', {
    method: 'POST',
    body: input,
  });
}

export async function bulkRevokeEnrollments(input: {
  itemType: 'batch' | 'series';
  itemId: string;
  studentUids: string[];
}): Promise<{ revoked: number; failed: number }> {
  return requestApi('/admin/enrollments/bulk-revoke', {
    method: 'POST',
    body: { ...input, confirm: 'REVOKE' },
  });
}

export async function deleteAdminEnrollment(id: string): Promise<{ removed: boolean }> {
  return requestApi(`/admin/enrollments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function restoreAdminEnrollment(
  id: string,
  input?: { expiresAt?: string | null; force?: boolean }
): Promise<AdminEnrollmentRow> {
  const res = await requestApi<{ item: AdminEnrollmentRow }>(
    `/admin/enrollments/${encodeURIComponent(id)}/restore`,
    { method: 'POST', body: input || {} }
  );
  return res.item;
}

export async function getEnrollmentHistory(limit = 120): Promise<EnrollmentHistoryEvent[]> {
  const res = await requestApi<{ items: EnrollmentHistoryEvent[]; unavailable?: boolean }>(
    `/admin/enrollments/history?limit=${encodeURIComponent(String(limit))}`
  );
  return res.items || [];
}

export async function getEnrollmentRules(): Promise<EnrollmentRule[]> {
  const res = await requestApi<{ items: EnrollmentRule[]; unavailable?: boolean }>(
    '/admin/enrollment-rules'
  );
  return res.items || [];
}

export async function setEnrollmentRuleActive(id: string, active: boolean): Promise<EnrollmentRule> {
  const res = await requestApi<{ item: EnrollmentRule }>(
    `/admin/enrollment-rules/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: { active } }
  );
  return res.item;
}

export async function deleteEnrollmentRule(id: string): Promise<{ removed: boolean }> {
  return requestApi(`/admin/enrollment-rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Shape of the 409 payload returned when a wide audience needs confirmation. */
export interface EnrollmentConfirmationError {
  code: 'CONFIRMATION_REQUIRED';
  scope: EnrollmentScope;
  preview: number;
}

// ---------------------------------------------------------------------------
// Student personal library (bookmarks, timestamps notes, recents, challenges)
// ---------------------------------------------------------------------------

export async function getStudentLibrary(): Promise<LibraryItem[]> {
  const res = await requestApi<{ items: LibraryItem[] }>('/library');
  return res.items || [];
}

export async function saveStudentLibraryItem(input: {
  itemType: LibraryItemType;
  itemId: string;
  payload?: Record<string, unknown>;
}): Promise<LibraryItem> {
  const res = await requestApi<{ item: LibraryItem }>('/library', {
    method: 'POST',
    body: {
      itemType: input.itemType,
      itemId: input.itemId,
      payload: input.payload || {},
    },
  });
  return res.item;
}

export async function deleteStudentLibraryItem(
  itemType: LibraryItemType,
  itemId: string
): Promise<{ removed: boolean }> {
  return requestApi(
    `/library/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' }
  );
}


// ---------------------------------------------------------------------------
// Student feedback inbox (stored in Cloudflare D1; Firebase Auth supplies identity)
// ---------------------------------------------------------------------------
export interface StudentFeedbackItem {
  id: string;
  firebase_uid: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  last_message_text?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}
export interface FeedbackMessageItem {
  id: string;
  sender_uid: string;
  sender_role: 'student' | 'admin';
  text: string;
  created_at: string;
  read_at?: string | null;
  is_read?: boolean;
}

export async function getStudentFeedback(): Promise<StudentFeedbackItem[]> {
  const res = await requestApi<{ items: StudentFeedbackItem[] }>('/feedback');
  return res.items || [];
}
export async function submitFeedback(input: { subject: string; category: string; message: string }): Promise<StudentFeedbackItem> {
  const res = await requestApi<{ item: StudentFeedbackItem }>('/feedback', {
    method: 'POST',
    body: { subject: input.subject.trim(), category: input.category, message: input.message.trim() },
  });
  return res.item;
}
export async function getStudentFeedbackThread(id: string): Promise<{ item: StudentFeedbackItem; messages: FeedbackMessageItem[] }> {
  return requestApi(`/feedback/${encodeURIComponent(id)}`);
}
export async function addFeedbackMessage(id: string, message: string): Promise<FeedbackMessageItem[]> {
  const res = await requestApi<{ messages: FeedbackMessageItem[] }>(`/feedback/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: { message: message.trim() },
  });
  return res.messages || [];
}
export interface AdminFeedbackItem extends StudentFeedbackItem {
  display_name?: string | null;
  email?: string | null;
  exam?: ExamTrack | null;
  class_level?: ClassLevel | null;
}
export async function getAdminFeedback(): Promise<AdminFeedbackItem[]> {
  const res = await requestApi<{ items: AdminFeedbackItem[] }>('/admin/feedback');
  return res.items || [];
}
export async function getAdminFeedbackThread(id: string): Promise<{ item: AdminFeedbackItem; messages: FeedbackMessageItem[] }> {
  return requestApi(`/admin/feedback/${encodeURIComponent(id)}`);
}
export async function replyToFeedback(id: string, message: string): Promise<void> {
  await requestApi(`/admin/feedback/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    body: { message: message.trim() },
  });
}
export async function updateFeedbackStatus(id: string, status: 'open' | 'in_progress' | 'resolved'): Promise<void> {
  await requestApi(`/admin/feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
}
