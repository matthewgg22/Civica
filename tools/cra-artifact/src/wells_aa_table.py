"""Wells Fargo's per-assessment-area giving, anchored on the SECTION OPENER.

Each AA's Investment discussion opens "<AA name> The bank had an excellent level
of qualified CD investments and grants..." and states the grants subset a few
sentences later. Anchoring on the nearest MENTION of a place name instead put
Fresno's $5.5M under Los Angeles, so the anchor is the opener, found by walking
backwards from the figure to the closest preceding opener.
"""
import re, json

t = re.sub(r"\s+", " ", open("wells.txt", errors="ignore").read())

OPENER = re.compile(r"((?:[A-Z][A-Za-z.\-]+[ \-]){1,5}(?:CSA|MSA|MMSA|MD|Non-MSA))\s+"
                    r"The bank had an?\s+(?:excellent|good|adequate|poor|significant)")
FIG = re.compile(r"([\d,]+)\s+grants and donations totaling\s+(\$[\d,.]+\s*(?:million|billion|thousand)?)")

openers = [(m.start(), m.group(1).strip()) for m in OPENER.finditer(t)]
print(f"section openers found: {len(openers)}")

def money(s):
    s = s.replace("$", "").replace(",", "").strip().lower()
    m = re.match(r"([\d.]+)\s*(million|billion|thousand)?", s)
    return int(float(m.group(1)) * {"million": 1e6, "billion": 1e9, "thousand": 1e3}.get(m.group(2), 1))

rows = {}
for m in FIG.finditer(t):
    prior = [o for o in openers if o[0] < m.start()]
    if not prior:
        continue
    pos, aa = prior[-1]
    if m.start() - pos > 3000:      # too far from its opener to trust
        continue
    rows[aa] = {"grants": m.group(1), "usd": money(m.group(2)), "raw": m.group(2).strip()}

print(f"assessment areas with a section-anchored figure: {len(rows)}\n")
for aa, r in sorted(rows.items(), key=lambda kv: -kv[1]["usd"])[:26]:
    print(f"  {aa[:36]:38}{r['grants']:>8} grants   ${r['usd']:>13,}")
json.dump(rows, open("wells_aa_giving.json", "w"), indent=1)
print(f"\ntotal across these areas: ${sum(r['usd'] for r in rows.values()):,}")
