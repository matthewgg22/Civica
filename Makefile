.PHONY: ingest

ingest:
	python3 scripts/ingest_votenow_metrics.py --input data/source/votenow_voter_participation_metrics_catalog_v3.xlsx --out data/derived
