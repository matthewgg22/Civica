"""Top-level PDF generation entry point.

Routes between the always-available summary PDF and the optional
template-filled MA DTA SNAP-1 path. Audit-logs every generation.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from ..audit.logger import AuditAction, AuditLogger
from ..documents.schemas import Paystub
from ..pipeline.schemas import PartialHousehold
from ..rules.interfaces import EligibilityResult
from .data_assembly import ApplicationPacket, assemble_application_packet
from .summary_pdf import render_summary_pdf
from .template_filler import (
    TemplateConfigurationError,
    fill_ma_dta_template,
    is_template_configured,
)

logger = logging.getLogger(__name__)


@dataclass
class GeneratedApplicationPDF:
    pdf_bytes: bytes
    rendering_path: str            # 'summary' or 'ma_dta_template'
    populated_field_paths: list[str]
    packet: ApplicationPacket


def generate_application_pdf(
    *,
    session_id: str,
    state: str,
    language: str,
    partial_household: PartialHousehold,
    eligibility: EligibilityResult | None,
    confirmed_paystubs: Optional[list[Paystub]] = None,
    audit_logger: AuditLogger | None = None,
    audit_actor_kind: str = "anonymous_session",
    audit_actor_id: str | None = None,
    audit_request_id: str | None = None,
    prefer_template: bool = True,
) -> GeneratedApplicationPDF:
    """Generate the application PDF for a session.

    `prefer_template`:
      - True (default): use the MA DTA SNAP-1 fillable template if it's
        configured at deployment, falling back to the summary PDF
        otherwise.
      - False: always render the summary PDF. Useful for endpoints
        that explicitly want the screening-summary artifact.
    """
    packet = assemble_application_packet(
        session_id=session_id,
        state=state,
        language=language,
        partial=partial_household,
        eligibility=eligibility,
        confirmed_paystubs=confirmed_paystubs,
    )

    rendering_path = "summary"
    pdf_bytes: bytes
    if prefer_template and is_template_configured():
        try:
            pdf_bytes = fill_ma_dta_template(packet)
            rendering_path = "ma_dta_template"
        except TemplateConfigurationError as exc:
            logger.warning(
                "MA DTA template fill failed (%s); falling back to summary PDF.", exc
            )
            pdf_bytes = render_summary_pdf(packet)
    else:
        pdf_bytes = render_summary_pdf(packet)

    if audit_logger is not None:
        audit_logger.log(
            session_id=session_id,
            action=AuditAction.PDF_GENERATED,
            actor_kind=audit_actor_kind,
            actor_id=audit_actor_id,
            reason=f"rendering_path={rendering_path} populated_count={len(packet.populated_field_paths)}",
            request_id=audit_request_id,
            column_or_resource=f"application_pdf/{rendering_path}",
        )

    return GeneratedApplicationPDF(
        pdf_bytes=pdf_bytes,
        rendering_path=rendering_path,
        populated_field_paths=list(packet.populated_field_paths),
        packet=packet,
    )
