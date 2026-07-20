#!/usr/bin/env node
// Real OpenFEC ingest — three passes, now with House per-district data.
//   A  candidate receipts (House + Senate), House captured per district
//   B1 Senate independent expenditures (Schedule E) per state + top vehicles
//   B2 House independent expenditures per DISTRICT + top vehicles (~435 calls)
//   C  donor hop: each Senate top-vehicle's biggest contributors + dark flag
// Money per state = receipts + Senate IE + House IE, normalized by registered
// voters. Writes src/data.json (states + per-district + committees).
//
//   FEC_API_KEY=your_key node scripts/fec-ingest.mjs
// The key is ~60 req/min, so this paces at ~1s/call and takes ~10 min.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGISTERED } from "../src/registration.js";

const KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const CYCLE = Number(process.env.CYCLE || 2026);
const DELAY = Number(process.env.DELAY || 1000); // ~60/min
const BASE = "https://api.open.fec.gov/v1";
const __dirname = dirname(fileURLToPath(import.meta.url));
if (KEY === "DEMO_KEY") console.warn("⚠  No FEC_API_KEY — DEMO_KEY is rate-limited.\n");

const STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
  ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
  ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],
  ["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],
  ["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
  ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
];

// Curated known 501(c)(4) / dark-money conduits (money into a super PAC from
// one of these is "dark" — the conduit's own donors are hidden). Heuristic, not
// exhaustive; expand over time.
const DARK = ["ONE NATION","MAJORITY FORWARD","AMERICANS FOR PROSPERITY","AFP ACTION","STAND TOGETHER",
  "SIXTEEN THIRTY","AMERICAN ACTION NETWORK","CROSSROADS GPS","CLUB FOR GROWTH","CONCORD FUND",
  "JUDICIAL CRISIS NETWORK","MARBLE FREEDOM","DONORSTRUST","DONORS TRUST","DONORS CAPITAL","NORTH FUND",
  "STATE TIDES","NEW VENTURE FUND","DEFENDING DEMOCRACY TOGETHER","DUTY AND COUNTRY","FACT AND OPINION",
  "WELLSPRING","45COMMITTEE","AMERICAN ENCORE","LEAGUE OF CONSERVATION VOTERS","PLANNED PARENTHOOD VOTES",
  "EVERYTOWN","DEMAND JUSTICE","PATRIOT MAJORITY","SUSAN B. ANTHONY","SUSAN B ANTHONY","AMERICA FIRST WORKS",
  "OPPORTUNITY SOLUTIONS","NATURAL RESOURCES DEFENSE","HEALTH CARE VOTER","THE SIXTEEN THIRTY FUND"];
const isDark = (n) => n && DARK.some((d) => n.toUpperCase().includes(d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${KEY}`;
  for (let a = 0; a < 5; a++) {
    const res = await fetch(url);
    if (res.status === 429) { const w = Number(res.headers.get("retry-after") || 20); await sleep((w + 1) * 1000); continue; }
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }
  throw new Error("429s");
}
const topN = (byId, n) => Object.values(byId).sort((a, b) => b.usd - a.usd).slice(0, n).map((v) => ({ ...v, usd: Math.round(v.usd) }));

// ---- Pass A: receipts (Senate + House), House captured per district ----
const receipts = {}, districts = {};
for (const [abbr, name] of STATES) {
  let sum = 0;
  const jS = await get(`/candidates/totals/?state=${abbr}&office=S&cycle=${CYCLE}&election_full=true&per_page=100&sort=-receipts`);
  for (const c of jS.results || []) sum += c.receipts || 0;
  await sleep(DELAY);
  const jH = await get(`/candidates/totals/?state=${abbr}&office=H&cycle=${CYCLE}&election_full=true&per_page=100&sort=-receipts`);
  districts[name] = {};
  for (const c of jH.results || []) {
    sum += c.receipts || 0;
    const code = String(c.district || "00").padStart(2, "0");
    const d = districts[name][code] || (districts[name][code] = { candidates: [], receiptsUSD: 0, ieUSD: 0, topVehicles: [] });
    d.receiptsUSD += c.receipts || 0;
    if (c.name) d.candidates.push({ name: c.name, party: c.party, receiptsUSD: Math.round(c.receipts || 0) });
  }
  receipts[name] = sum;
  await sleep(DELAY);
  console.log(`A ✓ ${name.padEnd(15)} receipts $${(sum / 1e6).toFixed(1)}M · ${Object.keys(districts[name]).length} districts`);
}

// ---- Pass B1: Senate IE per state + top vehicles ----
const ie = {}, senVehicles = {};
for (const [abbr, name] of STATES) {
  let sum = 0; const byCmte = {};
  try {
    const j = await get(`/schedules/schedule_e/by_candidate/?cycle=${CYCLE}&office=senate&state=${abbr}&per_page=100&sort=-total`);
    for (const r of j.results || []) {
      sum += r.total || 0;
      const id = r.committee_id || r.committee_name;
      (byCmte[id] || (byCmte[id] = { name: r.committee_name, id: r.committee_id, usd: 0 })).usd += r.total || 0;
    }
  } catch { /* no senate race */ }
  ie[name] = sum;
  senVehicles[name] = topN(byCmte, 3);
  await sleep(DELAY);
  console.log(`B1 ${name.padEnd(15)} senate IE $${(sum / 1e6).toFixed(1)}M`);
}

// ---- Pass B2: House IE per district (~435 calls) ----
let dc = 0;
for (const [abbr, name] of STATES) {
  for (const code of Object.keys(districts[name])) {
    dc++;
    const byCmte = {}; let sum = 0;
    try {
      const j = await get(`/schedules/schedule_e/by_candidate/?cycle=${CYCLE}&office=house&state=${abbr}&district=${code}&per_page=100&sort=-total`);
      for (const r of j.results || []) {
        sum += r.total || 0;
        const id = r.committee_id || r.committee_name;
        (byCmte[id] || (byCmte[id] = { name: r.committee_name, id: r.committee_id, usd: 0 })).usd += r.total || 0;
      }
    } catch { /* skip */ }
    districts[name][code].ieUSD = Math.round(sum);
    districts[name][code].topVehicles = topN(byCmte, 2);
    ie[name] += sum;
    await sleep(DELAY);
    if (dc % 25 === 0) console.log(`B2 … ${dc} districts done`);
  }
}

// ---- Pass C: donor hop for Senate top-2 vehicles ----
const nameById = {};
Object.values(senVehicles).flat().forEach((v) => { if (v.id) nameById[v.id] = v.name; });
const top2 = [...new Set(Object.values(senVehicles).flatMap((vs) => vs.slice(0, 2)).filter((v) => v.id).map((v) => v.id))];
const committees = {};
for (const id of top2) {
  try {
    const j = await get(`/schedules/schedule_a/?committee_id=${id}&two_year_transaction_period=${CYCLE}&sort=-contribution_receipt_amount&per_page=10`);
    const donors = (j.results || []).map((r) => ({ name: r.contributor_name, usd: Math.round(r.contribution_receipt_amount || 0), entity: r.entity_type, dark: isDark(r.contributor_name) }));
    const tot = donors.reduce((a, d) => a + d.usd, 0);
    const dk = donors.filter((d) => d.dark).reduce((a, d) => a + d.usd, 0);
    committees[id] = { name: nameById[id], topDonors: donors, darkPctOfTop: tot ? Math.round((dk / tot) * 100) : 0 };
  } catch (e) { committees[id] = { name: nameById[id], topDonors: [], darkPctOfTop: null }; }
  await sleep(DELAY);
}

// ---- Combine ----
const out = { generatedAt: new Date().toISOString(), cycle: CYCLE, source: "OpenFEC: candidate receipts + Senate & House independent expenditures (Schedule E) + Senate-vehicle contributors (Schedule A)", states: {}, committees };
for (const [, name] of STATES) {
  const r = Math.round(receipts[name] || 0), i = Math.round(ie[name] || 0), money = r + i, reg = REGISTERED[name];
  out.states[name] = { receiptsUSD: r, ieUSD: i, moneyUSD: money, perVoterUSD: reg ? +(money / reg).toFixed(2) : null, topVehicles: senVehicles[name] || [], districts: districts[name] || {} };
}
writeFileSync(join(__dirname, "..", "src", "data.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`\nDone. Wrote src/data.json for ${CYCLE}.`);
