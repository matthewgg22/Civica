"""Orchestrator integration tests with the ScriptedLLMClient.

These tests exercise the full per-turn flow: user utterance →
Interpreter (mocked) → state merge → Ask-Selector (deterministic) →
Script-Writer (mocked) → TurnResult. The eval harness in
test_eval_traces.py builds on this with longer scripted conversations.
"""
from __future__ import annotations

from decimal import Decimal

from backend.civic_api.snap.pipeline.schemas import (
    ExpectedInputType,
    HouseholdMemberUpdate,
    IncomeSourceUpdate,
    QuestionTopic,
)
from backend.civic_api.snap.rules.interfaces import (
    CitizenshipStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)


class TestStartSession:
    def test_first_turn_emits_assistant_question(self, orchestrator, scripted_llm):
        scripted_llm.push_script_writer(
            question_text="Are you currently in Massachusetts?",
            expected_input_type=ExpectedInputType.YES_NO,
        )
        session_id, result = orchestrator.start_session(state="MA", language="en")
        assert session_id
        assert result.assistant_question == "Are you currently in Massachusetts?"
        assert result.next_topic == QuestionTopic.HOUSEHOLD_COMPOSITION
        assert result.is_terminal is False

    def test_first_turn_persisted(self, orchestrator, scripted_llm, repo):
        scripted_llm.push_script_writer(question_text="What state do you live in?")
        session_id, _ = orchestrator.start_session(state="MA")
        turns = repo.list_turns(session_id)
        assert len(turns) == 1
        assert turns[0].role == "assistant"
        assert turns[0].pipeline_stage == "script_writer"


class TestUserTurn:
    def test_extracts_member_and_advances_topic(self, orchestrator, scripted_llm, repo):
        # Turn 0: opening assistant question.
        scripted_llm.push_script_writer(question_text="Tell me about your household.")
        session_id, _ = orchestrator.start_session(state="MA")

        # Turn 1: user responds; interpreter extracts an applicant member.
        scripted_llm.push_interpreter(
            confidence=0.95,
            member_updates=[
                HouseholdMemberUpdate(
                    member_id="applicant",
                    age=32,
                    is_applicant=True,
                    citizenship=CitizenshipStatus.US_CITIZEN,
                )
            ],
        )
        scripted_llm.push_script_writer(
            question_text="Do you receive TANF, SSI, or other cash assistance?",
            expected_input_type=ExpectedInputType.YES_NO,
        )
        result = orchestrator.handle_user_turn(
            session_id=session_id, user_text="It's just me, I'm 32, US citizen."
        )
        # Ask-Selector skips citizenship (now known) and picks cash-program receipt.
        assert result.next_topic == QuestionTopic.CASH_PROGRAM_RECEIPT
        assert result.assistant_question == "Do you receive TANF, SSI, or other cash assistance?"
        assert result.is_terminal is False

        turns = repo.list_turns(session_id)
        # 1 opening + 1 user + 1 assistant = 3 turns total.
        assert [t.role for t in turns] == ["assistant", "user", "assistant"]

    def test_clarification_short_circuits_topic_advance(self, orchestrator, scripted_llm):
        scripted_llm.push_script_writer(question_text="Tell me about your household.")
        session_id, _ = orchestrator.start_session(state="MA")

        scripted_llm.push_interpreter(
            confidence=0.3,
            needs_clarification=True,
            clarification_reason="Could you tell me how many people live with you?",
        )
        scripted_llm.push_script_writer(
            question_text="Could you tell me how many people live with you?",
            expected_input_type=ExpectedInputType.INTEGER,
        )
        result = orchestrator.handle_user_turn(
            session_id=session_id, user_text="some folks"
        )
        assert result.needs_clarification is True
        assert result.next_topic == QuestionTopic.CLARIFICATION_NEEDED


class TestTerminalDetermination:
    def test_eligible_terminal_message_includes_benefit(
        self, orchestrator, scripted_llm, repo
    ):
        # Set the session up to be one input shy of finalizable.
        scripted_llm.push_script_writer(question_text="Hi.")
        session_id, _ = orchestrator.start_session(state="MA")

        # Send a single rich turn that fills everything the engine needs:
        # applicant, citizenship, no cash programs, $1,800 wages, $1,400 rent,
        # heating/cooling SUA, not homeless.
        scripted_llm.push_interpreter(
            confidence=0.96,
            member_updates=[
                HouseholdMemberUpdate(
                    member_id="applicant",
                    age=32,
                    is_applicant=True,
                    citizenship=CitizenshipStatus.US_CITIZEN,
                    student_status=StudentStatus.NOT_STUDENT,
                    student_exemption=StudentExemption.NONE,
                )
            ],
            income_sources_added=[
                IncomeSourceUpdate(
                    member_id="applicant",
                    source_type="wages",
                    monthly_gross=Decimal("1800"),
                    is_earned=True,
                )
            ],
            rent_or_mortgage=Decimal("1400"),
            sua_tier=SUATier.HEATING_COOLING,
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            is_homeless=False,
        )
        # No script_writer push because terminal closing message is deterministic.
        result = orchestrator.handle_user_turn(
            session_id=session_id,
            user_text=(
                "I'm a 32-year-old US citizen, single, $1,800 from my job, "
                "$1,400 rent, I have heat included in rent, no cash benefits, "
                "I have stable housing."
            ),
        )
        assert result.is_terminal is True
        assert result.next_topic == QuestionTopic.DONE
        assert result.eligibility_preview is not None
        assert result.eligibility_preview.status.value == "eligible"
        assert "$" in result.assistant_question  # benefit dollar mentioned
        # Closing message is deterministic, not LLM-generated.
        assert "/month" in result.assistant_question


class TestCostTelemetry:
    def test_telemetry_logs_per_stage(self, orchestrator, scripted_llm):
        scripted_llm.push_script_writer(question_text="Hi.")
        session_id, opening = orchestrator.start_session(state="MA")
        assert len(opening.cost_telemetry) == 1
        assert opening.cost_telemetry[0].stage == "script_writer"

        scripted_llm.push_interpreter(
            confidence=0.9,
            member_updates=[
                HouseholdMemberUpdate(
                    member_id="applicant",
                    age=32,
                    is_applicant=True,
                    citizenship=CitizenshipStatus.US_CITIZEN,
                )
            ],
        )
        scripted_llm.push_script_writer(question_text="What about cash benefits?")
        turn = orchestrator.handle_user_turn(
            session_id=session_id, user_text="32, citizen, single."
        )
        stages = [t.stage for t in turn.cost_telemetry]
        assert stages == ["interpreter", "script_writer"]
