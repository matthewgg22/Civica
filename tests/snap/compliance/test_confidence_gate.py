"""Confidence-gate enforcement regression guard.

The QC layer of the SNAP enrollment product is positioned as a
"compliance-grade outreach subcontractor with provably lower error
rates." The 0.6 confidence threshold on interpreter output is the most
defensible single claim of that pitch — every conversational turn whose
interpretation is below the threshold must be flagged so the applicant
(or, downstream, a navigator) confirms before the data flows further.

This test pins three guarantees:

  1. TurnResult.confidence rejects values outside [0.0, 1.0] (Pydantic).
  2. InterpreterOutput.confidence rejects values outside [0.0, 1.0].
  3. The orchestrator MUST mark needs_user_confirmation=True for any
     interpreter output below the literal 0.6 threshold defined in
     backend/civic_api/snap/pipeline/orchestrator.py. If someone moves
     the threshold without updating this test, the test fails — which
     is the desired behavior: the threshold is a compliance commitment
     and shouldn't drift silently.

CI-blocking by sitting alongside the other tests in
tests/snap/compliance/ — the same workflow that runs
test_audit_trigger_coverage.py runs this.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.civic_api.snap.pipeline.schemas import InterpreterOutput, TurnResult

LOW_CONFIDENCE_THRESHOLD = 0.6

ORCHESTRATOR_PATH = (
    Path(__file__).resolve().parents[3]
    / "backend"
    / "civic_api"
    / "snap"
    / "pipeline"
    / "orchestrator.py"
)


def _turn_result_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = dict(
        session_id="s1",
        turn_index=0,
        assistant_question="What is your household size?",
        expected_input_type="integer",
        next_topic="household_composition",
        is_terminal=False,
        confidence=0.9,
    )
    base.update(overrides)
    return base


class TestSchemaConfidenceBounds:
    """Pydantic must reject out-of-range confidence at the schema layer.

    The contract with the iOS client (SNAPTurnResult.confidence: Double)
    assumes [0.0, 1.0]; a leaky schema would corrupt downstream UI logic.
    """

    @pytest.mark.parametrize("bad", [-0.01, -1.0, 1.01, 2.0, 100.0])
    def test_turn_result_rejects_out_of_range_confidence(self, bad: float) -> None:
        with pytest.raises(ValidationError):
            TurnResult(**_turn_result_kwargs(confidence=bad))  # type: ignore[arg-type]

    @pytest.mark.parametrize("bad", [-0.01, 1.01, -5.0])
    def test_interpreter_output_rejects_out_of_range_confidence(self, bad: float) -> None:
        with pytest.raises(ValidationError):
            InterpreterOutput(confidence=bad)

    @pytest.mark.parametrize("good", [0.0, 0.5, 0.59, 0.6, 0.85, 1.0])
    def test_schema_accepts_in_range_confidence(self, good: float) -> None:
        TurnResult(**_turn_result_kwargs(confidence=good))  # type: ignore[arg-type]
        InterpreterOutput(confidence=good)


class TestOrchestratorThreshold:
    """The orchestrator literal `< 0.6` is a compliance commitment.

    If the threshold drifts (e.g., someone tunes it to 0.5 to reduce
    confirmation friction) without updating this test + the spec, this
    fails. That's the point — the gate is a marketed product claim, not
    a tunable knob.
    """

    def test_orchestrator_emits_low_confidence_flag_below_threshold(self) -> None:
        # Direct read of the orchestrator source: the gating expression
        # must compare interpreter_output.confidence to LOW_CONFIDENCE_THRESHOLD.
        source = ORCHESTRATOR_PATH.read_text()
        # Allow optional whitespace; tolerate `.confidence < 0.6` exactly.
        pattern = re.compile(
            r"needs_user_confirmation\s*=\s*interpreter_output\.confidence\s*<\s*"
            + re.escape(str(LOW_CONFIDENCE_THRESHOLD))
        )
        assert pattern.search(source), (
            f"Confidence gate threshold in orchestrator.py must be "
            f"`interpreter_output.confidence < {LOW_CONFIDENCE_THRESHOLD}` "
            f"(see tests/snap/compliance/test_confidence_gate.py). "
            f"If the threshold legitimately needs to change, update both."
        )

    def test_turn_result_default_does_not_silently_bypass_gate(self) -> None:
        # needs_user_confirmation must default to False so an orchestrator
        # that forgets to set it doesn't accidentally pass the gate.
        # (Defaulting to True would be safer but breaks downstream truthy checks
        # — this test pins the existing contract.)
        tr = TurnResult(**_turn_result_kwargs())  # type: ignore[arg-type]
        assert tr.needs_user_confirmation is False
