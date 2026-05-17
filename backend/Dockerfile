# Production image for the FastAPI SNAP engine (backend/).
# Build context must be the REPO ROOT:
#   docker build -f backend/Dockerfile .
#
# Single-stage Python build. Requirements are pinned in requirements.txt at
# the repo root. SNAP module dependencies (anthropic, cryptography, pydantic
# v2) are all included; the engine fails fast on missing env vars at startup.

FROM python:3.11-slim

# System deps for cryptography (native extensions) and psycopg2 (if needed).
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
  && rm -rf /var/lib/apt/lists/*

# Non-root user.
RUN groupadd -g 1001 civica && useradd -u 1001 -g civica -s /bin/sh -m civica

WORKDIR /app

# Install Python deps first (layer-cache friendly).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source.
COPY backend/ ./backend/

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER civica

EXPOSE 8080

# uvicorn's built-in --workers flag for multi-process concurrency.
# WEB_CONCURRENCY defaults to 2; set higher via fly.toml [env] if needed.
CMD ["sh", "-c", \
  "uvicorn backend.civic_api.api:app \
    --host 0.0.0.0 \
    --port 8080 \
    --workers ${WEB_CONCURRENCY:-2} \
    --log-level info"]
