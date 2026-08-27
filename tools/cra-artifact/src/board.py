"""Generate the CRA outreach board from source data.

The board had been appended to by hand for weeks. Two things went wrong that a
generator prevents. It became reverse-chronological -- seventeen method sections
stacked ahead of the roster, so the operator scrolled past the whole method to
reach the list of banks to contact. And it drifted: every county card printed
796,577 unenrolled, which is the Los Angeles figure, repeated eleven times.

Design notes
------------
Structure is the subject's own: CRA component ratings are a five-step ordinal
scale (Outstanding / High Satisfactory / Low Satisfactory / Needs to Improve /
Substantial Noncompliance), so that scale IS the semantic colour ramp. Pitch
archetype is an orthogonal dimension and gets chips, not colour weight.

Figures are set in a monospace face with tabular numerals because the source
material -- bank examination reports -- is monospaced tabular disclosure, and
because columns of dollars have to line up to be scanned.
"""
from __future__ import annotations

import csv
import datetime
import html
import json
import sys
from collections import defaultdict
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1]
REPO = TOOL.parents[1]
sys.path.insert(0, str(TOOL))
from src import archetype  # noqa: E402

ANALYSIS = REPO / "data-ops/analysis"

RATING_CLASS = {
    "outstanding": "r-out", "high satisfactory": "r-high",
    "low satisfactory": "r-low", "needs to improve": "r-nti",
    "substantial noncompliance": "r-snc", "substantial non complianc": "r-snc",
}
RATING_SHORT = {
    "outstanding": "Outstanding", "high satisfactory": "High Sat",
    "low satisfactory": "Low Sat", "needs to improve": "Needs Impr",
    "substantial noncompliance": "Sub Noncomp",
}
ARCHETYPE_LABEL = {
    "peer": "Peer", "remediation": "Remediation",
    "service_partnership": "Service partnership", "pooled": "Pooled",
}
ARCHETYPE_BLURB = {
    "peer": "Clean Service rating, real giving. Leads with their own disclosed figure.",
    "remediation": "Documented Service Test gap. Quotes the examiner's own finding.",
    "service_partnership": "Meets CRA through instruments, not grants. A bond cannot cure a service finding.",
    "pooled": "Small capacity. One document, several names.",
}

REGISTRATION = [
    ("CA", "CT-1", 50, "prepared, unfiled"),
    ("IL", "BCO-10", 200, "late filing priced at $200"),
    ("MA", "Form PC + A-2", 150, "prepared, unfiled"),
    ("PA", "BCO-10 + BCO-23", 15, "prepared, unfiled"),
    ("NY", "CHAR410", 25, "prepared, unfiled"),
    ("TN", "SS-6001", 50, "or claim exemption"),
    ("AZ", "none", 0, "repealed 2013 (HB 2457)"),
    ("TX", "none", 0, "no such requirement"),
]


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""))


def money(n) -> str:
    return f"${n:,.0f}" if n else "—"


def load():
    banks = json.loads((TOOL / "inputs/assessment_areas.json").read_text())["banks"]

    unenrolled, county_meta = {}, {}
    src = ANALYSIS / "bank-pe-mining/county_pressure_coverage_2026.csv"
    for r in csv.DictReader(src.open()):
        key = (r["county"], r["state"])
        try:
            unenrolled[key] = int(r["unenrolled_persons"])
        except (ValueError, KeyError):
            continue
        county_meta[key] = r.get("method", "")

    depth_path = ANALYSIS / "cra-universe-2026/county_depth.json"
    depth = json.loads(depth_path.read_text()) if depth_path.exists() else {}

    contacts = {}
    cpath = ANALYSIS / "bank-pe-mining/bank_contacts_2026.csv"
    if cpath.exists():
        for r in csv.DictReader(cpath.open()):
            contacts[r["bank_key"]] = r
    return banks, unenrolled, county_meta, depth, contacts


