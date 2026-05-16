---
id: EXPERIMENT
type: checklist
category: active
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - experiment
  - checklist
relates_to:
  - BACKLOG_MASTER
---

# Experiment: 3-Step Guided Checklist Increases Activation

**Date**: 2026-04-24  
**Owner**: Growth & Marketing  
**Status**: Planned

---

## Hypothesis

Adding a "Start your first session in 3 steps" guided checklist on the post-signup dashboard increases the activation rate (signup → first session started) by 15% within 7 days of signup.

**Current state**: Users land on empty dashboard post-signup with no clear next action.  
**Expected impact**: +15% relative improvement in activation rate (baseline 30% → target 34.5%).

---

## Test Design

### Cohorts

**Cohort A (Control)**: Current post-signup dashboard  
- Empty state with "Create a session" CTA only
- Users must discover session creation flow themselves
- No progress indication toward first session

**Cohort B (Treatment)**: Dashboard with 3-step guided checklist  
- Prominent checklist card: "(1) Create session (2) Add a question (3) Go live"
- Each step shows completion checkmark when done
- Inline copy: "Your first session in 3 steps"
- Pro tip badge on step 1: "Free plan: 50 participants"
- CTA button on each incomplete step (mobile-friendly, 44px min touch target)
- Progress meter at top: "Step X of 3"

### Tracking Plan

**Experiment enrollment event** (`signup` event in Analytics Engine):
- Field: `experiment_group` = "control" | "treatment"
- Field: `timestamp` = signup completion time
- Field: `user_id` = hashed session ID
- Sent to Analytics Engine during auth completion

**Experiment conversion event** (`first_session_started` event):
- Field: `user_id` = same hashed ID
- Field: `timestamp` = time session entered LIVE state
- Field: `experiment_group` = "control" | "treatment"
- Field: `session_id` = session entity ID
- Sent to Analytics Engine when session transitions from DRAFT → LIVE

**Secondary tracking**:
- `checklist_step_completed` (Treatment only): Fired when user checks off each step
  - Fields: `user_id`, `step` (1|2|3), `timestamp`
- `checklist_viewed` (Treatment only): Fired when checklist card first rendered
  - Fields: `user_id`, `timestamp`

---

## Sample Size & Duration

### Calculation

**Baseline metrics**:
- Monthly signups: 200
- Baseline activation rate (7-day window): 30% (estimated from product assumption)
- Target activation rate: 34.5% (30% + 15% relative lift)
- Statistical significance: p < 0.05, two-tailed
- Power: 80% (ability to detect true effect if it exists)
- Minimum detectable effect (MDE): 4.5 percentage points absolute

**Sample size formula**:
- N = (Z_α/2 + Z_β)² × (p₁(1-p₁) + p₂(1-p₂)) / (p₁ - p₂)²
- N = (1.96 + 0.84)² × (0.30×0.70 + 0.345×0.655) / (0.045)²
- N = 7.84 × (0.21 + 0.226) / 0.002025
- N ≈ 1,470 users per cohort

**Duration estimate**:
- Total sample needed: 2,940 users (both cohorts)
- Monthly signup volume: 200 users
- 50/50 traffic split: 100 per cohort per month
- **Duration: ~29–30 days (1 month) to reach power**
- We will run for **28 days** and declare outcome based on primary KPI significance

**Audience check**: 30 days of signups (200 users) > 5% of monthly active users. ✓ Sufficient power.

---

## Success Criteria

### Primary KPI
**Activation rate (signup → first_session_started within 7 days)**
- **Control**: 30% (baseline assumption)
- **Target for Treatment**: 34.5% (15% relative uplift)
- **Success threshold**: p < 0.05, 95% confidence interval does not include zero

### Secondary KPIs (to watch for regressions)

1. **Time-to-first-session** (days between signup and first LIVE)
   - Watch for: Treatment slower than control (would indicate friction)
   - Target: Treatment ≤ Control (should be same or faster)

2. **Bounce rate on post-signup dashboard** (% who leave within 1 minute of signup)
   - Watch for: Treatment higher than control (checklist could overwhelm)
   - Target: Treatment ≤ Control

3. **Session creation rate** (% who create a session, regardless of going live)
   - Watch for: If first_session_started doesn't improve but creation rate does → product issue
   - Target: Treatment > Control (should help more users get to session creation)

