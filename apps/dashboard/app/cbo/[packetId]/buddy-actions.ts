"use server";

// Server action for the caseworker self-referral button on the CBO case page.
// Runs server-side so the session JWT is never exposed to the client; it calls
// the gateway's POST /packets/:id/buddies/request, which creates a PENDING
// buddy link the applicant must approve.

import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import { api } from "../../../lib/api";

export type RequestToAssistResult =
  | { ok: true; status: string; alreadyExisted: boolean }
  | { ok: false; error: string };

export async function requestToAssist(packetId: string): Promise<RequestToAssistResult> {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Your session expired — sign in again." };

  try {
    const res = (await api.packets.requestBuddy(token, packetId)) as {
      status?: string;
      already_existed?: boolean;
    };
    return { ok: true, status: res.status ?? "pending", alreadyExisted: res.already_existed === true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed." };
  }
}
