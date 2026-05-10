"""ReportLab-based "application summary" PDF.

Used when no MA DTA SNAP-1 fillable template is configured (the default
deployment), and as the always-available companion artifact when one
is. Single-column layout, accessible defaults (high contrast, generous
spacing), no embedded fonts beyond ReportLab's built-in ones.

Important: this PDF is NOT the official state application. The cover
explicitly says so. Users carry it into DTA Connect; it does not
replace the state-side intake.
"""
from __future__ import annotations

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .data_assembly import ApplicationPacket


_PAGE_MARGIN = 0.6 * inch


def render_summary_pdf(packet: ApplicationPacket) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        leftMargin=_PAGE_MARGIN,
        rightMargin=_PAGE_MARGIN,
        topMargin=_PAGE_MARGIN,
        bottomMargin=_PAGE_MARGIN,
        title=f"Civica SNAP Application Summary — {packet.session_id[:8]}",
    )
    styles = _styles()
    story: list = []

    story.extend(_cover(packet, styles))
    story.append(Spacer(1, 0.20 * inch))
    story.extend(_eligibility_block(packet, styles))
    story.append(Spacer(1, 0.20 * inch))
    story.extend(_household_block(packet, styles))
    story.append(Spacer(1, 0.20 * inch))
    story.extend(_income_block(packet, styles))
    story.append(Spacer(1, 0.20 * inch))
    story.extend(_expenses_block(packet, styles))
    story.append(Spacer(1, 0.20 * inch))
    story.extend(_documents_block(packet, styles))
    story.append(PageBreak())
    story.extend(_disclaimer_block(packet, styles))

    doc.build(story)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            name="CivicaTitle",
            parent=base["Title"],
            fontSize=20,
            leading=24,
            spaceAfter=8,
            textColor=colors.HexColor("#1F1B16"),
        ),
        "subtitle": ParagraphStyle(
            name="CivicaSubtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#6B5B54"),
        ),
        "section": ParagraphStyle(
            name="CivicaSection",
            parent=base["Heading2"],
            fontSize=14,
            leading=18,
            spaceBefore=4,
            spaceAfter=6,
            textColor=colors.HexColor("#1F1B16"),
        ),
        "body": ParagraphStyle(
            name="CivicaBody",
            parent=base["Normal"],
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#1F1B16"),
        ),
        "small": ParagraphStyle(
            name="CivicaSmall",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#6B5B54"),
        ),
        "verdict_eligible": ParagraphStyle(
            name="CivicaVerdictEligible",
            parent=base["Normal"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#176E49"),
        ),
        "verdict_ineligible": ParagraphStyle(
            name="CivicaVerdictIneligible",
            parent=base["Normal"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#9A5A14"),
        ),
    }


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


def _cover(packet: ApplicationPacket, styles: dict) -> list:
    return [
        Paragraph("Civica SNAP Application Summary", styles["title"]),
        Paragraph(
            f"Session reference: {packet.session_id}<br/>"
            f"Generated: {packet.generated_at.strftime('%Y-%m-%d %H:%M UTC')}<br/>"
            f"State: {packet.state} &nbsp;•&nbsp; Language: {packet.language}",
            styles["subtitle"],
        ),
    ]


def _eligibility_block(packet: ApplicationPacket, styles: dict) -> list:
    style_key = (
        "verdict_eligible"
        if packet.eligibility_status in ("eligible", "eligible_with_conditions")
        else "verdict_ineligible"
    )
    headline = {
        "eligible": "Likely eligible",
        "ineligible": "Likely not eligible at this time",
        "eligible_with_conditions": "Likely eligible with conditions",
        "insufficient_information": "Eligibility could not be determined yet",
    }.get(packet.eligibility_status, packet.eligibility_status.title())

    detail_parts: list[str] = []
    if packet.monthly_benefit is not None:
        detail_parts.append(f"Estimated monthly benefit: <b>${_money(packet.monthly_benefit)}</b>")
    if packet.expedited_eligible:
        detail_parts.append("May qualify for expedited service (within 7 days)")
    if packet.ineligibility_reason:
        detail_parts.append(f"Reason: {packet.ineligibility_reason}")
    if packet.rules_version:
        detail_parts.append(f"<font size=9 color='#6B5B54'>Rules version: {packet.rules_version}</font>")

    body: list = [
        Paragraph("Eligibility result", styles["section"]),
        Paragraph(headline, styles[style_key]),
    ]
    for part in detail_parts:
        body.append(Paragraph(part, styles["body"]))
    if packet.contributing_factors:
        body.append(
            Paragraph(
                f"<font size=9 color='#6B5B54'>Contributing factors: "
                f"{', '.join(packet.contributing_factors)}</font>",
                styles["small"],
            )
        )
    return [KeepTogether(body)]


def _household_block(packet: ApplicationPacket, styles: dict) -> list:
    rows: list[list] = [
        ["Member ID", "Age", "Applicant", "Citizenship", "Notes"],
    ]
    for a in packet.applicants:
        notes = []
        if a.is_elderly: notes.append("60+")
        if a.is_disabled: notes.append("disabled")
        if a.is_pregnant: notes.append("pregnant")
        if a.student_status not in ("not_student", "unknown"):
            notes.append(f"student: {a.student_status}")
        if a.student_exemption != "none":
            notes.append(f"exempt: {a.student_exemption}")
        rows.append([
            a.name_or_label,
            str(a.age),
            "Yes" if a.is_applicant else "No",
            a.citizenship,
            ", ".join(notes) if notes else "—",
        ])

    table = Table(rows, repeatRows=1)
    table.setStyle(_table_style())

    header = [
        Paragraph("Household", styles["section"]),
        Paragraph(f"Household size: <b>{packet.household_size}</b>", styles["body"]),
        Spacer(1, 0.05 * inch),
        table,
    ]

    flag_lines: list[str] = []
    if packet.receives_tanf: flag_lines.append("Receives TANF")
    if packet.receives_ssi: flag_lines.append("Receives SSI")
    if packet.receives_general_assistance: flag_lines.append("Receives General Assistance")
    if packet.is_homeless: flag_lines.append("Currently unhoused")
    if packet.is_seasonal_or_migrant_farmworker: flag_lines.append("Migrant or seasonal farmworker")
    if flag_lines:
        header.append(Spacer(1, 0.10 * inch))
        header.append(Paragraph("Household flags: " + ", ".join(flag_lines), styles["body"]))

    return header


def _income_block(packet: ApplicationPacket, styles: dict) -> list:
    if not packet.income_lines:
        return [
            Paragraph("Income", styles["section"]),
            Paragraph("No income reported.", styles["body"]),
        ]
    rows: list[list] = [["Member", "Source", "Monthly gross", "Earned?"]]
    total = Decimal("0")
    for line in packet.income_lines:
        rows.append([
            line.member_label,
            line.source_type,
            f"${_money(line.monthly_gross)}",
            "Yes" if line.is_earned else "No",
        ])
        total += line.monthly_gross
    rows.append(["", "Total monthly", f"${_money(total)}", ""])

    table = Table(rows, repeatRows=1)
    table.setStyle(_table_style(footer_row=True))

    pieces: list = [
        Paragraph("Income", styles["section"]),
        table,
    ]
    if packet.confirmed_paystubs:
        pieces.append(Spacer(1, 0.10 * inch))
        pieces.append(Paragraph("Confirmed paystubs (uploaded and reviewed):", styles["body"]))
        for ref in packet.confirmed_paystubs:
            pieces.append(
                Paragraph(
                    f"• {ref.employer_name} — {ref.pay_period} — "
                    f"gross ${_money(ref.gross_period)}, net ${_money(ref.net_period)}",
                    styles["body"],
                )
            )
    return pieces


def _expenses_block(packet: ApplicationPacket, styles: dict) -> list:
    if not packet.expense_lines and packet.countable_resources == 0:
        return [
            Paragraph("Expenses & resources", styles["section"]),
            Paragraph("No expenses or countable resources reported.", styles["body"]),
        ]
    rows: list[list] = [["Category", "Monthly amount", "Notes"]]
    for line in packet.expense_lines:
        rows.append([line.label, f"${_money(line.monthly_amount)}", line.note or ""])
    if packet.countable_resources > 0:
        rows.append([
            "Countable resources",
            f"${_money(packet.countable_resources)}",
            "Not monthly — total liquid",
        ])
    table = Table(rows, repeatRows=1)
    table.setStyle(_table_style())
    return [
        Paragraph("Expenses & resources", styles["section"]),
        table,
    ]


def _documents_block(packet: ApplicationPacket, styles: dict) -> list:
    if not packet.required_verifications:
        return [
            Paragraph("Documents to bring", styles["section"]),
            Paragraph(
                "No additional documents required by the rules engine. "
                "DTA may still ask for proof during the interview.",
                styles["body"],
            ),
        ]
    pieces: list = [
        Paragraph("Documents to bring", styles["section"]),
        Paragraph(
            "DTA Connect will ask for the following verifications during your application:",
            styles["body"],
        ),
        Spacer(1, 0.05 * inch),
    ]
    for v in packet.required_verifications:
        pieces.append(
            Paragraph(
                f"<b>• {v['label']}</b><br/>"
                f"<font size=9 color='#6B5B54'>{v['explanation']}</font>",
                styles["body"],
            )
        )
        pieces.append(Spacer(1, 0.04 * inch))
    return pieces


def _disclaimer_block(packet: ApplicationPacket, styles: dict) -> list:
    return [
        Paragraph("Important notes", styles["section"]),
        Paragraph(
            "<b>This is not the official Massachusetts SNAP application.</b> "
            "It is a screening summary generated by Civica based on the answers "
            "you shared. To formally apply, complete the Massachusetts Department "
            "of Transitional Assistance application — either online at "
            "DTAConnect.eohhs.mass.gov, by mail, or in person at a DTA office.",
            styles["body"],
        ),
        Spacer(1, 0.10 * inch),
        Paragraph(
            "<b>What to do next:</b><br/>"
            "1. Open <b>DTAConnect.eohhs.mass.gov</b> on your phone or computer.<br/>"
            "2. Click <b>Apply for SNAP</b> and create a DTA Connect account.<br/>"
            "3. Use this summary as a reference while you complete the official application. "
            "Upload the documents listed in the section above. Your benefits decision will come "
            "from DTA after a short interview.",
            styles["body"],
        ),
        Spacer(1, 0.10 * inch),
        Paragraph(
            f"<font size=9 color='#6B5B54'>"
            f"Privacy: this summary contains your application answers. Treat it as you would any "
            f"document containing personal information. The session reference at the top of page 1 "
            f"is the only identifier Civica uses to look up your record."
            f"</font>",
            styles["small"],
        ),
    ]


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def _money(d: Decimal) -> str:
    quantized = d.quantize(Decimal("0.01"))
    sign = "-" if quantized < 0 else ""
    abs_val = abs(quantized)
    integer_part = int(abs_val)
    cents = int((abs_val - integer_part) * 100)
    return f"{sign}{integer_part:,}.{cents:02d}"


def _table_style(*, footer_row: bool = False) -> TableStyle:
    cmds = [
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7FAFD")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1F1B16")),
        ("FONT", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#F1DDD3")),
        ("LINEBELOW", (0, "splitlast"), (-1, "splitlast"), 0.25, colors.HexColor("#F1DDD3")),
    ]
    if footer_row:
        cmds.extend([
            ("FONT", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#F1DDD3")),
        ])
    return TableStyle(cmds)
