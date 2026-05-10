"""Pure-Python validator for extracted paystubs.

Why pure Python: the validator is the deterministic backstop against
LLM extraction errors. It must produce the same output every time for
the same input — no model variance — and be testable without any
network round-trip.

Validation policy:
  - Tolerances are intentionally loose. Real paystubs round at multiple
    points (per-period rounding, YTD reconciliation), so exact equality
    is the wrong test. We aim to catch off-by-orders-of-magnitude and
    swapped-numbers errors, not pennies.
  - Most checks emit `warning` flags, not blockers. The user sees them
    inline in the confirmation UI; they can correct the affected field
    before pressing Confirm.
  - A single category of `blocker` flag stops ingestion: when the
    extracted dollar amounts can't be reconciled at all (e.g. net pay
    larger than gross). The user is shown an explicit retry prompt.

When this validator's invariants change, prior extractions stay valid
because validator output is captured into snap_documents.validator_errors
at write time, not re-derived on every read.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from .schemas import Paystub, ValidationFlag

# Tolerances chosen empirically from a sample of real paystubs across
# ADP, Gusto, Paychex, Workday, and Square Payroll formats. Tighten as
# the eval set grows.
_DOLLAR_TOLERANCE = Decimal("2.00")           # ±$2 — survives sub-cent rounding
_HOURS_RATE_TOLERANCE = Decimal("5.00")       # ±$5 — handles tip/bonus add-ons
_YTD_TOLERANCE = Decimal("0.50")              # YTD should add precisely

# Most employers issue paychecks within ~7 days after the period closes;
# a paycheck dated more than 14 days before the period end is suspicious.
_MAX_PAY_DATE_LAG_DAYS = timedelta(days=14)


def validate_paystub(
    paystub: Paystub,
    *,
    prior_paystubs: list[Paystub] | None = None,
) -> list[ValidationFlag]:
    """Apply paystub invariants. Returns a list of flags (possibly empty).

    `prior_paystubs` is the user's earlier confirmed paystubs from the
    same employer, used to detect duplicate uploads (same period dates)
    and YTD regressions across uploads.
    """
    flags: list[ValidationFlag] = []
    flags.extend(_check_period_dates(paystub))
    flags.extend(_check_net_versus_gross(paystub))
    flags.extend(_check_gross_minus_deductions_equals_net(paystub))
    flags.extend(_check_hours_times_rate(paystub))
    flags.extend(_check_ytd_relationships(paystub))
    if prior_paystubs:
        flags.extend(_check_against_priors(paystub, prior_paystubs))
    return flags


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------


def _check_period_dates(p: Paystub) -> list[ValidationFlag]:
    if p.pay_period_end < p.pay_period_start:
        return [
            ValidationFlag(
                code="period_end_before_start",
                message_en="The pay period's end date is before its start date.",
                message_es="La fecha final del período de pago es anterior a la fecha de inicio.",
                severity="blocker",
            )
        ]
    span_days = (p.pay_period_end - p.pay_period_start).days
    if span_days > 35:
        return [
            ValidationFlag(
                code="period_span_too_long",
                message_en=f"This pay period spans {span_days} days, which is unusually long.",
                message_es=f"Este período de pago abarca {span_days} días, lo cual es inusualmente largo.",
                severity="warning",
            )
        ]
    if p.pay_date is not None and p.pay_date < p.pay_period_end - _MAX_PAY_DATE_LAG_DAYS:
        return [
            ValidationFlag(
                code="pay_date_before_period_end",
                message_en="The pay date is earlier than the end of the pay period.",
                message_es="La fecha de pago es anterior al final del período de pago.",
                severity="warning",
            )
        ]
    return []


def _check_net_versus_gross(p: Paystub) -> list[ValidationFlag]:
    if p.net_pay_period > p.gross_pay_period + _DOLLAR_TOLERANCE:
        return [
            ValidationFlag(
                code="net_exceeds_gross",
                message_en=(
                    f"Net pay (${p.net_pay_period}) is larger than gross pay "
                    f"(${p.gross_pay_period}). Please double-check both fields."
                ),
                message_es=(
                    f"El pago neto (${p.net_pay_period}) es mayor que el pago bruto "
                    f"(${p.gross_pay_period}). Por favor verifique ambos campos."
                ),
                severity="blocker",
            )
        ]
    return []


def _check_gross_minus_deductions_equals_net(p: Paystub) -> list[ValidationFlag]:
    if not p.deductions:
        # Missing deductions on a non-trivial gross is suspicious but
        # not impossible (some 1099 stubs show no withholding). Flag for
        # review rather than blocking.
        if p.gross_pay_period - p.net_pay_period > _DOLLAR_TOLERANCE:
            return [
                ValidationFlag(
                    code="no_deductions_but_net_lower_than_gross",
                    message_en="No itemized deductions were extracted, but net pay is less than gross. Some withholdings may have been missed.",
                    message_es="No se extrajeron deducciones detalladas, pero el pago neto es menor que el bruto. Algunas retenciones podrían haberse pasado por alto.",
                    severity="warning",
                )
            ]
        return []

    expected_net = p.gross_pay_period - p.total_deductions
    diff = abs(expected_net - p.net_pay_period)
    if diff > _DOLLAR_TOLERANCE:
        return [
            ValidationFlag(
                code="gross_minus_deductions_does_not_match_net",
                message_en=(
                    f"Gross (${p.gross_pay_period}) minus the sum of deductions "
                    f"(${p.total_deductions}) is ${expected_net}, which doesn't "
                    f"match the printed net (${p.net_pay_period}). Off by ${diff}."
                ),
                message_es=(
                    f"El bruto (${p.gross_pay_period}) menos la suma de deducciones "
                    f"(${p.total_deductions}) es ${expected_net}, que no coincide con "
                    f"el neto impreso (${p.net_pay_period}). Diferencia de ${diff}."
                ),
                severity="warning",
            )
        ]
    return []


def _check_hours_times_rate(p: Paystub) -> list[ValidationFlag]:
    if p.is_salaried:
        return []
    if p.hours_worked_in_period is None or p.hourly_rate is None:
        return []
    expected_gross = p.hours_worked_in_period * p.hourly_rate
    diff = abs(expected_gross - p.gross_pay_period)
    if diff > _HOURS_RATE_TOLERANCE:
        return [
            ValidationFlag(
                code="hours_times_rate_mismatch",
                message_en=(
                    f"{p.hours_worked_in_period} hours × ${p.hourly_rate}/hour = "
                    f"${expected_gross}, but the printed gross is ${p.gross_pay_period}."
                ),
                message_es=(
                    f"{p.hours_worked_in_period} horas × ${p.hourly_rate}/hora = "
                    f"${expected_gross}, pero el bruto impreso es ${p.gross_pay_period}."
                ),
                severity="warning",
            )
        ]
    return []


def _check_ytd_relationships(p: Paystub) -> list[ValidationFlag]:
    flags: list[ValidationFlag] = []
    if p.gross_pay_ytd is not None and p.gross_pay_ytd < p.gross_pay_period - _YTD_TOLERANCE:
        flags.append(
            ValidationFlag(
                code="gross_ytd_less_than_period",
                message_en=(
                    f"Gross year-to-date (${p.gross_pay_ytd}) is less than this "
                    f"period's gross (${p.gross_pay_period}). YTD should always "
                    f"include this period."
                ),
                message_es=(
                    f"El bruto del año hasta la fecha (${p.gross_pay_ytd}) es menor "
                    f"que el bruto de este período (${p.gross_pay_period}). El YTD "
                    f"siempre debe incluir este período."
                ),
                severity="warning",
            )
        )
    if p.net_pay_ytd is not None and p.net_pay_ytd < p.net_pay_period - _YTD_TOLERANCE:
        flags.append(
            ValidationFlag(
                code="net_ytd_less_than_period",
                message_en="Net year-to-date is less than this period's net pay.",
                message_es="El neto del año hasta la fecha es menor que el neto de este período.",
                severity="warning",
            )
        )
    if (
        p.gross_pay_ytd is not None
        and p.net_pay_ytd is not None
        and p.net_pay_ytd > p.gross_pay_ytd + _YTD_TOLERANCE
    ):
        flags.append(
            ValidationFlag(
                code="net_ytd_exceeds_gross_ytd",
                message_en="Net YTD is larger than gross YTD; one of the two fields may be misread.",
                message_es="El neto YTD es mayor que el bruto YTD; uno de los dos campos puede estar mal leído.",
                severity="blocker",
            )
        )
    return flags


def _check_against_priors(
    current: Paystub, priors: list[Paystub]
) -> list[ValidationFlag]:
    flags: list[ValidationFlag] = []

    # Duplicate detection: same employer, same period_start AND period_end.
    duplicates = [
        p
        for p in priors
        if p.employer_name.strip().lower() == current.employer_name.strip().lower()
        and p.pay_period_start == current.pay_period_start
        and p.pay_period_end == current.pay_period_end
    ]
    if duplicates:
        flags.append(
            ValidationFlag(
                code="duplicate_pay_period",
                message_en=(
                    "This paystub appears to cover the same pay period as one "
                    "you already uploaded. Make sure you're sending distinct periods."
                ),
                message_es=(
                    "Este recibo parece cubrir el mismo período de pago que uno "
                    "que ya subiste. Asegúrate de enviar períodos distintos."
                ),
                severity="warning",
            )
        )

    # YTD regression across uploads from the same employer (chronologically).
    same_employer = [
        p
        for p in priors
        if p.employer_name.strip().lower() == current.employer_name.strip().lower()
        and p.pay_period_end < current.pay_period_end
        and p.gross_pay_ytd is not None
    ]
    if same_employer and current.gross_pay_ytd is not None:
        latest_prior = max(same_employer, key=lambda p: p.pay_period_end)
        if (
            latest_prior.gross_pay_ytd is not None
            and current.gross_pay_ytd < latest_prior.gross_pay_ytd - _YTD_TOLERANCE
        ):
            flags.append(
                ValidationFlag(
                    code="ytd_regressed_versus_prior",
                    message_en=(
                        f"This paystub's gross YTD (${current.gross_pay_ytd}) is lower "
                        f"than a prior paystub's (${latest_prior.gross_pay_ytd}) from "
                        f"earlier in the year. One of the values may be misread."
                    ),
                    message_es=(
                        f"El bruto YTD de este recibo (${current.gross_pay_ytd}) es "
                        f"menor que el de un recibo anterior (${latest_prior.gross_pay_ytd}). "
                        f"Uno de los valores puede estar mal leído."
                    ),
                    severity="warning",
                )
            )
    return flags


# ---------------------------------------------------------------------------
# Helpers exposed for tests
# ---------------------------------------------------------------------------


def has_blocker(flags: list[ValidationFlag]) -> bool:
    return any(f.severity == "blocker" for f in flags)


def overall_extraction_confidence(
    classification_confidence: float, flags: list[ValidationFlag]
) -> float:
    """Combine the classifier's confidence with the validator outcome
    into a single number iOS surfaces to the user."""
    if has_blocker(flags):
        return 0.0
    warning_count = sum(1 for f in flags if f.severity == "warning")
    penalty = min(0.30, 0.10 * warning_count)
    return max(0.0, min(1.0, classification_confidence - penalty))
