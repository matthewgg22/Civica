from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.civic_api.models import (
    CallCompletionRequest,
    CallEvent,
    CallLaunchRequest,
    LeaderboardPeriodType,
    VerificationMethod,
)
from backend.civic_api.repository import InMemoryCivicRepository
from backend.civic_api.service import CivicService, _tier_for_score


NOW = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)


def _event(
    *,
    user_id: str,
    office_id: str,
    issue_id: str | None,
    days_ago: int,
    eligible: bool = True,
    reason: str | None = None,
    launch_id: str = "launch-1",
    event_id: str = "event-1",
) -> CallEvent:
    return CallEvent(
        id=event_id,
        user_id=user_id,
        office_id=office_id,
        issue_id=issue_id,
        launch_event_id=launch_id,
        completed_confirmed_at=NOW - timedelta(days=days_ago),
        verification_method=VerificationMethod.APP_INITIATED_SELF_CONFIRMED,
        scoring_eligible_boolean=eligible,
        scoring_ineligibility_reason=reason,
    )


def test_tier_assignment_boundaries() -> None:
    assert _tier_for_score(0) == "Not Active Yet"
    assert _tier_for_score(29) == "Not Active Yet"
    assert _tier_for_score(30) == "Crossed Baseline"
    assert _tier_for_score(49) == "Crossed Baseline"
    assert _tier_for_score(50) == "Active Advocate"
    assert _tier_for_score(69) == "Active Advocate"
    assert _tier_for_score(70) == "Consistent Caller"
    assert _tier_for_score(84) == "Consistent Caller"
    assert _tier_for_score(85) == "Civic Catalyst"
    assert _tier_for_score(100) == "Civic Catalyst"


def test_call_score_formula_components_reach_expected_max() -> None:
    service = CivicService(repository=InMemoryCivicRepository())
    calls = [
        _event(user_id="u1", office_id="o1", issue_id="i1", days_ago=1, event_id="e1"),
        _event(user_id="u1", office_id="o2", issue_id="i2", days_ago=8, event_id="e2"),
        _event(user_id="u1", office_id="o3", issue_id="i3", days_ago=15, event_id="e3"),
        _event(user_id="u1", office_id="o4", issue_id="i4", days_ago=21, event_id="e4"),
    ]

    snapshot = service._build_call_score_snapshot(user_id="u1", now=NOW, eligible_calls=calls)

    assert snapshot.activation_points == 30
    assert snapshot.recency_points == 10
    assert snapshot.consistency_points == 25
    assert snapshot.breadth_points == 20
    assert snapshot.momentum_points == 15
    assert snapshot.call_score == 100
    assert snapshot.tier_name == "Civic Catalyst"


def test_trailing_window_boundaries_are_inclusive_on_cutoffs() -> None:
    service = CivicService(repository=InMemoryCivicRepository())
    calls = [
        _event(user_id="u2", office_id="o1", issue_id="i1", days_ago=0, event_id="e10"),
        _event(user_id="u2", office_id="o2", issue_id="i2", days_ago=30, event_id="e11"),
        _event(user_id="u2", office_id="o3", issue_id="i3", days_ago=90, event_id="e12"),
        _event(user_id="u2", office_id="o4", issue_id="i4", days_ago=56, event_id="e13"),
    ]

    snapshot = service._build_call_score_snapshot(user_id="u2", now=NOW, eligible_calls=calls)

    assert snapshot.consistency_points >= 12  # includes day 30
    assert snapshot.breadth_points >= 15      # includes day 90
    assert snapshot.momentum_points >= 10     # includes week 8 cutoff


def test_duplicate_suppression_with_issue_id() -> None:
    repo = InMemoryCivicRepository()
    service = CivicService(repository=repo)

    launch_1 = service.log_call_launch(
        CallLaunchRequest(
            user_id="dup-user",
            office_id="office-1",
            issue_id="issue-1",
            source_screen="issue_call_center",
            session_id="session-1",
        )
    )
    confirm_1 = service.confirm_call_completion(
        CallCompletionRequest(
            user_id="dup-user",
            launch_event_id=launch_1["launch_event_id"],
            completed=True,
        )
    )
    assert confirm_1.scoring_eligible_boolean is True

    launch_2 = service.log_call_launch(
        CallLaunchRequest(
            user_id="dup-user",
            office_id="office-1",
            issue_id="issue-1",
            source_screen="issue_call_center",
            session_id="session-2",
        )
    )
    confirm_2 = service.confirm_call_completion(
        CallCompletionRequest(
            user_id="dup-user",
            launch_event_id=launch_2["launch_event_id"],
            completed=True,
        )
    )

    assert confirm_2.scoring_eligible_boolean is False
    assert "past 7 days" in (confirm_2.scoring_ineligibility_reason or "")

    eligible_calls = repo.list_call_events("dup-user", eligible_only=True)
    assert len(eligible_calls) == 1


