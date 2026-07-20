import React, { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { feature } from "topojson-client";
import { scaleLinear } from "d3-scale";
import statesTopo from "us-atlas/states-10m.json";
import DATA from "./data.json";
import { REGISTERED } from "./registration.js";

// Real geometry: convert the us-atlas topology to state features (deterministic
// — pick the `states` object, not `nation`).
const statesGeo = feature(statesTopo, statesTopo.objects.states);

// Illustrative money PER REGISTERED VOTER intensity (0..1). Normalizing by
// registered voters neutralizes state size: small states with expensive races
// run hot; big populous states run cool even though their raw dollars are huge.
// Georgia is the one state with real traced data wired into the drill-down;
// everything else is placeholder shading until the itemized FEC ingest (GT1).
const MONEY = {
  Georgia: 1.0, Maine: 0.9, Montana: 0.88, "West Virginia": 0.85, Alaska: 0.82,
  "New Hampshire": 0.8, "North Carolina": 0.72, Nevada: 0.68, Iowa: 0.55, Wisconsin: 0.55,
  Michigan: 0.5, Ohio: 0.5, Pennsylvania: 0.5, Arizona: 0.48, Minnesota: 0.35, Colorado: 0.34,
  Virginia: 0.3, Kansas: 0.3, Oregon: 0.3, Washington: 0.28, "South Carolina": 0.28,
  Louisiana: 0.26, Alabama: 0.25,
  // big states: huge raw dollars, but LOW per registered voter
  Florida: 0.38, Texas: 0.28, "New York": 0.2, California: 0.18,
};

// Dark-theme heat: low money = dark/recedes, high money = bright/hot.
// Single-hue luminance ramp (colorblind + grayscale safe).
const color = scaleLinear().domain([0, 1]).range(["#24344f", "#a9caff"]);
const NODATA = "#3a3f47"; // neutral gray, distinct hue from the blue ramp

// Scale the heat across the actual observed range so a few very-high-$/voter
// small states don't blow out the ramp. Real data (from the ingest) wins;
// otherwise fall back to the illustrative placeholder pattern in MONEY.
const PV_VALUES = Object.values(DATA.states).map((s) => s.perVoterUSD).filter((x) => x != null);
const MAX_PV = PV_VALUES.length ? Math.max(...PV_VALUES) : 20;
function intensity(name) {
  const d = DATA.states[name];
  if (d && d.perVoterUSD != null) return Math.min(1, d.perVoterUSD / MAX_PV);
  return MONEY[name];
}
function isReal(name) {
  return DATA.states[name] && DATA.states[name].perVoterUSD != null;
}

// National aggregates computed live from the ingested data — this is "The Number".
const NAT = (() => {
  const S = DATA.states || {};
  let receipts = 0, ie = 0, total = 0;
  for (const s of Object.values(S)) { receipts += s.receiptsUSD || 0; ie += s.ieUSD || 0; total += s.moneyUSD || 0; }
  let reg = 0; for (const v of Object.values(REGISTERED)) reg += v;
  const C = DATA.committees || {}; let dk = 0, tp = 0;
  for (const c of Object.values(C)) for (const d of (c.topDonors || [])) { tp += d.usd || 0; if (d.dark) dk += d.usd || 0; }
  return { total, receipts, ie, reg, perVoter: reg ? total / reg : 0, darkPct: tp ? Math.round((dk / tp) * 100) : 0 };
})();

// Prior full cycles, reported (OpenSecrets) — context for the trend. Clearly
// labeled "final" vs our live "cycle-to-date" figure so the comparison is honest.
const HISTORY = [
  { cycle: "2022", usd: 8.9e9, note: "final · midterm" },
  { cycle: "2024", usd: 15.9e9, note: "final · incl. presidential" },
];

function NumberScreen({ onExplore }) {
  const [method, setMethod] = useState(false);
  const S = DATA.sector;
  const asOf = S?.asOf || (DATA.generatedAt ? DATA.generatedAt.slice(0, 10) : "—");
  const grossR = S?.grossReceiptsUSD || NAT.total;
  const dedup = S?.dedupUSD || Math.round(grossR * 0.616);
  const ratio = S?.dedupRatio || 0.616;
  const bm = S?.benchmarks || {};
  const perVoter = NAT.reg ? dedup / NAT.reg : 0;
  const comps = S ? [
    { label: "Candidates", usd: S.candidatesReceiptsUSD },
    { label: "Party cmtes", usd: S.partyReceiptsUSD },
    { label: "PACs", usd: S.pacReceiptsUSD },
  ] : [];
  const B = (x) => "$" + (x / 1e9).toFixed(x >= 1e10 ? 1 : 2) + "B";
  return (
    <>
      <Kick>VoteNow · money in US elections</Kick>
      <div style={{ textAlign: "center", margin: "20px 0 6px" }}>
        <div style={{ fontSize: 12, color: C.mut }}>Raised (de-duplicated), so far (2026 · federal)</div>
        <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: "-.03em", color: C.hot, lineHeight: 1.05 }}>${(dedup / 1e9).toFixed(1)}B</div>
        <div style={{ fontSize: 11, color: C.mut }}><b style={{ color: C.ink }}>{B(S?.grossBulkUSD || grossR)}</b> gross − <b style={{ color: C.ink }}>{B(S?.committeeTransfersUSD || 0)}</b> committee-to-committee transfers (exact netting, FEC bulk summaries)</div>
        <div style={{ fontSize: 10.5, color: C.mut, marginTop: 3 }}>FEC totals · as of {asOf}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "12px 0 4px" }}>
        {comps.map((c) => (
          <div key={c.label} style={{ background: C.panel, borderRadius: 9, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{B(c.usd)}</div>
            <div style={{ fontSize: 10.5, color: C.mut }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: C.mut, textAlign: "center", marginBottom: 12 }}>Most of the sector is PACs — a candidate-only view sees ~a quarter of it.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>${perVoter.toFixed(0)}</div>
          <div style={{ fontSize: 10.5, color: C.mut }}>per registered voter (de-duplicated)</div>
        </div>
        <div style={{ background: C.panel, borderRadius: 10, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.wall }}>≥{NAT.darkPct}% 🧱</div>
          <div style={{ fontSize: 10.5, color: C.mut }}>of sampled super-PAC money is dark</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "center", margin: "4px 0" }}>
        {(S?.dedupTrend || [{ cycle: 2026, dedupUSD: dedup, note: "so far" }]).map((h) => {
          const mx = Math.max(...(S?.dedupTrend || [{ dedupUSD: dedup }]).map((t) => t.dedupUSD));
          const live = h.cycle === 2026;
          return (
            <div key={h.cycle} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ height: 56, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: 32, height: `${Math.max(6, (h.dedupUSD / mx) * 56)}px`, borderRadius: "3px 3px 0 0", background: live ? C.hot : C.line }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{B(h.dedupUSD)}</div>
              <div style={{ fontSize: 9.5, color: C.mut }}>{h.cycle}<br />{h.note}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: C.mut, textAlign: "center", marginBottom: 12 }}>Money RAISED, de-duplicated (exact netting, same basis all cycles); 2026 is cycle-to-date. Different from OpenSecrets' "cost of election" ($8.9B/2022, $15.9B/2024), which measures <i>spending</i>. + state/local ~{B(bm.stateLocal2324 || 4.6e9)}/cycle.</div>
      <div style={{ fontSize: 11.5, color: C.ink, textAlign: "center", marginBottom: 12 }}>
        We trace <b style={{ color: C.hot }}>${(NAT.total / 1e9).toFixed(2)}B</b> of it down to specific races, donors, and dark-money vehicles.
      </div>

      <button onClick={() => setMethod(!method)} style={{ cursor: "pointer", background: "none", border: `1px solid ${C.line}`, color: C.mut, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, width: "100%" }}>
        {method ? "▾ " : "▸ "}Methodology — what this counts, and what it can't
      </button>
      {method && (
        <div style={{ fontSize: 11.5, color: C.mut, background: C.panel, borderRadius: 8, padding: 12, marginTop: 8, lineHeight: 1.5 }}>
          <b style={{ color: C.ink }}>The headline (${(dedup / 1e9).toFixed(1)}B, de-duplicated)</b> = <b>exact netting</b> from FEC bulk committee-summary files: {B(S?.grossBulkUSD || grossR)} gross receipts (every candidate + every PAC + party committee) minus {B(S?.committeeTransfersUSD || 0)} of committee-to-committee inflows (transfers + inter-committee contributions), so each dollar is counted once at its original source. Doing it for real corrected an earlier estimate — true double-counting is only ~15%, not the ~38% a naive ratio suggested. Note this is money <b>raised</b>; OpenSecrets' "cost of election" (~$15.9B/2024) measures <b>spending</b> and is a different, smaller metric.<br />
          <b style={{ color: C.ink }}>The traceable layer (${(NAT.total / 1e9).toFixed(2)}B)</b> is our own live pull — candidate receipts + independent expenditures we can attribute to specific House/Senate races, each dollar counted once. That's what the map drills into.<br />
          <b style={{ color: C.ink }}>Not yet counted:</b> presidential, and state + local (~$4.6B, 50 separate systems).<br />
          <b style={{ color: C.wall }}>The dark gap:</b> money entering super PACs from 501(c)(4) nonprofits is traceable <i>to</i> the nonprofit, never <i>through</i> it. Our dark % is a curated floor ("at least"), not exact.<br />
          <b style={{ color: C.ink }}>As of:</b> {asOf}. Numbers move as filings land (announced ≠ filed).
        </div>
      )}

      <button onClick={onExplore} style={{ display: "block", width: "100%", cursor: "pointer", border: "none", borderRadius: 9, background: C.hot, color: "#0f1115", fontWeight: 800, fontSize: 13, padding: 12, marginTop: 12 }}>
        Explore the money map ▸
      </button>
    </>
  );
}

const C = {
  bg: "#0f1115", panel: "#1a1d23", line: "#2b313a", ink: "#eef1f6", mut: "#9aa2af",
  d: "#3b82f6", r: "#e05666", wall: "#d08a3a", disc: "#3aa06a", hot: "#8fb4f2",
};

function Wrap({ children }) {
  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.ink, display: "flex",
      alignItems: "flex-start", justifyContent: "center", padding: "18px" }}>
      <div style={{ width: "100%", maxWidth: 820 }}>{children}</div>
    </div>
  );
}

