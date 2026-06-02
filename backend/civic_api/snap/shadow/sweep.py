"""Shadow eligibility sweep — run the engine over live packets, persist results.

Reads snap_enrollment.packet_answers + snap_packets, runs the deterministic rules
engine on each packet (via the adapter), and writes a determination + rule trace
into snap_enrollment.eligibility_determinations / eligibility_rule_trace
(migration 20260602). READ-ONLY shadow: nothing in the applicant/navigator flow
changes.

Modes:
  (default)   dry-run — build determinations, print an AGGREGATE summary, write nothing.
  --write     persist determinations + traces (requires migration 20260602 applied).
  --demo      run one synthetic complete household through determine -> trace and
              print it (no DB; verifies the engine->determination->trace mapping).
  --limit N   cap packets processed.

Run from the backend package root:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
        python -m civic_api.snap.shadow.sweep            # dry-run
    python -m civic_api.snap.shadow.sweep --demo          # no creds needed

The aggregate summary IS the deliverable on today's data: it quantifies, per
packet, what the intake fails to collect (the `needs` histogram) — the gap that
keeps determinations `pending`. No applicant values are printed.
"""
from __future__ import annotations

import argparse
import logging
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from ..rules.federal import FederalSNAPRules
from ..rules.interfaces import (
    CitizenshipStatus,
    EligibilityResult,
    EligibilityStatus,
    ExpenseFacts,
    Household,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
)
from ..rules.citations import citation_for
from ..rules.poverty_guidelines import NoTableForDateError
from ..rules.states.california import CaliforniaSNAPRules
from ..rules.states.massachusetts import MassachusettsSNAPRules
from .adapter import build_household
from .rest import PostgrestClient
from ..eligibility_engine import EligibilityEngine
from ..scoring.clarification import build_clarification
from ..scoring.priors import InputUncertainty
from ..scoring.spine import Origin, rank_clarifications, score_case
from ..scoring.verification import VerificationStatus, from_answer_source

logger = logging.getLogger(__name__)

_SCHEMA = "snap_enrollment"
_STATE_RULES: dict[str, type[FederalSNAPRules]] = {
    "CA": CaliforniaSNAPRules,
    "MA": MassachusettsSNAPRules,
}
_OUTCOME = {
    EligibilityStatus.ELIGIBLE: "eligible",
    EligibilityStatus.INELIGIBLE: "ineligible",
    EligibilityStatus.ELIGIBLE_WITH_CONDITIONS: "eligible_with_conditions",
    EligibilityStatus.INSUFFICIENT_INFORMATION: "pending",
}
_ENGINE_NOT_RUN = "shadow-adapter-v0 (engine not run: required inputs uncollected)"


def _rules_for(state: str, effective: date) -> FederalSNAPRules:
    cls = _STATE_RULES.get((state or "").upper(), FederalSNAPRules)
    return cls(effective_date=effective)


def _as_of(meta: dict[str, Any] | None) -> date:
    for key in ("submitted_at", "created_at"):
        value = (meta or {}).get(key)
        if value:
            try:
                return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
            except ValueError:
                pass
    return datetime.now(timezone.utc).date()


def _allotment_cents(result: EligibilityResult) -> int | None:
    if result.monthly_benefit is None:
        return None
    return int((result.monthly_benefit * Decimal("100")).to_integral_value())


def _determination_row(
    *,
    packet_id: str,
    state: str,
    as_of: date,
    outcome: str,
    engine_version: str,
    allotment_cents: int | None = None,
    needs: list[str] | None = None,
    ineligibility_reason: str | None = None,
    facts_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "packet_id": packet_id,
        "engine_version": engine_version,
        "state_code": state,
        "action_type": "initial",
        "as_of_date": as_of.isoformat(),
        "outcome": outcome,
        "allotment_cents": allotment_cents,
        "needs": needs or [],
        "ineligibility_reason": ineligibility_reason,
        "facts_snapshot": facts_snapshot or {},
    }


