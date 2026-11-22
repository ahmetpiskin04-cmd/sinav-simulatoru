// Çalışma seti (sınavdan bağımsız özet + flashcard destesi) — sunucu ve tarayıcı ortak
import type { Flashcard, StudyTopic } from "@/lib/exam/types";

export type CardStatus = "known" | "unknown";
/** Kart sırası (string) → durum */
export type CardStatusMap = Record<string, CardStatus>;

export const STUDY_CARD_COUNTS = [10, 20, 30] as const;

export interface StudySetContent {
  topics: StudyTopic[];
  flashcards: Flashcard[];
}

export interface StudySet {
  id: string;
  course_id: string;
  title: string;
  source_names: string[];
  content: StudySetContent;
  card_status: CardStatusMap;
  model: string | null;
  created_at: string;
}

/** Ders panelindeki liste için */
export interface StudySetSummary {
  id: string;
  title: string;
  created_at: string;
  source_count: number;
  topic_count: number;
  card_count: number;
  known_count: number;
}

export interface StudySetView extends StudySet {
  course: { id: string; title: string };
}
