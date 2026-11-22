import type { NextRequest } from "next/server";
import { getSupabaseAdmin, MATERIALS_BUCKET } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";

// DELETE /api/materials/:materialId — materyali ve PDF dosyasını siler.
// Daha önce üretilmiş sınavlar etkilenmez (sorular sınav kaydında saklı).
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/materials/[materialId]">) {
  try {
    const { materialId } = await ctx.params;
    if (!isUuid(materialId)) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    const db = getSupabaseAdmin();

    const { data: deleted, error } = await db
      .from("materials")
      .delete()
      .eq("id", materialId)
      .select("storage_path");
    if (error) throw error;
    if (!deleted.length) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");

    const path = deleted[0].storage_path;
    if (path) {
      const { error: rmErr } = await db.storage.from(MATERIALS_BUCKET).remove([path]);
      // Kayıt zaten silindi; depoda yetim dosya kalması kullanıcıyı etkilemez, yalnızca günlüğe yaz
      if (rmErr) console.warn("PDF depodan silinemedi:", path, rmErr.message);
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