def _trace_from_result(result: EligibilityResult) -> list[dict[str, Any]]:
    return [
        {
            "seq": i,
            "rule_id": t.test_name,
            "citation_id": citation_for(t.test_name),
            "predicate_result": t.passes,
            "threshold": str(t.threshold) if t.threshold is not None else None,
            "actual": str(t.actual) if t.actual is not None else None,
            "effect_applied": None,
            "notes": t.notes or None,
        }
        for i, t in enumerate(result.test_outcomes)
    ]


def _trace_from_needs(needs: list[str]) -> list[dict[str, Any]]:
    """Pending determinations have no engine tests; the trace documents WHY."""
    return [
        {
            "seq": i,
            "rule_id": f"input.{need}",
            "citation_id": None,
            "predicate_result": False,
            "threshold": None,
            "actual": None,
            "effect_applied": "blocks_determination",
            "notes": "required engine input not collected by the intake",
        }
        for i, need in enumerate(needs)
    ]


# Live answer field -> the scoring spine's canonical field.
_SCORING_FIELD = {"monthly_income": "earned", "monthly_rent": "housing"}


def build_uncertainty(adapted) -> InputUncertainty:
    """Bridge the adapter's provenance into per-field uncertainty for the spine.
    The §11 verification status (the strongest predictor) is derived from the answer's
    origin; the spine turns it into P(error). The error-magnitude SAMPLES remain
    ⚠ PLACEHOLDERS pending the QC error-magnitude distribution — illustrative, not validated."""
    facts = adapted.facts_snapshot.get("facts", {})
    samples: dict[str, list[Decimal]] = {}
    verification: dict[str, VerificationStatus] = {}
    for live_field, sfield in _SCORING_FIELD.items():
        info = facts.get(live_field)
        if not info:
            continue
        verification[sfield] = from_answer_source(info.get("source"))
        st = info.get("status", "self_reported")
        samples[sfield] = ([Decimal("150"), Decimal("-150"), Decimal("75")]
                           if st in ("self_reported", "extracted") else [Decimal("40"), Decimal("-40")])
    return InputUncertainty(error_samples=samples, verification=verification)


def _outcome_row(*, packet_id, b_hat, region, case_unit, clarifications, origin="random") -> dict[str, Any]:
    cents = int((b_hat * Decimal("100")).to_integral_value()) if b_hat is not None else None
    return {
        "packet_id": packet_id,
        "b_hat_cents": cents,
        "region": region.value if hasattr(region, "value") else str(region),
        "sampling_origin": origin,        # census of submitted packets = unbiased (not cherry-picked)
        "label_source": "engine",          # our determination, NOT truth → counts_toward_rate = false
        "meta": {
            "case_value": str(case_unit.value),
            "dollars_at_risk": str(case_unit.dollars_at_risk),
            "p_error": str(case_unit.p_error),
            "driver_field": case_unit.detail.get("driver_field"),
            "top_clarifications": [c.label for c in clarifications],
        },
    }


def _persist(client: PostgrestClient, det_row: dict[str, Any], trace_rows: list[dict[str, Any]]) -> str:
    inserted = client.insert("eligibility_determinations", [det_row], schema=_SCHEMA)
    determination_id = inserted[0]["determination_id"]
    for r in trace_rows:
        r["determination_id"] = determination_id
    client.insert("eligibility_rule_trace", trace_rows, schema=_SCHEMA)
    return determination_id


# ---------------------------------------------------------------------------
# Demo: prove the engine -> determination -> trace mapping (no DB).
# ---------------------------------------------------------------------------