def sendable(banks):
    out = {}
    for k, v in banks.items():
        if v.get("target_status") != "target":
            continue
        if v.get("ask_verdict") not in ("earmark", "pool"):
            continue
        try:
            arch = archetype.resolve(v)
        except archetype.ArchetypeError:
            continue
        if v.get("ask_scope_caveat") and arch != "service_partnership":
            continue
        out[k] = (v, arch)
    return out


def rating_chip(value) -> str:
    key = (value or "").strip().lower()
    if not key:
        return '<span class="chip r-none">not on file</span>'
    return (f'<span class="chip {RATING_CLASS.get(key, "r-none")}">'
            f'{esc(RATING_SHORT.get(key, value))}</span>')


# --- sections ---------------------------------------------------------------

def roster_section(send, unenrolled, county_meta, contacts) -> str:
    # Each bank appears ONCE, under the highest-need county inside its assessment
    # area. Listing it under every county in a nine-county area turns a roster of
    # thirty into a hundred and forty rows and makes the card totals meaningless.
    by_county = defaultdict(list)
    for key, (b, arch) in send.items():
        counties = b.get("aa_counties") or []
        if not counties:
            continue
        home = max(counties, key=lambda c: unenrolled.get((c, b["state"]), 0))
        by_county[(home, b["state"])].append((key, b, arch))

    ranked = sorted(by_county.items(),
                    key=lambda kv: -(unenrolled.get(kv[0], 0)))
    cards = []
    for (county, st), rows in ranked:
        rows.sort(key=lambda r: -(r[1].get("ask_usd") or 0))
        total = sum(r[1].get("ask_usd") or 0 for r in rows)
        un = unenrolled.get((county, st))
        # Not every assessment-area county carries a modelled figure. Print an
        # em dash rather than a zero: a missing estimate is not "nobody here".
        # Fresno and Kern carry no estimate because their measured SNAP
        # households exceed their poor households -- coverage at or above 1.
        # That is a finding, not a hole, and the card should say which it is.
        un_txt = f"{un:,}" if un else "no measured gap"
        meth = county_meta.get((county, st), "")
        bank_rows = []
        for key, b, arch in rows:
            c = contacts.get(key)
            who = (f'{esc(c["contact_name"])} · <span class="muted">{esc(c["contact_title"])}</span>'
                   if c and c.get("contact_name") else '<span class="nocontact">no named contact</span>')
            bank_rows.append(f"""
        <tr>
          <td class="bk"><span class="bn">{esc(b['name'])}</span>
              <span class="tag t-{arch}">{ARCHETYPE_LABEL[arch]}</span></td>
          <td class="rt">{rating_chip(b.get('inv_rating'))}{rating_chip(b.get('svc_rating'))}</td>
          <td class="num">{money(b.get('ask_usd'))}</td>
          <td class="who">{who}</td>
        </tr>""")
        cards.append(f"""
    <section class="county">
      <header class="ch">
        <h3>{esc(county)}<span class="st">{esc(st)}</span></h3>
        <div class="figs">
          <div><span class="n">{un_txt}</span><span class="l">{'unenrolled' if un else 'coverage at or above 1'}{' · modeled' if meth=='MODELED' and un else ''}</span></div>
          <div><span class="n">{money(total)}</span><span class="l">prepared · {len(rows)} bank{"s" if len(rows)!=1 else ""}</span></div>
        </div>
      </header>
      <div class="scroll"><table class="banks-t">
        <thead><tr><th>Bank</th><th>Investment · Service</th><th class="num">Ask</th><th>Contact</th></tr></thead>
        <tbody>{''.join(bank_rows)}
        </tbody>
      </table></div>
    </section>""")
    return "\n".join(cards)


