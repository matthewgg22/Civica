from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from .issue_catalog import baseline_issue_variants

logger = logging.getLogger(__name__)


@dataclass
class GeneratedDraft:
    issue_title: str
    issue_summary: str
    background: str
    live_script_template: str
    voicemail_script_template: str
    talking_points: list[str]


class OpenAICivicAssistant:
    REQUIRED_TEMPLATE_TOKENS = (
        "{OFFICE_TYPE}",
        "{REP_NAME}",
    )

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-5.4-nano",
        base_url: str = "https://api.openai.com",
        timeout_seconds: int = 30,
    ) -> None:
        self.api_key = api_key.strip()
        self.model = model.strip() or "gpt-5.4-mini"
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = max(5, timeout_seconds)

    @classmethod
    def from_env(cls) -> OpenAICivicAssistant | None:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return None
        model = os.getenv("VOTENOW_OPENAI_MODEL", "gpt-5.4-nano")
        return cls(api_key=api_key, model=model)

    def moderate_concern(self, concern_text: str) -> tuple[bool, str | None]:
        normalized = concern_text.lower()
        hard_block_patterns = (
            "pro hitler",
            "support hitler",
            "heil hitler",
            "praise hitler",
            "white power",
            "racial supremacy",
            "ethnic cleansing",
            "genocide now",
        )
        if any(pattern in normalized for pattern in hard_block_patterns):
            return True, "The request appears to promote hateful or violent extremism."

        try:
            payload = {
                "model": "omni-moderation-latest",
                "input": concern_text,
            }
            response = self._post_json("/v1/moderations", payload)
            results = response.get("results") or []
            first = results[0] if results else {}
            if bool(first.get("flagged")):
                categories = first.get("categories") or {}
                flagged = [name for name, value in categories.items() if bool(value)]
                if flagged:
                    return True, f"Safety system flagged categories: {', '.join(flagged)}."
                return True, "Safety system flagged this request as disallowed."
        except Exception:
            # Fail open on moderation transport errors so civic access is not blocked by network issues.
            return False, None

        return False, None

    def generate_draft(
        self,
        concern_text: str,
        selected_ask: str,
        rep_names: list[str],
        optional_bill_ref: str | None,
        user_location: str,
        broad_issue_mode: bool = False,
        canonical_issue_id: str | None = None,
    ) -> GeneratedDraft | None:
        rep_list = ", ".join(rep_names[:3]) if rep_names else "the member"
        bill_ref = (optional_bill_ref or "").strip() or "this issue"
        style_examples = self._fallback_template_examples_block(max_examples=3)
        strict_script_instruction = (
            "Draft caller-ready scripts for a congressional office.\n\n"
            "Guidance:\n"
            "- Keep the wording natural when spoken aloud\n"
            "- Assume the user input may be short and simple (for example: 'gun control' or 'medicaid')\n"
            "- Include: a clear ask, one concrete policy action, and one concrete impact or fact when available\n"
            "- Keep live script roughly 80-140 words and voicemail roughly 40-80 words\n"
            "- Avoid robotic filler (for example: 'this helps people', 'this is important')\n"
            "- Never use 'my area' or 'our area'\n"
            "- Do not require bill numbers from the user\n"
            "- If no specific bill is confirmed, use a plausible congressional action tied to the issue\n"
            "- Do not output labels or meta commentary"
        )
        broad_issue_script_instruction = (
            "Draft scripts for a broad civic advocacy request to Congress.\n\n"
            "Guidance:\n"
            "- Use natural spoken English that sounds like a real constituent call\n"
            "- Treat short user input as valid and infer a practical, realistic congressional ask\n"
            "- For live scripts, target 80-140 words; for voicemail, 40-80 words\n"
            "- Include: constituent identity, direct ask, one concrete policy action, and one real-world impact when available\n"
            "- If ZIP or city is available, include it naturally\n"
            "- Avoid awkward repetition of the issue phrase\n"
            "- Avoid robotic filler and meta language\n"
            "- Do not output labels or explanations"
        )

        system_prompt = (
            "You are a U.S. civic call assistant for constituents. "
            "Return strict JSON only, no markdown. "
            "Write plain-language content at about a 6th-8th grade reading level. "
            "Do not include hate, harassment, threats, criminal planning, or extremist advocacy. "
            "Keep scripts concise and phone-ready. "
            "Use clear, natural spoken language, not robotic phrasing."
        )
        user_prompt = (
            "Generate a civic call draft from this user request.\n"
            f"Concern: {concern_text.strip()}\n"
            f"Explicit ask: {selected_ask}\n"
            f"User location label: {user_location.strip() if user_location else 'not provided'}\n"
            f"Primary targets: {rep_list}\n"
            f"Bill reference: {bill_ref}\n\n"
            "For script generation behavior, follow this exactly:\n"
            f"{broad_issue_script_instruction if broad_issue_mode else strict_script_instruction}\n\n"
            f"{style_examples}\n\n"
            "Return JSON object with keys:\n"
            "- issue_title: short title (<= 9 words)\n"
            "- issue_summary: 2-4 plain sentences on what the user is asking\n"
            "- background: 2-4 factual context sentences; if uncertain, say details are still developing\n"
            "- live_script_template: include placeholders {OFFICE_TYPE}, {REP_NAME}, {ASK_ACTION}, {LOCATION}, {BILL_OR_ISSUE}\n"
            "- voicemail_script_template: include same placeholders\n"
            "- talking_points: array of exactly 4 short bullets\n"
            "Do not use placeholders outside the exact tokens above."
        )

        payload = {
            "model": self.model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        logger.info("=== OPENAI SCRIPT CALL START ===")
        logger.info(
            "=== OPENAI SCRIPT CALL CONTEXT === %s",
            {
                "model": self.model,
                "generation_mode": "llm_full",
                "is_template_rewrite": False,
                "canonical_issue_id": canonical_issue_id,
                "selected_ask": selected_ask,
                "raw_user_input": self._preview_text(concern_text, max_chars=220),
                "context_preview": {
                    "rep_names": rep_names[:3],
                    "bill_ref": self._preview_text(bill_ref, max_chars=120),
                    "user_location": self._preview_text(user_location, max_chars=80),
                },
                "prompt_preview": {
                    "system": self._preview_text(system_prompt, max_chars=220),
                    "user": self._preview_text(user_prompt, max_chars=380),
                },
            },
        )
        logger.info("=== OPENAI SCRIPT CALL END ===")

        response = self._post_json("/v1/chat/completions", payload)
        choices = response.get("choices") or []
        logger.info("=== OPENAI SCRIPT RESPONSE START ===")
        logger.info(
            "=== OPENAI SCRIPT RESPONSE SUMMARY === %s",
            {
                "response_id": response.get("id"),
                "response_model": response.get("model"),
                "choices_count": len(choices),
                "has_usage": isinstance(response.get("usage"), dict),
            },
        )
        logger.info("=== OPENAI SCRIPT RESPONSE END ===")

        choices = response.get("choices") or []
        message = (choices[0] or {}).get("message") if choices else {}
        content = (message or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            logger.info("=== OPENAI SCRIPT PARSE RESULT === %s", {"parsed": False, "reason": "empty_or_missing_message_content"})
            return None

        parsed = self._parse_json(content)
        if not isinstance(parsed, dict):
            logger.info("=== OPENAI SCRIPT PARSE RESULT === %s", {"parsed": False, "reason": "content_not_valid_json_object"})
            return None

        issue_title = self._clean_text(parsed.get("issue_title"), max_words=9)
        issue_summary = self._clean_text(parsed.get("issue_summary"), max_words=80)
        background = self._clean_text(parsed.get("background"), max_words=95)
        live_template = self._clean_text(parsed.get("live_script_template"), max_words=120)
        voicemail_template = self._clean_text(parsed.get("voicemail_script_template"), max_words=75)
        talking_points = self._clean_points(parsed.get("talking_points"))

        logger.info(
            "=== OPENAI SCRIPT PARSE RESULT === %s",
            {
                "parsed": True,
                "keys": sorted(parsed.keys()),
                "issue_title_words": len(issue_title.split()) if issue_title else 0,
                "live_template_words": len(live_template.split()) if live_template else 0,
                "voicemail_template_words": len(voicemail_template.split()) if voicemail_template else 0,
                "talking_points_count": len(talking_points),
            },
        )

        if not issue_title or not issue_summary or not live_template or not voicemail_template:
            logger.info("=== OPENAI SCRIPT PARSE RESULT === %s", {"parsed": False, "reason": "required_fields_empty_after_cleaning"})
            return None
        if not self._is_usable_template(live_template, min_words=35):
            logger.info("=== OPENAI SCRIPT PARSE RESULT === %s", {"parsed": False, "reason": "live_template_failed_usability_gate"})
            return None
        if not self._is_usable_template(voicemail_template, min_words=18):
            logger.info("=== OPENAI SCRIPT PARSE RESULT === %s", {"parsed": False, "reason": "voicemail_template_failed_usability_gate"})
            return None

        return GeneratedDraft(
            issue_title=issue_title,
            issue_summary=issue_summary,
            background=background,
            live_script_template=live_template,
            voicemail_script_template=voicemail_template,
            talking_points=talking_points,
        )

    def _preview_text(self, value: str | None, max_chars: int = 240) -> str:
        text = (value or "").strip()
        if not text:
            return ""
        compact = " ".join(text.split())
        if len(compact) <= max_chars:
            return compact
        return compact[: max_chars - 3] + "..."

    def _fallback_template_examples_block(self, max_examples: int = 3) -> str:
        try:
            variants = baseline_issue_variants()
        except Exception:
            return "Fallback bill template examples: unavailable."

        lines: list[str] = [
            "Fallback bill template examples (style references only; do not copy facts blindly):"
        ]
        for variant in variants[: max(1, max_examples)]:
            snippet = self._preview_text(" ".join(variant.live_script.split()), max_chars=260)
            lines.append(f"- {variant.title}: {snippet}")
        return "\n".join(lines)

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url=f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except urlerror.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ValueError(f"OpenAI HTTP {exc.code}: {detail}") from exc
        except Exception as exc:
            raise ValueError(f"OpenAI request failed: {exc}") from exc

        decoded = self._parse_json(raw)
        if not isinstance(decoded, dict):
            raise ValueError("OpenAI response was not a JSON object.")
        return decoded

    def _parse_json(self, raw: str) -> Any:
        text = raw.strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                snippet = text[start : end + 1]
                try:
                    return json.loads(snippet)
                except json.JSONDecodeError:
                    return None
            return None

    def _clean_text(self, value: Any, max_words: int) -> str:
        if not isinstance(value, str):
            return ""
        cleaned = " ".join(value.replace("\n", " ").split()).strip()
        if not cleaned:
            return ""
        words = cleaned.split()
        if len(words) > max_words:
            cleaned = " ".join(words[:max_words])
        return cleaned

    def _clean_points(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        points: list[str] = []
        for item in value:
            if not isinstance(item, str):
                continue
            cleaned = self._clean_text(item, max_words=16)
            if cleaned:
                points.append(cleaned)
        deduped: list[str] = []
        seen = set()
        for point in points:
            key = point.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(point)
        return deduped[:5]

    def _is_usable_template(self, text: str, min_words: int) -> bool:
        words = text.split()
        if len(words) < min_words:
            return False

        lowered = text.lower()
        low_quality_patterns = (
            "i hope this message finds you well",
            "dear sir or madam",
            "to whom it may concern",
            "current status:",
            "latest item:",
            "policy focus:",
            "additional context:",
            "office tie-in:",
        )
        if any(pattern in lowered for pattern in low_quality_patterns):
            return False

        for token in self.REQUIRED_TEMPLATE_TOKENS:
            if token not in text:
                return False
        return True
