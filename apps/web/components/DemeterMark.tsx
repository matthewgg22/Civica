// The Demeter mark — terracotta disc, wheat-gold grains.
//
// Lives once so the header, the favicon (app/icon.svg) and the OG card
// can't drift apart. Wheat gold (#EFB544) appears on the mark and nowhere
// else in the UI, per the identity spec.
//
// Extracted from the identity kit's 200x200 master; the design tool's
// construction grid (guide circles and axes) was stripped — it is
// scaffolding for showing geometry, not part of the artwork.

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
      <g fill="#F7F1E8">
      <path d="M100 20 C107 30 110 41 106 50 C104 54 102 56.5 100 58 C98 56.5 96 54 94 50 C90 41 93 30 100 20 Z" fill="#EFB544"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(98 90) scale(-0.76,0.76)"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(98 128) scale(-0.81,0.81)"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(98 166) scale(-0.86,0.86)"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(102 108) scale(0.78,0.78)"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(102 148) scale(0.84,0.84)"></path>
      <path d="M0 0 C0 -10 1 -21 5 -29 C8 -35 14 -39 22 -42 C27 -34 31 -24 31 -14 C31 -5 23 0 9 0 C3 0 1 0 0 0 Z" fill="#EFB544" transform="translate(102 187) scale(0.90,0.90)"></path>
      <path d="M56 169 L100 165 L100 172 L56 176 Z" fill="#2A211C"></path></g>
    </svg>
  );
}
