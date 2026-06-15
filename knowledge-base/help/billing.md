---
id: billing
title: Pricing and Plans
topic: billing
scope: starter
excerpt: Understand Qesto's three subscription plans — Pulse, Signal, and Chorus — plus payment and plan management.
---

# Pricing and Plans

Qesto offers three subscription plans. Official names and limits are published at [qesto.cc/pricing](https://qesto.cc/pricing).

## Pulse

**€0 / host / month**

Perfect for trying Qesto:

- Up to 5 new sessions per month
- Up to 50 participants per session
- All question types
- 30-day retention
- Full and cohort anonymity modes
- Email support

**Great for:** Small teams, testing, getting started

## Signal

**€24 / host / month billed annually** (€29 month-to-month)

For facilitators running recurring rooms:

- Everything in Pulse, plus:
- Up to 50 new sessions per month
- Up to 500 participants per session
- 365-day retention
- CSV export of results
- Identified mode + consent logs
- Custom branding
- Priority email support

**Great for:** Departments, mid-size teams, regular facilitators

## Chorus

**Custom annual contract** — talk to us

For HR, events, and compliance-heavy rollouts:

- Everything in Signal, plus:
- Up to 500 new sessions per month
- Up to 5,000 participants per session
- AI-powered insights and evidence-anchored clusters
- SAML SSO and advanced auth
- Townhall Q&A board
- Cross-session intelligence
- Embed widgets, live captions, and webhooks
- Dedicated onboarding + SLA

**Great for:** Large organizations, multiple workspaces, complex workflows

## Feature Comparison

| Feature | Pulse | Signal | Chorus |
|---------|-------|--------|--------|
| New sessions / month | 5 | 50 | 500 |
| Participants / session | 50 | 500 | 5,000 |
| Retention | 30 days | 365 days | Custom |
| AI Insights | — | — | ✓ |
| CSV Export | — | ✓ | ✓ |
| SAML SSO | — | — | ✓ |
| Webhooks | — | — | ✓ |
| Support | Email | Priority Email | Dedicated |

Numeric limits hydrate from the same source as in-app enforcement (`PLAN_QUOTAS` via `GET /api/plans/catalog`).

## Billing

- **Monthly**: Bill every month, cancel anytime
- **Annual**: Save on Signal when billed annually, auto-renew yearly
- **No setup fees**: Start immediately
- **No lock-in**: Cancel anytime; prorated adjustments on plan changes

## Upgrade/Downgrade

1. Go to Settings → Billing
2. Click "Change Plan"
3. Choose your new plan (Signal or Chorus)
4. Changes take effect immediately
5. Prorated adjustments on your next invoice

Ready to upgrade? Visit [qesto.cc/pricing](https://qesto.cc/pricing)

---

## Payment Methods and Invoicing

### Accepted Payment Methods

#### Credit/Debit Cards
- Visa
- Mastercard
- American Express
- Discover

Secure processing via Stripe. Your card info is encrypted and never stored on our servers.

## Setting Up Billing

1. Go to Settings → Billing
2. Click "Add Payment Method"
3. Enter card details
4. Save

Your payment method is stored securely and used for future renewals.

## Invoices & Receipts

### Viewing Invoices

1. Settings → Billing → "Invoices"
2. View, download, or email invoices
3. Invoices sent automatically to billing email

### Invoice Details

- Invoice number
- Billing period
- Amount charged
- Payment date
- Item breakdown (plan + prorations)

## Billing Email

Change the email where invoices are sent:

1. Settings → Account
2. Update "Billing Email"
3. Save

Invoices are sent to this email automatically.

## Refund Policy

- **Monthly plans**: Refunds only if payment processing errors. Otherwise, no refunds (but cancel anytime).
- **Annual plans**: Prorated refunds if you downgrade or cancel within 30 days of purchase.
- **Disputes**: Contact support@qesto.cc within 30 days

## Failed Payments

If your card declines:

1. We'll notify you via email
2. You have 5 days to update your payment method
3. We'll retry automatically
4. After 5 days, your plan downgrades to Pulse

**To fix:** Settings → Billing → Update payment method

## Tax

- US: Sales tax calculated based on your state
- EU: VAT applied (reverse charge for B2B)
- International: VAT/GST varies by country
- Non-profit: Email support for discount (Chorus at 40% off for registered nonprofits and accredited educational institutions)

**Q: Do you offer nonprofit or education discounts?**
A: Yes — registered nonprofits and accredited educational institutions get Chorus at 40% off. Apply via the pricing page or email support@qesto.cc.

**Q: Can I get a VAT invoice for my company?**
A: Yes. EU B2B customers may use reverse charge. Invoices include tax details — download from Settings → Billing → Invoices.

**Q: What happens to my sessions if payment fails?**
A: After 5 days with a declined card, your plan downgrades to Pulse. Sessions and data are preserved; new sessions are limited to Pulse quotas.

**Q: Can I switch from monthly to annual billing?**
A: Yes. Settings → Billing → Change Plan → select annual. Prorated credit applies to the switch.

## Questions?

Email billing@qesto.cc with:
- Your account email
- Issue description
- Invoice number (if relevant)

We'll respond within 24 hours.

---

## Upgrading and Downgrading Your Plan

### Upgrading Your Plan

Want more features or participants?

#### Steps

1. Go to Settings → Billing
2. Click "Change Plan"
3. Select your new plan (Signal or Chorus)
4. Choose billing period (Monthly or Annual)
5. Review the charge
6. Click "Upgrade"

#### What Happens

- **Immediate activation**: New features available right away
- **Prorated charge**: You're charged the difference for the remainder of the current billing cycle
- **Next renewal**: Full price for new plan

**Example**: Upgrade from Pulse to Signal mid-month
- Pulse: €0
- Signal: €29/month
- Days remaining: 15
- Charge: ~€14.50 (prorated)
- Next month: Full €29 charge

### Downgrading Your Plan

Need fewer features?

#### Steps

1. Settings → Billing → "Change Plan"
2. Select your new plan (Pulse or Signal)
3. Review the change
4. Click "Downgrade"

#### What Happens

- **Prorated credit**: Unused portion credited to your account
- **Features limited**: Access to downgraded plan features immediately
- **Active sessions**: Unaffected (you keep current sessions)
- **Next renewal**: New plan price

**Example**: Downgrade from Signal to Pulse mid-month
- Signal: €29/month
- Days remaining: 15
- Credit: ~€14.50 (prorated)
- Next month: Pulse (€0)

## Timing Matters

**Best time to change plans**: Right after your renewal date (less proration)

**Can I change plans multiple times?** Yes, but note that frequent changes may incur small prorations.

## What About My Data?

Downgrading doesn't delete your data:

- **Sessions**: All sessions preserved
- **Response data**: Stays in your account
- **Limits apply**: Pulse has lower session and participant limits per new session
- **Export first**: If worried, export CSV from Signal before downgrading

## Annual Plans

Special rules for annual billing:

- **Prorated refund**: If you downgrade within 30 days of purchase
- **No refund**: After 30 days; instead, pay monthly on downgraded plan next year
- **Upgrade**: Always prorated, new plan takes effect immediately

## Need Help?

Unsure about the right plan? Email support@qesto.cc—we can help you choose!
