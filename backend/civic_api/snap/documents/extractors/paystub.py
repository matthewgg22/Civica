"""Paystub extractor — vision LLM returns a structured Paystub.

Run after the classifier confirms the image is paystub-shaped. The
output goes to the validator next; only after the validator's
invariants pass (or fail with non-blocker warnings) does the user see
the confirmation UI.

Why we extract verbatim deduction labels alongside categorized ones:
state SNAP application forms sometimes require employer-printed
terminology (DTA Connect's data-entry screens cross-reference these),
and the audit trail wants the original strings.
"""
from __future__ import annotations

from .._vision import build_vision_message
from ...llm.client import LLMCallTelemetry, LLMClient
from ..schemas import Paystub

DEFAULT_PAYSTUB_MODEL = "claude-sonnet-4-6"


PAYSTUB_EXTRACTOR_PROMPT = """Task: Extract the structured paystub fields from the image.

Return a Paystub object exactly matching the schema. Hard constraints:

1. Currency values are Decimal-compatible numbers without a leading '$' or comma.
2. Dates are ISO YYYY-MM-DD. If the paystub shows MM/DD/YYYY, convert it.
3. employer_name is the legal/dba name as printed. Strip trailing addresses.
4. pay_period_start and pay_period_end are the start and end dates of the pay period this paystub covers (NOT the pay date, which is when wages were issued).
5. gross_pay_period and net_pay_period are this paystub's earnings, NOT year-to-date.
6. For each itemized deduction:
   - category: map the printed label to a canonical PaystubDeductionCategory enum value.
     Common mappings: 'FED', 'FIT', 'FED INC TAX', 'Federal Tax' -> federal_income_tax;
     'FICA', 'FICA-OASDI', 'OASDI', 'Soc Sec', 'SS' -> social_security;
     'MEDI', 'Medicare', 'FICA-MED' -> medicare;
     'STATE', 'SIT', 'MA Tax' -> state_income_tax;
     'HEALTH', 'MEDICAL', 'Med Plan' -> health_insurance;
     '401K', '401(k) DEFER' -> retirement_401k;
     anything that does not map cleanly -> other.
   - label_as_printed: verbatim label text from the paystub (max 64 chars).
   - amount: the dollar amount, no sign.
7. is_salaried: true ONLY if the paystub explicitly indicates salaried compensation (e.g. 'Salary' line item without an hours column). When in doubt, leave hours_worked_in_period and hourly_rate populated and is_salaried=false.
8. If hours and rate are not visible, leave both as null. Do not infer them from gross / typical wages.
9. gross_pay_ytd and net_pay_ytd: populate ONLY if explicitly shown as year-to-date totals on this paystub.
10. pay_frequency_label_as_printed: copy the verbatim text if shown ('BI-WEEKLY', 'Weekly', 'Semi-Monthly'). Leave null if not displayed; the rules engine layer will infer from period dates.
11. Never fabricate a value. If a required field is unreadable, return a low extraction_confidence in the wrapper above this output rather than guessing.
12. The image may be skewed, partially obscured by glare, or low-resolution. Extract what you can read and rely on the validator to flag inconsistencies."""


def run_paystub_extractor(
    *,
    client: LLMClient,
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    language: str = "en",
    model: str = DEFAULT_PAYSTUB_MODEL,
) -> tuple[Paystub, LLMCallTelemetry]:
    messages = build_vision_message(
        image_bytes=image_bytes,
        media_type=media_type,
        instruction="Extract paystub fields per the schema.",
    )
    return client.call_with_schema(
        model=model,
        schema=Paystub,
        system=PAYSTUB_EXTRACTOR_PROMPT,
        messages=messages,
        language=language,
        max_tokens=1024,
    )