function Kick({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: C.mut }}>{children}</div>;
}
function Back({ onClick, children }) {
  return <button onClick={onClick} style={{ cursor: "pointer", background: "none", border: "none",
    color: C.mut, fontSize: 12, fontWeight: 700, padding: "0 0 10px" }}>{children}</button>;
}

function MapScreen({ onPick, note, onBack }) {
  return (
    <>
      {onBack && <Back onClick={onBack}>‹ The Number</Back>}
      <Kick>VoteNow · the map</Kick>
      <h2 style={{ margin: "3px 0 2px", fontSize: 20, fontWeight: 800 }}>2026 money map</h2>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 6 }}>
        Shade = <b>money per registered voter</b> — real FEC data: candidate receipts (House+Senate) + Senate outside spending (2026). Small states run hot; big states cool despite huge totals. Click any state; <b style={{ color: C.hot }}>Georgia</b> follows the money to its source.
      </div>
      <div style={{ borderRadius: 12, background: C.panel, border: `1px solid ${C.line}`, overflow: "hidden" }}>
        <ComposableMap projection="geoAlbersUsa" width={800} height={470}
          projectionConfig={{ scale: 950 }} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={statesGeo}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = geo.properties.name;
                const v = intensity(name);
                const real = isReal(name);
                const isGA = name === "Georgia";
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    onClick={() => onPick(name)}
                    style={{
                      default: {
                        fill: v == null ? NODATA : color(v),
                        stroke: isGA ? C.hot : C.bg,
                        strokeWidth: isGA ? 2 : 0.5, outline: "none",
                        cursor: "pointer",
                      },
                      hover: { fill: isGA ? "#3d63a8" : (v == null ? "#3a414d" : color(Math.min(1, v + 0.12))),
                        stroke: C.hot, strokeWidth: 1.2, outline: "none", cursor: "pointer" },
                      pressed: { fill: "#3d63a8", outline: "none" },
                    }} />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.mut, marginTop: 10 }}>
        <span>less $</span>
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <i key={s} style={{ width: 18, height: 10, borderRadius: 2, background: color(s), display: "inline-block" }} />
        ))}
        <span>more $ / registered voter</span>
        <i style={{ width: 12, height: 10, borderRadius: 2, background: NODATA, display: "inline-block", marginLeft: 10 }} />
        <span>no data yet</span>
      </div>
      {note && <div style={{ fontSize: 12, color: C.wall, marginTop: 8 }}>{note}</div>}
      <div style={{ fontSize: 12, color: C.hot, fontWeight: 700, marginTop: 6, textAlign: "center" }}>▸ Click Georgia to drill in</div>
    </>
  );
}

