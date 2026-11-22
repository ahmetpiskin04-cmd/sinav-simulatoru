import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleRouteError, jsonError } from "@/lib/api";
import type { Course } from "@/lib/types";

// GET /api/courses — tüm dersler (en yeni üstte)
export async function GET() {
  await connection(); // her istekte çalışsın, derlemede statikleşmesin
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json(data as Course[]);
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

    const { data, error } = await getSupabaseAdmin()
      .from("courses")
      .insert({ title })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json(data as Course, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
