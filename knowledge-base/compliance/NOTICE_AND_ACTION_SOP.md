# Notice and Action — Standard Operating Procedure

**Regulation:** Art. 16, Regulation (EU) 2022/2065 (Digital Services Act)  
**Maintained by:** Legal / Trust & Safety  
**Effective:** 2026-06-30  
**Review cycle:** Annual or after receiving the first formal notice

---

## 1. Purpose

This SOP describes how Qesto processes notices of alleged illegal content submitted via the Art. 16 notice and action mechanism at `qesto.cc/legal/report`. It applies to all team members who handle incoming content reports.

---

## 2. Reporting channel

Any person or entity may submit a notice of alleged illegal content at:

- **Web form:** `https://qesto.cc/legal/report`
- **Email:** `abuse@qesto.cc`

The web form collects:
- Location of the alleged illegal content (session ID, URL, or description)
- Nature of the alleged illegality (from a structured list)
- Notifier's email address
- Optional free-text description

Every submission generates a reference ID in the format `NaA-{timestamp}-{random}` and triggers an acknowledgement email to the notifier within minutes.

---

## 3. Intake and triage (Day 0–1)

1. **Acknowledge receipt.** The system sends an automated acknowledgement. If the notifier contacted `abuse@qesto.cc` directly (bypassing the form), send a manual acknowledgement within 24 hours.
2. **Log the notice.** Record in the compliance incident register: reference ID, receipt date, reported content location, nature of allegation, notifier contact.
3. **Initial triage.** Assess the notice:
   - Is the content location valid and accessible?
   - Does the described illegality appear prima facie plausible?
   - Is this a duplicate of a prior notice?

---

## 4. Review (Day 1–5)

4. **Identify the relevant content.** Locate the session, response, or data in question.
5. **Assess the allegation.** Evaluate whether the content is:
   - **Clearly illegal** under EU or Dutch law (e.g., CSAM, hate speech under Art. 137c Sr, serious threat to safety)
   - **Plausibly illegal** but requiring legal judgment
   - **Not illegal** (civil complaint, policy dispute, or misidentified content)
6. **Escalate if necessary.** If the content suggests a serious criminal offence involving threat to life or safety, immediately escalate to the Art. 18 criminal offence procedure (see `CRIMINAL_REFERRAL_SOP.md`).
7. **Decide.** Document the decision and the specific legal basis:
   - Remove / disable access to the content
   - Contact the host to request removal
   - Take no action (content is not illegal)

---

## 5. Notification (Day 5 maximum)

8. **Notify the notifier.** Within 5 business days of receipt, send a decision notice to the notifier's email including:
   - Reference ID
   - Decision (action taken or reason no action was taken)
   - If action was taken: what was done and when
   - Available redress options (reply to this email / contact `legal@qesto.cc`)
9. **Notify the affected host** (if content was removed or restricted):
   - Describe the specific content removed
   - Cite the specific legal basis and internal policy clause
   - Inform them of the right to appeal within 14 days by emailing `legal@qesto.cc`

---

## 6. Statement of reasons (Art. 17)

When restricting or terminating a host account as a result of a notice, the statement of reasons sent to the host must include:
- The reference ID of the notice
- The specific content that triggered the action
- The specific policy clause(s) under the Terms of Service
- The specific legal provision if applicable
- A description of the action taken
- The available redress mechanism (appeal within 14 days)

---

## 7. Record-keeping

Maintain a notice log with the following fields per entry:
- Reference ID
- Date received
- Notifier email (pseudonymised after 6 months)
- Content location
- Allegation type
- Decision (remove / no action)
- Decision date
- Whether the host was notified
- Whether the notifier received the decision notice

This log feeds into the annual transparency report required under Art. 15 DSA.

---

## 8. Transparency reporting

Aggregate counts from this log must be published in the annual DSA Transparency Statement at `qesto.cc/legal`. The statement must cover:
- Number of notices received
- Number of notices acted upon
- Number of notices resulting in no action
- Any government orders received under Art. 9 or 10 DSA
- Any account suspensions issued under Art. 17 DSA

For the current period (2026): see the transparency statement at `qesto.cc/legal`.

---

## 9. Contact

Internal escalation: `legal@qesto.cc`  
Criminal offence referrals: see `CRIMINAL_REFERRAL_SOP.md`
