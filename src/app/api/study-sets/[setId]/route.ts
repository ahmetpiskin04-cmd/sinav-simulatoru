import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { deleteStudySet, getStudySet, updateCardStatus } from "@/lib/db/repo";
import { sanitizeCardStatus } from "@/lib/study/view";

// PATCH /api/study-sets/:setId  { card_status: { "<kart sırası>": "known" | "unknown" } }
// Kartların "bildim / bilemedim" durumunu kaydeder (gönderilen harita tamamının yerini alır).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/study-sets/[setId]">) {
  try {
    const { setId } = await ctx.params;
    if (!isUuid(setId)) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");
    const set = getStudySet(setId);
    if (!set) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");

    const body = (await request.json().catch(() => null)) as { card_status?: unknown } | null;
    const status = sanitizeCardStatus(body?.card_status, set.content.flashcards.length);
    if (!status) return jsonError(400, "card_status { kartSırası: 'known' | 'unknown' } biçiminde olmalı.", "BAD_REQUEST");

    updateCardStatus(setId, status);
    return Response.json({ card_status: status });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/study-sets/:setId
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/study-sets/[setId]">) {
  try {
    const { setId } = await ctx.params;
    if (!isUuid(setId) || !deleteStudySet(setId)) return jsonError(404, "Çalışma seti bulunamadı.", "NOT_FOUND");
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
