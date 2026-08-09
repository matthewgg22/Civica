// The Demeter mark — terracotta disc, wheat-gold grains, hand-inked white
// outline + stem.
//
// Lives once so the header, the favicon (app/icon.svg) and the OG card
// can't drift apart. Wheat gold (#EFB544) appears on the mark and nowhere
// else in the UI, per the identity spec.
//
// v2 (2026-08-09): reconciled against the reference wheat image the user
// supplied. That image combines two things that only existed SEPARATELY in
// the identity kit (/private/tmp/demeter-logo/): the terracotta+gold
// colorway from `Demeter Logo Kit.dc.html` (unchanged from v1 — same grain
// path data, same fill colors) and the rough white-outline + visible stem
// treatment from `Reference Wheat Kit.dc.html` (an alternate gold-circle/
// white-grain colorway that was never wired up). Grain paths are outlined
// with a parchment (#F7F1E8) stroke instead of pure white — matches the
// kit's own already-declared #F7F1E8 group fill rather than inventing a
// new token. Stroke width is deliberately modest (not a feTurbulence
// roughen filter) so the mark stays legible at favicon size (16-32px);
// the "hand-drawn" read comes from each grain's differing scale factor
// producing slightly different effective stroke weights, which is a
// byproduct of SVG's per-element transform scaling strokes along with
// geometry — kept intentionally rather than normalized away.
export function DemeterMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="Demeter"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="100" cy="100" r="90" fill="#C0553B"></circle>
      <path d="M100 58 L100 172" stroke="#F7F1E8" strokeWidth="4" strokeLinecap="round" fill="none"></path>
      <g fill="#EFB544" stroke="#F7F1E8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M100 20 C107 30 110 41 106 50 C104 54 102 56.5 100 58 C98 56.5 96 54 94 50 C90 41 93 30 100 20 Z"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(98 90) scale(-0.76,0.76)"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(98 128) scale(-0.81,0.81)"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(98 166) scale(-0.86,0.86)"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(102 108) scale(0.78,0.78)"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(102 148) scale(0.84,0.84)"></path>
        <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" transform="translate(102 187) scale(0.90,0.90)"></path>
      </g>
      <path d="M56 169 L100 165 L100 172 L56 176 Z" fill="#2A211C"></path>
    </svg>
  );
}
