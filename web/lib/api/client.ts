import createClient from "openapi-fetch";
import type { paths } from "./types";

export function createApiClient(accessToken?: string) {
  return createClient<paths>({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
