import "server-only";
import { getDb, newId, now, transaction } from "@/lib/db";
import { deleteCourseFiles, deletePdf } from "@/lib/db/files";
import type { ExamQuestion, ExamSettings, GradedAnswer, StudyGuide } from "@/lib/exam/types";
import type { CardStatusMap, StudySet, StudySetContent } from "@/lib/study/types";
import type { Course, ExtractionMethod, Material, MaterialSummary, MaterialType } from "@/lib/types";

// Tüm tablo işlemleri burada. JSON sütunları metin olarak saklanır; okurken ayrıştırılır.

type Row = Record<string, unknown>;
const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toJson = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

// ---------------------------------------------------------------- dersler

const toCourse = (r: Row): Course => ({ id: String(r.id), title: String(r.title), created_at: String(r.created_at) });

export function listCourses(): Course[] {
  return (getDb().prepare("select * from courses order by created_at desc").all() as Row[]).map(toCourse);
}

export function getCourse(id: string): Course | null {
  const r = getDb().prepare("select * from courses where id = ?").get(id) as Row | undefined;
  return r ? toCourse(r) : null;
}

export function createCourse(title: string): Course {
  const course = { id: newId(), title, created_at: now() };
  getDb().prepare("insert into courses (id, title, created_at) values (?, ?, ?)").run(course.id, course.title, course.created_at);
  return course;
}

/** Ders + materyalleri, sınavları, setleri (cascade) + PDF klasörü */
export function deleteCourse(id: string): boolean {
  const { changes } = getDb().prepare("delete from courses where id = ?").run(id);
  if (changes) deleteCourseFiles(id);
  return Number(changes) > 0;
}

// ---------------------------------------------------------------- materyaller

const toMaterial = (r: Row): Material => ({
  id: String(r.id),
  course_id: String(r.course_id),
  file_name: String(r.file_name),
  file_type: r.file_type as MaterialType,
  extracted_text: str(r.extracted_text),
  storage_path: str(r.storage_path),
  page_count: num(r.page_count),
  extraction_method: (r.extraction_method as ExtractionMethod | null) ?? null,
  created_at: String(r.created_at),
});

export const toMaterialSummary = ({ extracted_text, ...m }: Material): MaterialSummary => ({
  ...m,
  text_length: extracted_text?.length ?? 0,
});

/** Dersin materyalleri (metinleriyle). order: "new" en yeni üstte, "old" yükleme sırası */
export function listMaterials(courseId: string, order: "new" | "old" = "new"): Material[] {
  const dir = order === "new" ? "desc" : "asc";
  return (getDb().prepare(`select * from materials where course_id = ? order by created_at ${dir}`).all(courseId) as Row[]).map(
    toMaterial,
  );
}

export function getMaterial(id: string): Material | null {
  const r = getDb().prepare("select * from materials where id = ?").get(id) as Row | undefined;
  return r ? toMaterial(r) : null;
}

