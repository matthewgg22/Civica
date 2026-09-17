"""Generate a per-bank CRA pitch PDF.

Usage:
  python3 -m src.generate --bank bank_irvine            # HTML + PDF into out/
  python3 -m src.generate --bank bank_irvine --send     # + content-hash archive into sent/
  python3 -m src.generate --bank bank_irvine --html-only

Build fails loudly on: unknown bank, missing template field, no metrics
coverage, metrics/geometry mismatch, invalid assumptions. --send refuses
unverified banks (assessment_areas.json verified:false).
"""
import argparse
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import access_evidence, mapsvg, pumamap, report, score, states  # noqa: E402

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

REQUIRED_ASSUMPTION_KEYS = {
    "version", "cpc_usd", "budget_split", "rates", "benefit",
    "household_size_eligible", "ratio_display_threshold", "mock_report_policy",
}


class TemplateFieldError(Exception):
    pass


class UnverifiedBankError(Exception):
    pass


def load_inputs():
    inputs = TOOL_ROOT / "inputs"
    banks = json.loads((inputs / "assessment_areas.json").read_text())["banks"]
    assumptions = json.loads((inputs / "funnel_assumptions.json").read_text())
    org = json.loads((inputs / "org.json").read_text())
    missing = REQUIRED_ASSUMPTION_KEYS - set(assumptions)
    if missing:
        raise ValueError(f"funnel_assumptions.json missing keys: {sorted(missing)}")
    return banks, assumptions, org


def fmt_int(x):
    return f"{x:,.0f}"


def fmt_musd(x):
    if x >= 1e9:
        return f"${x/1e9:.2f}B"
    if x >= 1e6:
        # Whole millions keep the range compact so it never forces a table
        # label to wrap (e.g. "$320M–$500M", not "$320.0M–$500.0M").
        return f"${x/1e6:.0f}M"
    return f"${x/1e3:,.0f}K"


# A bank's CRA rule lives in its prudential regulator's CFR part (1995
# framework): FDIC -> 12 CFR 345, OCC -> 12 CFR 25, FRB -> 12 CFR 228 (Reg BB).
# The community-services-to-LMI subsection is harmonized across the three parts
# as .12(g)(2) (the Interagency Q&A cites it in the common "§__.12(g)(2)" form).
CRA_REG_PART = {"FDIC": "345", "OCC": "25", "FRB": "228", "Federal Reserve": "228"}


def cra_reg_part(regulator: str) -> str:
    """CFR part number for a regulator's CRA rule; '__' if unknown."""
    return CRA_REG_PART.get(regulator, "__")


def render(template: str, values: dict) -> str:
    """Strict [[field]] substitution: missing field or leftover marker fails."""
    def sub(m):
        key = m.group(1)
        if key not in values:
            raise TemplateFieldError(f"template field has no value: {key}")
        return str(values[key])
    out = re.sub(r"\[\[(\w+)\]\]", sub, template)
    if "[[" in out:
        raise TemplateFieldError("unsubstituted template marker remains")
    return out


def build_county_breakdown(covered_counties, metrics, cap=6):
    """Ranked per-county unmet-need bars—the regional insight a flat AA
    choropleth can't carry (which counties actually drive the need).

    Presentation only: reads the same county metrics the score uses, never
    changes a headline figure. Rows beyond `cap` fold into an 'other counties'
    line so the numbers still sum to the assessment-area total.
    """
    rows = [(c, metrics[c]["eligible_pop"] * metrics[c]["non_enroll_rate"])
            for c in covered_counties]
    rows.sort(key=lambda t: t[1], reverse=True)
    if len(rows) > cap:
        tail = sum(u for _, u in rows[cap - 1:])
        rows = rows[:cap - 1] + [(f"{len(rows) - (cap - 1)} other counties", tail)]
    top = rows[0][1] if rows and rows[0][1] > 0 else 1
    lis = []
    for name, u in rows:
        pct = max(3.0, u / top * 100.0)
        # Stacked row: county + count on one line, a full-width proportional
        # bar beneath. Full-width bars give the ranking room to read (LA dwarfs
        # the rest) instead of stubby bars stranded from their numbers.
        lis.append(
            f'<li><div class="brk-row"><span class="c">{name}</span>'
            f'<span class="n">{fmt_int(round(u, -3))}</span></div>'
            f'<div class="track"><span class="bar" style="width:{pct:.1f}%"></span></div></li>'
        )
    return ('<div class="brk"><div class="brk-cap">Not enrolled, by county</div>'
            f'<ul>{"".join(lis)}</ul></div>')


