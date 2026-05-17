import { NextResponse } from "next/server";

// Exchanges a Plaid public_token for an access_token.
//
// When PLAID_CLIENT_ID + PLAID_SECRET are configured, this calls the real
// Plaid sandbox API. Without credentials the prototype treats the token as
// opaque and passes it straight through to the fixture-backed transaction
// fetchers — no exchange needed because they ignore the token anyway.

export async function POST(req: Request) {
  const { public_token } = await req.json();
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? "sandbox";

  if (clientId && secret) {
    const res = await fetch(`https://${env}.plaid.com/item/public_token/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, secret, public_token }),
    });
    const data = await res.json();
    return NextResponse.json({ access_token: data.access_token, item_id: data.item_id });
  }

  // Fixture path: return a fake access_token the downstream fixture
  // fetchers recognise and ignore.
  return NextResponse.json({
    access_token: `access-sandbox-fixture-${public_token}`,
    item_id: `item-sandbox-fixture`,
  });
}