def test_duplicate_suppression_without_issue_id_dedupes_by_office_only() -> None:
    repo = InMemoryCivicRepository()
    service = CivicService(repository=repo)

    first = service.log_call_launch(
        CallLaunchRequest(
            user_id="dup-user-2",
            office_id="office-2",
            issue_id="issue-a",
            source_screen="issue_call_center",
            session_id="s1",
        )
    )
    first_confirm = service.confirm_call_completion(
        CallCompletionRequest(user_id="dup-user-2", launch_event_id=first["launch_event_id"], completed=True)
    )
    assert first_confirm.scoring_eligible_boolean is True

    second = service.log_call_launch(
        CallLaunchRequest(
            user_id="dup-user-2",
            office_id="office-2",
            issue_id=None,
            source_screen="issue_call_center",
            session_id="s2",
        )
    )
    second_confirm = service.confirm_call_completion(
        CallCompletionRequest(user_id="dup-user-2", launch_event_id=second["launch_event_id"], completed=True)
    )

    assert second_confirm.scoring_eligible_boolean is False
    assert "office" in (second_confirm.scoring_ineligibility_reason or "").lower()


def test_recompute_after_call_completion_crosses_baseline() -> None:
    repo = InMemoryCivicRepository()
    service = CivicService(repository=repo)

    launch = service.log_call_launch(
        CallLaunchRequest(
            user_id="score-user",
            office_id="office-3",
            issue_id="issue-score",
            source_screen="issue_call_center",
            session_id="score-1",
        )
    )
    confirmation = service.confirm_call_completion(
        CallCompletionRequest(
            user_id="score-user",
            launch_event_id=launch["launch_event_id"],
            completed=True,
        )
    )

    assert confirmation.call_logged is True
    assert confirmation.scoring_eligible_boolean is True
    assert confirmation.call_score_snapshot is not None
    assert confirmation.call_score_snapshot.call_score >= 30
    assert confirmation.baseline_crossed is True


def test_leaderboard_rollups_use_eligible_verified_calls() -> None:
    repo = InMemoryCivicRepository()
    service = CivicService(repository=repo)

    repo.insert_call_event(_event(user_id="uA", office_id="o1", issue_id="i1", days_ago=0, event_id="ua1"))
    repo.insert_call_event(_event(user_id="uA", office_id="o2", issue_id="i2", days_ago=0, event_id="ua2"))
    repo.insert_call_event(_event(user_id="uB", office_id="o3", issue_id="i3", days_ago=0, event_id="ub1"))
    repo.insert_call_event(_event(user_id="uB", office_id="o3", issue_id="i4", days_ago=0, event_id="ub2", eligible=False, reason="duplicate"))

    service.recompute_call_score("uA")
    service.recompute_call_score("uB")

    sample_time = repo.list_call_events("uA", eligible_only=True)[0].completed_confirmed_at.astimezone(timezone.utc)
    period_start = datetime(sample_time.year, sample_time.month, sample_time.day, tzinfo=timezone.utc)
    board = service.get_leaderboard(period_type=LeaderboardPeriodType.DAILY, period_start=period_start, limit=10)

    assert len(board.entries) >= 2
    first = board.entries[0]
    second = board.entries[1]
    assert first.user_alias.startswith("voter-")
    assert first.user_alias != "uA"
    assert first.eligible_verified_call_count == 2
    assert second.user_alias.startswith("voter-")
    assert second.user_alias != "uB"
    assert second.eligible_verified_call_count == 1

    me = service.get_user_leaderboard_summary(
        user_id="uA",
        period_type=LeaderboardPeriodType.DAILY,
        period_start=period_start,
    )
    assert me.rank == 1
    assert me.eligible_verified_call_count == 2
