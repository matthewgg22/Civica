"""Orchestrator — coordinates the 3 pipeline stages per user turn.

Sequence per turn:
  1. Append the user's utterance to the transcript.
  2. Run Interpreter → InterpreterOutput.
  3. Merge into running PartialHousehold (state_merge.apply_interpreter_output).
  4. If finalizable, run rules engine. If determination is reached
     (ELIGIBLE / INELIGIBLE), set next_topic=DONE and emit a closing
     assistant message.
  5. Otherwise run Ask-Selector to pick the next topic.
  6. Run Script-Writer to turn the topic into a user-facing question.
  7. Append the assistant's question to the transcript.
  8. Return TurnResult.

The orchestrator is sync. FastAPI handlers wrap it in `await asyncio.to_thread(...)`.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Callable
from uuid import uuid4

from ..llm.client import LLMClient
from ..rules.federal import FederalSNAPRules
from ..rules.interfaces import EligibilityResult
from ..rules.states.california import CaliforniaSNAPRules
from ..rules.states.massachusetts import MassachusettsSNAPRules
from .ask_selector import pick_next_topic
from .interpreter import run_interpreter
from .repository import SnapPipelineRepository, StoredTurn
from .schemas import (
    AskSelectorOutput,
    InterpreterOutput,
    PartialHousehold,
    QuestionTopic,
    ScriptWriterOutput,
    TurnLLMTelemetry,
    TurnResult,
)
from .script_writer import run_script_writer
from .state_merge import apply_interpreter_output


# Rules-class registry. Adding a state means adding one entry here and
# building the corresponding rules subclass.
_RULES_BY_STATE: dict[str, type] = {
    "CA": CaliforniaSNAPRules,
    "MA": MassachusettsSNAPRules,
}


def _select_rules_class(state: str | None) -> type:
    if state and state in _RULES_BY_STATE:
        return _RULES_BY_STATE[state]
    return FederalSNAPRules


@dataclass
class SnapPipelineOrchestrator:
    """Stateless executor; per-session state lives in the repository.

    Build one instance per process and reuse it. The LLMClient inside
    is stateless too, so no contention.
    """

    llm_client: LLMClient
    repository: SnapPipelineRepository
    effective_date: date
    interpreter_runner: Callable = run_interpreter
    script_writer_runner: Callable = run_script_writer
    ask_selector: Callable[[PartialHousehold], AskSelectorOutput] = pick_next_topic

    def start_session(self, *, state: str, language: str = "en") -> tuple[str, TurnResult]:
        """Open a new session and return the opening assistant turn."""
        session_id = self.repository.create_session(state=state, language=language)
        accumulated = self.repository.get_session_state(session_id)

        ask_decision = self.ask_selector(accumulated)
        script_output, telemetry = self.script_writer_runner(
            client=self.llm_client,
            ask_decision=ask_decision,
            state=accumulated,
            language=language,
        )
        # Record that we've asked this topic so the next turn doesn't re-ask.
        accumulated.asked_topics.append(ask_decision.next_topic.value)
        self.repository.save_session_state(session_id, accumulated)

        turn_index = self.repository.next_turn_index(session_id)
        self.repository.append_turn(
            StoredTurn(
                turn_id=str(uuid4()),
                session_id=session_id,
                turn_index=turn_index,
                role="assistant",
                content=script_output.question_text,
                pipeline_stage="script_writer",
                telemetry=_to_turn_telemetry("script_writer", telemetry),
            )
        )
        return session_id, TurnResult(
            session_id=session_id,
            turn_index=turn_index,
            assistant_question=script_output.question_text,
            helper_text=script_output.helper_text,
            expected_input_type=script_output.expected_input_type,
            choice_options=script_output.choice_options,
            next_topic=ask_decision.next_topic,
            is_terminal=False,
            confidence=1.0,
            cost_telemetry=[_to_turn_telemetry("script_writer", telemetry)],
        )

    def handle_user_turn(self, *, session_id: str, user_text: str) -> TurnResult:
        accumulated = self.repository.get_session_state(session_id)
        language = self.repository.session_language(session_id)
        last_assistant_topic = self._last_assistant_topic(session_id)

        # 1. Persist the user's utterance.
        user_turn_index = self.repository.next_turn_index(session_id)
        self.repository.append_turn(
            StoredTurn(
                turn_id=str(uuid4()),
                session_id=session_id,
                turn_index=user_turn_index,
                role="user",
                content=user_text,
            )
        )

        cost_log: list[TurnLLMTelemetry] = []

        # 2. Interpreter.
        interpreter_output, interp_tel = self.interpreter_runner(
            client=self.llm_client,
            user_utterance=user_text,
            accumulated_state=accumulated,
            pending_topic=last_assistant_topic,
            language=language,
        )
        cost_log.append(_to_turn_telemetry("interpreter", interp_tel))

        # 3. Merge into running state.
        new_state = apply_interpreter_output(accumulated, interpreter_output)
        self.repository.save_session_state(session_id, new_state)

        # If the interpreter flagged needs_clarification, surface it
        # without advancing the topic.
        if interpreter_output.needs_clarification:
            return self._emit_clarification(
                session_id=session_id,
                interpreter_output=interpreter_output,
                state=new_state,
                language=language,
                cost_log=cost_log,
            )

        # 4. Pick next topic. Ask-Selector is the gate: only when it says
        #    DONE do we run the rules engine for a final determination.
        #    Running rules earlier produces "eligible at $292" for a
        #    barely-populated household and prematurely terminates the
        #    conversation.
        ask_decision = self.ask_selector(new_state)

        if ask_decision.next_topic == QuestionTopic.DONE:
            eligibility_preview: EligibilityResult | None = None
            if new_state.is_finalizable():
                household = new_state.to_household()
                rules_class = _select_rules_class(new_state.state)
                rules = rules_class(effective_date=self.effective_date)
                eligibility_preview = rules.determine_eligibility(household)
            return self._emit_terminal(
                session_id=session_id,
                eligibility_preview=eligibility_preview,
                cost_log=cost_log,
                interpreter_confidence=interpreter_output.confidence,
            )

        # 6. Script-Writer.
        script_output, script_tel = self.script_writer_runner(
            client=self.llm_client,
            ask_decision=ask_decision,
            state=new_state,
            language=language,
        )
        cost_log.append(_to_turn_telemetry("script_writer", script_tel))

        # Record asked topic so the next turn doesn't re-ask.
        new_state.asked_topics.append(ask_decision.next_topic.value)
        self.repository.save_session_state(session_id, new_state)

        # 7. Append assistant turn.
        assistant_turn_index = self.repository.next_turn_index(session_id)
        self.repository.append_turn(
            StoredTurn(
                turn_id=str(uuid4()),
                session_id=session_id,
                turn_index=assistant_turn_index,
                role="assistant",
                content=script_output.question_text,
                pipeline_stage="script_writer",
                telemetry=_to_turn_telemetry("script_writer", script_tel),
            )
        )

        return TurnResult(
            session_id=session_id,
            turn_index=assistant_turn_index,
            assistant_question=script_output.question_text,
            helper_text=script_output.helper_text,
            expected_input_type=script_output.expected_input_type,
            choice_options=script_output.choice_options,
            next_topic=ask_decision.next_topic,
            is_terminal=False,
            needs_user_confirmation=interpreter_output.confidence < 0.6,
            confidence=interpreter_output.confidence,
            cost_telemetry=cost_log,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _last_assistant_topic(self, session_id: str) -> QuestionTopic:
        """Best-effort lookup of the topic from the most recent assistant
        turn. Used by the Interpreter as the pending-topic hint."""
        for turn in reversed(self.repository.list_turns(session_id)):
            if turn.role == "assistant":
                # Phase C doesn't persist topic alongside content; we
                # rely on the Interpreter's prompt to figure out from
                # the conversation history what was asked. Default to
                # CLARIFICATION_NEEDED if we genuinely can't tell.
                return QuestionTopic.CLARIFICATION_NEEDED
        return QuestionTopic.HOUSEHOLD_STATE

    def _emit_clarification(
        self,
        *,
        session_id: str,
        interpreter_output: InterpreterOutput,
        state: PartialHousehold,
        language: str,
        cost_log: list[TurnLLMTelemetry],
    ) -> TurnResult:
        clarification_decision = AskSelectorOutput(
            next_topic=QuestionTopic.CLARIFICATION_NEEDED,
            justification="Interpreter flagged the user response as ambiguous.",
            priority="high",
            is_clarification=True,
            clarification_text=interpreter_output.clarification_reason
            or "Could you tell me a little more about that?",
        )
        script_output, script_tel = self.script_writer_runner(
            client=self.llm_client,
            ask_decision=clarification_decision,
            state=state,
            language=language,
        )
        cost_log.append(_to_turn_telemetry("script_writer", script_tel))

        assistant_turn_index = self.repository.next_turn_index(session_id)
        self.repository.append_turn(
            StoredTurn(
                turn_id=str(uuid4()),
                session_id=session_id,
                turn_index=assistant_turn_index,
                role="assistant",
                content=script_output.question_text,
                pipeline_stage="script_writer",
                telemetry=_to_turn_telemetry("script_writer", script_tel),
            )
        )
        return TurnResult(
            session_id=session_id,
            turn_index=assistant_turn_index,
            assistant_question=script_output.question_text,
            helper_text=script_output.helper_text,
            expected_input_type=script_output.expected_input_type,
            choice_options=script_output.choice_options,
            next_topic=QuestionTopic.CLARIFICATION_NEEDED,
            is_terminal=False,
            needs_clarification=True,
            clarification_text=interpreter_output.clarification_reason,
            confidence=interpreter_output.confidence,
            cost_telemetry=cost_log,
        )

    def _emit_terminal(
        self,
        *,
        session_id: str,
        eligibility_preview: EligibilityResult | None,
        cost_log: list[TurnLLMTelemetry],
        interpreter_confidence: float,
    ) -> TurnResult:
        # Closing assistant message comes from a deterministic template,
        # not the Script-Writer LLM, because we want predictable copy
        # for the verdict screen across runs of the same data.
        if eligibility_preview is None:
            closing = (
                "Thanks — I have what I need to put together your application draft."
            )
        elif eligibility_preview.status.value == "eligible":
            benefit = eligibility_preview.monthly_benefit or Decimal("0")
            closing = (
                f"Based on what you've shared, you appear likely eligible for about "
                f"${int(benefit)}/month. I'll list the documents you'll need to submit."
            )
        else:
            closing = (
                f"Based on what you've shared, you don't appear likely to qualify for "
                f"SNAP right now: {eligibility_preview.ineligibility_reason}"
            )
        assistant_turn_index = self.repository.next_turn_index(session_id)
        self.repository.append_turn(
            StoredTurn(
                turn_id=str(uuid4()),
                session_id=session_id,
                turn_index=assistant_turn_index,
                role="assistant",
                content=closing,
                pipeline_stage=None,
            )
        )
        return TurnResult(
            session_id=session_id,
            turn_index=assistant_turn_index,
            assistant_question=closing,
            expected_input_type=__import__(
                "backend.civic_api.snap.pipeline.schemas",
                fromlist=["ExpectedInputType"],
            ).ExpectedInputType.FREE_TEXT,
            next_topic=QuestionTopic.DONE,
            eligibility_preview=eligibility_preview,
            is_terminal=True,
            confidence=interpreter_confidence,
            cost_telemetry=cost_log,
        )


def _to_turn_telemetry(stage: str, telemetry) -> TurnLLMTelemetry:
    return TurnLLMTelemetry(
        stage=stage,
        model_used=telemetry.model_used,
        provider_used=telemetry.provider_used,
        input_tokens=telemetry.input_tokens,
        output_tokens=telemetry.output_tokens,
        latency_ms=telemetry.latency_ms,
        cost_usd=telemetry.cost_usd,
    )
