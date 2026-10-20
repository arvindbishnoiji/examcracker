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

async function requestEdgeFunction<T>(
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
  // Site-platform routes are served by the dedicated `ec-site-api` function so
  // the heavily-used content API stays untouched. Both share auth + database.
  const isSiteApiRoute = ['/public/site', '/admin/site-settings', '/admin/activity', '/admin/analytics', '/admin/enrollments', '/library'].some(
    (prefix) => normalizedRoute === prefix || normalizedRoute.startsWith(`${prefix}/`) || normalizedRoute.startsWith(`${prefix}?`)
  );
  const baseUrl = options.baseUrl || (isSiteApiRoute ? APP_CONFIG.supabase.siteFunctionUrl : APP_CONFIG.supabase.functionUrl);
  const url = `${baseUrl}${normalizedRoute}`;

  const headers: Record<string, string> = {
    apikey: APP_CONFIG.supabase.publishableKey,
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
  return requestEdgeFunction('/health', { publicRoute: true });
}

export async function getStudentProfile(): Promise<StudentProfile | null> {
  const res = await requestEdgeFunction<{ profile: StudentProfile | null }>('/profile');
  return res.profile || null;
}

export async function saveStudentProfile(input: {
  displayName: string;
  exam: ExamTrack;
  classLevel: ClassLevel;
  avatarUrl?: string | null;
}): Promise<StudentProfile> {
  const res = await requestEdgeFunction<{ profile: StudentProfile }>('/profile', {
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
  const res = await requestEdgeFunction<BootstrapResponse>('/bootstrap');
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
  const res = await requestEdgeFunction<{ items: CourseCatalogItem[] }>(
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
  const res = await requestEdgeFunction<{ enrolled?: boolean; enrollment: Enrollment }>(
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
  const res = await requestEdgeFunction<{ progress: LessonProgress }>('/progress', {
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
  const res = await requestEdgeFunction<{ items: TestCardItem[] }>('/tests');
  return res.items || [];
}

export async function getTestForAttempt(testId: string): Promise<{
  test: TestCardItem;
  questions: TestQuestion[];
}> {
  const res = await requestEdgeFunction<{
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
  return requestEdgeFunction(`/tests/${encodeURIComponent(testId)}/submit`, {
    method: 'POST',
    body: { answers },
  });
}

export async function getSubmittedTestResult(testId: string): Promise<{
  attempt: ExamAttempt;
  result: TestResultSummary;
  review: QuestionReviewItem[];
}> {
  return requestEdgeFunction(`/tests/${encodeURIComponent(testId)}/result`);
}

export async function getTestLeaderboard(testId: string): Promise<{
  testId: string | null;
  items: LeaderboardEntry[];
}> {
  const query = new URLSearchParams();
  if (testId) query.set('testId', testId);
  const qs = query.toString();
  return requestEdgeFunction(`/leaderboard${qs ? `?${qs}` : ''}`);
}

export async function getStudentAnalysis(): Promise<AnalysisResponse> {
  return requestEdgeFunction<AnalysisResponse>('/analysis');
}

// ---------------------------------------------------------------------------
// Admin API endpoints (server-verified against arvinddarabishnoi@gmail.com)
// ---------------------------------------------------------------------------

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  return requestEdgeFunction<AdminOverviewResponse>('/admin/overview');
}

export async function getAdminStudents(): Promise<StudentProfile[]> {
  const res = await requestEdgeFunction<{ items: StudentProfile[] }>('/admin/students');
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
  const res = await requestEdgeFunction<{ items: CourseCatalogItem[] }>(
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
  const res = await requestEdgeFunction<{ item: CourseCatalogItem }>('/admin/content', {
    method: 'POST',
    body: payload,
  });
  return res.item;
}

export async function updateAdminContent(
  id: string,
  payload: AdminContentPayload
): Promise<CourseCatalogItem> {
  const res = await requestEdgeFunction<{ item: CourseCatalogItem }>(
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
  return requestEdgeFunction(`/admin/content/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getAdminAnnouncements(): Promise<Announcement[]> {
  const res = await requestEdgeFunction<{ items: Announcement[] }>('/admin/announcements');
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
  const res = await requestEdgeFunction<{ item: Announcement }>('/admin/announcements', {
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
  const res = await requestEdgeFunction<{ item: Announcement }>(
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
    return await requestEdgeFunction<PublicSiteConfigResponse>('/public/site', {
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
  const res = await requestEdgeFunction<{ items: SiteSettingRow[] }>('/admin/site-settings');
  return res.items || [];
}

export async function saveAdminSiteSettingDraft<TPayload = unknown>(
  key: SiteSettingKey,
  draft: TPayload
): Promise<SiteSettingRow> {
  const res = await requestEdgeFunction<{ item: SiteSettingRow }>(
    `/admin/site-settings/${encodeURIComponent(key)}`,
    { method: 'PATCH', body: { draft } }
  );
  return res.item;
}

export async function publishAdminSiteSetting(key: SiteSettingKey): Promise<SiteSettingRow> {
  const res = await requestEdgeFunction<{ item: SiteSettingRow }>(
    `/admin/site-settings/${encodeURIComponent(key)}/publish`,
    { method: 'POST', body: {} }
  );
  return res.item;
}

export async function resetAdminSiteSetting(key: SiteSettingKey): Promise<{ reset: boolean }> {
  return requestEdgeFunction(`/admin/site-settings/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

export async function getAdminActivity(limit = 100): Promise<AdminActivityEntry[]> {
  const res = await requestEdgeFunction<{ items: AdminActivityEntry[] }>(
    `/admin/activity?limit=${encodeURIComponent(String(limit))}`
  );
  return res.items || [];
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsResponse> {
  return requestEdgeFunction<AdminAnalyticsResponse>('/admin/analytics');
}

export async function getAdminEnrollments(params?: {
  student?: string;
  item?: string;
}): Promise<AdminEnrollmentRow[]> {
  const query = new URLSearchParams();
  if (params?.student) query.set('student', params.student);
  if (params?.item) query.set('item', params.item);
  const qs = query.toString();
  const res = await requestEdgeFunction<{ items: AdminEnrollmentRow[] }>(
    `/admin/enrollments${qs ? `?${qs}` : ''}`
  );
  return res.items || [];
}

export async function createAdminEnrollment(input: {
  studentUid: string;
  itemType: 'batch' | 'series';
  itemId: string;
}): Promise<AdminEnrollmentRow> {
  const res = await requestEdgeFunction<{ item: AdminEnrollmentRow }>('/admin/enrollments', {
    method: 'POST',
    body: input,
  });
  return res.item;
}

export async function deleteAdminEnrollment(id: string): Promise<{ removed: boolean }> {
  return requestEdgeFunction(`/admin/enrollments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Student personal library (bookmarks, timestamps notes, recents, challenges)
// ---------------------------------------------------------------------------

export async function getStudentLibrary(): Promise<LibraryItem[]> {
  const res = await requestEdgeFunction<{ items: LibraryItem[] }>('/library');
  return res.items || [];
}

export async function saveStudentLibraryItem(input: {
  itemType: LibraryItemType;
  itemId: string;
  payload?: Record<string, unknown>;
}): Promise<LibraryItem> {
  const res = await requestEdgeFunction<{ item: LibraryItem }>('/library', {
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
  return requestEdgeFunction(
    `/library/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' }
  );
}
