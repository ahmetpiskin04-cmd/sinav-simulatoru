// Tarayıcı tarafında API rotalarını çağıran küçük yardımcılar
import type { ApiError, Course, CourseDetail, MaterialType, UploadMaterialResponse } from "@/lib/types";
import type { AnswerMap, CompletedExamView, ExamSettings, StudyGuide } from "@/lib/exam/types";
import type { CardStatusMap } from "@/lib/study/types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ApiError["code"],
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiRequestError("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.", 0);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiError | null;
    throw new ApiRequestError(err?.error ?? `İstek başarısız (${res.status})`, res.status, err?.code);
  }
  return body as T;
}

export const api = {
  listCourses: () => request<Course[]>("/api/courses"),
  createCourse: (title: string) =>
    request<Course>("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  getCourse: (id: string) => request<CourseDetail>(`/api/courses/${id}`),
  deleteCourse: (id: string) => request<void>(`/api/courses/${id}`, { method: "DELETE" }),
  uploadMaterial: (courseId: string, file: File, fileType: MaterialType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("file_type", fileType);
    return request<UploadMaterialResponse>(`/api/courses/${courseId}/materials`, {
      method: "POST",
      body: form,
    });
  },
  deleteMaterial: (materialId: string) => request<void>(`/api/materials/${materialId}`, { method: "DELETE" }),
  /** Görsel ağırlıklı bir PDF'i Gemini ile yeniden okut */
  readMaterialWithVision: (materialId: string) =>
    request<UploadMaterialResponse>(`/api/materials/${materialId}/vision`, { method: "POST" }),
  createStudySet: (courseId: string, body: { materialIds?: string[]; cardCount: number }) =>
    request<{ setId: string }>(`/api/courses/${courseId}/study-sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  saveCardStatus: (setId: string, card_status: CardStatusMap) =>
    request<{ card_status: CardStatusMap }>(`/api/study-sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_status }),
    }),
  deleteStudySet: (setId: string) => request<void>(`/api/study-sets/${setId}`, { method: "DELETE" }),
  deleteExam: (examId: string) => request<void>(`/api/exams/${examId}`, { method: "DELETE" }),
  generateStudyGuide: (examId: string) => request<StudyGuide>(`/api/exams/${examId}/study-guide`, { method: "POST" }),
  generateExam: (
    courseId: string,
    settings: Pick<ExamSettings, "questionCount" | "difficulty" | "questionType" | "mode"> & { materialIds?: string[] },
  ) =>
    request<{ examId: string; questionCount: number }>(`/api/courses/${courseId}/generate-exam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  submitExam: (examId: string, answers: AnswerMap) =>
    request<CompletedExamView>(`/api/exams/${examId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
