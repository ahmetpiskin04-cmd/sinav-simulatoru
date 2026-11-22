import "server-only";
import { getStudySet as getStudySetRow } from "@/lib/db/repo";
import type { CardStatus, CardStatusMap, StudySet, StudySetSummary, StudySetView } from "@/lib/study/types";

export async function getStudySet(setId: string): Promise<StudySetView | null> {
  return getStudySetRow(setId);
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