export function insertMaterial(m: Omit<Material, "id" | "created_at">): Material {
  const row: Material = { ...m, id: newId(), created_at: now() };
  getDb()
    .prepare(
      `insert into materials (id, course_id, file_name, file_type, extracted_text, storage_path, page_count, extraction_method, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.course_id, row.file_name, row.file_type, row.extracted_text, row.storage_path, row.page_count, row.extraction_method, row.created_at);
  return row;
}

export function updateMaterialText(id: string, text: string, method: ExtractionMethod): Material | null {
  getDb().prepare("update materials set extracted_text = ?, extraction_method = ? where id = ?").run(text, method, id);
  return getMaterial(id);
}

/** Kaydı ve PDF dosyasını siler */
export function deleteMaterial(id: string): boolean {
  const m = getMaterial(id);
  if (!m) return false;
  getDb().prepare("delete from materials where id = ?").run(id);
  deletePdf(m.storage_path);
  return true;
}

// ---------------------------------------------------------------- sınavlar

export interface ExamRow {
  id: string;
  course_id: string;
  title: string | null;
  settings: ExamSettings | null;
  questions_json: ExamQuestion[];
  user_answers_json: GradedAnswer[] | null;
  score: number | null;
  feedback_summary: string | null;
  submitted_at: string | null;
  study_guide: StudyGuide | null;
  started_at: string | null;
  /** Soru id'si → sınav başından itibaren o soruya son dokunuş (ms) */
  timing_json: Record<string, number> | null;
  /** "Bu soru hatalı" işaretlenen soru id'leri */
  flagged_json: number[];
  created_at: string;
  courses: { id: string; title: string } | null;
}

const toExam = (r: Row): ExamRow => ({
  id: String(r.id),
  course_id: String(r.course_id),
  title: str(r.title),
  settings: json<ExamSettings | null>(r.settings, null),
  questions_json: json<ExamQuestion[]>(r.questions_json, []),
  user_answers_json: json<GradedAnswer[] | null>(r.user_answers_json, null),
  score: num(r.score),
  feedback_summary: str(r.feedback_summary),
  submitted_at: str(r.submitted_at),
  study_guide: json<StudyGuide | null>(r.study_guide, null),
  started_at: str(r.started_at),
  timing_json: json<Record<string, number> | null>(r.timing_json, null),
  flagged_json: json<number[]>(r.flagged_json, []),
  created_at: String(r.created_at),
  courses: r.course_title ? { id: String(r.course_id), title: String(r.course_title) } : null,
});

const EXAM_SELECT = "select e.*, c.title as course_title from exams e join courses c on c.id = e.course_id";

export function listExams(courseId: string, limit?: number): ExamRow[] {
  const sql = `${EXAM_SELECT} where e.course_id = ? order by e.created_at desc${limit ? ` limit ${Math.floor(limit)}` : ""}`;
  return (getDb().prepare(sql).all(courseId) as Row[]).map(toExam);
}

export function getExam(id: string): ExamRow | null {
  const r = getDb().prepare(`${EXAM_SELECT} where e.id = ?`).get(id) as Row | undefined;
  return r ? toExam(r) : null;
}

export function insertExam(e: { course_id: string; title: string; settings: ExamSettings; questions: ExamQuestion[] }): string {
  const id = newId();
  getDb()
    .prepare("insert into exams (id, course_id, title, settings, questions_json, created_at) values (?, ?, ?, ?, ?, ?)")
    .run(id, e.course_id, e.title, JSON.stringify(e.settings), JSON.stringify(e.questions), now());
  return id;
}

/** Süreli sınav: ilk açılışta başlangıç zamanını yazar (sonraki açılışlarda değişmez) */
export function markExamStarted(id: string): string | null {
  getDb().prepare("update exams set started_at = ? where id = ? and started_at is null and score is null").run(now(), id);
  return str((getDb().prepare("select started_at from exams where id = ?").get(id) as Row | undefined)?.started_at);
}

/** Yalnızca henüz puanlanmamışsa yazar (iki sekmeden aynı anda gönderime karşı) */
export function submitExamResult(
  id: string,
  r: { graded: GradedAnswer[]; score: number; feedback: string; submittedAt: string; timing: Record<string, number> | null },
): boolean {
  const { changes } = getDb()
    .prepare(
      `update exams set user_answers_json = ?, score = ?, feedback_summary = ?, submitted_at = ?, timing_json = ?
       where id = ? and score is null`,
    )
    .run(JSON.stringify(r.graded), r.score, r.feedback, r.submittedAt, toJson(r.timing), id);
  return Number(changes) > 0;
}

/** "Hatalı soru" işaretleri değişince puan ve özet yeniden hesaplanıp birlikte yazılır */
export function updateExamFlags(id: string, flagged: number[], score: number, feedback: string) {
  getDb()
    .prepare("update exams set flagged_json = ?, score = ?, feedback_summary = ? where id = ?")
    .run(JSON.stringify(flagged), score, feedback, id);
}

/** Yalnızca henüz rehber yoksa yazar */
export function setStudyGuide(id: string, guide: StudyGuide): boolean {
  const { changes } = getDb()
    .prepare("update exams set study_guide = ? where id = ? and study_guide is null")
    .run(JSON.stringify(guide), id);
  return Number(changes) > 0;
}

export function deleteExam(id: string): boolean {
  return Number(getDb().prepare("delete from exams where id = ?").run(id).changes) > 0;
}

// ---------------------------------------------------------------- çalışma setleri

type StudySetWithCourse = StudySet & { course: { id: string; title: string } };

const toStudySet = (r: Row): StudySetWithCourse => ({
  id: String(r.id),
  course_id: String(r.course_id),
  title: String(r.title),
  source_names: json<string[]>(r.source_names, []),
  content: json<StudySetContent>(r.content, { topics: [], flashcards: [] }),
  card_status: json<CardStatusMap>(r.card_status, {}),
  model: str(r.model),
  created_at: String(r.created_at),
  course: { id: String(r.course_id), title: String(r.course_title ?? "Ders") },
});

const SET_SELECT = "select s.*, c.title as course_title from study_sets s join courses c on c.id = s.course_id";

export function listStudySets(courseId: string): StudySetWithCourse[] {
  return (getDb().prepare(`${SET_SELECT} where s.course_id = ? order by s.created_at desc`).all(courseId) as Row[]).map(toStudySet);
}

export function getStudySet(id: string): StudySetWithCourse | null {
  const r = getDb().prepare(`${SET_SELECT} where s.id = ?`).get(id) as Row | undefined;
  return r ? toStudySet(r) : null;
}

export function insertStudySet(s: { course_id: string; title: string; source_names: string[]; content: StudySetContent; model: string }): string {
  const id = newId();
  getDb()
    .prepare("insert into study_sets (id, course_id, title, source_names, content, model, created_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(id, s.course_id, s.title, JSON.stringify(s.source_names), JSON.stringify(s.content), s.model, now());
  return id;
}

export function updateCardStatus(id: string, status: CardStatusMap) {
  getDb().prepare("update study_sets set card_status = ? where id = ?").run(JSON.stringify(status), id);
}

export function deleteStudySet(id: string): boolean {
  return Number(getDb().prepare("delete from study_sets where id = ?").run(id).changes) > 0;
}

// ---------------------------------------------------------------- sohbet

export interface ChatMessage {
  id: string;
  course_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
}

const toChat = (r: Row): ChatMessage => ({
  id: String(r.id),
  course_id: String(r.course_id),
  role: r.role as ChatMessage["role"],
  content: String(r.content),
  model: str(r.model),
  created_at: String(r.created_at),
});

export function listChat(courseId: string): ChatMessage[] {
  return (getDb().prepare("select * from chat_messages where course_id = ? order by created_at, rowid").all(courseId) as Row[]).map(toChat);
}

export function addChatMessages(msgs: Omit<ChatMessage, "id" | "created_at">[]): ChatMessage[] {
  return transaction(() =>
    msgs.map((m) => {
      const row: ChatMessage = { ...m, id: newId(), created_at: now() };
      getDb()
        .prepare("insert into chat_messages (id, course_id, role, content, model, created_at) values (?, ?, ?, ?, ?, ?)")
        .run(row.id, row.course_id, row.role, row.content, row.model, row.created_at);
      return row;
    }),
  );
}

export function clearChat(courseId: string) {
  getDb().prepare("delete from chat_messages where course_id = ?").run(courseId);
}
