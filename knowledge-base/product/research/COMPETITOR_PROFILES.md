# Competitive Profiles

Detailed analysis of Qesto's core competitors. Updated quarterly or on-demand after major releases.

---

## Mentimeter

**Overall Assessment**: Leader in brand awareness and slide integration. Primary competitive threat due to market position and feature breadth.

### Recent Activity (Last 3 Months)

*To be updated by market research agent*

### Core Features

| Feature | Availability | Notes |
|---------|--------------|-------|
| Real-time polls | Yes | |
| Slide integration | Yes | Native PowerPoint/Google Slides |
| AI-powered insights | Yes (beta) | Recap, synthesis features |
| Anonymity modes | Yes | |
| Multi-language support | Yes (20+ languages) | |
| SSO/Enterprise auth | Yes (Enterprise only) | SAML |
| Export/Analytics | Yes | CSV, PDF, API access |
| Durable Objects | No | Traditional backend |
| Edge-native | No | Cloud-hosted |

### Pricing Model

- **Free**: Limited features, 5 sessions/month, 30 participants
- **Pro**: $10/month, 100 participants, analytics
- **Enterprise**: Custom pricing, SSO, dedicated support

**Value metric**: Per-user/month (subscription-based)

### Positioning Statement

"Real-time audience engagement for presentations and events"

### Strengths (Why customers choose them)

1. **Brand awareness**: Widely known, often first choice
2. **Slide integration**: Seamless PowerPoint/Slides experience
3. **Enterprise features**: SSO, audit logs, advanced analytics
4. **Market momentum**: Established, trusted by large organizations

### Weaknesses (Why customers switch away)

1. **Privacy concerns**: Data stored in cloud (not edge)
2. **Per-seat pricing**: Expensive at scale compared to per-session
3. **Cold start latency**: Traditional backend, not edge-native
4. **GDPR perception**: Less transparent about data handling
5. **AI limitations**: Recent AI features feel bolted-on, not core

### Qesto Differentiation

- **Privacy-first**: Anonymity by default, edge-native data handling
- **Performance**: No cold starts, sub-100ms responses
- **Fair pricing**: Per-session not per-seat; cheaper at scale
- **AI integration**: AI is foundational, not an add-on
- **Edge advantage**: Runs on Cloudflare Workers, not cloud VMs

### Vulnerability Signals

*To be populated as customer feedback arrives*

---

## Slido

**Overall Assessment**: Strong in enterprise/Cisco ecosystem. Growing AI and analytics capabilities.

### Recent Activity (Last 3 Months)

*To be updated by market research agent*

### Core Features

| Feature | Availability | Notes |
|---------|--------------|-------|
| Real-time polls | Yes | |
| AI-powered recaps | Yes (recently launched) | |
| Anonymity modes | Yes | |
| Multi-language support | Yes (25+ languages) | |
| SSO/Enterprise auth | Yes (all tiers) | Cisco ecosystem |
| Q&A moderation | Yes | |
| Voting/ranking | Yes | |
| Integrations | Yes | Salesforce, Adobe, etc. |
| Export | Yes | Multiple formats |

### Pricing Model

- **Free**: Limited features
- **Premium**: Per-event pricing
- **Enterprise**: Custom, volume discounts

**Value metric**: Per-event or per-session

### Positioning Statement

"The #1 engagement platform for large-scale events and enterprise communications"

### Strengths

1. **Enterprise reach**: Cisco ecosystem, widely deployed in Fortune 500
2. **Event optimization**: Designed for large conferences, webinars
3. **AI adoption**: Recent AI features gaining traction
4. **Integration breadth**: Salesforce, Adobe, Cisco stack
5. **Moderation tools**: Q&A management, filtering

### Weaknesses

1. **Lock-in concerns**: Cisco ecosystem creates switching costs but also friction
2. **Privacy perception**: Enterprise-focused (less transparent on GDPR)
3. **Complexity**: Many features can overwhelm smaller teams
4. **Pricing opacity**: Enterprise deals not transparent

### Qesto Differentiation

- **Simplicity**: Focused feature set vs. bloated feature matrix
- **GDPR-native**: Clear privacy commitment vs. enterprise complexity
- **No lock-in**: Open, portable, not tied to ecosystem
- **Edge performance**: Sub-100ms vs. enterprise cloud latency

---

## Vevox

**Overall Assessment**: Leader in the anonymous employee-voice / HR-feedback segment. Rated #1 on G2, Capterra, and Trustpilot for anonymity-driven engagement (per market pulse, May 2026). The most direct competitive threat on Qesto's core privacy positioning — Vevox owns the "anonymous feedback" narrative today, but on a traditional cloud backend without zero-knowledge guarantees.

### Recent Activity (Last 3 Months)

- Mentimeter reported losing ground on anonymous engagement to Vevox (market pulse, May 2026).
- Sustained #1 rating across G2/Capterra/Trustpilot driven by anonymity and HR/employee-sentiment use cases.

