import { format } from "date-fns";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exportAll, markBackupTaken } from "@/lib/backup";

/** One-click backup download (build-spec §6). Auth comes from the middleware. */
export async function GET() {
  const file = await exportAll();
  await markBackupTaken();
  revalidatePath("/", "layout");

  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="na-office-hr-${format(new Date(), "yyyy-MM-dd")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
