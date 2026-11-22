import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { loadCourseSources, noSourcesMessage, parseMaterialIds } from "@/lib/course-sources";
import { generateStudySet } from "@/lib/study/generate";
import { STUDY_CARD_COUNTS } from "@/lib/study/types";

export const maxDuration = 300;

// POST /api/courses/:courseId/study-sets  { materialIds?: string[], cardCount?: 10 | 20 | 30 } → { setId }
// Sınavdan bağımsız: seçilen PDF'lerden konu özetleri + flashcard destesi üretir ve kaydeder.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/study-sets">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const cardCount = body.cardCount === undefined ? 20 : Number(body.cardCount);
    if (!(STUDY_CARD_COUNTS as readonly number[]).includes(cardCount)) {
      return jsonError(400, `Kart sayısı ${STUDY_CARD_COUNTS.join(", ")} olabilir.`, "BAD_REQUEST");
    }
    const materialIds = parseMaterialIds(body.materialIds);
    if (typeof materialIds === "string") return jsonError(400, materialIds, "BAD_REQUEST");

    const db = getSupabaseAdmin();
    const { data: course, error: courseErr } = await db.from("courses").select("id").eq("id", courseId).maybeSingle();
    if (courseErr) throw courseErr;
    if (!course) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const { sources, courseHasMaterials } = await loadCourseSources(courseId, materialIds);
    if (!sources.length) return jsonError(400, noSourcesMessage(courseHasMaterials, Boolean(materialIds)), "BAD_REQUEST");

    const set = await generateStudySet(sources, cardCount);

    const { data: row, error } = await db
      .from("study_sets")
      .insert({
        course_id: courseId,
        title: set.title,
        source_names: sources.map((s) => s.file_name),
        content: { topics: set.topics, flashcards: set.flashcards },
        model: set.model,
      })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ setId: row.id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