def _load_caseload(state):
    """Actual CalFresh enrolled persons by county for `state`, or None.

    Used to anchor the headline eligible base on the real caseload so it
    reconciles with the state's own enrollment (see inputs/calfresh_caseload.json
    and score.bank_need)."""
    path = TOOL_ROOT / "inputs" / "calfresh_caseload.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return data["counties"] if data.get("state") == state else None


def build_values(bank, assumptions, org, metrics, meta):
    caseload = _load_caseload(bank.get("state", "CA"))
    need = score.bank_need(bank["aa_counties"], metrics, assumptions,
                           reconcile_rate=meta.get("usda_participation_rate"),
                           caseload=caseload)
    fun = report.funnel(bank["ask_usd"], assumptions)
    aa_label = (f"{bank['aa_counties'][0]} County" if len(bank["aa_counties"]) == 1
                else "assessment-area")
    map_caption = (f"{aa_label} in regional context · SNAP need by county"
                   if len(bank["aa_counties"]) == 1
                   else "Assessment area · SNAP need by county")
    county_breakdown = build_county_breakdown(need["covered_counties"], metrics)
    # Sub-county PUMA choropleth where we have both need data and geometry
    # (CA, FL); every other state falls back to the county-bar breakdown.
    # When the headline is caseload-anchored, the per-neighborhood bars are
    # scaled to sum to the same reconciled AA total, so the map and the headline
    # tell one consistent story.
    aa_geo_visual = pumamap.puma_visual_html(
        bank["aa_counties"], bank.get("state", "CA"), meta["method_short"],
        reconcile_rate=meta.get("usda_participation_rate"),
        total_override=need["unenrolled"] if need.get("caseload_anchored") else None)
    if not aa_geo_visual:
        aa_geo_visual = county_breakdown
    ratio_line = ""
    if need["show_ratio"]:
        ratio_line = (f'<div class="ratio-line">Unmet need here runs '
                      f'{need["ratio"]:.1f}× the statewide average.</div>')
    gaps = ""
    if need["gap_counties"]:
        gaps = ("Data gaps: no need estimate available for "
                + ", ".join(need["gap_counties"])
                + " (shown gray on the map; excluded from all figures). ")
    hh = assumptions["household_size_eligible"]
    counties_plain = (", ".join(bank["aa_counties"])
                      + (" Counties" if len(bank["aa_counties"]) > 1 else " County"))
    why_this_bank = (
        f"We run and measure the program only inside {bank['name']}'s CRA "
        f"assessment area ({counties_plain})—the same geography your Performance "
        "Evaluation already covers."
    )
    # Plain-language funnel conversion for the page-3 sample report: normalizes the
    # mid-scenario rates to a per-1,000-clicks story so a reader sees why the
    # prompt -> application -> approval path is effective.
    r = assumptions["rates"]
    _sess = 1000 * r["click_to_session"]["mid"]
    _chk = _sess * r["session_to_check"]["mid"]
    _sub = _chk * r["check_to_app_started"]["mid"] * r["started_to_submitted"]
    _appr = _sub * r["approval"]["mid"]
    # Wording matches the table rows exactly: _chk = eligibility checks COMPLETED
    # (not sessions), _sub = applications SUBMITTED.
    funnel_note = (f"Mid-range: per 1,000 ad clicks, ~{_chk:.0f} complete an eligibility "
                   f"check, ~{_sub:.0f} submit an application, and ~{_appr:.0f} are approved.")
    # Credibility line (reviewer ask): a single substantiable sentence on why
    # the analysis here is Civica's own work, not vendor boilerplate. State-aware
    # on two axes—CA carries a trained model (AUC) AND the CDSS ME review;
    # every other state is a direct survey-weighted estimate with neither, so
    # the CDSS clause must never appear off-CA (mirrors the CalFresh trap). No
    # traction/delivery number is asserted here by design.
    state = bank.get("state", "CA")
    if state == "CA":
        credibility_line = (
            "The need and access figures here are Civica's own work: a "
            "reproducible model of 2023 federal ACS microdata, and a review of "
            "38 California county CalFresh Management Evaluation reports "
            "(FFY 2024–2025), obtained by public-records (FOIA/CPRA) requests."
        )
    else:
        credibility_line = (
            "The need estimate here is Civica's own analysis: a survey-weighted "
            "estimate built directly from 2023 federal ACS microdata, "
            "reproducible from public sources."
        )
    # (The product itself—the rule-grounded conversational assistant—is
    # already described in "The program" section above, so the credibility line
    # no longer repeats it.)
    # Optional per-bank "Why this bank specifically" callout: a fully-sourced,
    # bank-specific argument (e.g. commercial/no-retail structure + the exam
    # component a grant lands on). Present only for banks that carry the field;
    # every other bank renders nothing here.
    _bank_note = bank.get("bank_specific_note", "").strip()
    bank_specific_block = (
        f'<div class="provenance" style="margin-top:11px;"><b>Why {bank["name"]}.'
        f'</b> {_bank_note}</div>' if _bank_note else "")
    # Page-3 hero: a REAL captured screenshot of the live assistant, referenced by
    # file:// URI so Chrome embeds it into the PDF without a giant base64 blob in
    # the HTML. State-specific so the FL banks show Florida/DCF/SNAP, not CA.
    _shot = "chat-shot-ca.png" if state == "CA" else "chat-shot-fl.png"
    chat_shot_src = (TOOL_ROOT / "assets" / _shot).as_uri()
    # Page-3 annotated screenshot. CA carries a composited capture of one real
    # conversation (aspect 2760x2548): the messy question, the live $494 estimate,
    # and the interview answer marked CERTAIN with its citation—numbered markers
    # on the image, an intent legend beneath. FL still uses its earlier full-
    # height capture without callouts (couldn't recapture—the live product's
    # daily question cap was reached); both render correctly because the aspect
    # ratio and the overlay are state-specific.
    if state == "CA":
        chat_aspect = "2760/2225"
        # Numbered markers sit ON the screenshot; the legend beneath it explains
        # the INTENT behind each simple feature (not a caption of what's shown).
        # (x,y) is the marker centre in % of the image box, ordered top-to-bottom
        # so the numbers ascend as the eye moves down the capture. Small numbers
        # avoid the leader-line/label overlap of earlier versions.
        # Real product layout (user bubbles right-aligned, answers left), PDF-offer
        # row removed: the image is a landscape 2760x2225. Marker x% are relative
        # to the 2760 width.
        # Five callouts, each tied to a RECORDED event the quarterly report counts
        # (the barrier table above carries the "why"; this is the short key).
        # Ordered top-to-bottom so numbers ascend as the eye moves down.
        _marks = [
            (97, 2),     # 1  the messy question bubble (top-right)
            (24, 9),     # 2  state selector — state-aware session
            (24, 44),    # 3  WHERE THIS LANDS—the live $494 estimate
            (24, 59),    # 4  FROM WHAT YOU'VE TOLD ME—the correctable record
            (70, 85),    # 5  the CERTAIN badge + citation—rule cited, dated
        ]
        chat_overlay = "".join(
            f'<div class="cmark" style="left:{x}%;top:{y}%">{i + 1}</div>'
            for i, (x, y) in enumerate(_marks))
        _legend = [
            ("A messy, real question", "plain-language input a fixed form can’t take, so people don’t self-select out."),
            ("State-aware", "answers from California’s rules (CDSS); each session is recorded by state."),
            ("A live estimate", "an estimated benefit fills in as the applicant talks—recorded as an eligibility check."),
            ("A correctable record", "it shows back what you’ve told it, so nothing is re-asked and the applicant can fix it."),
            ("Rule cited, dated", "shows the rule and the fiscal year under each answer, so a reviewer can check it."),
        ]
        chat_legend = ('<div class="chat-legend">' + "".join(
            f'<div class="leg"><span class="leg-n">{i + 1}</span>'
            f'<span class="leg-t"><b>{t}:</b> {d}</span></div>'
            for i, (t, d) in enumerate(_legend)) + "</div>")
        chat_cap = "A real conversation in the live assistant."
    else:
        chat_aspect = "2760/2360"
        chat_overlay = ""
        chat_legend = ""
        # FL carries no markers/legend, so don't promise a numbered key below.
        chat_cap = "A real conversation in the live assistant."
    # ---- Page-3 evidence region (state-driven so no CA brand leaks onto FL) ----
    qr_svg = (TOOL_ROOT / "assets/qr-chat.svg").read_text()
    _me_audit = ("; the CA pack built from an audit of 38 county ME reports"
                 if state == "CA" else "")
    _qrbox = ('<div class="qrbox"><div class="qr">' + qr_svg + '</div>'
              '<div class="qr-txt"><strong>Try it.</strong> Scan, or visit<br>'
              '<span class="url">civica-applicant.vercel.app/chat</span></div></div>')
    if state == "CA":
        evidence_block = (
            '<table class="barriers"><thead><tr>'
            '<th style="width:1.05in">Barrier</th><th>What the evidence shows</th>'
            '<th style="width:1.5in">How the assistant addresses it</th>'
            '<th style="width:1.0in">Measured (pg 4)</th></tr></thead><tbody>'
            '<tr><td class="b">Don’t know they qualify</td>'
            '<td class="ev">Information alone nearly doubled SNAP take-up, 6%&rarr;11%<sup>*</sup></td>'
            '<td>A five-minute personalized estimate</td>'
            '<td class="m">Eligibility checks completed</td></tr>'
            '<tr><td class="b">A confusing application</td>'
            '<td class="ev">Hands-on application help raised take-up to 18%, vs 11% for information alone<sup>*</sup></td>'
            '<td>Plain-language answers, cited rules, a correctable running record</td>'
            '<td class="m">Applications submitted</td></tr>'
            '<tr><td class="b">Language</td>'
            '<td class="ev">Reaches the largest limited-English-proficient populations California outreach must serve</td>'
            '<td>Answers in Spanish, Vietnamese, Chinese and English</td>'
            '<td class="m">Sessions by language</td></tr>'
            '</tbody></table>'
            '<div class="barriers-note"><sup>*</sup> Take-up figures: a randomized trial of '
            'elderly SNAP applicants in Pennsylvania (Finkelstein &amp; Notowidigdo, QJE 2019); '
            'the pilot tests whether they hold for the general CalFresh population. The process '
            'barriers the state’s own county reviews document (page 1)—wrong-language '
            'forms, information wrongly requested—are a further target; post-submission '
            'reminders are a planned addition.</div>'
            '<div class="whyrow"><div class="why-chat">'
            '<div class="why-h">Why a chatbot</div>'
            '<p>Human application help has the strongest evidence, but it’s capped by staff '
            'hours and cost per case. The assistant offers that kind of help around the clock, in '
            'four languages, at near-zero marginal cost—the pilot tests whether it reproduces '
            'those results.</p></div>'
            '<div class="why-out"><div class="why-h">Why digital outreach</div><ul>'
            '<li><b>Aimed at need:</b> geo-targeted to LMI tracts—the targeting the CRA LMI test rewards.</li>'
            '<li><b>Where people are:</b> 16% of U.S. adults are smartphone-only, far more among households under $30k (Pew).</li>'
            '<li><b>Into help, not an ad:</b> an LA trial found social-media ads alone didn’t lift enrollment (Rogers, 2024), so every contact opens straight into the assistant.</li>'
            '</ul></div></div>')
        safeguards_line = (
            '<div class="safeguards"><b>Safeguards:</b> estimates, never decides; no '
            'SSN/DOB/account number; crisis &amp; DV lines; nothing shared with the bank; '
            'text auto-purges.</div>')
        p3_detail_foot = (
            '<div class="p3foot"><b>Independently checkable:</b> a graded ~600-question '
            'set across all 53 jurisdictions (adversarial and crisis cases included), '
            're-run on every rules change and open to your compliance team. Civica is in '
            'the Harvard Innovation Labs incubator; the impact study behind these figures '
            'is available on request.</div>')
    else:
        evidence_block = (
            '<div class="evidence-foot" style="border-top:none;margin-top:7px;padding-top:0;">'
            '<div class="ev-text">'
            '<p><strong>Built-in limits.</strong> It estimates, never decides—the county '
            'decides; anything outside its scope routes to the county or 2-1-1. Never asks for an '
            'SSN, DOB, or account number; carries crisis and domestic-violence lines. Nothing is '
            'shared with the bank, and question text auto-purges.</p>'
            '<p><strong>Independently checkable.</strong> A graded ~600-question set across all 53 '
            'jurisdictions, re-run on every rules change and open to your compliance team.</p>'
            '</div><div class="ev-side">' + _qrbox + '</div></div>')
        safeguards_line = ""
        p3_detail_foot = ""
    # Page-3 demo section. CA: the screenshot bleeds left, with the five recorded-
    # feature explainers stacked to its right. FL: the plain full-width hero.
    _img = ('<img src="' + chat_shot_src + '" alt="A real Demeter conversation in '
            'the live assistant, annotated with recorded-event callouts."/>')
    _shot = (f'<div class="chatshot" style="aspect-ratio:{chat_aspect};">'
             + _img + chat_overlay + '</div>')
    if state == "CA":
        demo_section = (
            '<div class="demo-row"><div class="demo-col">' + _shot
            + f'<div class="chatshot-cap">{chat_cap}</div></div>'
            '<div class="legend-col"><div class="legend-head">Five recorded '
            'features, keyed on the screenshot</div>' + chat_legend
            + '<div class="qrbox legend-qr"><div class="qr">' + qr_svg + '</div>'
            '<div class="qr-txt"><strong>Try it.</strong> Scan, or visit<br>'
            '<span class="url">civica-applicant.vercel.app/chat</span></div></div>'
            '</div></div>')
    else:
        demo_section = ('<div class="platform-hero">' + _shot
                        + f'<div class="chatshot-cap">{chat_cap}</div></div>')
    # Regulator-specific CRA rule citation for the community-reinvestment box.
    cra_part = cra_reg_part(bank["regulator"])
    cra_rule_cite = f"12 CFR Part {cra_part} ({bank['regulator']})"
    # Investment-test qualitative criteria live at .23(e) in each regulator's
    # CRA rule (FDIC 345, OCC 25, Fed 228): (e)(2) innovativeness/complexity,
    # (e)(3) responsiveness to community-development needs.
    cra_invest_cite = f"12 CFR {cra_part}.23(e)"
    # Reconciliation note (page-1 methods): when we report the eligible-but-
    # unenrolled headline at USDA's published participation rate (see
    # score.bank_need + states.usda_participation_rate), disclose exactly that,
    # so a reader who checks the USDA figure finds we anticipated it. CA also
    # carries the post-H.R.1 direction (LAO Feb-2026); other states omit the
    # state-specific haircut to avoid an unsourced number. Empty when a state
    # has no published rate wired (falls back to the raw model figure).
    if need.get("reconciled"):
        if state == "CA" and need.get("caseload_anchored"):
            _enr = f"{need['aa_enrolled'] / 1e6:.1f}M"
            recon_note = (
                "<strong>How we count unmet need:</strong> eligible = the assessment "
                f"area's actual CalFresh caseload (CDSS via CA Assn. of Food Banks, 2025; "
                f"~{_enr} enrolled) &divide; USDA's California participation rate (81%, "
                "FY2022), so the count reconciles with the state's own enrollment "
                "(a federal-rules model base understates it because California's "
                "Broad-Based Categorical Eligibility reaches 200% FPL). H.R.1 (2025) "
                "changes shrink this pool further (California LAO, Feb 2026). &nbsp;·&nbsp; ")
        elif state == "CA":
            recon_note = (
                "<strong>How we count unmet need:</strong> our eligible-population "
                "estimate matches USDA's independent California figure within ~1%; "
                "we apply USDA's published participation rate (81%, FY2022), not the "
                "model's raw non-enrollment rate. H.R.1 changes effective 2026 "
                "(noncitizen, ABAWD) shrink this pool further (California LAO, Feb "
                "2026). &nbsp;·&nbsp; ")
        else:
            recon_note = (
                "<strong>How we count unmet need:</strong> we apply USDA's "
                "published state participation rate (81%, FY2022), not the "
                "survey-weighted non-enrollment count, which over-reads unmet "
                "need because ACS respondents under-report SNAP receipt. "
                "&nbsp;·&nbsp; ")
    else:
        recon_note = ""
    # Page-4 methodology bullet mirrors the headline method, state-correct so no
    # CA brand ("CalFresh"/"CDSS"/"California") leaks onto a non-CA artifact.
    if need.get("caseload_anchored"):
        recon_method_bullet = (
            "<strong>Reconciled to the state caseload:</strong> the eligible base is "
            "actual CDSS CalFresh enrollment &divide; USDA's California participation "
            "rate (81%, FY2022), so the page-1 count reconciles with the state's own "
            "enrollment (a federal-rules model base sits below it).")
    else:
        recon_method_bullet = (
            "<strong>Reconciled to a federal series:</strong> the "
            "eligible-not-enrolled count is held to USDA's published participation "
            "rate (81%, FY2022) rather than the model's raw non-enrollment rate, "
            "which survey under-reporting inflates.")
    # H.R.1 methodology bullet — state-correct source (CA LAO only for CA; no
    # state cite elsewhere, so "California" never leaks onto a non-CA artifact).
    _hr1_src = " (California LAO, Feb 2026)" if state == "CA" else ""
    hr1_bullet = (
        "<strong>H.R.1 (2025 law):</strong> SNAP changes to noncitizen eligibility "
        "and ABAWD work rules shrink the eligible pool going forward" + _hr1_src
        + "; the rules corpus reflects law through 2025.")
    v = {
        "why_this_bank": why_this_bank,
        "credibility_line": credibility_line,
        "cra_rule_cite": cra_rule_cite,
        "cra_invest_cite": cra_invest_cite,
        "hr1_bullet": hr1_bullet,
        "funnel_note": funnel_note,
        "org_name": org["org_name"],
        "program_name": org["program_name"],
        "status_line": org["status_line"],
        "status_line_lc": org["status_line"][0].lower() + org["status_line"][1:],
        "engine_line": org["engine_line"],
        "contact_name": org["contact_name"],
        "contact_title": org["contact_title"],
        "contact_email": org["contact_email"],
        "contact_phone_line": (f" · {org['contact_phone']}" if org.get("contact_phone") else ""),
        "bank_name": bank["name"],
        "regulator": bank["regulator"],
        "pe_date": bank["pe_date"],
        "aa_counties_list": (", ".join(bank["aa_counties"])
                             + (" Counties" if len(bank["aa_counties"]) > 1 else " County")
                             + bank.get("aa_note", "")),
        "aa_label": aa_label,
        "prepared_date": datetime.date.today().strftime("%B %Y"),
        "headline_unenrolled": fmt_int(round(need["unenrolled"])),
        "recon_note": recon_note,
        "recon_method_bullet": recon_method_bullet,
        "bank_specific_block": bank_specific_block,
        # Static QR to the live assistant (same URL for every bank); pre-generated
        # asset, so the generator stays stdlib-only. See assets/qr-chat.svg.
        "qr_chat_svg": qr_svg,
        "evidence_block": evidence_block,
        "safeguards_line": safeguards_line,
        "p3_detail_foot": p3_detail_foot,
        "demo_section": demo_section,
        "chat_shot_src": chat_shot_src,
        "chat_aspect": chat_aspect,
        "chat_overlay": chat_overlay,
        "chat_legend": chat_legend,
        "chat_cap": chat_cap,
        # Page-3 (platform evidence) state-awareness: the demo and the ME-audit
        # provenance are state-specific, so the CalFresh/California framing must
        # not render for the FL banks. The mixed-status citations (7 CFR) are
        # federal and valid in every state.
        "state_name": pumamap.STATE_NAMES.get(state, "your state"),
        "me_audit_clause": (
            "; the CA pack built from an audit of 38 county ME reports"
            if state == "CA" else ""),
        "benefit_range": f"{fmt_musd(need['benefit_low_usd'])}–{fmt_musd(need['benefit_high_usd'])}",
        "ratio_line": ratio_line,
        "map_caption": map_caption,
        "map_svg": mapsvg.regional_map_svg(bank["aa_counties"], metrics,
                                           geojson_kind=meta["geojson"],
                                           state_fips=meta["fips"]),
        "program_ref": meta["program_ref"],
        "model_note": meta["model_note"],
        "method_short": meta["method_short"],
        "method_bullet": meta["method_bullet"],
        "eligible_fmt": fmt_int(need["eligible"]),
        "aa_enrolled_pct": f"{need['aa_enrolled_pct']:.0f}",
        "aa_unenrolled_pct": f"{100 - need['aa_enrolled_pct']:.0f}",
        "state_enrolled_pct": f"{need['state_enrolled_pct']:.0f}",
        "benefit_monthly": f"{need['avg_household_monthly_usd']:.0f}",
        "data_gaps_note": gaps,
        "ask_fmt": fmt_int(bank["ask_usd"]),
        # Page-1 documented-access callout (CDSS ME). Presentation only—see
        # access_evidence.py; never feeds need/funnel/score. Empty = silent.
        "me_evidence_block": access_evidence.evidence_html(
            bank["aa_counties"], state=bank.get("state", "CA")),
        "aa_geo_visual": aa_geo_visual,
        "assumptions_version": assumptions["version"],
        "hh_low": hh["low_dollar"],
        "hh_high": hh["high_dollar"],
    }
    for s in ("low", "mid"):
        f = fun[s]
        v[f"{s}_clicks"] = fmt_int(f["clicks"])
        v[f"{s}_sessions"] = fmt_int(f["sessions"])
        v[f"{s}_checks"] = fmt_int(f["checks"])
        v[f"{s}_started"] = fmt_int(f["apps_started"])
        v[f"{s}_submitted"] = fmt_int(f["apps_submitted"])
        v[f"{s}_approved"] = fmt_int(f["approved_households"])
        v[f"{s}_benefit"] = fmt_musd(f["annual_benefit_usd"]) + "/yr"
        v[f"{s}_cps"] = f"${bank['ask_usd'] / f['apps_submitted']:,.0f}"
        # Downstream research effects (debt, delinquency, credit score) are shown
        # ONLY as per-household figures in page-1 prose, labelled as published
        # research measured on other people. They are deliberately NOT aggregated
        # into the projected table: multiplying a per-household effect by a
        # projected approval count stacks assumptions, and credit-score points in
        # particular do not sum across households.
    return v, need


