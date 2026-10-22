export type ExamTrack = 'JEE' | 'NEET';
export type ContentExam = 'JEE' | 'NEET' | 'Both';
export type ClassLevel = '11' | '12' | 'Dropper';
export type ContentKind =
  | 'batch'
  | 'series'
  | 'lecture'
  | 'resource'
  | 'event'
  | 'goal'
  | 'test';

export interface StudentProfile {
  firebase_uid: string;
  display_name: string;
  email: string | null;
  exam: ExamTrack;
  class_level: ClassLevel;
  avatar_url: string | null;
  avatar_file_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalMetadata {
  startsAt?: string | null;
  endsAt?: string | null;
  deepLink?: string;
  ctaLabel?: string;
  priority?: number;
  displayText?: string;
  [key: string]: unknown;
}

export interface BatchMetadata {
  thumbnailUrl?: string;
  codeDisplay?: string;
  instructor?: string;
  subjects?: string[];
  features?: string[];
  requiresAccessCode?: boolean;
  scheduleInfo?: string;
  language?: string;
  [key: string]: unknown;
}

export interface SeriesMetadata {
  thumbnailUrl?: string;
  codeDisplay?: string;
  instructor?: string;
  features?: string[];
  requiresAccessCode?: boolean;
  [key: string]: unknown;
}

export interface LectureMetadata {
  youtubeUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  duration?: string;
  position?: number;
  parentId?: string;
  lesson?: string;
  topic?: string;
  notesPdfUrl?: string;
  isPreview?: boolean;
  playlistId?: string;
  author?: string;
  [key: string]: unknown;
}

export interface ResourceMetadata {
  pdfUrl?: string;
  thumbnailUrl?: string;
  parentId?: string;
  subject?: string;
  topic?: string;
  fileSizeLabel?: string;
  [key: string]: unknown;
}

export interface EventBannerImage {
  url: string;
  alt?: string;
  caption?: string;
  deepLink?: string;
}

export interface EventMetadata {
  images?: EventBannerImage[];
  thumbnailUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  deepLink?: string;
  ctaLabel?: string;
  subtitle?: string;
  [key: string]: unknown;
}

export interface TestQuestionOption {
  id: string;
  text: string;
}

export interface TestQuestion {
  id: string;
  type: 'single-choice';
  text: string;
  imageUrl?: string;
  subject?: string;
  topic?: string;
  options: TestQuestionOption[];
  correctAnswer?: string;
  marks?: number;
  negativeMarks?: number;
  explanation?: string;
}

export interface TestMetadata {
  subject?: string;
  durationMinutes?: number;
  scheduledAt?: string | null;
  endsAt?: string | null;
  isLive?: boolean;
  allowMultipleAttempts?: boolean;
  marksPerQuestion?: number;
  negativeMarks?: number;
  totalQuestions?: number;
  totalMarks?: number;
  thumbnailUrl?: string;
  questions?: TestQuestion[];
  [key: string]: unknown;
}

export interface CourseCatalogItem<TMetadata = Record<string, unknown>> {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  exam: ContentExam;
  classes: ClassLevel[];
  active: boolean;
  access_code?: string | null;
  hasAccessCode?: boolean;
  metadata: TMetadata;
  /** Stable D1 relationship columns (preferred over metadata for filtering). */
  parentId?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  sortOrder?: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectAssignment {
  courseId: string;
  courseTitle: string;
  courseKind: 'batch' | 'series' | 'lecture' | 'resource' | 'event' | 'goal' | 'test';
  lectureCount: number;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  exam: ContentExam;
  classes: ClassLevel[];
  active: boolean;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  assignmentCount?: number;
  lectureCount?: number;
  assignments?: SubjectAssignment[];
}

export interface CourseTreeSubject extends Subject {
  lectures: CourseCatalogItem[];
  resources: CourseCatalogItem[];
  totalLectureCount?: number;
  totalResourceCount?: number;
  lockedLectureCount?: number;
  lockedResourceCount?: number;
}

export interface CourseTreeResponse {
  parent: CourseCatalogItem;
  enrolled: boolean;
  locked: boolean;
  adminPreview?: boolean;
  isFree?: boolean;
  previewCount: number;
  totalLectureCount?: number;
  totalResourceCount?: number;
  lockedLectureCount?: number;
  subjects: CourseTreeSubject[];
  unassigned: {
    id: null;
    name: string;
    lectures: CourseCatalogItem[];
    resources: CourseCatalogItem[];
    totalLectureCount?: number;
    totalResourceCount?: number;
    lockedLectureCount?: number;
  } | null;
}

export interface SubjectQueueProgress {
  watchedSeconds: number;
  completed: boolean;
  updatedAt: string | null;
}

export interface SubjectQueueItem extends CourseCatalogItem<LectureMetadata> {
  progress?: SubjectQueueProgress;
}

export interface SubjectQueueMeta {
  subjectId: string | null;
  subjectName: string | null;
  parentId: string | null;
  totalInSubject: number;
  currentIndex: number;
  previousLectureId: string | null;
  nextLectureId: string | null;
  reason?: string;
}

export interface CatalogItemResponse {
  item: CourseCatalogItem;
  parent: CourseCatalogItem | null;
  subject: { id: string; name: string | null } | null;
  progress?: {
    lectureId: string;
    watchedSeconds: number;
    completed: boolean;
    updatedAt: string | null;
  } | null;
  subjectQueue?: SubjectQueueItem[];
  queueMeta?: SubjectQueueMeta | null;
}

export interface DriveProbeResult {
  ok: boolean;
  httpStatus: number;
  code: string;
  reason?: string;
  detail?: string;
  folderId?: string;
  folderName?: string;
  sharedDrive?: boolean;
  canAddChildren?: boolean;
}

export interface DriveStatusResponse {
  configured: boolean;
  serviceAccountConfigured: boolean;
  serviceAccountEmail: string | null;
  folderIdConfigured: boolean;
  folderId: string | null;
  pdfFolderId: string | null;
  profileFolderId: string | null;
  scope: string;
  scopeWarning: string | null;
  credentialError: string | null;
  probe: DriveProbeResult | null;
}

export interface DriveFileItem {
  id: string;
  purpose: 'profile_photo' | 'pdf';
  mimeType: string;
  displayName: string;
  sizeBytes: number;
  courseId: string | null;
  courseTitle?: string | null;
  subjectId: string | null;
  ownerUid?: string | null;
  uploaderUid?: string | null;
  status: 'active' | 'superseded' | 'deleted' | 'orphan';
  visibility: 'private' | 'authenticated' | 'course';
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  active: boolean;
  scheduled_at: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  firebase_uid?: string;
  item_type: 'batch' | 'series';
  item_id: string;
  active: boolean;
  status?: 'active' | 'revoked' | 'expired';
  source?: string;
  expires_at?: string | null;
  created_at?: string;
}

export interface LessonProgress {
  id?: string;
  firebase_uid?: string;
  lecture_id: string;
  watched_seconds: number;
  completed: boolean;
  updated_at?: string;
}

export interface TestCardItem {
  id: string;
  kind: 'test';
  title: string;
  description: string;
  exam: ContentExam;
  classes: ClassLevel[];
  active: boolean;
  thumbnailUrl: string | null;
  scheduledAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number | null;
  isLive: boolean;
  subject: string | null;
}

export interface QuestionReviewItem {
  questionId: string;
  answer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  explanation: string;
  marksAwarded: number;
}

export interface TestResultSummary {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
}

export interface ExamAttempt {
  id: string;
  firebase_uid?: string;
  test_id: string;
  exam?: ExamTrack;
  class_level?: ClassLevel;
  score: number;
  max_score: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  answers?: {
    submitted?: Record<string, string>;
    review?: QuestionReviewItem[];
  };
  submitted_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  testId: string;
  firebaseUid: string;
  classLevel?: ClassLevel | null;
  name: string;
  avatarUrl: string | null;
  score: number;
  maxScore: number;
  submittedAt: string;
  isCurrentUser?: boolean;
}

export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface AnalysisResponse {
  profile: StudentProfile;
  level: LearningLevel;
  testsTaken: number;
  averagePercentage: number;
  totalScore: number;
  totalMaxScore: number;
  completedLessons: number;
  watchedSeconds: number;
  attempts: ExamAttempt[];
  lessonProgress: LessonProgress[];
}

export interface BootstrapResponse {
  needsOnboarding: boolean;
  profile: StudentProfile | null;
  content: CourseCatalogItem[];
  announcements: Announcement[];
  enrollments?: Enrollment[];
}

export interface AdminOverviewResponse {
  counts: {
    student_profiles: number;
    course_catalog: number;
    exam_attempts: number;
    enrollments: number;
    announcements: number;
    [key: string]: number;
  };
  latestContent: Array<{
    id: string;
    kind: ContentKind;
    title: string;
    exam: ContentExam;
    classes: ClassLevel[];
    active: boolean;
    updated_at: string;
  }>;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderRole: 'student' | 'admin';
  text: string;
  createdAt: string;
  readAt?: string | null;
  isRead?: boolean;
  attachments?: string[];
}

export interface StudentThread {
  id: string;
  studentUid: string;
  studentName?: string;
  studentEmail?: string | null;
  exam?: ExamTrack;
  classLevel?: ClassLevel;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastSenderRole?: 'student' | 'admin';
  unreadByAdmin?: boolean;
  unreadByStudent?: boolean;
  updatedAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  deepLink?: string | null;
  createdAt: string;
  readAt?: string | null;
  isRead?: boolean;
  type?: 'info' | 'test' | 'lecture' | 'feedback' | 'chat' | 'announcement' | 'goal';
}

export interface BroadcastNotice {
  id: string;
  title: string;
  body: string;
  deepLink?: string | null;
  exam?: ContentExam;
  classes?: ClassLevel[];
  active: boolean;
  createdAt: string;
}

export interface CloudflareVideoMetadata {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  provider: string;
  watchUrl: string;
}

export interface CloudflarePlaylistItem {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  position: number;
  watchUrl: string;
  lesson?: string;
  selected?: boolean;
}

export interface CloudflarePlaylistResponse {
  playlistId: string;
  title: string;
  count: number;
  items: CloudflarePlaylistItem[];
  nextCursor: string | null;
  hasMore: boolean;
  youtubeDataApiKeyRequired: boolean;
  note?: string;
}

export * from './site';

export * from './screens';
