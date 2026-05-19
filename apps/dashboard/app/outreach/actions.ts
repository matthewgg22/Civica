"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";

type OutreachStatus = "contacted" | "resolved" | "cancelled";

export async function updateOutreachTaskStatus(
  taskId: string,
  status: OutreachStatus,
  resolutionNotes?: string,
): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = { status };
  if (resolutionNotes) payload["resolution_notes"] = resolutionNotes;
  const now = new Date().toISOString();
  if (status === "contacted") payload["contacted_at"] = now;
  if (status === "resolved") payload["resolved_at"] = now;

  await supabase
    .schema("snap_enrollment")
    .from("navigator_outreach_queue")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("outreach_task_id", taskId);

  revalidatePath("/outreach");
}
