// Plaid sandbox client.
//
// In production this wraps the official `plaid` Node SDK against
// PLAID_ENV=sandbox using PLAID_CLIENT_ID / PLAID_SECRET. The flow is:
//   1. POST /link/token/create  → returns a link_token for the frontend
//   2. Frontend opens Plaid Link with link_token, receives a public_token
//   3. POST /item/public_token/exchange  → access_token
//   4. POST /transactions/get  → recent transactions
//
// For the prototype we expose the same call sites but synthesize the
// data so reviewers can run the app without credentials.

export interface LinkTokenResponse {
  link_token: string;
  expiration: string;
  request_id: string;
}

export async function createLinkToken(userId: string): Promise<LinkTokenResponse> {
  return {
    link_token: `link-sandbox-${userId}-${Math.random().toString(36).slice(2, 10)}`,
    expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    request_id: Math.random().toString(36).slice(2, 14),
  };
}

export interface PlaidTransaction {
  transaction_id: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive = outflow (Plaid convention)
  name: string;
  merchant_name?: string;
  category: string[];
  counterparty?: string;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export interface RentTransactionsParams {
  publicToken: string;
  leaseholderName: string;
  monthlyAmount: number;
  paymentMethod: "bank_transfer" | "cash" | "venmo_zelle" | "other";
}

export async function fetchRentTransactions(
  params: RentTransactionsParams
): Promise<PlaidTransaction[]> {
  if (params.paymentMethod === "cash") return [];

  const counterparty = params.leaseholderName || "Leaseholder";
  const desc =
    params.paymentMethod === "venmo_zelle"
      ? `VENMO PAYMENT TO ${counterparty.toUpperCase()}`
      : `ACH TRANSFER ${counterparty.toUpperCase()}`;

  // 3 recurring monthly outflows, amount jittered ±2% to look realistic.
  return [0, 1, 2].map((i) => ({
    transaction_id: `tx_rent_${i}`,
    date: daysAgo(7 + 30 * i),
    amount: Math.round(params.monthlyAmount * (1 + (i - 1) * 0.01) * 100) / 100,
    name: desc,
    merchant_name: params.paymentMethod === "venmo_zelle" ? "Venmo" : undefined,
    category: ["Transfer", "Rent"],
    counterparty,
  }));
}

export interface DepositSummary {
  source_name: string;
  monthly_average: number;
  deposit_count_90d: number;
}

export async function fetchIncomeDeposits(params: {
  publicToken: string;
  knownSources: string[];
}): Promise<DepositSummary[]> {
  // Synthesize plausible deposits for any known sources.
  return params.knownSources.map((source, idx) => {
    const base = 600 + idx * 250;
    return {
      source_name: source,
      monthly_average: base + Math.round(Math.random() * 80),
      deposit_count_90d: 9 + idx * 2,
    };
  });
}
