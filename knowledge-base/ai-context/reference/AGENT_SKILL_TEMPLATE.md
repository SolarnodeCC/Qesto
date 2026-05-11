# Agent & Skill Canonical Template (Qesto)

_Hub: [Documentation map](../README.md)._

## Agent template

```markdown
---
model: <haiku|sonnet|opus>
---
# Agent: <name>
# VERSION: v1.0.0
# OWNER: <role>
# CONTEXT: <scope>
# TRIGGER: <when to invoke>

## Identity
Who this agent is and what outcomes it owns.

## Boundaries
- Own:
- Read:
- Never:

## Load Your Skill First
Reference the exact `.claude/skills/<skill>.md` file.
Also reference `.claude/skills/COMMON_RULES.md`.

## Task Workflow
1. Intake
2. Validate constraints
3. Execute
4. Verify
5. Report

## Escalation Triggers
List precise conditions that must be escalated.

## Output Format
Define required response sections and artifact locations.

## Docs to Update
Map each change category to exact docs file(s).

## Do Not
Hard constraints and anti-patterns.

## Change Log
- YYYY-MM-DD: change note
```

## Skill template

```markdown
# Skill: <name>
# SCOPE: task
# LOAD: <trigger>
# VERSION: v1.0.0
# OWNER: <role>

## Role
Short role definition.

## Preconditions / Inputs
What must be known before execution.

## Workflow
Step-by-step operating procedure.

## Quality Gates
Commands/checklists required before completion.

## Output Contract
Expected output fields/artifacts.

## Docs to Update
Which docs must be updated and when.

## Do Not
Forbidden actions for this skill.

## Metrics
How skill quality is measured.

## Change Log
- YYYY-MM-DD: change note
```
