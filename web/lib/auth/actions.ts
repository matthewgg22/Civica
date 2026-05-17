"use server";

import { createSupabaseServerClient } from "./supabase-server";
import { env } from "@/lib/env";

export type AuthActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function sendMagicLink(
  email: string,
  locale: string
): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/${locale}/auth/callback?next=/${locale}/app/packet`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: "magic_link_sent" };
}

export async function sendPhoneOtp(phone: string): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: "otp_sent" };
}

export async function verifyPhoneOtp(
  phone: string,
  token: string
): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: "verified" };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
