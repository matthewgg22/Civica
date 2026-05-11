"""Eval harness for the SNAP conversational pipeline.

Each Trace is a scripted conversation: a list of turns where each turn
specifies the user utterance, the InterpreterOutput we expect the LLM
to produce for it, and the resulting orchestrator state assertions.

The harness runs every trace through the orchestrator with a mocked
LLM client. CI fails on any regression — extracted state diverging,
next_topic changing unexpectedly, terminal verdict flipping.

Re-run after every prompt change. Snapshot mismatches mean either:
  (a) you intentionally changed pipeline behavior — update the trace,
  (b) you regressed something — the stack trace tells you what.
"""

from .traces import ALL_TRACES, Trace, TurnExpectation

__all__ = ["ALL_TRACES", "Trace", "TurnExpectation"]
