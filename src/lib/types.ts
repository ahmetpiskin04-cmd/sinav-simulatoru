import type { ExamSettings, StudyGuide } from "@/lib/exam/types";
import type { ReviewSummary } from "@/lib/exam/review";
import type { StudySetSummary } from "@/lib/study/types";

// Veritabanı satırlarının uygulama içindeki karşılıkları (supabase/schema.sql ile aynı tutun)

export type MaterialType = "slide" | "past_exam";
/** 'text': PDF'in kendi metni, 'gemini_vision': sayfalar Gemini ile okundu */
export type ExtractionMethod = "text" | "gemini_vision";

export interface Course {
  id: string;
  user_id: string | null;
  title: string;
  created_at: string;
}

export interface Material {
  id: string;
  course_id: string;
  file_name: string;
  file_type: MaterialType;
  extracted_text: string | null;
  storage_path: string | null;
  page_count: number | null;
  extraction_method: ExtractionMethod | null;
  created_at: string;
}

/** Listelerde metnin tamamını taşımamak için kullanılan özet */
export type MaterialSummary = Omit<Material, "extracted_text"> & { text_length: number };

/** Supabase'den özet için seçilen sütunlar (extracted_text hariç) */
export const MATERIAL_SUMMARY_COLUMNS =
  "id, course_id, file_name, file_type, storage_path, page_count, extraction_method, created_at";

export interface UploadMaterialResponse {
  material: MaterialSummary;
  notice?: string;
  warning?: string;
}

export interface Exam {
  id: string;
  course_id: string;
  title: string | null;
  settings: ExamSettings | null;
  questions_json: unknown[];
  user_answers_json: unknown | null;
  score: number | null;
  feedback_summary: string | null;
  submitted_at: string | null;
  study_guide: StudyGuide | null;
  created_at: string;
}

export type ExamSummary = Pick<Exam, "id" | "title" | "settings" | "score" | "created_at"> & { question_count: number };

export interface CourseDetail {
  course: Course;
  materials: MaterialSummary[];
  exams: ExamSummary[];
  /** Önceki sınavlardaki yanlışların konu dağılımı (tekrar sınavı için) */
  review: ReviewSummary;
  study_sets: StudySetSummary[];
}

export interface ApiError {
  error: string;
  code?:
    | "SUPABASE_NOT_CONFIGURED"
    | "GEMINI_NOT_CONFIGURED"
    | "SCHEMA_OUTDATED"
    | "AI_ERROR"
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "CONFLICT"
    | "SERVER_ERROR";
}
