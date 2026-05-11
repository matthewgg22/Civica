"""SNAP conversational pipeline.

Three stages run per user turn:
  1. Interpreter — extract structured entities from the user's utterance
     (LLM, Anthropic Haiku, structured output).
  2. Ask-Selector — given the running state and the rules engine's view
     of what's still needed, pick the next-most-informative question
     topic. Phase C: deterministic priority walker. Phase D+: optional
     LLM-driven prioritization.
  3. Script-Writer — turn the next-question topic into a plain-language
     question in the user's preferred language (LLM, Anthropic Sonnet).

The Orchestrator threads these together, persists each turn through a
SnapRepository, and emits cost telemetry.
"""
