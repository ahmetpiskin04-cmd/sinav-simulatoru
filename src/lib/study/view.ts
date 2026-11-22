import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CardStatus, CardStatusMap, StudySet, StudySetSummary, StudySetView } from "@/lib/study/types";

const COLUMNS = "id, course_id, title, source_names, content, card_status, model, created_at";

export async function getStudySet(setId: string): Promise<StudySetView | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("study_sets")
    .select(`${COLUMNS}, courses(id, title)`)
    .eq("id", setId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { courses, ...set } = data as unknown as StudySet & { courses: { id: string; title: string } | null };
  return { ...set, card_status: set.card_status ?? {}, course: courses ?? { id: set.course_id, title: "Ders" } };
}

export function toSummary(set: Pick<StudySet, "id" | "title" | "created_at" | "source_names" | "content" | "card_status">): StudySetSummary {
  const statuses = Object.values(set.card_status ?? {}) as CardStatus[];
  return {
    id: set.id,
    title: set.title,
    created_at: set.created_at,
    source_count: set.source_names?.length ?? 0,
    topic_count: set.content?.topics?.length ?? 0,
    card_count: set.content?.flashcards?.length ?? 0,
    known_count: statuses.filter((s) => s === "known").length,
  };
}

/** İstemciden gelen kart durumlarını doğrular: yalnızca var olan kart sıraları ve geçerli değerler */
export function sanitizeCardStatus(raw: unknown, cardCount: number): CardStatusMap | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: CardStatusMap = {};
  for (const [k, v] of Object.entries(raw)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= cardCount) continue;
    if (v === "known" || v === "unknown") out[String(i)] = v;
  }
  return out;
}