def run_demo(effective: date) -> None:
    household = Household(
        state="CA",
        members=[
            HouseholdMember(member_id="m1", age=40, is_applicant=True, citizenship=CitizenshipStatus.US_CITIZEN),
            HouseholdMember(member_id="m2", age=10),
            HouseholdMember(member_id="m3", age=8),
        ],
        income=IncomeFacts(
            sources=[IncomeSource(member_id="m1", source_type="wages",
                                  monthly_gross=Decimal("1800"), is_earned=True)]
        ),
        expenses=ExpenseFacts(rent_or_mortgage=Decimal("1360")),  # near the shelter cap
    )
    result = _rules_for(household.state, effective).determine_eligibility(household)
    det = _determination_row(
        packet_id="00000000-0000-0000-0000-000000000000",
        state="CA",
        as_of=effective,
        outcome=_OUTCOME[result.status],
        engine_version=result.rules_version,
        allotment_cents=_allotment_cents(result),
        needs=[v.code for v in result.required_verifications],
        ineligibility_reason=result.ineligibility_reason,
        facts_snapshot={"demo": True, "note": "synthetic complete household"},
    )
    trace = _trace_from_result(result)
    print("=== DEMO: synthetic complete household -> determination ===")
    print(f"  outcome={det['outcome']}  allotment_cents={det['allotment_cents']}  "
          f"engine_version={det['engine_version']}  as_of={det['as_of_date']}")
    print(f"  trace ({len(trace)} rows):")
    for r in trace:
        print(f"    seq={r['seq']} rule={r['rule_id']} pass={r['predicate_result']} "
              f"thr={r['threshold']} act={r['actual']} cite={r['citation_id']}")
    # ---- the two wings on this determinable household (the spine, wired) ----
    engine = EligibilityEngine()
    unc = InputUncertainty(
        error_samples={"earned": [Decimal("300"), Decimal("-300"), Decimal("150")]},
        p_wrong={"earned": Decimal("0.6")},
    )
    case_unit = score_case(engine, household, as_of_date=effective, uncertainty=unc, origin=Origin.RANDOM)
    ranked = rank_clarifications(engine, household, as_of_date=effective, uncertainty=unc)
    top = ranked[0]
    clar = build_clarification(top.label)
    print("  --- error-rate wing: case score ---")
    print(f"    region={case_unit.region.value}  $-at-risk={case_unit.dollars_at_risk}  "
          f"Value(P×$×tier)={case_unit.value}")
    print("  --- prevention wing: top clarification (amount firewalled) ---")
    print(f"    field={top.label}  reason={clar.reason_code}")
    print(f"    prompt: {clar.prompt_en}")
    orow = _outcome_row(packet_id="00000000-0000-0000-0000-000000000000", b_hat=result.monthly_benefit,
                        region=case_unit.region, case_unit=case_unit, clarifications=ranked[:3])
    print("  --- outcome-ledger row (engine label; counts_toward_rate=false) ---")
    print(f"    sampling_origin={orow['sampling_origin']}  label_source={orow['label_source']}  "
          f"b_hat_cents={orow['b_hat_cents']}")
    print("  (dry-run only — demo never writes; uses a placeholder packet_id)")


# ---------------------------------------------------------------------------
# Sweep over the live packets.
# ---------------------------------------------------------------------------


