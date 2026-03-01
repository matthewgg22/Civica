from __future__ import annotations

from .models import Ask, RepContext


def compose_call_scripts(
    rep: RepContext,
    ask: Ask,
    issue_title: str,
    issue_summary: str,
    selected_bill: str | None,
    user_location: str,
    reason_badges: list[str],
) -> tuple[str, str, list[str]]:
    """Build neutral, user-directed scripts with fixed length budgets.

    Rules:
    - Use only explicit ask selected by user.
    - Separate factual grounding from suggested wording.
    - Include fallback line asking member position.
    - Keep live script < 90 words and voicemail < 50 words.
    """

    ask_phrase = _ask_phrase(ask)
    bill_fragment = f" {selected_bill}" if selected_bill else ""
    factual_reason = reason_badges[0] if reason_badges else "Issue currently active in Congress"

    live = (
        f"Hello, my name is [Your Name], and I am a constituent in {user_location}. "
        f"I am calling about {issue_title}. "
        f"Please ask {rep.rep_name} to {ask_phrase}{bill_fragment}. "
        f"Fact: {factual_reason}. "
        "Could you share the member's current position on this issue? Thank you."
    )

    voicemail = (
        f"Constituent in {user_location} calling about {issue_title}. "
        f"Please ask {rep.rep_name} to {ask_phrase}{bill_fragment}. "
        "Please share the member's current position. Thank you."
    )

    points = [
        f"Explicit ask: {ask.value}{bill_fragment}",
        f"Factual context: {factual_reason}",
        "Request the office to confirm the member's current position",
    ]

    return _trim_words(live, 90), _trim_words(voicemail, 50), points


def _ask_phrase(ask: Ask) -> str:
    if ask is Ask.SUPPORT:
        return "support"
    if ask is Ask.OPPOSE:
        return "oppose"
    if ask is Ask.COSPONSOR:
        return "cosponsor"
    if ask is Ask.VOTE_YES:
        return "vote yes on"
    if ask is Ask.VOTE_NO:
        return "vote no on"
    if ask is Ask.SEEK_OVERSIGHT:
        return "seek oversight on"
    if ask is Ask.ASK_PUBLIC_STATEMENT:
        return "issue a public statement on"
    if ask is Ask.ASK_AMENDMENT:
        return "support an amendment on"
    return "take action on"


def _trim_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])
