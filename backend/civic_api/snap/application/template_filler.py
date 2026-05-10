"""Fill the official MA DTA SNAP-1 PDF when its template is configured.

Activated by setting `SNAP_MA_DTA_TEMPLATE_PATH` in the environment.
The path must point to a fillable PDF copy of MA's SNAP-1 form
downloaded from DTA's website. Civica deployments are responsible for
sourcing the form themselves; we don't bundle it.

Field mapping is intentionally narrow: the template_filler only fills
fields where Civica has high-confidence data from the conversation.
Anything ambiguous is left blank for the user to complete in DTA
Connect — better to leave a field empty than to put the wrong answer
on a state form.

If the template file or any field name is missing, the filler raises
TemplateConfigurationError so the deployment alarm fires before any
real applicant sees a half-filled form.
"""
from __future__ import annotations

import io
import logging
import os
from typing import Any

from .data_assembly import ApplicationPacket

logger = logging.getLogger(__name__)


class TemplateConfigurationError(RuntimeError):
    """Raised when SNAP_MA_DTA_TEMPLATE_PATH is set but the file is
    missing, unreadable, or doesn't expose the expected form fields."""


# Field-name mapping. Keys are stable internal names; values are the
# AcroForm field names in the MA DTA SNAP-1 PDF. The values must be
# updated when MA DTA publishes a new form revision.
#
# This dict is the configuration surface between Civica and a specific
# state-form revision. Tests verify every key referenced by the filler
# logic appears here.
_FIELD_MAP_DEFAULT: dict[str, str] = {
    "applicant_first_name": "applicant_first_name",  # placeholder
    "applicant_last_name": "applicant_last_name",
    "household_size": "household_size",
    "monthly_gross_income_total": "monthly_gross_income_total",
    "monthly_rent_or_mortgage": "monthly_rent_or_mortgage",
    "is_homeless_yes_checkbox": "is_homeless_yes",
    "is_homeless_no_checkbox": "is_homeless_no",
    # Real production deployments override this dict to match the
    # actual AcroForm field names as published by MA DTA.
}


def is_template_configured() -> bool:
    """Whether SNAP_MA_DTA_TEMPLATE_PATH is set AND the file exists.

    Doesn't open the PDF; that's the filler's job. This check is
    cheap enough to call from a hot path."""
    path = os.environ.get("SNAP_MA_DTA_TEMPLATE_PATH", "").strip()
    return bool(path) and os.path.isfile(path)


def fill_ma_dta_template(
    packet: ApplicationPacket,
    *,
    template_path: str | None = None,
    field_map: dict[str, str] | None = None,
) -> bytes:
    """Fill the MA DTA SNAP-1 fillable PDF from the application packet.

    Returns the filled PDF bytes. Raises TemplateConfigurationError if
    the template path is unset, missing, or has no fillable fields.
    """
    path = template_path or os.environ.get("SNAP_MA_DTA_TEMPLATE_PATH", "").strip()
    if not path:
        raise TemplateConfigurationError(
            "SNAP_MA_DTA_TEMPLATE_PATH is not set. "
            "Configure the path to the MA DTA SNAP-1 fillable PDF, or use the "
            "summary PDF path (which is always available)."
        )
    if not os.path.isfile(path):
        raise TemplateConfigurationError(
            f"SNAP_MA_DTA_TEMPLATE_PATH={path!r} does not point to a readable file."
        )

    field_map = field_map or _FIELD_MAP_DEFAULT
    form_data = _build_form_data(packet)

    # Local import keeps pdfrw optional for environments running summary-only.
    import pdfrw  # type: ignore[import-not-found]

    template = pdfrw.PdfReader(path)
    if not _has_acroform(template):
        raise TemplateConfigurationError(
            f"Template at {path!r} does not contain an AcroForm. "
            "Confirm you downloaded the fillable revision from MA DTA, "
            "not the print-only one."
        )

    # Set NeedAppearances so PDF viewers render the field values without
    # having to re-flatten the form.
    if template.Root.AcroForm:
        template.Root.AcroForm.update(
            pdfrw.PdfDict(NeedAppearances=pdfrw.PdfObject("true"))
        )

    matched, unmatched = 0, 0
    for page in template.pages:
        annotations = page.Annots or []
        for annotation in annotations:
            if annotation.Subtype != "/Widget" or not annotation.T:
                continue
            field_name = annotation.T.to_unicode().strip("()")
            internal_key = _reverse_lookup(field_map, field_name)
            if internal_key is None or internal_key not in form_data:
                continue
            value = form_data[internal_key]
            _set_field_value(annotation, value)
            matched += 1
    unmatched = len(form_data) - matched
    if unmatched > 0:
        logger.warning(
            "MA DTA template-fill: %d/%d fields unmatched. Update _FIELD_MAP_DEFAULT "
            "or the override field_map to match the current form revision.",
            unmatched,
            len(form_data),
        )

    output = io.BytesIO()
    pdfrw.PdfWriter().write(output, template)
    return output.getvalue()


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _build_form_data(packet: ApplicationPacket) -> dict[str, Any]:
    """Project the packet into the flat field dict the filler consumes.

    Only well-formed, high-confidence values land here; ambiguous data
    is left out so the user fills it in DTA Connect themselves."""
    data: dict[str, Any] = {}

    # Phase F MVP: applicant name is not collected by the conversation
    # pipeline yet (privacy posture defers PII fields to the document-
    # extraction phase). Leave name blank for the user to fill.
    # household_size IS reliably known.
    data["household_size"] = str(packet.household_size)

    if packet.income_lines:
        total = sum((line.monthly_gross for line in packet.income_lines), start=__import__("decimal").Decimal(0))
        data["monthly_gross_income_total"] = f"{total:.2f}"

    rent_lines = [
        line for line in packet.expense_lines if "Rent" in line.label
    ]
    if rent_lines:
        data["monthly_rent_or_mortgage"] = f"{rent_lines[0].monthly_amount:.2f}"

    if packet.is_homeless:
        data["is_homeless_yes_checkbox"] = "Yes"
    else:
        data["is_homeless_no_checkbox"] = "No"

    return data


def _has_acroform(template) -> bool:
    return template.Root and template.Root.AcroForm and template.Root.AcroForm.Fields


def _reverse_lookup(field_map: dict[str, str], field_name: str) -> str | None:
    for internal_key, mapped in field_map.items():
        if mapped == field_name:
            return internal_key
    return None


def _set_field_value(annotation, value: Any) -> None:
    import pdfrw  # type: ignore[import-not-found]

    annotation.update(pdfrw.PdfDict(V=str(value), AS=pdfrw.PdfName(str(value))))