### Core Features

| Feature | Availability | Notes |
|---------|--------------|-------|
| Real-time polls | Yes | Polls, quizzes, surveys |
| Anonymous Q&A | Yes | Core strength; positioned as fully anonymous |
| Q&A moderation | Yes | Pre-moderation, filtering, upvoting |
| Anonymous live discussion | Yes | Discussion boards / open text, anonymous mode |
| Employee-voice / pulse analytics | Yes | Sentiment dashboards for HR/leadership |
| Anonymity modes | Yes (marquee feature) | Anonymity is the brand promise |
| Multi-language support | Yes | |
| SSO/Enterprise auth | Yes | SAML/SSO for enterprise tiers |
| Export/Analytics | Yes | CSV/PDF, sentiment reporting |
| Zero-knowledge anonymity | No | Anonymity is policy/config-based, not cryptographic |
| Durable Objects | No | Traditional cloud backend |
| Edge-native | No | Cloud-hosted (not edge) |

### Pricing Model

- **Free/Starter**: Limited features, capped participants
- **Professional / Business**: Subscription tiers, per-host/per-plan
- **Enterprise**: Custom pricing, SSO, dedicated support, advanced analytics

**Value metric**: Per-host/subscription (qualitative — exact public tiers vary; treat as posture, not quoted figures)

### Positioning Statement

"Anonymous polling, surveys, and Q&A that give every employee a voice"

### Strengths (Why customers choose them)

1. **Anonymity reputation**: #1 across G2/Capterra/Trustpilot for anonymous engagement — owns the narrative
2. **HR / employee-voice fit**: Purpose-built for pulse surveys, psychological safety, leadership listening
3. **Anonymous Q&A + moderation**: Mature moderation (pre-moderation, filtering, upvoting) trusted for sensitive all-hands
4. **Sentiment analytics**: Dashboards aimed at leadership/HR decision-making
5. **Switching momentum**: Actively winning anonymity-sensitive customers away from Mentimeter

### Weaknesses (Why customers switch away)

1. **Anonymity is trust-based, not provable**: Anonymity is a configuration/policy promise on a conventional backend — no cryptographic, zero-knowledge guarantee that the operator cannot re-identify participants
2. **Cloud backend**: No edge-native delivery; cold-start and regional-latency exposure for global audiences
3. **Scaling limits**: Strong at typical corporate sizes but not positioned for very-large (10,000+) real-time anonymous audiences
4. **Third-party AI / data-egress exposure**: Analytics/sentiment pipelines risk participant data leaving the trust boundary (no first-party edge-AI guarantee)
5. **Single-segment gravity**: Deep in HR/employee-voice; weaker on multi-tenant team federation and cross-segment facilitation

### Qesto Differentiation

- **Zero-knowledge anonymity moat**: Qesto's ANON-DEPTH work makes anonymity cryptographically provable, not just a policy toggle — the operator cannot re-identify participants. This is the structural answer to Vevox's trust-based anonymity.
- **No third-party AI egress**: Insights run on Workers AI inside the trust boundary; participant data never leaves to an external LLM — a cleaner privacy story than cloud sentiment pipelines.
- **Edge performance**: No cold starts, sub-100ms global responses vs. Vevox's cloud backend.
- **Scale for anonymous audiences**: Edge + Durable Objects target 10,000+ real-time anonymous participants where Vevox hits practical limits.
- **Multi-tenant federation (CONNECT)**: Team/role federation across tenants vs. Vevox's single-org orientation.
- **Data residency posture**: Edge-native + GDPR-by-default data handling vs. conventional cloud storage.

### Vulnerability Signals

- Any Vevox customer review citing doubt that "anonymous really means anonymous" is a direct opening for Qesto's zero-knowledge proof point.
- Requests for larger anonymous audiences or global low-latency are scale/edge wins for Qesto.
- HR buyers asking where sentiment/AI processing happens favor Qesto's no-egress Workers-AI story.

---

## Kahoot!

**Overall Assessment**: Strong in K-12 education and gamification. Weak in serious facilitation and enterprise.

### Recent Activity (Last 3 Months)

*To be updated by market research agent*

### Core Features

| Feature | Availability | Notes |
|---------|--------------|-------|
| Real-time quizzes | Yes | Gamified |
| Leaderboards | Yes | Competitive scoring |
| Custom themes | Yes | |
| Mobile-first UX | Yes | Phone participation |
| Multi-language support | Yes (multiple languages) | |
| Analytics | Yes | Score tracking |
| AI features | Limited | Recent additions |
| Enterprise SSO | Yes (Enterprise only) | |

### Positioning Statement

"Learning games that engage, excite, and empower"

### Strengths

1. **Education market**: Deep roots in K-12 (teachers love it)
2. **Gamification**: Built-in competition and fun
3. **Mobile UX**: Intuitive phone-based participation
4. **Brand**: Well-known in schools

