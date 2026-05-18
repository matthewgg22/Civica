export interface USPSCredentials {
  clientId: string;
  clientSecret: string;
}

export interface USPSClientOptions {
  credentials: USPSCredentials;
  // Defaults to the production base URL. Tests inject a base that points at
  // a recorded-fixture mock and a fetch implementation that serves them.
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  // Skew applied to token expiry so we refresh slightly early.
  tokenSkewSeconds?: number;
}

export interface USPSAddressApiResponse {
  address: {
    streetAddress: string;
    secondaryAddress?: string;
    city: string;
    state: string;
    ZIPCode: string;
    ZIPPlus4?: string;
  };
  additionalInfo?: {
    deliveryPoint?: string;
    DPVConfirmation?: "Y" | "N" | "S" | "D";
  };
  warnings?: string[];
}

export interface USPSTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  // USPS returns more fields; we only consume these three.
}
