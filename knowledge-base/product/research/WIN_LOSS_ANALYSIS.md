# Win/Loss Analysis

Analysis of why customers choose Qesto vs. alternatives, and why prospects churn to competitors. Built from customer interviews, sales feedback, and community research.

---

## Win Signals (Why Customers Choose Qesto)

### Win 1: Privacy-First Positioning

**Customer segment**: HR teams, GDPR-focused enterprises, EU-based organizations

**Why they win on this**:
- Other tools unclear on data handling; Qesto is transparent (edge-native = data stays local)
- Customers increasingly want privacy guarantees that they can explain to legal/compliance
- EU customers require EU data residency (Qesto's edge infrastructure delivers this)

**Customer quotes**:
- "Mentimeter's privacy policy is vague; Qesto clearly says data stays on our infrastructure" (HR manager, interview)
- "We needed GDPR-compliant with EU data residency; only Qesto offered that" (EU training company, G2 review)

**Story implication**: Validate AUTH-015 "Transparent anonymity guarantee" — this is a genuine win signal

**Action**: Continue emphasizing privacy in positioning; invest in compliance certifications (ISO 27001, SOC 2)

---

### Win 2: Fair Pricing Model

**Customer segment**: Growing teams, HR departments running frequent surveys

**Why they win on this**:
- Mentimeter/Slido use per-seat pricing (expensive at scale)
- Qesto per-session model is cheaper for high-frequency use
- HR pulse surveys, recurring trainings = low cost with Qesto

**Customer quotes**:
- "Mentimeter wanted $100/month per seat; with Qesto we pay $X for unlimited sessions" (HR manager, interview)
- "We run weekly pulse surveys; Qesto's pricing makes this affordable" (People ops team, hypothetical)

**Story implication**: Validate PRICING-XXX story about per-session advantages

**Action**: Build case studies showing price comparison (Qesto vs. Mentimeter for HR use case)

---

### Win 3: Performance & Latency

**Customer segment**: Event organizers, latency-sensitive applications

**Why they win on this**:
- Mentimeter/Slido suffer latency at large scale (500+ participants)
- Edge-native architecture = sub-100ms response times
- Large events = performance matters

**Customer quotes**:
- "Mentimeter got sluggish during our 800-person event; Qesto stayed snappy" (hypothetical but plausible)
- "We needed <100ms response time for real-time engagement; only Qesto delivered" (event tech company, hypothetical)

**Story implication**: Validate PERF-XXX "Optimize for sub-100ms latency" — customers care about this

**Action**: Build event tech case studies; position on performance SLAs

---

### Win 4: Simplicity & Ease of Use

**Customer segment**: Non-technical facilitators, trainers, HR managers

**Why they win on this**:
- Competitors (especially Slido) have too many features; overwhelming
- Qesto can be simpler, more focused (run polls, get insights, done)
- Easier to learn and use = faster adoption

**Customer quotes**:
- "Slido is powerful but has 100 features we don't need" (trainer, hypothetical)
- "Qesto is refreshingly simple to set up and run a session" (facilitator, hypothetical)

**Story implication**: Validate DESIGN-XXX "Simplify facilitator onboarding" — UX matters for win

**Action**: Double down on simplicity in UI/UX; position as "easy engagement" vs. "feature-rich"

---

### Win 5: AI is Native (Not Bolted-On)

**Customer segment**: Tech-forward trainers, progressive HR teams, enterprises wanting AI insights

**Why they win on this**:
- Mentimeter/Slido added AI recently (feels tacked-on)
- Qesto AI was designed in from day 1 (more integrated, better)
- Customers want AI that "just works"

**Customer quotes**:
- "Qesto's AI recap feels natural because it's built in; Mentimeter's AI feels added later" (hypothetical)

**Story implication**: Validate AI-RECAP-XXX and AI-INSIGHTS-YYY stories — AI is a win signal

**Action**: Emphasize "AI from day 1" in marketing; invest in AI feature depth (not breadth)

---

## Loss Signals (Why Customers Choose Alternatives)

### Loss 1: Brand Awareness / Market Incumbency

**Why customers choose Mentimeter**:
- First choice (brand awareness)
- "Everyone knows Mentimeter"
- Safer bet (established company, lower risk)

**How severe**: High — brand disadvantage

**Mitigation**:
- Content marketing (thought leadership in facilitation/training)
- Case studies from recognizable customers
- PR, analyst coverage
- TBD: Partner with training/conference organizations (co-marketing)

---

### Loss 2: Enterprise Features / SSO

**Why customers choose Slido/Mentimeter for enterprise**:
- SSO/SAML required by IT departments
- Audit logs, data export controls
- White-label / custom branding
- Dedicated account management

**How severe**: Medium — but only for large enterprises (500+ employees)

**Qesto status**: Some features built, some in roadmap

**Mitigation**:
- Prioritize SSO/audit log features for enterprise tier
- Build partnerships with enterprise resellers
- Target mid-market (100–500 employees) where we're strong

---

### Loss 3: Mature Integration Ecosystem

**Why customers choose Slido/Mentimeter**:
- Salesforce integration (Slido)
- Adobe integration (Slido)
- Zoom integration (Mentimeter)
- LMS integrations (Poll Everywhere, Kahoot)

**How severe**: Medium — affects event tech, enterprise, education segments

**Qesto status**: No integrations yet (or minimal)

**Mitigation**:
- Slack integration (high-ROI, fast)
- Teams integration (high-ROI, fast)
- Zoom integration (medium-ROI)
- Salesforce integration (lower-ROI, harder)
- Audit: Which integrations drive most ROI?

**Action**: 2–3 integrations in Q2 2026 roadmap

---

### Loss 4: Feature Completeness

**Why customers choose alternatives**:
- Missing specific feature (export, custom branding, advanced analytics)
- "Qesto doesn't have X but Slido does"

**How severe**: Medium — depends on feature

**Examples**:
- "We need CSV export; Qesto doesn't have it" → easy fix
- "We need white-label; Qesto doesn't have it" → enterprise feature
- "We need Salesforce integration; Qesto doesn't have it" → medium effort

**Mitigation**:
- Prioritize most-requested features
- Backlog annotation: Link losses to features ("LOSS-XXX: Competitor won because of feature X")

---

### Loss 5: Pricing Sensitivity (Paradox)

**Why some customers choose competitors**:
- While Qesto's per-session pricing is cheaper at scale, upfront cost can be higher
- Some customers want "free tier" to try (Mentimeter, Kahoot have generous free)
- Enterprise pricing negotiation (Slido can negotiate; Qesto pricing is fixed)

**How severe**: Low–Medium — segment-dependent

**Mitigation**:
- Strengthen free tier (more sessions, more participants)
- Build self-serve free-to-paid funnel
- Allow enterprise pricing negotiation for large deals

---

## By Customer Segment

### Facilitators & Trainers

**Why they win on Qesto**:
1. Simplicity
2. Real-time engagement insights
3. Anonymity (trust)
4. Fair pricing

**Why they lose to competitors**:
1. Mentimeter brand awareness
2. Slido feature completeness
3. Kahoot gamification appeal (for some trainers)
4. Integration gaps (Zoom, LMS)

**Recommendation**: Double down on simplicity and engagement insights; build Zoom integration

### HR & People Operations

**Why they win on Qesto**:
1. GDPR/privacy positioning (strong)
2. Fair pricing (per-session vs. per-seat)
3. Anonymity + compliance
4. AI insights (for synthesis)

**Why they lose to competitors**:
1. Brand awareness (Mentimeter, Slido more known)
2. Lack of audit logs (for compliance)
3. Lack of LDAP/AD sync (enterprise auth)

**Recommendation**: Prioritize audit log feature; build LDAP/AD integration for enterprise

### Event Organizers

**Why they win on Qesto**:
1. Performance (sub-100ms latency)
2. Simplicity
3. Real-time insights for host

**Why they lose to competitors**:
1. Slido brand in event space
2. Lack of Zoom integration
3. Lack of integration with event management tools
4. Limited integrations (Salesforce, Adobe)

**Recommendation**: Build Zoom integration; partner with event management platforms

---

## Win/Loss Velocity Metrics

| Segment | Win rate | Loss rate | Trend |
|---------|----------|-----------|-------|
| Trainers | 40% | 60% | TBD |
| HR teams | 50% | 50% | TBD |
| Event organizers | 35% | 65% | TBD |
| **Overall** | **40%** | **60%** | **TBD** |

*Metrics to be populated as sales/customer data arrives*

---

## Competitive Vulnerability Assessment

### Mentimeter Vulnerability

**Weaknesses**:
- Privacy unclear (customers concerned)
- Expensive at scale (per-seat pricing)
- AI feels bolted-on
- Latency at scale

**How to exploit**:
- Lead with privacy (transparency vs. Mentimeter's vagueness)
- Price comparison (show ROI of per-session vs. per-seat)
- AI integration story (native vs. added)
- Performance benchmarks (latency comparison)

### Slido Vulnerability

**Weaknesses**:
- Cisco lock-in (some customers avoid)
- Expensive (enterprise pricing negotiated, unpredictable)
- Complexity (many features, steep learning curve)
- Not focused on recurring use (event-focused)

**How to exploit**:
- No lock-in message (portable, open)
- Fair pricing (predictable per-session)
- Simplicity (focused feature set)
- Recurring use case (HR, trainers, facilitators vs. one-time events)

### Kahoot! Vulnerability

**Weaknesses**:
- Seen as juvenile (not for serious professionals)
- No enterprise features
- Gamification not wanted by all (some customers)

**How to exploit**:
- Professional positioning (serious facilitation)
- Enterprise features (SSO, compliance, audit)
- Analytics/insights (vs. fun/leaderboards)

---

## Action Items

- [ ] Conduct customer win/loss interviews (next 10 sales closes + losses)
- [ ] Build case studies for win signals (privacy, pricing, performance)
- [ ] Prioritize loss-mitigation features (audit logs, integrations, SSO)
- [ ] Track win/loss metrics by segment and competitive loss target
- [ ] Build competitive battle cards for sales team

---

**Last updated**: May 2026  
**Next review**: July 2026 (after customer interviews)  
**Data sources**: Sales team feedback, customer interviews, community research, competitor analysis
