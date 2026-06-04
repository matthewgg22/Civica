import { cookies } from "next/headers";
import type { Locale } from "../../app/i18n";

export const LOCALE_COOKIE = "civica.locale";

export async function readLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return value === "es" ? "es" : "en";
}

export async function writeLocale(locale: Locale): Promise<void> {
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
