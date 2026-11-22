// Sınav veri yapıları — hem sunucu hem tarayıcı tarafında kullanılır

export type QuestionType = "multiple_choice" | "open_ended";
export type QuestionTypeSetting = QuestionType | "mixed";
export type Difficulty = "easy" | "medium" | "hard";

export const QUESTION_COUNTS = [5, 10, 15] as const;
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 20;
export const MC_LETTERS = ["A", "B", "C", "D"] as const;
export type McLetter = (typeof MC_LETTERS)[number];

/** normal: seçilen materyallerden; review: önceki sınavlardaki yanlışlardan */
export type ExamMode = "normal" | "review";

export interface ExamSettings {
  questionCount: number;
  difficulty: Difficulty;
  questionType: QuestionTypeSetting;
  mode?: ExamMode;
  /** Yalnızca belirli materyallerden üretildiyse (boş/yok = tümü) */
  materialIds?: string[];
  /** Kullanılan PDF adları (sınav sayfasında göstermek için) */
  materialNames?: string[];
  /** Tekrar sınavında odaklanılan konular */
  focusTopics?: string[];
  /** Sınavı üreten Gemini modeli (bilgi amaçlı) */
  model?: string;
  /**
   * Cevap anahtarı doğrulaması: kaç çoktan seçmeli soru bağımsız çözüldü, kaçında uyuşmazlık çıkıp
   * hakeme gitti, kaçı çıkarıldı. null = doğrulama yapılamadı (ör. kota); undefined = eski sınav.
   */
  verification?: { checked: number; disputed?: number; rejected: number; model: string } | null;
}

/** Veritabanında (exams.questions_json) saklanan tam soru */
export interface ExamQuestion {
  id: number;
  type: QuestionType;
  topic: string;
  question_text: string;
  /** Çoktan seçmelide 4 şık ("A) ...", "B) ..."), açık uçluda boş dizi */
  options: string[];
  /** Çoktan seçmelide yalnızca harf ("A"-"D"), açık uçluda ideal cevap */
  correct_answer: string;
  explanation: string;
}

/** Sınav bitmeden tarayıcıya giden hâli: cevap ve çözüm yok */
export type PublicQuestion = Omit<ExamQuestion, "correct_answer" | "explanation">;

/** Soru id'si → öğrencinin cevabı (çoktan seçmelide harf) */
export type AnswerMap = Record<string, string>;

/** exams.user_answers_json içinde saklanan puanlanmış cevap */
export interface GradedAnswer {
  question_id: number;
  answer: string;
  /** 0-100 */
  score: number;
  is_correct: boolean;
  /** Açık uçlu sorularda yapay zekânın kısa yorumu */
  feedback: string | null;
}

/** Bu oranın altındaki konular "zayıf" sayılır (tekrar çalış listesi + çalışma rehberi) */
export const WEAK_TOPIC_THRESHOLD = 70;
export const STUDY_GUIDE_FLASHCARDS = 5;

export interface StudyTopic {
  topic: string;
  /** Hap niteliğinde özet maddeleri */
  summary: string[];
  /** Sık düşülen tuzaklar ve ipuçları */
  pitfalls: string[];
}

export interface StudyGuideTopic extends StudyTopic {
  /** Sınavdaki konu puanı (0-100) */
  score: number;
}

export interface Flashcard {
  topic: string;
  front: string;
  back: string;
}

/** exams.study_guide içinde saklanır */
export interface StudyGuide {
  topics: StudyGuideTopic[];
  flashcards: Flashcard[];
  model: string;
  generated_at: string;
}

export interface TopicStat {
  topic: string;
  /** 0-100, konudaki soruların ortalaması */
  score: number;
  question_count: number;
}

interface ExamViewBase {
  id: string;
  title: string;
  course: { id: string; title: string };
  settings: ExamSettings | null;
  created_at: string;
}

export interface InProgressExamView extends ExamViewBase {
  status: "in_progress";
  questions: PublicQuestion[];
}

export interface CompletedExamView extends ExamViewBase {
  status: "completed";
  questions: ExamQuestion[];
  graded: GradedAnswer[];
  topics: TopicStat[];
  score: number;
  feedback_summary: string;
  submitted_at: string | null;
  study_guide: StudyGuide | null;
}

export type ExamView = InProgressExamView | CompletedExamView;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

export const QUESTION_TYPE_LABELS: Record<QuestionTypeSetting, string> = {
  multiple_choice: "Çoktan seçmeli",
  open_ended: "Açık uçlu",
  mixed: "Karışık",
};
