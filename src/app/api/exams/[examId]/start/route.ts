import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { getExam, markExamStarted } from "@/lib/db/repo";

// POST /api/exams/:examId/start → { started_at }
// Sınav ilk açıldığında başlangıç zamanını kaydeder; sonraki çağrılar aynı zamanı döndürür.
// Böylece sayfa yenilense ya da kapatılıp açılsa bile süre sayacı sıfırlanmaz.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/exams/[examId]/start">) {
  try {
    const { examId } = await ctx.params;
    if (!isUuid(examId) || !getExam(examId)) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");
    return Response.json({ started_at: markExamStarted(examId) });
  } catch (err) {
    return handleRouteError(err);
  }
}
