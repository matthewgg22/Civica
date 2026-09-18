# Drop-in institutions

Each `*.json` file in this directory defines **one** bank or financial institution,
keyed by its filename (`preferred_bank.json` → key `preferred_bank`). It is loaded
and merged with the roster in `../assessment_areas.json` at generate time, so
adding an institution here needs no edit to the shared roster.

```bash
python3 -m src.generate --scaffold preferred_bank   # writes preferred_bank.json here
python3 -m src.generate --validate preferred_bank   # check readiness
python3 -m src.generate --bank preferred_bank        # render its personalized page
```

Same schema as an `assessment_areas.json` entry (see `--fields` or `src/institution.py`).
Keys beginning with `_` (e.g. `_README` in a scaffold) are ignored. A key defined in
both this directory and `assessment_areas.json` is an error.