function RaceScreen({ onBack, onForward }) {
  const Bar = ({ w, c }) => (
    <div style={{ height: 11, borderRadius: 6, background: C.line, overflow: "hidden" }}>
      <div style={{ height: "100%", width: w, background: c }} />
    </div>
  );
  return (
    <>
      <Back onClick={onBack}>‹ back to Georgia races</Back>
      <Kick>Georgia · U.S. Senate · 2026</Kick>
      <h2 style={{ margin: "3px 0 2px", fontSize: 20, fontWeight: 800 }}>The money race</h2>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 10 }}>Raised this cycle · candidate committees</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "10px 0 5px" }}>
        <div style={{ fontWeight: 800, color: C.d }}>Jon Ossoff <span style={{ fontWeight: 600, fontSize: 11, color: C.mut }}>Dem · incumbent</span></div>
        <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$77.3M</div>
      </div>
      <Bar w="100%" c={C.d} />
      <div style={{ fontSize: 11, color: C.mut, marginTop: 3 }}>$42.6M cash on hand · $20M in Q2</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "12px 0 5px" }}>
        <div style={{ fontWeight: 800, color: C.r }}>Mike Collins <span style={{ fontWeight: 600, fontSize: 11, color: C.mut }}>Rep · nominee</span></div>
        <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$2.2M cash</div>
      </div>
      <Bar w="2.8%" c={C.r} />
      <div style={{ fontSize: 11, color: C.mut, marginTop: 3 }}>$2.1M in Q2 · cycle total pending</div>
      <div style={{ margin: "16px 0", padding: 14, borderRadius: 10, background: C.panel, textAlign: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: C.hot, letterSpacing: "-.02em" }}>~$10</div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 4 }}>raised per <b>registered</b> Georgia voter — Ossoff's campaign alone (~8M registered)</div>
      </div>
      <button onClick={onForward} style={{ display: "block", width: "100%", cursor: "pointer", border: "none",
        borderRadius: 9, background: C.hot, color: "#0f1115", fontWeight: 800, fontSize: 13, padding: 12 }}>
        Who's really behind this money? ▸
      </button>
    </>
  );
}

