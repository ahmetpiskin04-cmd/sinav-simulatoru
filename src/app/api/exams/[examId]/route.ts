import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { deleteExam } from "@/lib/db/repo";

// DELETE /api/exams/:examId — sınavı (soruları, cevapları ve çalışma rehberiyle birlikte) siler.
// Not: silinen sınavdaki yanlışlar artık "Yanlışlarımı Tekrar Et" hesabına girmez.
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/exams/[examId]">) {
  try {
    const { examId } = await ctx.params;
    if (!isUuid(examId) || !deleteExam(examId)) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
