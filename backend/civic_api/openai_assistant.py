from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest


@dataclass
class GeneratedDraft:
    issue_title: str
    issue_summary: str
    background: str
    live_script_template: str
    voicemail_script_template: str
    talking_points: list[str]


class OpenAICivicAssistant:
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
    ) -> GeneratedDraft | None:
        rep_list = ", ".join(rep_names[:3]) if rep_names else "the member"
        bill_ref = (optional_bill_ref or "").strip() or "this issue"

        system_prompt = (
            "You are a U.S. civic call assistant for constituents. "
            "Return strict JSON only, no markdown. "
            "Write plain-language content at about a 6th-8th grade reading level. "
            "Do not include hate, harassment, threats, criminal planning, or extremist advocacy. "
            "Keep scripts concise and phone-ready."
        )
        user_prompt = (
            "Generate a civic call draft from this user request.\n"
            f"Concern: {concern_text.strip()}\n"
            f"Explicit ask: {selected_ask}\n"
            f"User location label: {user_location or 'their area'}\n"
            f"Primary targets: {rep_list}\n"
            f"Bill reference: {bill_ref}\n\n"
            "Return JSON object with keys:\n"
            "- issue_title: short title (<= 9 words)\n"
            "- issue_summary: 2-4 neutral sentences on what the user is asking\n"
            "- background: 2-4 factual context sentences (no fake citations)\n"
            "- live_script_template: <= 110 words, include placeholders {OFFICE_TYPE}, {REP_NAME}, {ASK_ACTION}, {LOCATION}, {BILL_OR_ISSUE}\n"
            "- voicemail_script_template: <= 65 words, same placeholders\n"
            "- talking_points: array of 3-5 short bullets\n"
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

        response = self._post_json("/v1/chat/completions", payload)
        choices = response.get("choices") or []
        message = (choices[0] or {}).get("message") if choices else {}
        content = (message or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            return None

        parsed = self._parse_json(content)
        if not isinstance(parsed, dict):
            return None

        issue_title = self._clean_text(parsed.get("issue_title"), max_words=9)
        issue_summary = self._clean_text(parsed.get("issue_summary"), max_words=80)
        background = self._clean_text(parsed.get("background"), max_words=95)
        live_template = self._clean_text(parsed.get("live_script_template"), max_words=120)
        voicemail_template = self._clean_text(parsed.get("voicemail_script_template"), max_words=75)
        talking_points = self._clean_points(parsed.get("talking_points"))

        if not issue_title or not issue_summary or not live_template or not voicemail_template:
            return None

        return GeneratedDraft(
            issue_title=issue_title,
            issue_summary=issue_summary,
            background=background,
            live_script_template=live_template,
            voicemail_script_template=voicemail_template,
            talking_points=talking_points,
        )

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
