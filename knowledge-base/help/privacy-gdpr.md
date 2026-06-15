---
id: privacy-gdpr
title: Privacy, GDPR, and Data Rights
topic: faq
scope: free
excerpt: How Qesto handles personal data, GDPR compliance, consent, retention, and your rights as host or participant.
---

# Privacy, GDPR, and Data Rights

## Who Is the Data Controller?

| Data | Controller |
|------|------------|
| Your Qesto account (email, billing) | Qesto |
| Session responses and votes | **Session host** (Qesto is the processor) |
| Team workspace metadata | Team owner / organization |

Participants exercising rights over votes in a session should contact the **host** first. Account holders contact **Qesto** at support@qesto.cc.

## What We Collect

### Hosts

- Email, name, authentication logs
- Sessions, questions, configuration
- Billing information (processed by Stripe — Qesto does not store full card numbers)

### Participants

- Display name (if not anonymous)
- Responses and votes
- Optional GDPR consent record (timestamped)
- Technical metadata (connection events, no advertising trackers)

## GDPR Consent for Participants

When a host runs a **named** or partially identified session, participants may see:

> I agree to the processing of my name for analytics purposes. Data is stored for a maximum of 30 days and then deleted.

Consent is logged with a timestamp for audit (Chorus plan audit log). Hosts running sensitive surveys should use **anonymous** or **zero-knowledge** modes.

## Encryption and Hosting

- All traffic uses **HTTPS** (encrypted in transit)
- Data encrypted at rest on Cloudflare infrastructure
- Global edge network — data may be processed in multiple regions; GDPR and CCPA compliant processing

## Data Retention

| Data type | Default retention |
|-----------|-------------------|
| Closed session responses | 1 year (host can delete earlier) |
| Identified participant names (with consent) | Up to 30 days for analytics, then deleted |
| Account data | Until account deletion requested |
| Audit logs (Chorus) | Per team compliance settings |

Export important results before deletion (CSV on Signal+).

## Your Rights (GDPR / CCPA)

You can request:

- **Access** — copy of your personal data
- **Correction** — fix inaccurate account data
- **Deletion** — erase your account or specific responses
- **Export** — machine-readable copy (CSV for session results)
- **Objection** — restrict certain processing

### How to request

- **Account holders:** email support@qesto.cc from your registered address
- **Participants:** contact the session host; they can erase respondent data from their session
- **Team admins:** use audit log and session management tools; contact support for bulk erasure

We respond within 30 days for verified requests.

## Anonymity Modes

| Mode | Best for |
|------|----------|
| Not anonymous | Internal team transparency |
| Partial | Balance of attribution and privacy |
| Zero-knowledge | Sensitive HR, leadership feedback |

Anonymous modes do not attach names to responses in host exports or insights.

## AI and Personal Data

- AI insights cluster **response text**, not identities, in anonymous sessions
- AI question generation does not train public models on your content
- All AI runs on Cloudflare Workers AI within our infrastructure

## Cookies and Tracking

Qesto uses essential cookies for authentication and session state. We do not use third-party advertising trackers.

See the full [Privacy Policy](https://qesto.cc/privacy) and [Terms](https://qesto.cc/terms) on our website.

## Security Incidents

If you suspect unauthorized access to your account:

1. Sign out all sessions and reset your password
2. Email security@qesto.cc immediately
3. Review team member list for unexpected invites

## Questions?

**Q: Can I run Qesto in the EU for GDPR?**
A: Yes. Qesto is designed for GDPR compliance; hosts remain controllers for session content.

**Q: Does Qesto sell participant data?**
A: No. We never sell personal data.

**Q: How do I delete all data for one participant?**
A: Hosts with appropriate permissions can erase respondent data from a session; contact support for assistance.

**Q: Where is my data stored?**
A: Cloudflare's global network. Specific region pinning for enterprise — contact sales@qesto.cc.
