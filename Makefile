.PHONY: ingest ingest-absentee

ingest:
	python3 scripts/ingest_votenow_metrics.py --input data/source/votenow_voter_participation_metrics_catalog_v3.xlsx --out data/derived

ingest-absentee:
	python3 scripts/convert_absentee_xlsx_to_json.py --input data/absentee_ballot_request_links_deadlines.xlsx --out data/absentee_ballot_request_links_deadlines.json --bundle-out "WeVote Information Page/Models/absentee_ballot_request_links_deadlines.json"
