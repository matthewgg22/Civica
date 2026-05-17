.PHONY: ingest ingest-absentee l10n-sync-appshell l10n-sync-myinfo l10n-sync-all l10n-sync-dry-run \
	api-install api-dev api-test api-typecheck api-build api-openapi \
	compose-up compose-down compose-postgres db-reset db-migrate db-gen-types \
	fly-deploy-api fly-deploy-engine fly-logs-api fly-logs-engine

ingest:
	python3 scripts/ingest_votenow_metrics.py --input data/source/votenow_voter_participation_metrics_catalog_v3.xlsx --out data/derived

ingest-absentee:
	python3 scripts/convert_absentee_xlsx_to_json.py --input data/absentee_ballot_request_links_deadlines.xlsx --out data/absentee_ballot_request_links_deadlines.json --bundle-out "WeVote Information Page/Models/absentee_ballot_request_links_deadlines.json"

l10n-sync-appshell:
	python3 scripts/sync_xcstrings_locales.py --xcstrings "WeVote Information Page/AppShell.xcstrings" --target-locales "es,zh-Hans,fil,vi" --machine-dir ".l10n_machine" --locklist ".l10n_machine/locklist.json"

l10n-sync-myinfo:
	python3 scripts/sync_xcstrings_locales.py --xcstrings "WeVote Information Page/MyInfoPanel.xcstrings" --target-locales "es,zh-Hans,fil,vi" --machine-dir ".l10n_machine" --locklist ".l10n_machine/locklist.json"

l10n-sync-all: l10n-sync-appshell l10n-sync-myinfo

l10n-sync-dry-run:
	python3 scripts/sync_xcstrings_locales.py --xcstrings "WeVote Information Page/AppShell.xcstrings" --target-locales "es,zh-Hans,fil,vi" --machine-dir ".l10n_machine" --locklist ".l10n_machine/locklist.json" --dry-run
	python3 scripts/sync_xcstrings_locales.py --xcstrings "WeVote Information Page/MyInfoPanel.xcstrings" --target-locales "es,zh-Hans,fil,vi" --machine-dir ".l10n_machine" --locklist ".l10n_machine/locklist.json" --dry-run

# ======================================================================
# SNAP API gateway (apps/api, Hono)
# ======================================================================

api-install:
	pnpm install

api-dev:
	pnpm --filter @civica/api dev

api-test:
	pnpm --filter @civica/api test

api-typecheck:
	pnpm --filter @civica/api typecheck

api-build:
	pnpm --filter @civica/api build

# ======================================================================
# Local dev stack (docker compose)
# ======================================================================

compose-up:
	docker compose up

compose-postgres:
	docker compose up postgres

compose-down:
	docker compose down

db-reset:
	docker compose down -v postgres
	docker compose up -d postgres

db-migrate:
	./scripts/apply-snap-migrations.sh

db-gen-types:
	./scripts/gen-db-types.sh

api-openapi:
	pnpm --filter @civica/api build:openapi

# ======================================================================
# Fly.io deploy (run from repo root — build context is the monorepo)
# ======================================================================

fly-deploy-api:
	fly deploy --config fly.api.toml

fly-deploy-engine:
	fly deploy --config fly.engine.toml

fly-logs-api:
	fly logs --config fly.api.toml

fly-logs-engine:
	fly logs --config fly.engine.toml
