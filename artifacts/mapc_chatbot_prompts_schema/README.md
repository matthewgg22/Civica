# MAPC Chatbot Prompts + Schema Bundle
Generated: 2026-04-10T14:17:31.615567

This bundle contains the prompts and schema/models currently used by the MAPC script-building chatbot flow.

## Included
- prompts/
  - 01_stage1_interpreter_prompt.txt
  - 02_stage2_ask_selector_prompt.txt
  - 03_stage3_background_writer_prompt.txt
  - 04_stage4_script_writer_prompt.txt
- schemas/
  - mapc_v3_session_runtime_schema.json (derived from backend runtime sanitize fields)
  - swift_mapc_v3_models.swift (app request/response/session structs)
- source_snapshots/
  - mapc_pipeline_v3.py
  - CivicCallService.swift
  - IssueCallCenterView.swift
  - api_v2_mapc_handlers.py
  - ui_text_snippets.txt