def run_sweep(*, write: bool, limit: int | None) -> None:
    client = PostgrestClient()

    answer_rows = client.get(
        "packet_answers",
        schema=_SCHEMA,
        params={
            "select": "packet_id,question_key,answer_source,applicant_answer,"
                      "original_ocr_value,navigator_confirmed_value"
        },
    )
    answers_by_packet: dict[str, list[dict[str, Any]]] = {}
    for row in answer_rows:
        answers_by_packet.setdefault(row["packet_id"], []).append(row)

    packet_rows = client.get(
        "snap_packets",
        schema=_SCHEMA,
        params={"select": "packet_id,state_code,submitted_at,created_at"},
    )
    meta_by_packet = {r["packet_id"]: r for r in packet_rows}

    packet_ids = list(answers_by_packet.keys())
    if limit is not None:
        packet_ids = packet_ids[:limit]

    outcomes: Counter[str] = Counter()
    needs_hist: Counter[str] = Counter()
    clar_hist: Counter[str] = Counter()
    case_values: list[Decimal] = []
    skipped_no_reference = 0
    scorable = 0
    engine = EligibilityEngine()

    for packet_id in packet_ids:
        meta = meta_by_packet.get(packet_id)
        state = (meta or {}).get("state_code") or ""
        as_of = _as_of(meta)
        adapted = build_household(answers_by_packet[packet_id], state)
        outcome_row: dict[str, Any] | None = None

        if adapted.household is None:
            outcomes["pending"] += 1
            needs_hist.update(adapted.needs)
            det = _determination_row(
                packet_id=packet_id, state=state, as_of=as_of, outcome="pending",
                engine_version=_ENGINE_NOT_RUN, needs=adapted.needs,
                facts_snapshot=adapted.facts_snapshot,
            )
            trace = _trace_from_needs(adapted.needs)
        else:
            try:
                result = _rules_for(state, as_of).determine_eligibility(adapted.household)
            except NoTableForDateError:
                skipped_no_reference += 1
                logger.warning("packet %s: no reference table for %s — skipped", packet_id, as_of)
                continue
            outcome = _OUTCOME[result.status]
            outcomes[outcome] += 1
            det = _determination_row(
                packet_id=packet_id, state=state, as_of=as_of, outcome=outcome,
                engine_version=result.rules_version,
                allotment_cents=_allotment_cents(result),
                needs=[v.code for v in result.required_verifications],
                ineligibility_reason=result.ineligibility_reason,
                facts_snapshot=adapted.facts_snapshot,
            )
            trace = _trace_from_result(result)
            # error-rate wing: score the determined case. prevention wing: rank clarifications.
            uncertainty = build_uncertainty(adapted)
            case_unit = score_case(engine, adapted.household, as_of_date=as_of, uncertainty=uncertainty, origin=Origin.RANDOM)
            clars = rank_clarifications(engine, adapted.household, as_of_date=as_of, uncertainty=uncertainty)[:3]
            scorable += 1
            case_values.append(case_unit.value)
            if clars:
                clar_hist[clars[0].label] += 1
            outcome_row = _outcome_row(packet_id=packet_id, b_hat=result.monthly_benefit,
                                       region=case_unit.region, case_unit=case_unit, clarifications=clars)

        if write:
            det_id = _persist(client, det, trace)
            if outcome_row is not None:
                outcome_row["determination_id"] = det_id
                client.insert("eligibility_outcomes", [outcome_row], schema=_SCHEMA)

    _print_summary(
        total=len(packet_ids), outcomes=outcomes, needs_hist=needs_hist,
        skipped_no_reference=skipped_no_reference, scorable=scorable,
        case_values=case_values, clar_hist=clar_hist, wrote=write,
    )


def _print_summary(*, total, outcomes, needs_hist, skipped_no_reference, scorable, case_values, clar_hist, wrote) -> None:
    print("=== Shadow eligibility sweep — summary (aggregate only; no applicant values) ===")
    print(f"  packets processed:        {total}")
    for outcome, n in sorted(outcomes.items()):
        print(f"    {outcome:<26} {n}")
    print(f"    skipped (no FY ref table) {skipped_no_reference}")
    if needs_hist:
        print("  collection-gap histogram (why packets are pending):")
        for need, n in needs_hist.most_common():
            print(f"    needs {need:<22} {n}")
    print(f"  scorable cases (error-rate wing): {scorable}")
    if case_values:
        mean_v = sum(case_values, Decimal("0")) / len(case_values)
        print(f"    mean case Value (P×$×tier): {mean_v:.2f}")
    if clar_hist:
        print("  top clarification field (prevention wing):")
        for fld, n in clar_hist.most_common():
            print(f"    {fld:<12} {n}")
    print(f"  persisted: {'YES (--write)' if wrote else 'no (dry-run)'}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Shadow eligibility sweep over live packets.")
    parser.add_argument("--write", action="store_true", help="persist determinations + traces")
    parser.add_argument("--limit", type=int, default=None, help="cap packets processed")
    parser.add_argument("--demo", action="store_true",
                        help="run one synthetic complete household (no DB) and exit")
    parser.add_argument("--effective-date", default="2025-03-15",
                        help="demo effective date (FY-loaded; default 2025-03-15)")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.demo:
        run_demo(date.fromisoformat(args.effective_date))
        return
    run_sweep(write=args.write, limit=args.limit)


if __name__ == "__main__":
    main()