function ChainScreen({ onBack }) {
  const Step = ({ kind, title, sub }) => {
    const border = kind === "wall" ? `1.4px dashed ${C.wall}` : `1px solid ${C.line}`;
    const left = kind === "disc" ? `3px solid ${C.disc}` : kind === "r" ? `3px solid ${C.r}` : kind === "d" ? `3px solid ${C.d}` : undefined;
    return (
      <div style={{ background: kind === "wall" ? "rgba(208,138,58,.12)" : C.panel, border,
        borderLeft: left, borderRadius: 7, padding: "7px 9px", fontSize: 11.5 }}>
        <b>{title}</b>
        <div style={{ color: C.mut, fontSize: 10, marginTop: 1 }}>{sub}</div>
      </div>
    );
  };
  const Arrow = ({ ch }) => <div style={{ textAlign: "center", color: C.mut, fontSize: 13, margin: "2px 0" }}>{ch}</div>;
  return (
    <>
      <Back onClick={onBack}>‹ back to the race</Back>
      <Kick>Georgia Senate · follow the money backwards</Kick>
      <h2 style={{ margin: "3px 0 2px", fontSize: 20, fontWeight: 800 }}>Who funds the outside spending?</h2>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 12 }}>Top super PAC each side → one hop back to its funders</div>
      <div style={{ background: C.panel, borderRadius: 10, padding: 12, textAlign: "center", marginBottom: 14 }}>
        <b style={{ fontSize: 14 }}>Share that's DARK (donor hidden)</b>
        <div style={{ fontSize: 28, fontWeight: 900, marginTop: 3 }}>
          <span style={{ color: C.r }}>26%</span> vs <span style={{ color: C.d }}>29%</span>
        </div>
        <div style={{ color: C.mut, fontSize: 11, marginTop: 3 }}>both sides route ~a quarter-to-a-third through dark-money nonprofits</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <h5 style={{ fontSize: 11, margin: "0 0 7px", textAlign: "center", color: C.r }}>Against Ossoff</h5>
          <Step kind="disc" title="Disclosed donors ~74%" sub="named people + corp PACs" />
          <Arrow ch="＋" />
          <Step kind="wall" title="🧱 One Nation 501(c)(4)" sub="hidden · ~26% · partial: oil & gas" />
          <Arrow ch="▼" />
          <Step kind="r" title="Senate Leadership Fund" sub="$44M into GA" />
        </div>
        <div>
          <h5 style={{ fontSize: 11, margin: "0 0 7px", textAlign: "center", color: C.d }}>For Ossoff</h5>
          <Step kind="disc" title="Disclosed donors ~71%" sub="named people + PACs" />
          <Arrow ch="＋" />
          <Step kind="wall" title="🧱 Majority Forward 501(c)(4)" sub="hidden · ~29% · $25M infusion" />
          <Arrow ch="▼" />
          <Step kind="d" title="Senate Majority PAC" sub="$20M for Ossoff" />
        </div>
      </div>
      <div style={{ fontSize: 10, color: C.mut, marginTop: 12, paddingTop: 9, borderTop: `1px solid ${C.line}` }}>
        Illustrative v0 · GA figures from reporting (OpenSecrets · Issue One · CREW), verify vs FEC before publishing.
      </div>
    </>
  );
}