def depth_section(depth, send) -> str:
    on = defaultdict(int)
    for key, (b, arch) in send.items():
        for c in b.get("aa_counties", []):
            on[f"{c},{b['state']}"] += 1
    rows = sorted(depth.items(), key=lambda kv: -len(kv[1]))
    mx = max((len(v) for v in depth.values()), default=1)
    out = []
    for county, banks in rows:
        n, a = on.get(county, 0), len(banks)
        pct_worked = (n / a * 100) if a else 0
        out.append(f"""
      <tr>
        <td class="cty">{esc(county)}</td>
        <td class="bar">
          <div class="track" style="--w:{a/mx*100:.1f}%">
            <div class="fill" style="--f:{pct_worked:.1f}%"></div>
          </div>
        </td>
        <td class="num on">{n}</td>
        <td class="num">{a}</td>
        <td class="num gap">{a-n}</td>
      </tr>""")
    return "".join(out)


def registration_rows() -> str:
    out = []
    for st, form, cost, note in REGISTRATION:
        cls = "free" if cost == 0 else "cost"
        out.append(f"""
      <tr>
        <td class="cty">{st}</td><td>{esc(form)}</td>
        <td class="num {cls}">{'—' if cost==0 else f'${cost}'}</td>
        <td class="muted">{esc(note)}</td>
      </tr>""")
    return "".join(out)


