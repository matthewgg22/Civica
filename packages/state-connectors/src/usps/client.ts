import { AddressSchema, type Address, type ValidationResult } from "../schemas.js";
import { normalizeUSPSResponse } from "./normalize.js";
import type {
  USPSAddressApiResponse,
  USPSClientOptions,
  USPSTokenResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://apis.usps.com";
const DEFAULT_SKEW_SECONDS = 30;

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

export class USPSClient {
  private cached: CachedToken | undefined;

  constructor(private readonly opts: USPSClientOptions) {}

  private get baseUrl(): string {
    return this.opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  private get fetchImpl(): typeof fetch {
    return this.opts.fetchImpl ?? fetch;
  }

  async getToken(now: number = Date.now()): Promise<string> {
    const skewMs = (this.opts.tokenSkewSeconds ?? DEFAULT_SKEW_SECONDS) * 1000;
    if (this.cached && this.cached.expiresAt - skewMs > now) {
      return this.cached.token;
    }
    const res = await this.fetchImpl(`${this.baseUrl}/oauth2/v3/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.opts.credentials.clientId,
        client_secret: this.opts.credentials.clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`USPS token request failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as USPSTokenResponse;
    this.cached = { token: body.access_token, expiresAt: now + body.expires_in * 1000 };
    return body.access_token;
  }

  async validate(input: Address): Promise<ValidationResult> {
    const parsed = AddressSchema.parse(input);
    const token = await this.getToken();

    const url = new URL(`${this.baseUrl}/addresses/v3/address`);
    url.searchParams.set("streetAddress", parsed.street);
    if (parsed.street2) url.searchParams.set("secondaryAddress", parsed.street2);
    url.searchParams.set("city", parsed.city);
    url.searchParams.set("state", parsed.state);
    url.searchParams.set("ZIPCode", parsed.zip.slice(0, 5));

    const res = await this.fetchImpl(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });

    if (res.status === 400) {
      // USPS returns 400 for un-parseable addresses — surface as a non-valid
      // result rather than throwing so callers can render a "double-check"
      // hint without try/catch noise.
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        valid: false,
        warnings: [body.error?.message ?? "Address could not be parsed"],
      };
    }
    if (!res.ok) {
      throw new Error(`USPS validate failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as USPSAddressApiResponse;
    return normalizeUSPSResponse(body);
  }
}

export function makeUSPSClient(opts: USPSClientOptions): USPSClient {
  return new USPSClient(opts);
}

// Convenience: a single-call helper that pulls credentials from env. Throws
// at first use if creds aren't set — the integration consumer should branch
// on a feature flag before calling this.
export function validateAddress(
  input: Address,
  opts: USPSClientOptions,
): Promise<ValidationResult> {
  return makeUSPSClient(opts).validate(input);
}
