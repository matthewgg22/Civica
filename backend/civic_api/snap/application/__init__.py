"""Application packet generation.

Two output paths:
  1. Summary PDF (always available): ReportLab-rendered, self-contained
     printable summary of every fact the conversation pipeline collected
     plus the rules-engine determination. Users carry this into DTA
     Connect (or hand to a benefits navigator) while completing the
     state-side intake.
  2. Form-fill (when MA DTA SNAP-1 fillable PDF is configured):
     pdfrw-based field population of the official form. Activated by
     setting `SNAP_MA_DTA_TEMPLATE_PATH` in the environment.

Why two paths: the official MA DTA SNAP-1 PDF lives on the state's
website with its own licensing. Civica deployments must download it
themselves and place it at the configured path; we don't bundle it.
The summary path always works regardless.

Audit boundary: every PDF generation produces an audit log row. The
PDF body never appears in logs; the audit row records who generated
what session's packet, when, and which fields were populated.
"""

from .data_assembly import ApplicationPacket, assemble_application_packet
from .pdf import GeneratedApplicationPDF, generate_application_pdf

__all__ = [
    "ApplicationPacket",
    "assemble_application_packet",
    "GeneratedApplicationPDF",
    "generate_application_pdf",
]
