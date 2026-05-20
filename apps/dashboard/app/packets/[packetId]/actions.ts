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

/**
 * Mint a short-lived signed URL for a document blob in the `documents` bucket.
 *
 * Access is enforced by RLS: the user's anon-key client can only resolve
 * storage_path for documents in packets they have access to. If RLS denies
 * the lookup we return null rather than leaking existence.
 */
const SIGNED_URL_TTL_SECONDS = 300; // 5 min — re-mint on the client before expiry

export async function getDocumentSignedUrl(
  documentId: string,
): Promise<{ url: string; expiresAt: number; contentType: string | null } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const { data: doc, error } = await supabase
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .select("storage_path, original_filename")
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .single();

  if (error || !doc) return null;

  const { data: signed, error: signErr } = await supabase
    .storage
    .from("documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) return null;

  const ext = (doc.original_filename ?? doc.storage_path).split(".").pop()?.toLowerCase() ?? "";
  const contentType =
    ext === "pdf" ? "application/pdf"
    : ext === "png" ? "image/png"
    : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "heic" ? "image/heic"
    : ext === "webp" ? "image/webp"
    : null;

  return {
    url: signed.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    contentType,
  };
}
