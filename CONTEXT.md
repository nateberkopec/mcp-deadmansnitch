# Dead Man's MCP

This repository contains a monitoring product and the factory that develops it. These terms are canonical across product, factory, issues, and reviews.

## Product

**Snitch**:
A monitor that expects check-ins on a schedule and reports their health.
_Avoid_: Check, job, monitor

**Check-in**:
A signal that a monitored job started, succeeded, or failed.
_Avoid_: Ping, heartbeat

**Twin**:
A deterministic behavioral substitute for the external Dead Man's Snitch service.
_Avoid_: Mock, stub, fake

**Conformance**:
Black-box comparison of observable behavior between the twin and an HTTP target.
_Avoid_: Integration test, golden test

**Scenario**:
A deterministic user story that supplies reproducible guidance and acceptance evidence.
_Avoid_: QA exploration, holdout

**Holdout**:
A private scenario withheld from implementation context and used to test generalization.
_Avoid_: Hidden test

## Factory

**Factory**:
The system that selects, implements, reviews, and merges work under bounded authority.
_Avoid_: Pipeline, bot

**Chief of staff**:
The sole coordinator that chooses timely work, controls queues, and shepherds units of work.
_Avoid_: Puck, worker, orchestrator

**Puck**:
The human-facing operator that starts, observes, and communicates with the chief of staff.
_Avoid_: Chief of staff

**Unit of work**:
One independently mergeable change from implementation cue through merge or blocker.
_Avoid_: Phase, task

**Implementation issue**:
The durable cue and record for one unit of work owned by one worker.
_Avoid_: Suggestion, backlog item

**Suggestion issue**:
A bounded finding awaiting chief-of-staff triage rather than an implementation cue.
_Avoid_: Implementation issue

**Worker**:
The agent that owns one implementation issue and its pull request.
_Avoid_: Chief of staff, attempt

**Attempt**:
One bounded continuation of a worker against a failed gate or review finding.
_Avoid_: Worker, retry loop

**Gate**:
A deterministic predicate that blocks invalid progress.
_Avoid_: Review, judgment

**Review**:
An independent judgment of one exact pull-request head.
_Avoid_: Gate, CI

**Finding**:
A reproducible defect, risk, or improvement proposed by an automation.
_Avoid_: Unit of work

**Queue**:
A labeled, capped set of open issues of one kind.
_Avoid_: Phase, project board

**Capacity**:
The maximum number of entries permitted in a queue.
_Avoid_: Cadence

**Automation**:
A recurring agent run with a trigger, authority, output, capacity, and retirement condition.
_Avoid_: Worker

**Backpressure**:
Skipping an automation run while its output queue is full.
_Avoid_: Failure, pause

**Interminable blocker**:
A condition that cannot be resolved within the factory's attempts or authority.
_Avoid_: Temporary failure

**Seal**:
The signed activation that turns construction-time policy into enforced operating constraints.
_Avoid_: Release
