"""Application-layer Fernet encryption for SNAP PII columns.

Why this exists on top of Postgres at-rest encryption: even if a database
backup leaks, attacker still needs the KMS-stored Fernet key to read
income amounts, names, addresses, document contents. The two layers
must be compromised separately.

Usage pattern: every SNAP repository method that writes a PII column
encrypts via this helper before insert; every read decrypts on the way
out. The encryption boundary is the repository, not the model — models
carry plaintext so business logic stays readable.

Key management:
  - In production, the Fernet key is loaded from AWS KMS or GCP Cloud KMS
    via a secrets-management bridge. The wrapper accepts a key directly
    so we don't couple this module to a particular KMS vendor.
  - For local development, set SNAP_FERNET_KEY in your .env (a 32-byte
    url-safe base64 string). Generate one with
    `scripts/generate-fernet-key.sh` and paste the output as the value.
  - Never commit a real key. `.env` is already gitignored at the repo root.

Key rotation: Fernet supports MultiFernet for graceful rotation. Phase G
adds a rotation runbook; Phase A only handles single-key.
"""
from __future__ import annotations

import os
from typing import Final

from cryptography.fernet import Fernet, InvalidToken


class EncryptionKeyMissing(RuntimeError):
    """Raised at boot when SNAP_FERNET_KEY is not configured.

    This must NEVER fall back to plaintext or a default key. Failing
    closed is the correct behavior — better to refuse to start than
    silently store PII unencrypted.
    """


_PII_COLUMN_PREFIX: Final[bytes] = b"snap_v1::"


class PIIEncryptor:
    def __init__(self, *, key: bytes | str | None = None) -> None:
        material = key or os.environ.get("SNAP_FERNET_KEY", "").strip()
        if not material:
            raise EncryptionKeyMissing(
                "SNAP_FERNET_KEY is not set. The SNAP module refuses to start without "
                "a Fernet key configured. Generate one with cryptography.fernet.Fernet.generate_key() "
                "and store it in your secrets manager (KMS in production)."
            )
        if isinstance(material, str):
            material = material.encode()
        self._fernet = Fernet(material)

    def encrypt(self, plaintext: str | None) -> str | None:
        """Returns a stable, prefixed token suitable for storing in a TEXT
        column. None passes through unchanged so optional fields work."""
        if plaintext is None:
            return None
        token = self._fernet.encrypt(plaintext.encode("utf-8"))
        return (_PII_COLUMN_PREFIX + token).decode("ascii")

    def decrypt(self, ciphertext: str | None) -> str | None:
        if ciphertext is None:
            return None
        encoded = ciphertext.encode("ascii")
        if not encoded.startswith(_PII_COLUMN_PREFIX):
            raise InvalidToken(
                "Stored value is missing the snap_v1:: prefix; refusing to decrypt as Fernet."
            )
        token = encoded[len(_PII_COLUMN_PREFIX):]
        return self._fernet.decrypt(token).decode("utf-8")


def get_default_encryptor() -> PIIEncryptor:
    """Module-level singleton accessor. Tests construct their own
    PIIEncryptor with an in-test key; production code uses this."""
    global _DEFAULT
    try:
        return _DEFAULT  # type: ignore[name-defined]
    except NameError:
        _DEFAULT = PIIEncryptor()  # type: ignore[name-defined]
        return _DEFAULT