def build() -> str:
    banks, unenrolled, county_meta, depth, contacts = load()
    send = sendable(banks)
    total = sum(b.get("ask_usd") or 0 for b, _ in send.values())
    counts = defaultdict(int)
    for _, arch in send.values():
        counts[arch] += 1

    blocked = [k for k, v in banks.items()
               if v.get("ask_scope_caveat") and k not in send]
    read_log = ANALYSIS / "cra-universe-2026/pe_read_log_2026.csv"
    n_read = sum(1 for _ in csv.DictReader(read_log.open())) if read_log.exists() else 0
    reg_total = sum(c for _, _, c, _ in REGISTRATION)
    today = datetime.date.today().strftime("%-d %B %Y")

    arch_cards = "".join(
        f"""
      <div class="ac t-{a}">
        <div class="acn">{counts.get(a,0)}</div>
        <div class="act">{ARCHETYPE_LABEL[a]}</div>
        <div class="acb">{ARCHETYPE_BLURB[a]}</div>
      </div>""" for a in ("peer", "remediation", "service_partnership", "pooled"))

    return f"""<title>CRA Outreach Board</title>
<style>
:root {{
  --paper:#f2f5f6; --card:#ffffff; --sunk:#e8edee;
  --ink:#0f1618; --soft:#546266; --faint:#8c989c; --rule:#d8e0e2;
  --accent:#0d4f54; --accent-ink:#ffffff; --accent-soft:#dfebec;
  --r-out:#176b5c; --r-high:#4a7f52; --r-low:#a8761f; --r-nti:#a3441a; --r-snc:#84291a;
  --r-none:#9aa5a8; --chip-ink:#ffffff;
  --t-peer:#0d4f54; --t-remediation:#a3441a; --t-service_partnership:#5b4a86; --t-pooled:#6b7377;
  --shadow:0 1px 2px rgba(15,22,24,.05), 0 8px 24px rgba(15,22,24,.045);
  --sans:ui-sans-serif,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --paper:#0d1113; --card:#151b1e; --sunk:#10171a;
    --ink:#e7eded; --soft:#9fadb1; --faint:#71807f; --rule:#263033;
    --accent:#5fb3ac; --accent-ink:#07100f; --accent-soft:#16302f;
    --r-out:#4bbf9f; --r-high:#7fb87f; --r-low:#d3a44b; --r-nti:#e0784a; --r-snc:#d95f45;
    --r-none:#6c7a7d; --chip-ink:#0b1112;
    --t-peer:#5fb3ac; --t-remediation:#e0784a; --t-service_partnership:#a996d8; --t-pooled:#8c999d;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.28);
  }}
}}
:root[data-theme="dark"] {{
  --paper:#0d1113; --card:#151b1e; --sunk:#10171a;
  --ink:#e7eded; --soft:#9fadb1; --faint:#71807f; --rule:#263033;
  --accent:#5fb3ac; --accent-ink:#07100f; --accent-soft:#16302f;
  --r-out:#4bbf9f; --r-high:#7fb87f; --r-low:#d3a44b; --r-nti:#e0784a; --r-snc:#d95f45;
  --r-none:#6c7a7d; --chip-ink:#0b1112;
  --t-peer:#5fb3ac; --t-remediation:#e0784a; --t-service_partnership:#a996d8; --t-pooled:#8c999d;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.28);
}}
* {{ box-sizing:border-box; }}
body {{ background:var(--paper); color:var(--ink); font-family:var(--sans);
  font-size:15px; line-height:1.55; margin:0; -webkit-font-smoothing:antialiased; }}
.wrap {{ max-width:1080px; margin:0 auto; padding:0 24px 96px; }}

/* masthead */
.mast {{ padding:44px 0 26px; border-bottom:2px solid var(--ink); margin-bottom:0; }}
.eyebrow {{ font-family:var(--mono); font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--accent); margin:0 0 10px; }}
h1 {{ font-size:clamp(30px,4.4vw,44px); line-height:1.04; letter-spacing:-.022em;
  margin:0 0 12px; text-wrap:balance; font-weight:680; }}
.dek {{ font-size:16px; color:var(--soft); max-width:64ch; margin:0; }}

/* headline figures */
.tally {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:1px; background:var(--rule); border:1px solid var(--rule);
  border-top:none; margin:0 0 40px; }}
.tally > div {{ background:var(--card); padding:18px 20px; }}
.tally .n {{ display:block; font-family:var(--mono); font-size:26px; font-weight:600;
  letter-spacing:-.02em; font-variant-numeric:tabular-nums; }}
.tally .l {{ display:block; font-size:11.5px; color:var(--soft); margin-top:3px;
  letter-spacing:.04em; text-transform:uppercase; }}

h2 {{ font-size:13px; font-family:var(--mono); letter-spacing:.13em; text-transform:uppercase;
  color:var(--accent); margin:52px 0 6px; font-weight:600; }}
.sub {{ color:var(--soft); font-size:14.5px; margin:0 0 20px; max-width:66ch; }}

/* archetypes */
.archs {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; }}
.ac {{ background:var(--card); border:1px solid var(--rule); border-top:3px solid var(--tc);
  padding:16px 17px; box-shadow:var(--shadow); }}
.ac.t-peer {{ --tc:var(--t-peer); }} .ac.t-remediation {{ --tc:var(--t-remediation); }}
.ac.t-service_partnership {{ --tc:var(--t-service_partnership); }} .ac.t-pooled {{ --tc:var(--t-pooled); }}
.acn {{ font-family:var(--mono); font-size:30px; font-weight:600; line-height:1;
  color:var(--tc); font-variant-numeric:tabular-nums; }}
.act {{ font-size:13.5px; font-weight:640; margin:7px 0 5px; }}
.acb {{ font-size:12.5px; color:var(--soft); line-height:1.45; }}

/* county roster */
.county {{ background:var(--card); border:1px solid var(--rule); margin:0 0 16px;
  box-shadow:var(--shadow); }}
/* the roster table scrolls inside its own card so the page body never does */
.county .scroll {{ overflow-x:auto; }}
.banks-t {{ min-width:560px; }}
.ch {{ display:flex; flex-wrap:wrap; gap:16px; align-items:baseline;
  justify-content:space-between; padding:15px 18px; background:var(--sunk);
  border-bottom:1px solid var(--rule); }}
.ch h3 {{ margin:0; font-size:17px; letter-spacing:-.012em; font-weight:650; }}
.ch .st {{ font-family:var(--mono); font-size:11px; color:var(--soft);
  margin-left:8px; letter-spacing:.08em; }}
.figs {{ display:flex; gap:26px; }}
.figs .n {{ display:block; font-family:var(--mono); font-size:15px; font-weight:600;
  font-variant-numeric:tabular-nums; }}
.figs .l {{ display:block; font-size:10.5px; color:var(--faint);
  text-transform:uppercase; letter-spacing:.05em; }}

table {{ width:100%; border-collapse:collapse; }}
.banks-t {{ font-size:13.5px; }}
.banks-t th {{ text-align:left; font-size:10.5px; text-transform:uppercase;
  letter-spacing:.07em; color:var(--faint); font-weight:600;
  padding:9px 18px; border-bottom:1px solid var(--rule); }}
.banks-t td {{ padding:11px 18px; border-bottom:1px solid var(--rule); vertical-align:top; }}
.banks-t tr:last-child td {{ border-bottom:none; }}
.bn {{ font-weight:600; }}
.num {{ text-align:right; font-family:var(--mono); font-variant-numeric:tabular-nums;
  white-space:nowrap; }}
.who {{ font-size:12.5px; }}
.muted {{ color:var(--soft); }}
.nocontact {{ color:var(--faint); font-style:italic; }}

.chip {{ display:inline-block; font-family:var(--mono); font-size:10px; letter-spacing:.03em;
  padding:2px 7px; border-radius:2px; margin-right:5px; white-space:nowrap;
  color:var(--chip-ink); background:var(--rc); }}
.chip.r-out {{ --rc:var(--r-out); }} .chip.r-high {{ --rc:var(--r-high); }}
.chip.r-low {{ --rc:var(--r-low); }} .chip.r-nti {{ --rc:var(--r-nti); }}
.chip.r-snc {{ --rc:var(--r-snc); }} .chip.r-none {{ --rc:var(--r-none); }}

.tag {{ display:inline-block; font-size:10px; letter-spacing:.05em; text-transform:uppercase;
  padding:1px 6px; margin-left:7px; border:1px solid var(--tc); color:var(--tc);
  border-radius:2px; vertical-align:1px; font-weight:600; }}
.tag.t-peer {{ --tc:var(--t-peer); }} .tag.t-remediation {{ --tc:var(--t-remediation); }}
.tag.t-service_partnership {{ --tc:var(--t-service_partnership); }} .tag.t-pooled {{ --tc:var(--t-pooled); }}

/* depth + registration tables */
.panel {{ background:var(--card); border:1px solid var(--rule); box-shadow:var(--shadow);
  overflow-x:auto; }}
.dt {{ font-size:13.5px; min-width:520px; }}
.dt th {{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.07em;
  color:var(--faint); font-weight:600; padding:11px 16px; border-bottom:1px solid var(--rule); }}
.dt td {{ padding:9px 16px; border-bottom:1px solid var(--rule); }}
.dt tr:last-child td {{ border-bottom:none; }}
.cty {{ font-weight:600; white-space:nowrap; }}
.bar {{ width:46%; }}
.track {{ width:var(--w); height:9px; background:var(--sunk);
  border:1px solid var(--rule); position:relative; min-width:12px; }}
.fill {{ position:absolute; inset:0 auto 0 0; width:var(--f); background:var(--accent); }}
.on {{ color:var(--accent); font-weight:600; }}
.gap {{ color:var(--r-nti); font-weight:600; }}
.free {{ color:var(--r-out); }} .cost {{ color:var(--soft); }}

/* method */
details {{ background:var(--card); border:1px solid var(--rule); margin-bottom:10px; }}
summary {{ padding:13px 18px; cursor:pointer; font-weight:600; font-size:14px;
  list-style:none; display:flex; justify-content:space-between; gap:16px; align-items:baseline; }}
summary::-webkit-details-marker {{ display:none; }}
summary::after {{ content:"+"; font-family:var(--mono); color:var(--accent); font-size:16px; }}
details[open] summary::after {{ content:"–"; }}
summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:-2px; }}
.dbody {{ padding:0 18px 18px; font-size:13.5px; color:var(--soft); max-width:72ch; }}
.dbody p {{ margin:0 0 10px; }}
.dbody strong {{ color:var(--ink); }}
.dbody code {{ font-family:var(--mono); font-size:12px; background:var(--sunk); padding:1px 5px; }}
.smeta {{ font-family:var(--mono); font-size:11px; color:var(--faint); font-weight:400; }}

.note {{ border-left:3px solid var(--accent); background:var(--card);
  padding:14px 18px; margin:18px 0; font-size:13.5px; box-shadow:var(--shadow); }}
.note strong {{ color:var(--ink); }}
footer {{ margin-top:56px; padding-top:18px; border-top:1px solid var(--rule);
  font-size:12px; color:var(--faint); font-family:var(--mono); }}
@media (max-width:560px) {{
  .ch {{ flex-direction:column; gap:10px; }}
  .figs {{ gap:20px; }}
  .tally {{ grid-template-columns:repeat(2,1fr); }}
}}
@media (prefers-reduced-motion: reduce) {{ * {{ animation:none !important; transition:none !important; }} }}
</style>

<div class="wrap">
  <header class="mast">
    <p class="eyebrow">Civica Torrey Inc · Community Reinvestment Act</p>
    <h1>Bank outreach, priced and ready to send</h1>
    <p class="dek">Every assessment area read from the bank's own performance evaluation, every
    ask anchored on giving it disclosed <em>in that area</em>, every institution confirmed live
    against BankFind. Nothing here is inferred from a bank's website.</p>
  </header>

  <div class="tally">
    <div><span class="n">{len(send)}</span><span class="l">banks ready</span></div>
    <div><span class="n">{money(total)}</span><span class="l">prepared asks</span></div>
    <div><span class="n">{n_read}</span><span class="l">evaluations read</span></div>
    <div><span class="n">1,781</span><span class="l">addressable universe</span></div>
    <div><span class="n">${reg_total}</span><span class="l">total registration cost</span></div>
  </div>

  <h2>Four pitches, not one</h2>
  <p class="sub">Rating and giving are independent. Capacity decides whether a bank <em>can</em>
  fund us; a <strong>Service Test</strong> gap decides whether it has a reason to act now. The
  generator refuses to send the wrong letter — a clean-rated bank cannot be told examiners
  flagged it.</p>
  <div class="archs">{arch_cards}</div>

  <h2>The roster, by county</h2>
  <p class="sub">Ordered by unenrolled residents. A county with several banks can carry a pooled
  ask; a county with one cannot.</p>
{roster_section(send, unenrolled, county_meta, contacts)}

  <h2>Depth per county</h2>
  <p class="sub">The bar is how many addressable banks hold branches there; the filled portion is
  how many are on the roster. <strong>This is the gap that matters</strong> — the reading queue was
  ordered nationally, which spread it thin instead of going deep anywhere.</p>
  <div class="panel">
    <table class="dt">
      <thead><tr><th>County</th><th>Worked / addressable</th><th class="num">On roster</th>
      <th class="num">Addressable</th><th class="num">Unworked</th></tr></thead>
      <tbody>{depth_section(depth, send)}</tbody>
    </table>
  </div>

  <h2>Charitable registration</h2>
  <p class="sub">A cost, not a wall. Arizona and Texas require nothing at all, and most states
  permit late registration outright.</p>
  <div class="panel">
    <table class="dt">
      <thead><tr><th>State</th><th>Form</th><th class="num">Fee</th><th>Status</th></tr></thead>
      <tbody>{registration_rows()}</tbody>
    </table>
  </div>

  <h2>Method, and what it cost to learn</h2>
  <p class="sub">Open only what you need. Each of these is a rule the pipeline now enforces in
  code, and most were bought with a mistake.</p>

  <details>
    <summary>Does this actually qualify for CRA credit? <span class="smeta">the answer a bank will ask for</span></summary>
    <div class="dbody">
      <p><strong>The agencies named our category themselves.</strong> The 2016 Interagency Q&amp;A
      at §__.12(g)(2)—1 lists, among the ways a community service is shown to be LMI-targeted,
      services provided to recipients of government programs with income limits at or stricter
      than LMI — <em>"Examples include … U.S. Department of Agriculture's section 514, 516, and
      Supplemental Nutrition Assistance programs."</em> Pulled from the Federal Register PDF, not
      paraphrased.</p>
      <p><strong>36 of 120 evaluations</strong> in our corpus place food-security activity in a
      credit context. The Village Bank granted <strong>$71,000</strong> to the Newton Food Pantry,
      which the examiner recorded as supporting "a community development service to low- and
      moderate-income individuals." Credited amounts run <strong>$500 to $71,000</strong> — every
      ask here sits inside that band.</p>
      <p><strong>Raise the wrinkle first.</strong> The SNAP bullet says "recipients of"; much of our
      population is eligible but not yet enrolled. Two other bullets — defined mission, defined
      program — cover them cleanly. Naming it before the CRA officer finds it is the difference
      between being trusted and being discounted.</p>
      <p><strong>The trap:</strong> in bank evaluations "SNAP" usually means the FHLB
      <em>Special Needs Assistance Program</em>, a home-repair subsidy — 4 of 7 literal hits in the
      corpus. Never tell a bank it already funds SNAP without opening the PDF.</p>
    </div>
  </details>

  <details>
    <summary>Why the screen changed <span class="smeta">an Investment gap predicts nothing</span></summary>
    <div class="dbody">
      <p>A bank can satisfy the <strong>Investment</strong> Test with LIHTC funds, municipal bonds
      and SBICs while writing almost no grants. Parkway holds <strong>$27.1M</strong> of investments
      in its Illinois assessment area against <strong>$7,000</strong> of grants; FirstBank $84.5M
      against $126,000. Screening on that to ask for a grant was close to a category error.</p>
      <p>The <strong>Service Test</strong> survives: our activity is service delivery, and a bond
      cannot cure a service finding. Investment gap is dropped as a targeting signal; capacity
      becomes a screen in its own right.</p>
      <p>Of 336 large banks carrying a Service rating, <strong>231 are clean</strong> — every one
      structurally unreachable by a gap-filtered query. Truist, the largest peer candidate found
      anywhere, was invisible to every query run before that change.</p>
    </div>
  </details>

  <details>
    <summary>Five predictors tried, five discarded <span class="smeta">why every figure is hand-read</span></summary>
    <div class="dbody">
      <p>Whether an evaluation publishes a per-assessment-area donations figure turns out to be a
      formatting choice by the examining office. Rejected in turn: <strong>national branch
      concentration</strong> (First-Citizens has 2 branches of ~550 in Phoenix and Phoenix was
      still full-scope); <strong>within-state branch share</strong> (banks <em>without</em> a figure
      scored higher — 34%, 31%, 25% — than those with it — 26%, 18%, 9%); <strong>strict
      table-subject matching</strong> (4 of 8, worse than the simple version); and
      <strong>asset size</strong> (medians $16.8B vs $13.0B, almost complete overlap — Pinnacle at
      $41.8B has none, Republic at $7.0B has one).</p>
      <p>What ships is <code>scope_probe.py</code>: fetch, extract with <code>-layout</code>, report
      scope and whether a donations row sits near the area's name. <strong>6 of 8</strong>, and a
      hint that orders a queue rather than a gate. Flattened text destroys table row labels, so the
      numbers survive while the assessment area that owns them does not.</p>
    </div>
  </details>

  <details>
    <summary>The wrong-AA trap, caught five times <span class="smeta">the most expensive recurring error</span></summary>
    <div class="dbody">
      <p>A dollar figure lifted from the wrong assessment area is the failure mode this project pays
      for most. City National's $13.2M is Los Angeles, not the Washington MMSA. Ocean's $492,000 is
      institution-wide, not Miami-Dade. Truist's $274.3M is bank-wide and its $22.9M is Raleigh —
      Houston's is $1.9M. Prosperity's first ratings block is <strong>Oklahoma's</strong>, not
      Texas's. And IBC's clean-looking sentence — "279 qualified donations totaling $1.2 million
      within the assessment area" — belongs to <strong>Laredo</strong>.</p>
      <p><strong>Assessment areas are not interchangeable even in one metro.</strong> Truist's
      Houston area is nine counties, Frost's is five and explicitly excludes four, OZK's is two.
      Copying one to another would have overstated Frost's by four counties.</p>
      <p>A test now requires every recorded figure to name the area it came from, or to declare
      itself institution-wide.</p>
    </div>
  </details>

  <details>
    <summary>Stale findings and phantom targets <span class="smeta">two guards, both bought with near-misses</span></summary>
    <div class="dbody">
      <p><strong>Busey was one step from a letter quoting a finding it had already fixed.</strong>
      Its artifact rested on the March 2022 evaluation — "no branches, limited service facilities,
      or ATMs within low- and moderate-income areas." The October 2025 evaluation rates Investment
      Outstanding and Service High Satisfactory. It hid because Busey is a <em>Federal Reserve</em>
      state member bank while the record said FDIC, and because CRAPES publishes the
      <em>public</em> date, not the exam date — comparing against it raised 18 false alarms.</p>
      <p>Any remediation pitch quoting a finding older than four years now fails the build without
      an explicit caution. Meridian (3.7y) and CTBC (3.6y) are next to cross.</p>
      <p><strong>Three phantom targets</strong> reached the queue with branches in counties their
      evaluations never mention — German American (Ohio appears once, Franklin never), Umpqua
      (Arizona, Phoenix, Maricopa all zero) and Bank of England. FDIC branch data is current while
      an evaluation is historical, so any acquisition in between manufactures a target that does not
      exist. The pre-filter now catches it: <strong>7 of 7</strong>.</p>
    </div>
  </details>

  <details>
    <summary>What is still not covered <span class="smeta">named and sized, not vague</span></summary>
    <div class="dbody">
      <p><strong>FDIC — 2,662 institutions:</strong> complete. <strong>Federal Reserve — 699:</strong>
      complete. <strong>OCC — 878:</strong> a permanent blind spot. The OCC publishes no searchable
      component ratings, so 200 large-bank-sized institutions can only be checked one at a time once
      a name is already known — which is exactly how Woodforest and Northfield had to enter.</p>
      <p><strong>Massachusetts has no "Low Satisfactory."</strong> Its Division of Banks collapses
      the two middle federal grades into one, so every MA bank scored clean off a "Satisfactory" was
      misclassified. New York, Connecticut and Rhode Island are unverified for the same defect.</p>
      <p><strong>The 2022–23 CRAPES vintage is defective</strong> — 25.1% Substantial Noncompliance
      against 0.1% in every other year. Any component rating from that window needs the PDF.</p>
      <p><strong>Never screened at all:</strong> credit unions, and ~70 New York lenders — check that
      NYDFS actually publishes evaluations first, since Illinois cost a full workstream because IDFPR
      publishes none.</p>
    </div>
  </details>

  <div class="note">
    <strong>Blocked on a figure that does not exist:</strong> {esc(', '.join(sorted(b['name'] for k,b in banks.items() if k in blocked)) or 'none')}.
    Each is a real target whose evaluation simply contains no per-assessment-area donations figure —
    limited-scope areas do not receive one. Waiting on it means waiting forever.
  </div>

  <footer>Generated {esc(today)} from assessment_areas.json · county_depth.json ·
  county_pressure_coverage_2026.csv · bank_contacts_2026.csv — never hand-edited.</footer>
</div>
"""


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else TOOL / "out/outreach-board.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build())
    print(f"wrote {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
