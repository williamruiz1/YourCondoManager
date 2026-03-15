# Agent Bootstrap Backbone Success Metrics

## Purpose
Define how the backbone should be measured so it improves based on evidence rather than intuition.

## Measurement Principles
- prefer simple, inspectable metrics over opaque scoring
- measure both activity and effect
- separate “backbone is being used” from “backbone is reducing startup cost”
- keep the first metric set small enough to maintain consistently

## Core Metrics

### 1. Backbone Coverage
Measures whether the required backbone artifacts exist and stay current.

Metrics:
- bootstrap manifest exists
- durable memory exists
- guardrails document exists
- closeout snapshot count
- metrics snapshot count

Success signal:
- all required artifacts exist
- artifact refreshes happen after meaningful backbone changes

### 2. Seed Roadmap Completion
Measures whether the backbone foundation work has been delivered.

Metrics:
- total seed tasks in the backbone roadmap project
- completed seed tasks
- remaining seed tasks

Success signal:
- the foundation project is materially complete
- new tasks are generated from evidence rather than from missing initial setup work

### 3. Friction Capture Rate
Measures whether repeated setup pain is being logged rather than forgotten.

Metrics:
- friction observations logged
- distinct friction categories
- repeatable friction observations
- precomputable friction observations

Success signal:
- repeated setup pain is visible in analysis history
- observations are structured enough to drive later automation

### 4. Friction-to-Backlog Conversion
Measures whether repeated friction is turning into visible improvement work.

Metrics:
- eligible repeated friction patterns
- roadmap tasks created from repeated friction
- roadmap tasks updated from repeated friction

Success signal:
- recurring friction is not trapped in chat history
- the backbone generates its own improvement backlog safely

### 5. Verification Reuse
Measures whether the backbone is reducing repeated verification discovery.

Metrics:
- verification paths captured in durable memory
- verification-related friction observations
- verification-related friction trends over time

Success signal:
- common change types have stable validation paths
- repeated confusion about how to verify work declines

### 6. Startup-Cost Reduction Proxy
This is a proxy, not a perfect direct measure.

Metrics:
- count of repeatable friction observations over time
- count of backbone artifact refreshes
- count of generated closeout recommendations
- count of generated follow-up tasks that eliminate rediscovery

Success signal:
- the same friction patterns appear less often over time
- more startup knowledge is available before work begins

## Data Sources
- `docs/agent-bootstrap/workspace-manifest.json`
- `docs/agent-bootstrap/durable-memory.json`
- `docs/projects/agent-bootstrap-self-amend-guardrails.md`
- backbone roadmap project in the roadmap tables
- analysis runs for `resourceId=admin-roadmap-backbone` and `module=agent-bootstrap-backbone`
- analysis versions for `resourceId=admin-roadmap-backbone` and `module=agent-bootstrap-backbone`

## Non-Goals
These metrics do not attempt to prove:
- absolute agent productivity
- total project throughput across all product work
- exact minutes saved per session

They are intended to provide a bounded operational signal for whether the backbone is being used and whether it is reducing repeated startup cost.

## Review Cadence
- refresh metrics whenever backbone closeout is generated
- review trend quality when repeated friction tasks are considered
- revisit the metric set when the backbone reaches a more autonomous stage

## Operating Rule
Do not add many more metrics unless the existing ones stop being decision-useful.
