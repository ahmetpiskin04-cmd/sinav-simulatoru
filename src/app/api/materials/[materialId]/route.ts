import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { deleteMaterial } from "@/lib/db/repo";

// DELETE /api/materials/:materialId — materyali ve PDF dosyasını siler.
// Daha önce üretilmiş sınavlar etkilenmez (sorular sınav kaydında saklı).
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/materials/[materialId]">) {
  try {
    const { materialId } = await ctx.params;
    if (!isUuid(materialId) || !deleteMaterial(materialId)) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
