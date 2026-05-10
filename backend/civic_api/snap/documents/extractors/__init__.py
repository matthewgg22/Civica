"""Type-specific document extractors.

One module per supported document type. Each exports a `run_<type>_extractor`
function with a uniform signature: image bytes in, Pydantic instance + LLM
telemetry out.

Phase E: paystub. Phase E+1: id, lease, utility_bill.
"""

from .paystub import DEFAULT_PAYSTUB_MODEL, run_paystub_extractor

__all__ = ["DEFAULT_PAYSTUB_MODEL", "run_paystub_extractor"]
