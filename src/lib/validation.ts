import type { ClassLevel, ContentExam, ExamTrack, TestQuestion } from '@/types';

export const CLASS_LEVELS: readonly ClassLevel[] = ['11', '12', 'Dropper'] as const;

export function normalizeClassLevel(value: unknown): ClassLevel | null {
  const cleaned = String(value === undefined || value === null ? '' : value).trim();
  if (cleaned === '11' || cleaned === '12') return cleaned;
  if (/^dropper$/i.test(cleaned)) return 'Dropper';
  return null;
}

/**
 * Class access policy:
 * - Class 11 students access Class 11 content on their track.
 * - Class 12 students access Class 12 content on their track.
 * - Dropper students access Class 11, Class 12, and Dropper content on their track.
 */
export function studentEligibleClassLevels(
  classLevel?: ClassLevel | string | null
): ClassLevel[] {
  const normalized = normalizeClassLevel(classLevel);
  if (normalized === 'Dropper') return ['11', '12', 'Dropper'];
  if (normalized === '11' || normalized === '12') return [normalized];
  return [];
}

export function formatClassLevel(classLevel?: string | null): string {
  const normalized = normalizeClassLevel(classLevel);
  if (normalized === 'Dropper') return 'Dropper';
  if (normalized === '11' || normalized === '12') return `Class ${normalized}`;
  return classLevel ? String(classLevel) : '—';
}

export function formatClassList(classes?: readonly string[] | null): string {
  if (!Array.isArray(classes) || classes.length === 0) return 'All classes';
  const normalized = Array.from(
    new Set(classes.map(normalizeClassLevel).filter((c): c is ClassLevel => Boolean(c)))
  );
  if (!normalized.length) return 'All classes';
  return normalized.map((cls) => formatClassLevel(cls)).join(', ');
}

export function inheritChildAudience(
  parent?: { exam?: ContentExam | string | null; classes?: readonly string[] | null } | null,
  subject?: { exam?: ContentExam | string | null; classes?: readonly string[] | null } | null,
  fallback?: { exam?: ContentExam | string | null; classes?: readonly string[] | null } | null
): { exam: ContentExam; classes: ClassLevel[] } {
  const parentExam: ContentExam | null =
    parent?.exam === 'JEE' || parent?.exam === 'NEET' || parent?.exam === 'Both'
      ? parent.exam
      : null;
  const subjectExam: ContentExam | null =
    subject?.exam === 'JEE' || subject?.exam === 'NEET' || subject?.exam === 'Both'
      ? subject.exam
      : null;
  const fallbackExam: ContentExam =
    fallback?.exam === 'JEE' || fallback?.exam === 'NEET' || fallback?.exam === 'Both'
      ? fallback.exam
      : 'JEE';
  const exam: ContentExam =
    parentExam && parentExam !== 'Both'
      ? parentExam
      : subjectExam && subjectExam !== 'Both'
        ? subjectExam
        : parentExam || subjectExam || fallbackExam;

  const parentClasses = Array.isArray(parent?.classes)
    ? parent.classes.map(normalizeClassLevel).filter((c): c is ClassLevel => Boolean(c))
    : [];
  const subjectClasses = Array.isArray(subject?.classes)
    ? subject.classes.map(normalizeClassLevel).filter((c): c is ClassLevel => Boolean(c))
    : [];
  const fallbackClasses = Array.isArray(fallback?.classes)
    ? fallback.classes.map(normalizeClassLevel).filter((c): c is ClassLevel => Boolean(c))
    : [];

  let classes: ClassLevel[];
  if (parentClasses.length && subjectClasses.length) {
    const overlap = parentClasses.filter((cls) => subjectClasses.includes(cls));
    classes = overlap.length ? overlap : parentClasses;
  } else if (parentClasses.length) {
    classes = parentClasses;
  } else if (subjectClasses.length) {
    classes = subjectClasses;
  } else if (fallbackClasses.length) {
    classes = fallbackClasses;
  } else {
    classes = ['11', '12', 'Dropper'];
  }

  return { exam, classes: Array.from(new Set(classes)) };
}

export function isSafeHttpUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const ALLOWED_INTERNAL_PREFIXES = [
  '/',
  '/lectures',
  '/batches',
  '/series',
  '/tests',
  '/leaderboard',
  '/profile',
  '/chat',
  '/feedback',
  '/challenges',
  '/home',
  '/events',
  '/search',
  '/notifications',
  '/onboarding',
  '/admin',
];

