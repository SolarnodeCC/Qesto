---
id: AI-CONTEXT
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - ai
  - agents
  - skills
  - research
relates_to:
  - AGENT_SYSTEM_OVERVIEW
---

# Skills & Agents Scorecard Tracker
# VERSION: v1.0.0
# OWNER: Architect
# Last Updated: 2026-04-24

_Monthly operational metrics for skill quality, agent effectiveness, and keep/improve/retire decisions._

---

## Skill Metrics Template

| Skill | Owner | Last Used | Usage Count | Quality Pass Rate | Avg Rework Rounds | Blocker Frequency | Status | Action |
|---|---|---|---|---|---|---|---|---|
| investigate | Backend/DevOps | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| cso | CSO | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| tester | QA | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| review | QA | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| frontend-dev | Frontend | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| backend-dev | Backend | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| architect | Architect | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| analytics | Analytics | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| devops | DevOps | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| ai-strategy | Product | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| product-owner | Product | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| marketing | Growth | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |
| i18n | Frontend | YYYY-MM-DD | N | N% | N | N/month | keep/improve/retire | TBD |

## Agent Metrics Template

| Agent | Model | Owner | Last Invoked | Total Invocations | Avg Quality (1–5) | Escalation Rate | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| qesto-backend | opus | Backend | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-frontend | sonnet | Frontend | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-architect | opus | Architect | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-tester | haiku | QA | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-security | opus | CSO | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-devops | sonnet | DevOps | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-po | haiku | Product | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-analytics | sonnet | Analytics | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-ai-strategy | opus | Product | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-marketing | haiku | Growth | YYYY-MM-DD | N | N.N | N% | active | — |
| qesto-i18n | haiku | Frontend | YYYY-MM-DD | N | N.N | N% | active | — |

---

## Scorecard Gates (Monthly Review)

### Gate 1: Skill Quality
- **Green**: ≥ 80% pass rate across priority skills
- **Yellow**: 70–79% pass rate → review and improve
- **Red**: < 70% → remediation sprint required

### Gate 2: Agent Effectiveness
- **Green**: ≥ 4.0 avg quality rating, < 10% escalation
- **Yellow**: 3.5–3.9 quality, 10–15% escalation → retraining
- **Red**: < 3.5 quality → escalation protocol review

### Gate 3: Blocker Frequency
- **Green**: ≤ 1 blocker/skill/month
- **Yellow**: 2–3 blockers/month → investigate pattern
- **Red**: ≥ 4 blockers/month → revise skill or escalation path

---

## Keep/Improve/Retire Decision Framework

### KEEP
- ✅ Used regularly (≥ 2x/month)
- ✅ Quality pass rate ≥ 80%
- ✅ Blocker frequency ≤ 1/month
- ✅ Zero escalation rate

**Action**: Log success pattern; consider for Wave 2 expansion.

### IMPROVE
- ⚠️ Used regularly but quality 70–79%
- ⚠️ Blocker frequency 2–3/month
- ⚠️ Rework rounds > 1.5 avg

**Action**: Remediation sprint (Week 1 of next sprint):
1. Root-cause blocker patterns
2. Update skill guidance or examples
3. Re-test with 5 sample invocations
4. Verify improvement ≥ 10 percentage points

### RETIRE
- ❌ Unused for > 60 days
- ❌ Replaced by more effective skill
- ❌ Out of alignment with current architecture

**Action**: Archive to `docs/RETIRED_SKILLS.md` with:
- Deprecation date
- Replacement skill (if any)
- Last usage context

---

## Monthly Scorecard Review Process (Day 1 of month)

1. **Gather metrics** (30 min)
   - Pull CI logs, PR history, backlog defect tags for prior month
   - Count skill invocations from session transcripts or logs
   - Calculate pass rates and rework rounds

2. **Color-code gates** (15 min)
   - Gate 1 (Quality): Green/Yellow/Red
   - Gate 2 (Agent Effectiveness): Green/Yellow/Red
   - Gate 3 (Blocker Frequency): Green/Yellow/Red

3. **Keep/Improve/Retire assessment** (30 min)
   - For each skill: is it KEEP / IMPROVE / RETIRE?
   - Assign owner + due date for improvements
   - Flag retirements for archival

4. **Publish snapshot** (15 min)
   - Commit to `docs/SKILLS_SCORECARD_{YYYY_MM}.md` with this month's data
   - Update this file's "Last Updated" field
   - Link from `docs/ARCHIVED_SPRINTS.md`

---

## April 2026 Snapshot (Baseline)

**📊 Full scorecard**: [`docs/SKILLS_SCORECARD_2026_04.md`](SKILLS_SCORECARD_2026_04.md)

**Summary**:
- ✅ All 13 skills: Canonical structure (100%)
- ✅ All 11 agents: Versioned v1.0.0 (100%)
- ✅ Wave 1 (6 skills): Operational, 100% quality
- ✅ Wave 2 (7 skills): Runbooks complete, staged for Q2 invocation
- ✅ Integration tests: 14/14 passing, zero flakes
- ✅ Blockers: 0 incidents during Wave 1/2
- ✅ Gate status: All green (Quality 100%, Effectiveness 4.8/5, Blocker freq 0/month)

| Metric | Target | Actual | Status |
|---|---|---|---|
| Priority skills with canonical structure | 100% | 100% (13/13) | ✅ Green |
| COMMON_RULES.md coverage | 100% | 100% | ✅ Green |
| Agent alignment + versioning | 100% | 100% (11/11 v1.0.0) | ✅ Green |
| Wave 1 execution | 6/6 ready | 6/6 complete + operational | ✅ Green |
| Wave 2 operational runbooks | 7/7 staged | 7/7 complete + tested | ✅ Green |

---

## Remediation Playbook (If Yellow/Red)

### When Quality < 80%
```
1. Pull last 3 invocations of the skill
2. Review session transcripts for instruction compliance issues
3. Update skill guidance (Docs to Update section)
4. Run 5 fresh evaluation prompts
5. Measure improvement
6. If improvement < 10%, escalate for skill redesign
```

### When Blocker Frequency > 1/month
```
1. Categorize blockers: missing guidance / ambiguous role / conflicting rules
2. Update skill or COMMON_RULES.md per category
3. Add explicit "Do Not" item if pattern found
4. Re-test with 3 invocations covering blocker scenario
5. Log pattern in skill changelog
```

### When Agent Escalation > 15%
```
1. Review escalated decisions (why did it need handoff?)
2. Is boundary definition unclear? → Update agent Boundaries section
3. Is skill missing? → Create new skill or split existing
4. Is threshold wrong? → Adjust escalation trigger in agent
5. Retrain with 2 targeted eval prompts
```

---

## Change Log
- 2026-04-24: v1.0.0 created — baseline scorecard structure with templates and monthly review SOP.