### Weaknesses

1. **Not for serious facilitation**: Gamified approach feels juvenile for corporate trainers/HR
2. **Enterprise penetration**: Limited enterprise customer base
3. **Facilitation features**: Weak Q&A, limited anonymity
4. **Corporate perception**: Seen as "fun but not serious"

### Qesto Differentiation

- **Serious facilitation**: Built for professionals, not just education
- **Team workflows**: Multi-team management vs. single-event focus
- **Enterprise features**: SSO, audit logs built-in
- **Anonymity focus**: Privacy-first vs. fun-first

---

## Poll Everywhere

**Overall Assessment**: Incumbent in US education. Legacy technology, declining market share.

### Recent Activity (Last 3 Months)

*To be updated by market research agent*

### Core Features

| Feature | Availability | Notes |
|---------|--------------|-------|
| Real-time polls | Yes | SMS-based roots |
| SMS participation | Yes (legacy) | |
| Web/app participation | Yes | Modern interface |
| Analytics | Yes | Basic |
| Integrations | Yes | LMS (Canvas, Blackboard) |
| Mobile app | Yes | Web-first now |

### Positioning Statement

"Classroom engagement platform for educators"

### Strengths

1. **Education legacy**: Long-standing relationships with universities
2. **LMS integration**: Canvas, Blackboard integrations
3. **Institutional lock-in**: Departments standardized on it (switching costs)

### Weaknesses

1. **Aging technology**: Legacy SMS roots, not modern
2. **Weak enterprise**: Limited corporate/non-education use
3. **UX debt**: Interface feels dated vs. Mentimeter, Slido
4. **No AI**: No AI/ML features
5. **Limited expansion**: Confined to education, not growing into enterprise

### Qesto Differentiation

- **Modern UX**: Mobile-first, edge-native vs. legacy
- **Cross-segment**: Works for facilitators, trainers, HR (not just education)
- **AI-powered**: Built-in insights vs. basic analytics
- **Performance**: Sub-100ms edge response vs. cloud-based latency

---

## Competitive Landscape Summary

| Dimension | Mentimeter | Slido | Vevox | Kahoot! | Poll Everywhere | **Qesto** |
|-----------|-----------|-------|-------|---------|-----------------|-----------|
| Brand awareness | **Leader** | Strong | Moderate | Strong | Weak | Growing |
| Enterprise features | Strong | **Leader** | Strong | Moderate | Weak | Strong |
| Privacy/GDPR | Moderate | Moderate | Strong | Weak | Weak | **Leader** |
| Zero-knowledge anonymity | No | No | No | No | No | **Yes** |
| Edge performance | No | No | No | No | No | **Yes** |
| AI integration | Recent | Recent | Moderate | Weak | None | **Native** |
| No third-party AI egress | No | No | No | No | No | **Yes** |
| Multi-segment | Good | Good | HR/employee-voice | K-12 only | Education only | **Strong** |
| Price competitiveness | Moderate | Moderate | Moderate | Good | Good | **Best** |
| Anonymity focus | Moderate | Moderate | **Leader** | Weak | Weak | **Strong (ZK)** |

---

## Market Positioning Recommendations

### Qesto's Competitive Advantages (well-differentiated)
1. **Privacy-first + edge-native**: Only competitor with this combination
2. **Fair pricing model**: Per-session vs. per-seat advantage at scale
3. **AI is native**: Not bolted-on like Mentimeter/Slido
4. **No lock-in**: Open, portable vs. ecosystem (Slido/Cisco)

### Areas to Watch (competitors strengthening)
1. **AI-powered insights**: Mentimeter and Slido adding AI recap features
2. **Enterprise auth**: All major competitors now offer SSO
3. **Multi-language**: All competitors support 20+ languages
4. **Anonymity narrative**: Vevox owns the "anonymous feedback" reputation (#1 G2/Capterra/Trustpilot) — Qesto must lead with zero-knowledge anonymity to win this segment, not just claim "anonymous"

### Positioning Focus Areas (for marketing/PO)
- Lead with **privacy** and **edge performance** (unique to Qesto)
- Counter **Mentimeter** on price (per-session vs. per-seat savings)
- Counter **Slido** on simplicity and no lock-in
- Differentiate from **Kahoot!** on "serious facilitation"
- Counter **Vevox** on provable (zero-knowledge) anonymity, no third-party AI egress, edge scale, and multi-tenant federation — Vevox claims anonymity, Qesto can prove it
- Avoid competing with **Poll Everywhere** (education market, declining)

---

**Last updated**: June 2026 (Vevox profile added — MARKET-RESEARCH-VEVOX-01)  
**Next quarterly review**: August 2026  
**Data sources**: Competitor websites, G2/Capterra reviews, ProductHunt, Reddit discussions, LinkedIn posts