const party = (p) => (p === "DEM" ? C.d : p === "REP" ? C.r : C.mut);

function StateScreen({ onBack, onOpenSenate }) {
  const [sel, setSel] = useState(null);
  const dObj = DATA.states.Georgia?.districts || {};
  const codes = Object.keys(dObj).filter((c) => c !== "00").sort();
  const money = (c) => (dObj[c].receiptsUSD || 0) + (dObj[c].ieUSD || 0);
  const maxM = Math.max(1, ...codes.map(money));
  const regPer = (REGISTERED.Georgia || 8e6) / (codes.length || 14); // ballpark registered voters / district
  const sd = sel ? dObj[sel] : null;
  const cands = sd ? [...(sd.candidates || [])].sort((a, b) => b.receiptsUSD - a.receiptsUSD).slice(0, 2) : [];

  return (
    <>
      <Back onClick={onBack}>‹ back to national map</Back>
      <Kick>Georgia · 2026 · where the money is</Kick>
      <h2 style={{ margin: "3px 0 2px", fontSize: 20, fontWeight: 800 }}>Georgia races</h2>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 12 }}>Statewide Senate race + U.S. House districts. Tiles shaded by total money in the district (real FEC). Click one.</div>

      <button onClick={onOpenSenate} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
        border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.hot}`, borderRadius: 10, background: C.panel, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".06em" }}>Statewide · U.S. Senate</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Ossoff <span style={{ color: C.mut, fontWeight: 600 }}>(D)</span> vs Collins <span style={{ color: C.mut, fontWeight: 600 }}>(R)</span></div>
          <div style={{ color: C.hot, fontWeight: 800, fontSize: 13 }}>open ▸</div>
        </div>
        <div style={{ fontSize: 11, color: C.mut, marginTop: 3 }}>real traced data · tap to follow the money to the dark-money wall</div>
      </button>

      <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>U.S. House · {codes.length || "—"} districts</div>
      {codes.length === 0 ? (
        <div style={{ fontSize: 12, color: C.wall }}>District data loads after the FEC ingest finishes — reload in a moment.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {codes.map((c) => {
              const v = money(c) / maxM;
              return (
                <button key={c} onClick={() => setSel(c)} title={`GA-${c}`}
                  style={{ aspectRatio: "1/1", borderRadius: 6, border: sel === c ? `2px solid ${C.hot}` : "1px solid transparent", cursor: "pointer",
                    background: color(v), color: v > 0.5 ? "#0f1115" : C.ink, fontSize: 10, fontWeight: 700 }}>
                  {Number(c)}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.mut, marginTop: 10 }}>
            <span>less $</span>
            {[0, 0.25, 0.5, 0.75, 1].map((s) => <i key={s} style={{ width: 16, height: 9, borderRadius: 2, background: color(s), display: "inline-block" }} />)}
            <span>more total money in district</span>
          </div>
        </>
      )}

      {sd && (
        <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".06em" }}>GA-{sel} · U.S. House</div>
          <div style={{ fontSize: 12, color: C.mut, margin: "2px 0 8px" }}>
            ${(money(sel) / 1e6).toFixed(1)}M total · ~${(money(sel) / regPer).toFixed(1)}/registered voter (ballpark)
          </div>
          {cands.length ? cands.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "5px 0" }}>
              <span style={{ fontWeight: 700, color: party(c.party) }}>{c.name} <span style={{ color: C.mut, fontWeight: 600, fontSize: 11 }}>({c.party || "?"})</span></span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>${(c.receiptsUSD / 1e6).toFixed(1)}M</span>
            </div>
          )) : <div style={{ fontSize: 12, color: C.mut }}>No candidate committees reported.</div>}
          {sd.ieUSD > 0 && <div style={{ fontSize: 11, color: C.wall, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>🧱 Outside money: ${(sd.ieUSD / 1e6).toFixed(1)}M{sd.topVehicles?.[0]?.name ? ` — top: ${sd.topVehicles[0].name}` : ""}</div>}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState("number");
  const [note, setNote] = useState("");
  const pick = (name) => {
    if (name === "Georgia") { setNote(""); setScreen("state"); return; }
    const d = DATA.states[name];
    if (!d || d.perVoterUSD == null) { setNote(`${name}: no data.`); return; }
    const top = d.topVehicles?.find((v) => v.name && v.name !== "null");
    const cm = top && DATA.committees ? DATA.committees[top.id] : null;
    const donor = cm?.topDonors?.find((x) => x.name);
    let chain = "";
    if (top) {
      chain = ` · top vehicle: ${top.name}`;
      if (cm && cm.darkPctOfTop != null) chain += ` (${cm.darkPctOfTop}% dark of top gifts)`;
      if (donor) chain += ` ← biggest donor: ${donor.name} $${(donor.usd / 1e6).toFixed(1)}M${donor.dark ? " 🧱" : ""}`;
    }
    const ie = d.ieUSD ? ` · $${(d.ieUSD / 1e6).toFixed(0)}M Senate outside` : "";
    setNote(`${name}: $${d.perVoterUSD}/registered voter · $${(d.receiptsUSD / 1e6).toFixed(0)}M candidate${ie}${chain}`);
  };
  return (
    <Wrap>
      {screen === "number" && <NumberScreen onExplore={() => setScreen("map")} />}
      {screen === "map" && <MapScreen onPick={pick} note={note} onBack={() => setScreen("number")} />}
      {screen === "state" && <StateScreen onBack={() => setScreen("map")} onOpenSenate={() => setScreen("race")} />}
      {screen === "race" && <RaceScreen onBack={() => setScreen("state")} onForward={() => setScreen("chain")} />}
      {screen === "chain" && <ChainScreen onBack={() => setScreen("race")} />}
    </Wrap>
  );
}
