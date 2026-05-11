"""Drive every scripted trace through the orchestrator and assert that
each turn produces the expected next topic, terminal status, and (when
applicable) eligibility verdict.

Run after every prompt or pipeline change. CI red on any divergence.
"""
from __future__ import annotations

from datetime import date

import pytest

from backend.civic_api.snap.pipeline.eval import ALL_TRACES, Trace, TurnExpectation
from backend.civic_api.snap.pipeline.orchestrator import SnapPipelineOrchestrator
from backend.civic_api.snap.pipeline.repository import InMemorySnapPipelineRepository
from backend.civic_api.snap.pipeline.schemas import QuestionTopic
from tests.snap.pipeline.conftest import ScriptedLLMClient


@pytest.mark.parametrize("trace", ALL_TRACES, ids=[t.name for t in ALL_TRACES])
def test_trace(trace: Trace):
    scripted = ScriptedLLMClient()
    repo = InMemorySnapPipelineRepository()
    orchestrator = SnapPipelineOrchestrator(
        llm_client=scripted,
        repository=repo,
        effective_date=date(2025, 5, 10),
    )

    # Open: the script_writer is called once with the opening question.
    scripted.push(trace.opening_question)
    session_id, opening = orchestrator.start_session(
        state=trace.state, language=trace.language
    )
    assert opening.assistant_question == trace.opening_question.question_text

    for turn_index, expectation in enumerate(trace.turns):
        scripted.push(expectation.interpreter_output)
        if expectation.script_writer_output is not None:
            scripted.push(expectation.script_writer_output)
        # Terminal turns don't push a script_writer_output because the
        # orchestrator emits a deterministic closing message.

        result = orchestrator.handle_user_turn(
            session_id=session_id, user_text=expectation.user_utterance
        )

        assert result.next_topic == expectation.expected_next_topic, (
            f"trace={trace.name!r} turn={turn_index} "
            f"expected next_topic={expectation.expected_next_topic.value!r}, "
            f"got {result.next_topic.value!r}"
        )

        if expectation.assert_terminal:
            assert result.is_terminal, (
                f"trace={trace.name!r} turn={turn_index} "
                f"expected terminal but is_terminal=False"
            )
        else:
            assert not result.is_terminal, (
                f"trace={trace.name!r} turn={turn_index} "
                f"unexpected terminal: result={result}"
            )

        if expectation.assert_clarification:
            assert result.needs_clarification, (
                f"trace={trace.name!r} turn={turn_index} "
                f"expected clarification but needs_clarification=False"
            )

        if expectation.assert_eligibility_status is not None:
            assert result.eligibility_preview is not None, (
                f"trace={trace.name!r} turn={turn_index} no eligibility preview"
            )
            assert (
                result.eligibility_preview.status == expectation.assert_eligibility_status
            ), (
                f"trace={trace.name!r} turn={turn_index} "
                f"expected status={expectation.assert_eligibility_status.value!r}, "
                f"got {result.eligibility_preview.status.value!r}"
            )

        if expectation.assert_min_benefit is not None:
            assert result.eligibility_preview is not None
            actual = result.eligibility_preview.monthly_benefit
            assert actual is not None and actual >= expectation.assert_min_benefit, (
                f"trace={trace.name!r} turn={turn_index} "
                f"expected benefit >= {expectation.assert_min_benefit}, got {actual}"
            )

        if expectation.assert_max_benefit is not None:
            assert result.eligibility_preview is not None
            actual = result.eligibility_preview.monthly_benefit
            assert actual is not None and actual <= expectation.assert_max_benefit, (
                f"trace={trace.name!r} turn={turn_index} "
                f"expected benefit <= {expectation.assert_max_benefit}, got {actual}"
            )


def test_trace_count_meets_phase_c_floor():
    """Plan calls for 30+ traces by end of Phase C; this asserts we have
    at least 10 (Phase C MVP target). Update as traces are added."""
    assert len(ALL_TRACES) >= 10, (
        f"Phase C eval set has {len(ALL_TRACES)} traces; minimum is 10."
    )


def test_language_passthrough_to_llm_calls():
    """When the session is opened with a non-English language, every
    LLM call inside this session must be tagged with that language."""
    from backend.civic_api.snap.pipeline.eval.traces import SPANISH_LANGUAGE_PASSTHROUGH

    scripted = ScriptedLLMClient()
    repo = InMemorySnapPipelineRepository()
    orchestrator = SnapPipelineOrchestrator(
        llm_client=scripted,
        repository=repo,
        effective_date=date(2025, 5, 10),
    )
    scripted.push(SPANISH_LANGUAGE_PASSTHROUGH.opening_question)
    session_id, _ = orchestrator.start_session(
        state=SPANISH_LANGUAGE_PASSTHROUGH.state,
        language=SPANISH_LANGUAGE_PASSTHROUGH.language,
    )
    for expectation in SPANISH_LANGUAGE_PASSTHROUGH.turns:
        scripted.push(expectation.interpreter_output)
        if expectation.script_writer_output is not None:
            scripted.push(expectation.script_writer_output)
        orchestrator.handle_user_turn(
            session_id=session_id, user_text=expectation.user_utterance
        )

    assert all(c["language"] == "es" for c in scripted.calls), (
        f"Some calls weren't tagged language=es: {scripted.calls}"
    )
