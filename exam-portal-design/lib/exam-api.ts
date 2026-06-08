export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function parseJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
  })
  const data = await parseJson(res)
  if (!res.ok) throw new ApiError((data as { error?: string }).error || 'Request failed', res.status)
  return data as T
}

export async function requestOtp(email: string) {
  return apiFetch<{ ok: boolean; message: string }>('/api/exam/student/request-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyOtp(email: string, code: string) {
  return apiFetch<{ ok: boolean; candidate: { id: string; name: string; email: string; course_name: string } }>(
    '/api/exam/student/verify',
    { method: 'POST', body: JSON.stringify({ email, code }) },
  )
}

export async function studentLogout() {
  return apiFetch('/api/exam/student/session', { method: 'DELETE' })
}

export async function studentMe() {
  return apiFetch<{ id: string; name: string; email: string; course_name: string }>('/api/exam/student/me')
}

export async function studentExams() {
  return apiFetch<{ exams: ExamRow[] }>('/api/exam/student/exams')
}

export async function studentAttempts() {
  return apiFetch<{ attempts: AttemptRow[] }>('/api/exam/student/attempts')
}

export async function getExamPreview(examId: string) {
  return apiFetch<ExamPreview>('/api/exam/student/exams/' + encodeURIComponent(examId) + '/preview')
}

export async function startExam(examId: string) {
  return apiFetch<ExamSession>('/api/exam/student/exams/' + encodeURIComponent(examId) + '/start', { method: 'POST' })
}

export async function saveAnswer(attemptId: string, questionId: string, selectedIndex: number) {
  return apiFetch('/api/exam/student/attempts/' + encodeURIComponent(attemptId) + '/answer', {
    method: 'POST',
    body: JSON.stringify({ questionId, selectedIndex }),
  })
}

export type SubmitReason = 'review' | 'timeout' | 'tab_switch'

export async function submitExam(attemptId: string, submitReason: SubmitReason = 'review') {
  return apiFetch<ExamResult>('/api/exam/student/attempts/' + encodeURIComponent(attemptId) + '/submit', {
    method: 'POST',
    body: JSON.stringify({ submitReason }),
  })
}

export async function getResult(attemptId: string) {
  return apiFetch<ExamResult>('/api/exam/student/attempts/' + encodeURIComponent(attemptId) + '/result')
}

export async function adminLogin(apiKey: string) {
  return apiFetch('/api/exam/admin/session', { method: 'POST', body: JSON.stringify({ apiKey }) })
}

export async function adminLogout() {
  return apiFetch('/api/exam/admin/session', { method: 'DELETE' })
}

export async function adminStats() {
  return apiFetch<{ exams: number; published: number; attempts: number; passed: number }>('/api/exam/admin/stats')
}

export async function adminExams() {
  return apiFetch<{ exams: ExamAdminRow[] }>('/api/exam/admin/exams')
}

export async function adminCreateExam(body: Partial<ExamAdminRow>) {
  return apiFetch<{ exam: ExamAdminRow }>('/api/exam/admin/exams', { method: 'POST', body: JSON.stringify(body) })
}

export async function adminGetExam(id: string) {
  return apiFetch<{ exam: ExamAdminRow; questions: QuestionRow[] }>('/api/exam/admin/exams/' + encodeURIComponent(id))
}

export async function adminUpdateExam(id: string, body: Partial<ExamAdminRow>) {
  return apiFetch('/api/exam/admin/exams/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) })
}

export async function adminPublishExam(id: string) {
  return apiFetch<{ exam: ExamAdminRow; message?: string }>(
    '/api/exam/admin/exams/' + encodeURIComponent(id) + '/publish',
    { method: 'POST' },
  )
}

export async function adminAddQuestion(examId: string, body: Partial<QuestionRow>) {
  return apiFetch('/api/exam/admin/exams/' + encodeURIComponent(examId) + '/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function adminDeleteQuestion(id: string) {
  return apiFetch('/api/exam/admin/questions/' + encodeURIComponent(id), { method: 'DELETE' })
}

export async function adminImportPreview(examId: string, type: 'excel' | 'pdf', fileBase64: string) {
  return apiFetch<{ questions: QuestionRow[]; errors: string[] }>(
    '/api/exam/admin/exams/' + encodeURIComponent(examId) + '/import/preview',
    { method: 'POST', body: JSON.stringify({ type, fileBase64 }) },
  )
}

export async function adminImportConfirm(examId: string, questions: QuestionRow[], replace = true) {
  return apiFetch<{ imported: number; pool: number; message?: string }>(
    '/api/exam/admin/exams/' + encodeURIComponent(examId) + '/import/confirm',
    { method: 'POST', body: JSON.stringify({ questions, replace }) },
  )
}

export async function adminImportExcel(examId: string, fileBase64: string) {
  return apiFetch<{ imported: number; pool: number; errors?: string[]; message?: string }>(
    '/api/exam/admin/exams/' + encodeURIComponent(examId) + '/import/excel',
    { method: 'POST', body: JSON.stringify({ fileBase64 }) },
  )
}

export async function adminAttempts() {
  return apiFetch<{ attempts: AttemptAdminRow[] }>('/api/exam/admin/attempts')
}

export async function adminExhaustedExams() {
  return apiFetch<{ exhausted: ExhaustedExamRow[]; attemptsMax: number }>('/api/exam/admin/reschedules')
}

export async function adminRescheduleExam(body: { exam_id: string; candidate_id: string; note?: string }) {
  return apiFetch<{ ok: boolean; reset_at: string; canTake: boolean }>('/api/exam/admin/reschedules', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function adminResendCertificate(attemptId: string) {
  return apiFetch<{ ok: boolean; certificateSent: boolean; alreadySent?: boolean }>(
    '/api/exam/admin/attempts/' + encodeURIComponent(attemptId) + '/resend-certificate',
    { method: 'POST' },
  )
}

export type ExamRow = {
  id: string
  title: string
  code?: string | null
  course_name: string
  duration_minutes: number
  question_count: number
  cutoff_percent: number
  published_at?: string | null
  updated_at?: string | null
  attemptsUsed?: number
  attemptsMax?: number
  canTake?: boolean
}

export type ExamAdminRow = ExamRow & {
  status: string
  shuffle_mode: string
  question_pool?: number
}

export type QuestionRow = {
  id?: string
  sort_order: number
  prompt: string
  question_type?: string
  options: string[]
  correct_index: number
}

export type AttemptRow = {
  id: string
  exam_id: string
  exam_title?: string
  score_percent?: number
  passed?: number
  submitted_at?: string
  started_at: string
}

export type AttemptAdminRow = AttemptRow & {
  candidate_name?: string
  candidate_email?: string
  cutoff_percent?: number
  certificate_sent_at?: string | null
  submit_reason?: string | null
}

export type ExhaustedExamRow = {
  candidate_id: string
  exam_id: string
  candidate_name: string
  candidate_email: string
  exam_title: string
  attemptsUsed: number
  attemptsMax: number
  last_reset_at?: string | null
}

export type ExamPreview = {
  examId: string
  examTitle: string
  durationMinutes: number
  questionCount: number
  cutoffPercent: number
  poolSize: number
  attemptsUsed: number
  attemptsMax: number
  canTake: boolean
  hasInProgress: boolean
  inProgressAttemptId?: string | null
  publishedAt?: string | null
  revisedSinceLastAttempt?: boolean
}

export type ExamSession = {
  attemptId: string
  examId: string
  examTitle: string
  durationMinutes: number
  startedAt: string
  endsAt: string
  studentName?: string
  questions: { id: string; prompt: string; question_type?: string; options: string[] }[]
  answers: Record<string, number>
  questionOrder: string[]
}

export type ExamResult = {
  attemptId: string
  examTitle: string
  scorePercent: number
  passed: boolean
  cutoffPercent: number
  correct: number
  total: number
  certificateSent?: boolean
  resultEmailSent?: boolean
  submitReason?: SubmitReason | string
  integrityViolation?: boolean
  attemptNumber?: number
  attemptsMax?: number
  canRetake?: boolean
  submittedAt: string
}
