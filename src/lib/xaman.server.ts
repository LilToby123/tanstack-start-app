/**
 * Xaman (XUMM) sign-in server functions for TanStack Start.
 *
 * Flow:
 *  1. Client calls POST /api/xaman/signin  → createXamanSignIn()
 *     Returns: { uuid, qr_png, deeplink }
 *  2. Client polls GET /api/xaman/signin/status?uuid=...  → checkXamanStatus()
 *     Returns: { signed: bool, expired: bool, address?: string }
 *  3. On signed=true, backend creates a Supabase user session keyed to the XRPL address.
 *
 * Deploy these as Supabase Edge Functions or TanStack server routes.
 * XUMM_API_KEY and XUMM_API_SECRET must be set in your environment.
 */

const XUMM_BASE = "https://xumm.app/api/v1/platform";

function xamanHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.XUMM_API_KEY ?? "",
    "x-api-secret": process.env.XUMM_API_SECRET ?? "",
  };
}

// ── Create sign-in payload ────────────────────────────────────────────────────
export async function createXamanSignIn(): Promise<{
  uuid: string;
  qr_png: string;
  deeplink: string;
  next_url: string;
}> {
  const res = await fetch(`${XUMM_BASE}/payload`, {
    method: "POST",
    headers: xamanHeaders(),
    body: JSON.stringify({
      txjson: { TransactionType: "SignIn" },
      options: {
        submit: false,
        expire: 5, // minutes
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xaman payload error: ${err}`);
  }
  const data = await res.json();
  return {
    uuid: data.uuid,
    qr_png: data.refs.qr_png,
    deeplink: data.next?.always ?? data.refs.qr_png,
    next_url: data.next?.always ?? "",
  };
}

// ── Check payload status ──────────────────────────────────────────────────────
export async function checkXamanStatus(uuid: string): Promise<{
  signed: boolean;
  expired: boolean;
  address: string | null;
}> {
  const res = await fetch(`${XUMM_BASE}/payload/${uuid}`, {
    headers: xamanHeaders(),
  });
  if (!res.ok) throw new Error("Xaman status check failed");
  const data = await res.json();

  const signed = data.meta?.signed === true;
  const expired = data.meta?.expired === true || data.meta?.cancelled === true;
  const address = data.response?.account ?? null;

  return { signed, expired, address };
}

// ── Create or fetch Supabase user for an XRPL address ─────────────────────────
// Call this server-side after checkXamanStatus returns signed=true.
// Uses Supabase admin client to create a user with email = `address@xrpl.flipxrpl`
// and a deterministic password (the address itself is not secret; the Xaman
// signature is the authentication proof). Then issue a session token.

export async function getOrCreateXrplUser(xrplAddress: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  const fakeEmail = `${xrplAddress.toLowerCase()}@xrpl.flipxrpl.internal`;
  // Try to sign in first (user exists)
  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users?.find((u) => u.email === fakeEmail);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create new user
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { xrpl_address: xrplAddress, auth_method: "xaman" },
    });
    if (error || !newUser.user) throw new Error(`Could not create user: ${error?.message}`);
    userId = newUser.user.id;

    // Ensure profile row exists
    await admin.from("profiles").upsert({
      id: userId,
      xrpl_address: xrplAddress,
      destination_tag: Math.floor(Math.random() * 4_294_967_295),
    });

    // Ensure balance row exists
    await admin.from("balances").upsert({ user_id: userId, drops: 0 });
  }

  // Issue a magic link / session token the client can use
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: fakeEmail,
  });
  if (linkErr || !link) throw new Error("Could not generate session link");

  return { userId, sessionLink: link.properties?.action_link ?? "" };
}