# Agent Bootstrap Self-Amend Guardrails

## Purpose
Define the write boundaries and promotion rules for the agent bootstrap backbone so self-amending behavior improves planning infrastructure without silently changing product behavior.

## Allowed Automatic Writes
The backbone may update these artifacts automatically:
- generated bootstrap artifacts in `docs/agent-bootstrap/`
- durable memory artifacts in `docs/agent-bootstrap/`
- analysis run records related to backbone friction and closeout
- analysis version records related to backbone snapshots and recommendations
- roadmap task status for backbone work only when the implementation has been completed explicitly in the current session
- planning and backbone documentation that describes the backbone itself

## Allowed Semi-Automatic Writes
These changes may be proposed automatically but should be reviewed before they are treated as complete:
- new backbone roadmap tasks inferred from repeated friction
- edits to backbone recommendations or success metrics
- promotion of recurring transient observations into durable memory

## Prohibited Automatic Writes
The backbone must not automatically change:
- product business logic
- schema or migrations
- authorization or role behavior
- user-facing workflows
- non-backbone roadmap projects
- implementation status of unrelated product tasks
- source documents that define product requirements unless the current task explicitly requested those edits

## Read-Only Dependencies
The backbone may read from, but should not automatically rewrite:
- primary application code
- shared schema definitions
- route registration
- product capability-model definitions
- product roadmap projects outside the backbone initiative

## Promotion Rules
Information may move from transient observation into a durable backbone artifact only when at least one of these is true:
- it is a stable repo fact that is unlikely to change frequently
- it is a repeatable verification path used across multiple sessions
- it is a recurring friction pattern that belongs in the backbone roadmap
- it is a planning or governance decision explicitly accepted into a durable document

Information must not be promoted when it is:
- a one-off debugging note
- an unverified hypothesis
- a temporary workaround
- task-specific implementation chatter with no durable value

## Friction Logging Rules
Backbone friction logging should:
- record what had to be rediscovered
- explain why the rediscovery was needed
- note whether the cost appears repeatable
- capture whether a precomputed artifact could remove the work

Backbone friction logging should not:
- imply that a friction pattern is important based on one observation alone
- create roadmap work automatically without thresholding or review
- overwrite previous analysis history silently

## Session Closeout Rules
Closeout automation may:
- snapshot current backbone artifacts
- summarize open backbone tasks
- recommend next improvements
- record known blocking repo issues that affect backbone verification

Closeout automation may not:
- mark unrelated roadmap work complete
- apply product changes
- mutate capability-model definitions
- rewrite application code

## Escalation Conditions
Automatic backbone behavior should stop and require human or explicit task review when:
- a write would cross from backbone infrastructure into product behavior
- mapping identifiers are ambiguous
- planning context is missing or stale enough to produce misleading output
- generated artifacts disagree materially with their source systems
- the analysis history suggests conflicting recommendations

## Operating Principle
The backbone is allowed to improve the project’s ability to understand itself.

It is not allowed to silently change what the product does.