export function isValidInternalDeepLink(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  const pathname = trimmed.split('?')[0].split('#')[0];
  if (pathname === '/') return true;
  return ALLOWED_INTERNAL_PREFIXES.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export function matchesStudentExamAndClass(
  item: { exam?: string | null; classes?: string[] | null },
  studentExam: ExamTrack,
  studentClass: ClassLevel
): boolean {
  const examOk = !item.exam || item.exam === 'Both' || item.exam === studentExam;
  if (!examOk) return false;
  if (!Array.isArray(item.classes) || item.classes.length === 0) return true;
  const allowed = studentEligibleClassLevels(studentClass);
  if (!allowed.length) return false;
  return item.classes
    .map((entry) => normalizeClassLevel(entry))
    .filter((entry): entry is ClassLevel => Boolean(entry))
    .some((entry) => allowed.includes(entry));
}

export interface QuestionValidationError {
  row: number;
  questionId: string;
  message: string;
}

export interface QuestionBankValidationResult {
  valid: boolean;
  questions: TestQuestion[];
  errors: QuestionValidationError[];
  globalError?: string;
}

export function validateQuestionsJson(rawJson: string): QuestionBankValidationResult {
  const trimmed = (rawJson || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      questions: [],
      errors: [],
      globalError: 'Paste or upload a JSON question bank before validating.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Invalid JSON syntax';
    return {
      valid: false,
      questions: [],
      errors: [],
      globalError: `JSON syntax error: ${detail}`,
    };
  }

  let rawList: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).questions)
  ) {
    rawList = (parsed as { questions: unknown[] }).questions;
  }

  if (!rawList) {
    return {
      valid: false,
      questions: [],
      errors: [],
      globalError:
        'Root JSON must be an array of question objects or an object containing a "questions" array.',
    };
  }

  if (rawList.length === 0) {
    return {
      valid: false,
      questions: [],
      errors: [],
      globalError: 'The question bank must contain at least 1 question.',
    };
  }

  const errors: QuestionValidationError[] = [];
  const normalizedQuestions: TestQuestion[] = [];
  const seenIds = new Set<string>();

  rawList.forEach((entry, index) => {
    const rowNum = index + 1;
    if (!entry || typeof entry !== 'object') {
      errors.push({
        row: rowNum,
        questionId: `q${rowNum}`,
        message: 'Question entry must be a JSON object.',
      });
      return;
    }

    const q = entry as Record<string, unknown>;
    const qId = String(q.id || `q${rowNum}`).trim();
    if (!qId) {
      errors.push({
        row: rowNum,
        questionId: `q${rowNum}`,
        message: 'Question id cannot be empty.',
      });
      return;
    }
    if (seenIds.has(qId.toLowerCase())) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: `Duplicate question id "${qId}".`,
      });
    }
    seenIds.add(qId.toLowerCase());

    const text = String(q.text || q.question || '').trim();
    if (!text) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'Question text is required.',
      });
    }

    const optionsRaw = q.options;
    if (!Array.isArray(optionsRaw) || optionsRaw.length < 2) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'Each question must have at least 2 options.',
      });
      return;
    }

    const options: { id: string; text: string }[] = [];
    const optionIds = new Set<string>();
    optionsRaw.forEach((opt, optIdx) => {
      if (opt && typeof opt === 'object') {
        const o = opt as Record<string, unknown>;
        const oid = String(o.id || String.fromCharCode(65 + optIdx)).trim();
        const fallbackId = String.fromCharCode(65 + optIdx);
        const otext = String(o.text || o.label || '').trim();
        if (!otext) {
          errors.push({
            row: rowNum,
            questionId: qId,
            message: `Option "${oid || fallbackId}" text cannot be empty.`,
          });
        }
        if (optionIds.has(oid.toUpperCase())) {
          errors.push({
            row: rowNum,
            questionId: qId,
            message: `Duplicate option id "${oid}" in question "${qId}".`,
          });
        }
        optionIds.add(oid.toUpperCase());
        options.push({ id: oid, text: otext });
      } else {
        errors.push({
          row: rowNum,
          questionId: qId,
          message: `Option #${optIdx + 1} must be an object with { id, text }.`,
        });
      }
    });

    const rawCorrect = String(
      q.correctAnswer ?? (q as Record<string, unknown>).correct_answer ?? (q as Record<string, unknown>).answerKey ?? ''
    ).trim();
    if (!rawCorrect) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'A "correctAnswer" matching one of the option IDs is required.',
      });
    } else if (options.length > 0 && !optionIds.has(rawCorrect.toUpperCase())) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: `correctAnswer "${rawCorrect}" does not match any option id (${options
          .map((o) => o.id)
          .join(', ')}).`,
      });
    }

    const matchedOption = options.find(
      (o) => o.id.toUpperCase() === rawCorrect.toUpperCase()
    );

    const imageUrl = q.imageUrl ? String(q.imageUrl).trim() : undefined;
    if (imageUrl && !isSafeHttpUrl(imageUrl)) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'Question imageUrl must be a valid http(s) URL.',
      });
    }

    const marks =
      q.marks !== undefined && q.marks !== null && q.marks !== ''
        ? Number(q.marks)
        : undefined;
    if (marks !== undefined && (!Number.isFinite(marks) || marks <= 0)) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'Question marks must be a positive number.',
      });
    }

    const negativeMarks =
      q.negativeMarks !== undefined && q.negativeMarks !== null && q.negativeMarks !== ''
        ? Number(q.negativeMarks)
        : undefined;
    if (
      negativeMarks !== undefined &&
      (!Number.isFinite(negativeMarks) || negativeMarks < 0)
    ) {
      errors.push({
        row: rowNum,
        questionId: qId,
        message: 'Question negativeMarks must be 0 or a positive number.',
      });
    }

    normalizedQuestions.push({
      id: qId || `q${rowNum}`,
      type: 'single-choice',
      text,
      imageUrl,
      subject: q.subject ? String(q.subject).trim() : undefined,
      topic: q.topic ? String(q.topic).trim() : undefined,
      options,
      correctAnswer: matchedOption ? matchedOption.id : rawCorrect,
      marks,
      negativeMarks,
      explanation: q.explanation ? String(q.explanation).trim() : '',
    });
  });

  return {
    valid: errors.length === 0,
    questions: normalizedQuestions,
    errors,
  };
}

export function sanitizeQuestionForClient(q: TestQuestion, idx = 0): TestQuestion {
  const copy: Record<string, unknown> = { ...q };
  delete copy.correctAnswer;
  delete copy.correct_answer;
  delete copy.answerKey;
  delete copy.answer_key;
  delete copy.explanation;
  return {
    id: String(q.id || `q${idx + 1}`),
    type: 'single-choice',
    text: q.text,
    imageUrl: q.imageUrl,
    subject: q.subject,
    topic: q.topic,
    options: Array.isArray(q.options) ? q.options : [],
    marks: q.marks,
    negativeMarks: q.negativeMarks,
  };
}