def html_to_pdf(html_path: Path, pdf_path: Path):
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf_path}", "--virtual-time-budget=8000",
         html_path.as_uri()],
        check=True, capture_output=True, timeout=120,
    )
    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise RuntimeError("Chrome produced no PDF")
    if pdf_path.stat().st_size > 10 * 1024 * 1024:
        raise RuntimeError("PDF exceeds the 10MB budget")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--send", action="store_true",
                    help="content-hash archive the PDF into sent/")
    ap.add_argument("--html-only", action="store_true")
    args = ap.parse_args(argv)

    banks, assumptions, org = load_inputs()
    if args.bank not in banks:
        raise KeyError(f"unknown bank key {args.bank!r}; known: {sorted(banks)}")
    bank = banks[args.bank]
    meta = states.state_meta(bank.get("state", "CA"))
    metrics = score.load_county_metrics(meta["metrics"])
    values, need = build_values(bank, assumptions, org, metrics, meta)

    template = (TOOL_ROOT / "templates/artifact.html").read_text()
    html = render(template, values)
    out = TOOL_ROOT / "out"
    out.mkdir(exist_ok=True)
    html_path = out / f"{args.bank}.html"
    html_path.write_text(html)
    print(f"HTML: {html_path}")

    # Numbers the oracle hand-calc (T5e) must independently reproduce:
    print(f"ORACLE CHECK—{bank['name']}: eligible={need['eligible']:.0f} "
          f"unenrolled={need['unenrolled']:.0f} ratio={need['ratio']:.3f} "
          f"benefit_range=({need['benefit_low_usd']:.0f}, {need['benefit_high_usd']:.0f})")

    if args.html_only:
        return 0
    pdf_path = out / f"{args.bank}.pdf"
    html_to_pdf(html_path, pdf_path)
    print(f"PDF:  {pdf_path} ({pdf_path.stat().st_size/1024:.0f} KB)")

    if args.send:
        if not bank.get("verified"):
            raise UnverifiedBankError(
                f"{args.bank} has verified:false—re-read the PE and flip the "
                "flag before archiving a send copy")
        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()[:8]
        sent = TOOL_ROOT / "sent"
        sent.mkdir(exist_ok=True)
        dest = sent / f"{args.bank}-{datetime.date.today()}-{digest}.pdf"
        shutil.copy2(pdf_path, dest)
        print(f"SENT ARCHIVE: {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
