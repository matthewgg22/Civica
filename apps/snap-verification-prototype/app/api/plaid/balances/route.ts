import { NextResponse } from "next/server";

// Plaid /accounts/balance/get — returns current balances per account.
// Fixture produces 1–3 depository accounts with plausible balances.
// When real credentials + access_token are provided, call the real API.

export async function POST(req: Request) {
  const { accessToken } = await req.json();

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? "sandbox";

  if (clientId && secret && accessToken && !accessToken.startsWith("access-sandbox-fixture")) {
    const res = await fetch(`https://${env}.plaid.com/accounts/balance/get`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    });
    const data = await res.json();
    return NextResponse.json({ accounts: data.accounts ?? [] });
  }

  // Fixture: two checking/savings accounts.
  return NextResponse.json({
    accounts: [
      {
        account_id: "fixture_checking",
        name: "Sandbox Checking",
        type: "depository",
        subtype: "checking",
        balances: { current: 1243.87, available: 1198.42, iso_currency_code: "USD" },
        institution_name: "Sandbox Bank",
      },
      {
        account_id: "fixture_savings",
        name: "Sandbox Savings",
        type: "depository",
        subtype: "savings",
        balances: { current: 612.0, available: 612.0, iso_currency_code: "USD" },
        institution_name: "Sandbox Bank",
      },
    ],
    source: "plaid_sandbox_fixture",
  });
}
