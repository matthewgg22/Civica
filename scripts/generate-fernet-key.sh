#!/usr/bin/env bash
# Generate a new SNAP_FERNET_KEY for local development.
# Output is a 32-byte url-safe base64 string suitable for placing
# directly into .env as SNAP_FERNET_KEY=<output>.
#
# In production the key is loaded from AWS KMS or GCP Cloud KMS via
# a secrets-management bridge; this helper is only for local dev.
# Never commit the printed value.
set -euo pipefail
python3 -c 'from cryptography.fernet import Fernet; import sys; sys.stdout.write(Fernet.generate_key().decode() + chr(10))'
