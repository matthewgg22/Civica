.PHONY: ingest ingest-absentee l10n-sync-appshell l10n-sync-myinfo l10n-sync-all l10n-sync-dry-run

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
