// The Demeter mark.
//
// Lives once so the header, the favicon (app/icon.png) and the OG card
// can't drift apart.
//
// v3 (2026-08-09): switched from a hand-built inline SVG (v1/v2 — see git
// history) to /public/demeter-wheat-mark.png, a copy of the existing
// civica-wheat-mark.png asset renamed for the Demeter surfaces. The
// original civica-wheat-mark.png stays exactly where it is — it's Civica's
// own live mark, referenced by 13+ call sites across apps/web and
// apps/dashboard (ApplyHeader, AppNav, dashboard auth pages, cbo-preview,
// compliance, AppHeader, etc.) — a rename in place would 404 all of those.
// This is a separate, Demeter-scoped copy, not a move.
import Image from "next/image";

export function DemeterMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/demeter-wheat-mark.png"
      alt="Demeter"
      width={size}
      height={size}
      // The mark sits in the header above the fold on every Demeter surface.
      // Lazy-loading it would pop the brand in after first paint, which is the
      // one image on the page where that is worth avoiding.
      priority
      style={{ display: "block", flex: "none", width: size, height: size, borderRadius: "50%" }}
    />
  );
}
