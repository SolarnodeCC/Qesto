# Weekly Market Pulse

Quick digest of competitive activity, customer sentiment, and backlog recommendations. Published ~weekly for Product Owner.

**Latest integration:** Week of May 19, 2026 → [`MARKET_PULSE_INTEGRATION_2026-05-19.md`](./MARKET_PULSE_INTEGRATION_2026-05-19.md) (2026-05-25)

---

## Current Week

### Week of May 26, 2026

_Pending publication by Market Research Agent. After publish, PO runs [`MARKET_PULSE_TO_BACKLOG_WORKFLOW.md`](../MARKET_PULSE_TO_BACKLOG_WORKFLOW.md)._

#### Competitor Activity
- _(awaiting scan)_

#### Customer Sentiment This Week
- _(awaiting scan)_

#### Market Trend Update
- _(awaiting scan)_

#### Top Backlog Recommendations
- _(awaiting scan)_

#### Qesto Positioning Opportunity
- _(awaiting scan)_

---

## Template (Copy for each week)

```markdown
### Week of [Date]

#### Competitor Activity
- **[Competitor]**: [Activity] — [implication]

#### Customer Sentiment This Week
- **Top conversation**: *[theme]*
- Platform: [sources]
- Frequency: [N mentions]
- Quote: "[quote]"
- Insight: [implication]

#### Market Trend Update
- [Trend]: [direction] | Qesto action: [yes/no]

#### Top Backlog Recommendations
1. **[STORY-ID or theme]** — [signal] → [action]

#### Qesto Positioning Opportunity
[1–3 sentences]
```

---

## Historical Pulses

### Week of May 19, 2026

**Integrated:** 2026-05-25 → [`MARKET_PULSE_INTEGRATION_2026-05-19.md`](./MARKET_PULSE_INTEGRATION_2026-05-19.md)

#### Competitor Activity
- **Mentimeter**: No major releases announced; remains market leader for polling/webinars but faces GDPR scrutiny due to US-based infrastructure despite EU headquarters. Losing ground on anonymous engagement to Vevox.
- **Slido**: Dominant in enterprise Q&A at conferences; deeply integrated with Webex; strong analytics dashboard. Market share 12.92% in polls/quizzes. Q&A prioritization by popular vote is a key differentiator.
- **Kahoot!**: Google Slides two-way syncing integration active; focus remains on gamification and educational markets. Slido and Mentimeter considered better alternatives for enterprise audiences.
- **Poll Everywhere**: Facing significant scaling constraints (max 700 participants vs. competitors at 10,000+). Free plan capped at 25 responses. Market share declining; competitors like StreamAlive and Wooclap gaining traction with broader format support and higher capacity.

#### Customer Sentiment This Week (from G2, Capterra, Trustpilot, industry reviews)

**Top conversation**: *Anonymous employee engagement and psychological safety*
- Platform: G2, Capterra, Trustpilot, enterprise review sites
- Frequency: 60+ reviews monthly mentioning anonymity as primary driver
- Sentiment: Strongly Positive (Vevox rated #1 across all three platforms)
- Quote: "Vevox empowers employees and leaders by truly understanding their team's sentiment" (Vevox customer testimonial)
- Insight: **Vevox** has carved out leadership in anonymous feedback for HR/corporate; Mentimeter losing customers due to privacy concerns.

**Emerging pain point**: *Participant scaling & data sovereignty*
- Segment affected: Enterprise events, hybrid conferences, large webinars (500+ participants)
- Signal strength: **High** — consistent across all competitor comparison sites
- Implication: Poll Everywhere's 700-participant cap is a major churn driver. StreamAlive (10,000+) and AhaSlides gaining adoption. **Qesto advantage**: Workers AI runs on edge with no data egress; can market as the privacy-first, scalable alternative.

#### Market Trend Update
**AI Companion & Emotionally-Aware Engagement Market Explosion:**
- Global AI companion market projected to reach **$435.9B by 2034** (31.24% CAGR)
- **55% of users prefer emotionally aware interactions**; AI systems with empathy-driven engagement are differentiators
- Top AI investment priorities: personalized experiences (56%), customer satisfaction/loyalty/engagement (46%), automation (45%)
- **81% of organizations** increasing AI for customer experience (CX) investments YoY
- Challenge: Most organizations lack data quality and harmonized profiles to scale AI personalization
- **Qesto opportunity**: Real-time AI-powered sentiment analysis + insights generation using Workers AI, without third-party data exposure

#### Top Backlog Recommendations
1. **PARTICIPANT-SCALING-UNLIMITED** → integrated as **`SCALE-PROOF-01`** (S32)
2. **AI-INSIGHTS-SENTIMENT-ANALYSIS** → validates **`AI-SENTIMENT-01`** + **`ADR-0011`**
3. **GDPR-PRIVACY-COMPLIANCE-BADGE** → validates **`GDPR-TRUST-PAGE-01`**, **`GDPR-BADGE-01`**, **`ENT-RESIDENCY-01`**
4. **ANONYMOUS-MODE-EXPANSION** → **`ANON-DEPTH-01`** boosted to P0

#### Qesto Positioning Opportunity
**"Privacy-First, Real-Time, AI-Ready Engagement Platform"**

1. **Data Sovereignty**: Mentimeter/Slido/Kahoot rely on cloud; Qesto's Cloudflare Workers edge means 0 data egress, GDPR-native, faster response.
2. **Anonymous Feedback at Scale**: Vevox dominates anonymity but has scaling limits; Qesto can support 10,000+ anonymous participants with real-time insights.
3. **AI Insights Without the Data Risk**: Workers AI sentiment analysis as alternative to third-party participant data APIs.

**Immediate narrative**: "The engagement platform that respects your participants' privacy while making your insights smarter."

---

## How to Read This

- **For PO**: Quick 5-min scan → run [`MARKET_PULSE_TO_BACKLOG_WORKFLOW.md`](../MARKET_PULSE_TO_BACKLOG_WORKFLOW.md)
- **For Marketing**: Customer conversation themes + positioning angles
- **For Engineering**: Competitor feature activity to inform technical decisions

---

**Published by**: Market Research Agent  
**Frequency**: Weekly (typically Mondays)  
**Time to read**: 5 minutes
