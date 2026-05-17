"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClientFromCookies } from "../../../lib/supabase";
import { api } from "../../../lib/api";

export async function recordExpeditedReview(packetId: string, isExpedited: boolean) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  await api.packets.update(session.access_token, packetId, { is_expedited: isExpedited });

  revalidatePath(`/packets/${packetId}`);
}