4. **Pro conversion rate** (% of treatment cohort who upgrade during first session within 7 days)
   - Watch for: Whether guided checklist aids or hinders upgrade consideration
   - Target: Treatment ≥ Control (neutral or positive)

---

## Statistical Significance

**Primary KPI evaluation**:
- Compare activation rate (proportion) between cohorts using Chi-square test or Fisher's exact
- Calculate 95% confidence intervals around both cohort rates
- Success: Treatment CI does not overlap with control (or p < 0.05)

**Stopping for early statistical significance**:
- Evaluate every 7 days starting day 14
- If p < 0.05 on primary KPI by day 14 → can declare winner early (skip to scale)
- If p > 0.05 by day 28 → declare inconclusive, iterate

---

## Stopping Rules

### Rule 1: Emergency Stop (Data Quality / Safety)
```
IF traffic drops > 10% in Treatment cohort relative to Control
  AND Treatment activation rate drops > 5 percentage points
  AND this persists > 24 hours
  → STOP immediately, revert to Control for 100%
  → Investigate: Did checklist rendering break? Is event tracking failing?
```

### Rule 2: Early Winner (Faster Iteration)
```
IF runs 14 days AND p < 0.05 on primary KPI (activation rate)
  AND Treatment rate > Control rate + 4.5pp (our MDE)
  → DECLARE WIN
  → Scale Treatment to 100% of new signups
  → Archive results and move to next experiment
```

### Rule 3: Statistical Loss
```
IF runs 28 days AND p > 0.05 on primary KPI
  AND Treatment rate ≤ Control rate + 1pp (negligible improvement)
  → DECLARE LOSS
  → Keep Control for 100% of signups
  → Document learnings (see "What We Learned" section)
  → Iterate on checklist design or test new hypothesis
```

### Rule 4: Inconclusive (Insufficient Power)
```
IF runs 28 days AND p > 0.05 AND Treatment rate is 2–4pp above Control
  → DECLARE INCONCLUSIVE
  → Extend experiment 14 more days OR
  → Keep checkpoint result, gather more signups in next cohort
  → Document effect size for power recalculation
```

### Rule 5: Hard Stop (Calendar)
```
IF reaches 42 days (1.5× planned duration)
  → STOP regardless of significance
  → Declare outcome based on p-value + effect size direction
  → Move to next experiment (velocity > perfection)
```

---

## Implementation Checklist (Do Not Launch Without)

- [ ] **Tracking plan finalized**: `signup` event includes `experiment_group` field, `first_session_started` event includes `experiment_group` field. Confirm event schema with Analytics owner.
- [ ] **Randomization logic**: 50/50 split implemented in signup flow. Verify cohort assignment is deterministic (same user always sees same cohort across sessions).
- [ ] **Feature flag created**: `trial_checklist_enabled` in code with cohort routing. Can be toggled off instantly if Rule 1 triggered.
- [ ] **Single variable verified**: Only change in Treatment is the checklist card. No copy changes, no flow changes, no other UI modifications.
- [ ] **Audience size validated**: 200 monthly signups > 5% audience threshold. Dashboard can segment by `experiment_group`.
- [ ] **Stopping rule automation**: Set calendar reminders at day 7, 14, 21, 28 to check Analytics Engine query results and p-value.
- [ ] **Baseline data collected**: Confirm current activation rate = ~30% by reviewing pre-experiment signups for 7–14 days (if available).
- [ ] **Mobile tested**: Checklist responsive at 375px (iPhone SE). Touch targets 44px. Read through with screen reader.
- [ ] **Accessibility audit**: axe-core on treatment variant, 0 violations. Contrast ≥ 4.5:1 on all text.
- [ ] **Results template prepared**: `docs/EXPERIMENTS/2026-04-24-trial-activation-checklist-RESULTS.md` ready to populate after test closes.

---

## Do Not

- **Do not** run without tracking plan. Unknown which events = enrolled vs. converted → uninterpretable results.
- **Do not** declare winner before statistical significance (p < 0.05). "Better" visually does not mean real.
- **Do not** mix multiple changes. If you also change the onboarding copy or create flow in Treatment → confounded test.
- **Do not** run forever. Set Rule 5 hard stop at 42 days regardless. Velocity beats perfection.
- **Do not** cherry-pick metrics. Primary KPI is activation rate. If checklist improves secondary KPI but hurts primary → it failed.
- **Do not** segment at <5% audience (200 signups is ~5% of assumed 4,000/month DAU on free tier). Below that, noise dominates signal.

