import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { getStudySet, sanitizeCardStatus } from "@/lib/study/view";

// PATCH /api/study-sets/:setId  { card_status: { "<kart sırası>": "known" | "unknown" } }
// Kartların "bildim / bilemedim" durumunu kaydeder (gönderilen harita tamamının yerini alır).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/study-sets/[setId]">) {
  try {
    const { setId } = await ctx.params;
    if (!isUuid(setId)) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");

    const set = await getStudySet(setId);
    if (!set) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");

    const body = (await request.json().catch(() => null)) as { card_status?: unknown } | null;
    const status = sanitizeCardStatus(body?.card_status, set.content.flashcards.length);
    if (!status) return jsonError(400, "card_status { kartSırası: 'known' | 'unknown' } biçiminde olmalı.", "BAD_REQUEST");

    const { error } = await getSupabaseAdmin().from("study_sets").update({ card_status: status }).eq("id", setId);
    if (error) throw error;
    return Response.json({ card_status: status });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/study-sets/:setId
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/study-sets/[setId]">) {
  try {
    const { setId } = await ctx.params;
    if (!isUuid(setId)) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");
    const { data, error } = await getSupabaseAdmin().from("study_sets").delete().eq("id", setId).select("id");
    if (error) throw error;
    if (!data.length) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
