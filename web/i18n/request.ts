import { getRequestConfig } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { hasLocale } from "next-intl";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    onError(error) {
      if (process.env.NODE_ENV === "development") {
        throw error;
      }
      console.error(error);
    },
    getMessageFallback({ namespace, key }) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(`Missing translation: ${namespace}.${key}`);
      }
      return `${namespace}.${key}`;
    },
  };
});
