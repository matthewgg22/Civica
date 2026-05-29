import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import DeviceApprovalFlow from "../../../components/DeviceApprovalFlow";

/**
 * /extension/connect — OAuth Device Authorization Grant approval screen
 * (RFC 8628), issue #317 part 2.
 *
 * The Civica Submitter browser extension starts a device flow and shows the
 * assister a short user_code + this URL. The assister opens it in the dashboard
 * (signed in as their CBO), confirms what's connecting, and approves — which
 * binds the extension's eventual token to *their* org so it can pull that org's
 * packets and fill the BenefitsCal gov form.
 *
 * Auth: middleware.ts already gates every non-public route — an unauthenticated
 * visitor is redirected to /login before this renders, and a non-staff JWT is
 * bounced with ?error=staff_only. We read the user here only to surface the
 * signed-in email (so the assister can confirm they're on the right account)
 * and to fail closed if the session somehow evaporated between the middleware
 * check and render. The backend is the real authority: it re-checks
 * requireNavigator and resolves the org from the JWT, never from the client.
 *
 * verification_uri_complete deep-links ?user_code=XXXX-XXXX (see oauth.ts);
 * we pass it through so the flow can prefill + auto-look-up.
 */
export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
      <DeviceApprovalFlow
        initialUserCode={params.user_code ?? null}
        signedInEmail={user?.email ?? null}
      />
    </div>
  );
}