---

## Results (to be filled after 28 days)

### Timeline

**Experiment start**: 2026-04-24  
**Planned evaluation date**: 2026-05-22 (28 days)  
**Early checkpoint (optional)**: 2026-05-08 (14 days)

### Primary KPI Result

**Activation rate (signup → first_session_started within 7 days)**

- **Control rate**: [TO BE FILLED] %
- **Treatment rate**: [TO BE FILLED] %
- **Absolute uplift**: [TO BE FILLED] pp
- **Relative uplift**: [TO BE FILLED] %
- **95% CI on difference**: [TO BE FILLED]
- **p-value**: [TO BE FILLED]
- **Statistical significance**: [PASS / FAIL]

### Secondary KPI Results

- **Time-to-first-session**: Control [X days] vs. Treatment [Y days] — [No regression / Regression observed]
- **Bounce rate**: Control [X%] vs. Treatment [Y%] — [No regression / Regression observed]
- **Session creation rate**: Control [X%] vs. Treatment [Y%] — [Positive / Neutral / Negative]
- **Pro conversion within 7 days**: Control [X%] vs. Treatment [Y%] — [Positive / Neutral / Negative]

### Conclusion

[Choose one]

**✓ WIN**: Treatment activation rate significantly higher. Roll out to 100% of signups.

**✗ LOSS**: No significant improvement. Revert to control, iterate on checklist UX.

**? INCONCLUSIVE**: Effect size suggests possible signal but not statistically significant. Extend to 42 days or bundle into next cohort for meta-analysis.

### Key Learnings

[What surprised you? What user behavior did the checklist reveal? What should we test next?]

Example: "Checklist helped with session creation (95% vs. 87%) but 30% of users who created sessions still didn't go live. Next test: 'Go live' prompt immediately after question add."

---

## What We Learned (Post-Experiment)

[To be filled after results are in. Questions to answer:]

1. **Did the checklist match user mental model?** (Check event sequence in `checklist_step_completed`)
2. **Where did users drop off?** (Activation loss: creation vs. going live? Add question vs. going live?)
3. **Did the checklist add friction?** (Check bounce rate and time-to-first-session)
4. **Next hypothesis**: Based on learnings, what should we test next?

Example learnings that could follow:
- "Checklist reduced time-to-first-session by 2 days. Users appreciated the clear sequence."
- "90% of treatment completed step 1 but only 60% completed step 3 (Go live). Copy on step 3 was too vague."
- "Mobile users bounced more on treatment. Checklist layout issues at 375px width."

---

## Appendix: Event Schema Examples

### signup event (sent during auth.ts:sendEmail → JWT generation)

```json
{
  "timestamp": "2026-04-24T14:35:12Z",
  "event_name": "signup",
  "user_id": "hashed-user-id-abc123",
  "email_domain": "company.com",
  "experiment_group": "treatment",
  "plan": "free",
  "country_code": "US"
}
```

### first_session_started event (sent when SessionRoom DO transitions DRAFT → LIVE)

```json
{
  "timestamp": "2026-04-24T14:42:18Z",
  "event_name": "first_session_started",
  "user_id": "hashed-user-id-abc123",
  "session_id": "session-xyz789",
  "experiment_group": "treatment",
  "time_to_first_session_days": 0.1,
  "participant_count_at_start": 1,
  "session_type": "poll"
}
```

### checklist_step_completed event (Treatment only, sent from Dashboard component)

```json
{
  "timestamp": "2026-04-24T14:37:45Z",
  "event_name": "checklist_step_completed",
  "user_id": "hashed-user-id-abc123",
  "step": 1,
  "step_name": "create_session",
  "time_to_completion_seconds": 120
}
```

---

## Review Checklist

Before launch:

- [ ] Hypothesis is specific, not a hope
- [ ] Control and Treatment differ by exactly one variable
- [ ] Sample size calculation shown (N=1,470 per cohort)
- [ ] Duration and traffic split realistic (28 days, 200 signups)
- [ ] Tracking plan identifies enrollment and conversion events
- [ ] Stopping rules are specific (p-values, thresholds, calendar dates)
- [ ] All "Do Not" items checked and acknowledged
- [ ] Audience size > 5% (confirmed: 200 signups > ~5% of 4k/month assumed DAU)
- [ ] Results and learnings templates ready (empty, to be filled)
- [ ] Stakeholders briefed: PO, Design, Analytics, Frontend
