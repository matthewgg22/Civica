// A state or territory flag, with its code beside it.
//
// This replaces a bare two-letter monogram. The monogram was chosen earlier
// BECAUSE state flags are famously illegible small — most are a seal on a blue
// field, and at 24px they are a smudge. That reasoning still holds; what it
// missed is that the flag and the code are not alternatives. The flag is
// RECOGNITION (you know your own before you read anything) and the code is
// LEGIBILITY (it survives any size, any screen, any eyesight). Together they
// do the job neither does alone, which is why the code sits beside the flag
// rather than being replaced by it.
//
// Flags come from the WeVote target's asset catalogue — all 56, including DC
// and every territory, so a newly verified state never silently ships without
// one. Rendered through next/image, so a 250x167 source is served at the ~28px
// it actually occupies.

import Image from "next/image";

/** Which codes have a flag file. Everything in public/flags, lowercased. */
const HAS_FLAG = new Set([
  "ak", "al", "ar", "as", "az", "ca", "co", "ct", "dc", "de", "fl", "ga", "gu",
  "hi", "ia", "id", "il", "in", "ks", "ky", "la", "ma", "md", "me", "mi", "mn",
  "mo", "mp", "ms", "mt", "nc", "nd", "ne", "nh", "nj", "nm", "nv", "ny", "oh",
  "ok", "or", "pa", "pr", "ri", "sc", "sd", "tn", "tx", "ut", "va", "vi", "vt",
  "wa", "wi", "wv", "wy",
]);

export function StateFlag({
  code,
  /** The federal floor is not a place and has no flag — it renders as the
   *  code alone, which is also what any future code without an asset does.
   *  Failing to a readable mark beats failing to a broken image. */
  size = 26,
}: {
  code: string;
  size?: number;
}) {
  const lower = code.toLowerCase();
  const has = HAS_FLAG.has(lower);
  return (
    <span className="dmflag" data-noflag={has ? undefined : "true"}>
      {has && (
        <Image
          className="dmflag__img"
          src={`/flags/${lower}.png`}
          // Decorative: the code beside it carries the meaning, and "flag of
          // California" read aloud before every option would be noise in a
          // list of fifty.
          alt=""
          aria-hidden
          width={size}
          height={Math.round((size * 167) / 250)}
        />
      )}
      <span className="dmflag__code">{code.toUpperCase()}</span>
    </span>
  );
}
