import { connection } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api";
import { createCourse, listCourses } from "@/lib/db/repo";

// GET /api/courses — tüm dersler (en yeni üstte)
export async function GET() {
  await connection(); // her istekte çalışsın, derlemede statikleşmesin
  try {
    return Response.json(listCourses());
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/courses  { title }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return jsonError(400, "Ders adı boş olamaz.", "BAD_REQUEST");
    if (title.length > 120) return jsonError(400, "Ders adı en fazla 120 karakter olabilir.", "BAD_REQUEST");
    return Response.json(createCourse(title), { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
