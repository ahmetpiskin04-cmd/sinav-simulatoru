import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { addChatMessages, clearChat, getCourse, listChat } from "@/lib/db/repo";
import { answerQuestion, MAX_QUESTION_CHARS } from "@/lib/chat";

export const maxDuration = 120;

// GET /api/courses/:courseId/chat → ChatMessage[]
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/chat">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId) || !getCourse(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    return Response.json(listChat(courseId));
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/courses/:courseId/chat  { message } → { messages: [öğrenci mesajı, cevap] }
// İkisi de yalnızca cevap başarıyla üretilince kaydedilir; hata olursa sohbet geçmişi değişmez.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/chat">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId) || !getCourse(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return jsonError(400, "Soru boş olamaz.", "BAD_REQUEST");
    if (message.length > MAX_QUESTION_CHARS) {
      return jsonError(400, `Soru en fazla ${MAX_QUESTION_CHARS} karakter olabilir.`, "BAD_REQUEST");
    }

    const { answer, model } = await answerQuestion(courseId, message, listChat(courseId));
    const messages = addChatMessages([
      { course_id: courseId, role: "user", content: message, model: null },
      { course_id: courseId, role: "assistant", content: answer, model },
    ]);
    return Response.json({ messages }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/courses/:courseId/chat — sohbet geçmişini temizler
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/chat">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId) || !getCourse(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    clearChat(courseId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
