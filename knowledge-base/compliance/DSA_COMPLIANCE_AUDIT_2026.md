# DSA Compliance Audit — Qesto

**Regulation:** EU 2022/2065 (Digital Services Act)  
**Related law:** GDPR (EU 2016/679), eCommerce Directive (2000/31/EC), Dutch UAVG  
**Jurisdiction:** Netherlands — Digital Services Coordinator: ACM (Autoriteit Consument & Markt)  
**Audit date:** 2026-06-30  
**Auditor:** Internal — AI-assisted legal review  
**Next review:** 2027-06-30 or on material product change

---

## Section A — Classification Verdict

```
CLASSIFICATION
Type: Hosting service (Art. 3(g)(iii) DSA) — CONFIRMED
      Online platform (Art. 3(i) DSA)       — BORDERLINE / probably NOT
      Intermediary service provider (Art. 3(h) DSA) — YES

Hosting service reasoning:
Qesto stores poll questions (created by hosts) and poll responses (submitted
by participants) at the explicit request of those recipients. Storage is a
core function of the service. Hosting service classification: YES.

Online platform reasoning:
Sessions are access-controlled via code or link. DSA Recital 13 defines
"dissemination to the public" as making information available to "a
potentially unlimited number of persons." A closed-code session shared with
a fixed group does not meet this threshold. However, a host who publishes a
session link publicly (e.g. on social media) would bring that session within
the online platform definition. Conservative position: Qesto MAY be an
online platform for individual sessions with unrestricted links. Audit online
platform obligations and apply micro-enterprise exemption where available.
Online platform classification: BORDERLINE.

Micro-enterprise exemption:
APPLIES — Qesto B.V. is early-stage (well under 10 FTE and €2M turnover).
Art. 19(1) DSA removes Art. 20, 21, 22, 26, and 27 obligations.
Art. 23, 25, and 28 are NOT exempted even for micro-enterprises.

Intermediary service provider:
YES — all Art. 11–15 baseline obligations apply.

Risk if misclassified downward:
Missing Art. 16–18 hosting obligations (no notice & action mechanism, no
statement of reasons) — these carry direct enforcement risk from ACM with
no exemption pathway.
```

---

## Section B — Findings Register

### Domain 2 — Baseline Obligations

---

**D2-01 [S2 HIGH] — Art. 11(1)(a) DSA: No competent-authority contact point**

- **Obligation:** Art. 11(1)(a) DSA requires a single, publicly accessible contact point allowing competent authorities (ACM, law enforcement, European Commission) to communicate directly and electronically with the service provider.
- **Current state:** `legal@qesto.cc` exists but appears only in the Terms of Service §10 Disputes and is not labelled as a DSA authority contact point. Not findable without reading the policy documents.
- **Gap:** No page, heading, or footer item explicitly identifies a contact for competent authorities. Art. 11 requires this to be "easy to find and use without prior registration."
- **Severity:** S2 HIGH
- **Remediation:** `legal@qesto.cc` designated as the DSA authority contact; published with explicit label on `/legal` page and in the footer. ✅ **Remediated in this release.**
- **Effort:** XS

---

**D2-02 [S2 HIGH] — Art. 11(1)(b) DSA: No dedicated user/recipient contact point**

- **Obligation:** Art. 11(1)(b) DSA requires an easily accessible contact point for service recipients (hosts, participants) allowing direct electronic communication without prior registration.
- **Current state:** `privacy@qesto.cc` and `dpo@qesto.cc` exist in the Privacy Policy. No contact page, no web form.
- **Gap:** Contact is only accessible via buried email addresses in a lengthy legal document. No `/contact` page, no web form as an alternative to email.
- **Severity:** S2 HIGH
- **Remediation:** `support@qesto.cc` and `legal@qesto.cc` published with explicit "Contact Us" label on `/legal` page. ✅ **Remediated in this release.**
- **Effort:** S

---

**D2-03 [S3 MEDIUM] — Art. 14(1)(c) DSA: T&C lacks content moderation complaint procedure**

- **Obligation:** Art. 14(1)(c) DSA requires T&Cs to describe the procedure for submitting complaints about content decisions.
- **Current state:** Terms §3 prohibits illegal use but does not describe how complaints about content are handled or what recourse exists.
- **Gap:** No complaint procedure referenced.
- **Severity:** S3 MEDIUM
- **Remediation:** Added to Terms §3: reference to `abuse@qesto.cc` and the `/legal/report` mechanism. ✅ **Remediated in this release.**
- **Effort:** S

---

**D2-04 [S3 MEDIUM] — Art. 14(3) DSA: No T&C change notification commitment**

- **Obligation:** Art. 14(3) DSA requires informing users of significant changes to T&Cs before those changes take effect; users must have the opportunity to terminate the contract.
- **Current state:** Terms have no change notification commitment.
- **Gap:** No advance-notice mechanism stated.
- **Severity:** S3 MEDIUM
- **Remediation:** Added "Changes to These Terms" clause to Terms §11 with 30-day notice commitment. ✅ **Remediated in this release.**
- **Effort:** XS

---

**D2-05 [S3 MEDIUM] — Art. 15 DSA: No transparency statement**

- **Obligation:** Art. 15 DSA requires periodic reporting on content moderation activities. For micro-enterprises applying the Art. 19 exemption, the obligation still exists but is triggered only when Art. 9/10 orders are received or Art. 17 suspensions are issued. A public statement of "no orders received" satisfies the obligation during quiet periods.
- **Current state:** No transparency statement or report published anywhere.
- **Gap:** No public channel for such reporting exists.
- **Severity:** S3 MEDIUM
- **Remediation:** Transparency statement published on `/legal` page (annually updated). ✅ **Remediated in this release.**
- **Effort:** XS

---

### Domain 3 — Hosting Service Obligations

---

**D3-01 [S1 CRITICAL] — Art. 16 DSA: No notice and action mechanism**

- **Obligation:** Art. 16(1) DSA requires any person or entity to be able to notify the hosting service of alleged illegal content electronically. Art. 16(3) requires the notifier to receive a decision, the reasons for it, and available redress options. No micro-enterprise exemption applies.
- **Current state:** No mechanism whatsoever. No `abuse@` address, no reporting form, no page.
- **Gap:** Complete absence of the legally required mechanism.
- **Severity:** S1 CRITICAL
- **Remediation:** Web form at `/legal/report` + `abuse@qesto.cc` + internal SOP (`NOTICE_AND_ACTION_SOP.md`). ✅ **Remediated in this release.**
- **Effort:** M

---

**D3-02 [S2 HIGH] — Art. 17 DSA: Statement of reasons procedure absent**

- **Obligation:** Art. 17 DSA requires that when Qesto restricts, suspends, or terminates a user's ability to use the service (or removes content), it must provide the affected recipient with a clear statement of reasons including: specific facts, the applicable policy clause, and available redress. This must be done before or at the time of restriction.
- **Current state:** Terms §7 Termination mentions termination for breach but does not describe the notification procedure, the specific information that will be provided, or the redress options.
- **Gap:** No statement-of-reasons commitment.
- **Severity:** S2 HIGH
- **Remediation:** Added "Enforcement Decisions" subsection to Terms §7. ✅ **Remediated in this release.**
- **Effort:** S

---

**D3-03 [S3 MEDIUM] — Art. 18 DSA: No criminal offence escalation procedure**

- **Obligation:** Art. 18 DSA requires hosting services that become aware of content giving rise to reasonable suspicion of a serious criminal offence involving a threat to life or safety to notify the relevant law enforcement authority of that member state and provide the relevant information.
- **Current state:** No documented internal procedure. `security@qesto.cc` exists but no SOP exists.
- **Gap:** No escalation procedure documented.
- **Severity:** S3 MEDIUM
- **Remediation:** `CRIMINAL_REFERRAL_SOP.md` to be created (P3). Terms to note law enforcement cooperation.
- **Effort:** S

---

### Domain 4 — Online Platform Obligations (conditional)

---

**D4-01 [S3 MEDIUM] — Art. 23 DSA: No monthly active recipient disclosure**

- **Obligation:** Art. 23 DSA requires online platforms to publish their average monthly active recipients in the EU on the service interface at least once every six months. This obligation is NOT exempted for micro-enterprises.
- **Current state:** No figure published anywhere on qesto.cc.
- **Gap:** Required disclosure absent.
- **Severity:** S3 MEDIUM
- **Remediation:** Published on `/legal` page with commitment to update every 6 months. ✅ **Remediated in this release.**
- **Effort:** XS

---

**D4-02 [S3 MEDIUM] — Art. 28 DSA: Classroom/minors use case unmitigated**

- **Obligation:** Art. 28 DSA requires appropriate safeguards for online platforms "likely to be accessed by minors." This obligation is NOT exempted for micro-enterprises.
- **Current state:** Terms §2 states the 16+ account requirement for hosts. Marketing explicitly targets teachers and classroom use. No participant-level minor safeguard exists.
- **Gap:** Participants under 16 (students in classroom settings) will foreseeably join sessions. No policy assigns responsibility, no safeguard is documented.
- **Severity:** S3 MEDIUM
- **Remediation:** "Educational Use & Minors" section added to Privacy Policy §2; "Educational Institution Responsibility" clause added to Terms §2. ✅ **Remediated in this release.**
- **Effort:** S

---

**Excluded obligations (Art. 19 micro-enterprise exemption):**

| Art. | Obligation | Trigger to activate |
|---|---|---|
| Art. 20 | Internal complaint-handling system | >10 FTE or >€10M turnover |
| Art. 21 | Out-of-court dispute settlement body | Same |
| Art. 22 | Trusted flaggers | Same |
| Art. 26 | Advertising transparency | Same |
| Art. 27 | Recommender systems transparency | Same |

Recommended: pre-draft Art. 20 complaint procedure and Art. 21 ODR reference now so scaling does not create a compliance sprint.

---

### Domain 5 — GDPR

---

**D5-01 [S1 CRITICAL] — GDPR Art. 7: Unfulfilled consent promise**

- **Obligation:** Art. 7(1) GDPR requires consent to be freely given, specific, informed, and unambiguous. A consent statement that is factually inaccurate invalidates the consent.
- **Current state:** The `gdprConsent` string in all five locale files promised: "Data is stored for a maximum of 30 days and then deleted." No 30-day purge cron exists (documented as "requirement debt" in `knowledge-base/help/privacy-gdpr.md` lines 46–54).
- **Gap:** The consent obtained from participants was based on a materially false promise.
- **Severity:** S1 CRITICAL
- **Remediation:** Consent copy updated in all 5 locale files to accurately reflect the plan-based retention model. ✅ **Remediated in this release.**
- **Effort:** XS

---

**D5-02 [S2 HIGH] — GDPR Art. 5(1)(e): Retention targets not enforced**

- **Obligation:** Art. 5(1)(e) GDPR (storage limitation) requires personal data not be kept longer than necessary for the stated purpose.
- **Current state:** Privacy Policy documents plan-level retention (30d Pulse / 365d Signal / 7y Chorus) but no automated cron enforces this for general `sessions`, `votes`, or `townhall_questions` tables. Only Pulse rollup data has automated retention via `PULSE-RETENTION-01`.
- **Gap:** Plan-level retention is aspirational documentation, not enforced code.
- **Severity:** S2 HIGH
- **Remediation:** Extend `worker/index.ts` with `RETENTION-SESSIONS` cron (P2 engineering task).
- **Effort:** M

---

**D5-03 [S3 MEDIUM] — GDPR Art. 5(1)(e): Audit log retention indefinite**

- **Obligation:** `audit_events` table stores admin action logs with no retention policy. GDPR storage limitation applies.
- **Current state:** No purge schedule configured.
- **Gap:** Audit logs grow indefinitely.
- **Severity:** S3 MEDIUM
- **Remediation:** Add `RETENTION-AUDIT-LOG` cron deleting events older than 90d (Pulse) / 1y (Signal) / 7y (Chorus) — P2 engineering task.
- **Effort:** S

---

**D5-04 [S3 MEDIUM] — GDPR Art. 35: No DPIA**

- **Obligation:** Art. 35 GDPR requires a Data Protection Impact Assessment for processing likely to result in high risk (systematic processing of special categories, large-scale processing, innovative technologies). AI processing of employee sentiment data and anonymous feedback meet this threshold.
- **Current state:** No DPIA document found in `knowledge-base/`.
- **Gap:** Processing proceeds without documented risk assessment.
- **Severity:** S3 MEDIUM
- **Remediation:** Draft `knowledge-base/compliance/DPIA_2026.md` (P3 task).
- **Effort:** L

---

**D5-05 [S3 MEDIUM] — GDPR Art. 28: DPA not publicly accessible**

- **Obligation:** Art. 28 GDPR requires a written data processing agreement between controller (host) and processor (Qesto). Making this easily available reduces friction for enterprise procurement.
- **Current state:** DPA template exists at `knowledge-base/security/DPA_SCC_TEMPLATE.md` but is not linked from any public page.
- **Gap:** Hosts must request the DPA manually via email; no public link exists.
- **Severity:** S3 MEDIUM
- **Remediation:** DPA request link added to `/legal` page (`privacy@qesto.cc` for DPA requests). ✅ **Remediated in this release.**
- **Effort:** S

---

**D5-06 [S3 MEDIUM] — GDPR Art. 8 / UAVG Art. 16: Minors in classroom sessions**

- **Obligation:** Under Dutch UAVG Art. 16, processing personal data of individuals under 16 requires parental consent unless the processing is covered by the educational institution acting as data controller.
- **Current state:** Terms §2 sets a 16+ age requirement for creating accounts (hosts) but has no clause addressing participant minors in educational sessions.
- **Gap:** No policy assigns responsibility for minor participant consent to the educational institution.
- **Severity:** S3 MEDIUM
- **Remediation:** "Educational Use & Minors" clause added to Privacy Policy and Terms. ✅ **Remediated in this release.**
- **Effort:** S

---

**D5-07 [S4 LOW] — GDPR Art. 13: "Anonymous" vs. pseudonymous precision**

- **Obligation:** Art. 13 GDPR requires accurate disclosure of processing. Marketing copy that overstates anonymity guarantees may mislead data subjects.
- **Current state:** Standard "full" anonymity mode stores `voter_id = anon_{ipHash8}_{fingerprint12}` — technically pseudonymous, not anonymous. Zero-knowledge mode is the only mode where no participant-correlatable data is stored. Privacy.tsx §3 explains this correctly; marketing copy uses "anonymous" without qualification.
- **Gap:** Minor precision gap in marketing copy; Privacy.tsx is accurate.
- **Severity:** S4 LOW
- **Remediation:** Add qualifier to `/features/privacy` marketing copy (P4 task).
- **Effort:** XS

---

**D5-08 [S4 LOW] — GDPR Art. 33: Breach notification runbook incomplete**

- **Obligation:** Art. 33 GDPR requires notification of a personal data breach to the AP within 72 hours of becoming aware.
- **Current state:** 72-hour SLA documented; runbook not finalized per `SOC2_ANNUAL_EVIDENCE_2026.md`.
- **Gap:** Runbook exists as a stub.
- **Severity:** S4 LOW
- **Remediation:** Finalize `knowledge-base/security/BREACH_NOTIFICATION_RUNBOOK.md` (P3 task).
- **Effort:** M

---

### Domain 6 — eCommerce Directive & Transparency

---

**D6-01 [S2 HIGH] — eCommerce Directive Art. 5: Incomplete identity disclosure**

- **Obligation:** Art. 5(1) eCommerce Directive (2000/31/EC), implemented via the Dutch Wet handhaving consumentenbescherming and Besluit elektronische handel, requires "easily, directly and permanently accessible" disclosure of: legal entity name, geographic address, email address, KvK registration, and VAT number (if registered).
- **Current state:** "Qesto B.V., Amsterdam, KvK 88214503" appears in Privacy.tsx §1. No street address, no VAT number, not in the footer or a dedicated location.
- **Gap:** No street address published; not "directly accessible" (only in a lengthy privacy policy).
- **Severity:** S2 HIGH
- **Remediation:** Company identity block added to `/legal` page and footer. Street address must be obtained from KvK registration and inserted before go-live. ✅ **Page created in this release; street address marked as TODO.**
- **Effort:** S

---

**D6-02 [S2 HIGH] — Operational: Google Search Console placeholder in index.html**

- **Obligation:** Not a DSA/GDPR requirement, but the `content="REPLACE_WITH_GSC_TOKEN"` meta tag in `index.html` indicates incomplete pre-launch configuration and will undermine trust claims in technical due diligence.
- **Current state:** `<meta name="google-site-verification" content="REPLACE_WITH_GSC_TOKEN" />` visible in page source.
- **Gap:** Placeholder shipped to production.
- **Severity:** S2 HIGH (operational risk)
- **Remediation:** Tag removed from `index.html` pending real GSC token. ✅ **Remediated in this release.**
- **Effort:** XS

---

**D6-03 [S4 LOW] — eCommerce Directive: No Dutch-language legal documents**

- **Obligation:** While no EU law strictly mandates native-language legal docs, Dutch consumer law (and the ACM's guidelines) expect key legal documents to be accessible in the primary language of the target market (the Netherlands).
- **Current state:** Privacy Policy and Terms are English-only. Site has i18n infrastructure for 5 languages (EN/NL/DE/FR/ES).
- **Gap:** NL users cannot read legal documents in their native language.
- **Severity:** S4 LOW
- **Remediation:** Priority translation of Terms and Privacy Policy into Dutch (P4 task).
- **Effort:** L

---

## Section C — Findings Summary Table

| ID | Domain | Article | Title | Severity | Effort | Priority |
|---|---|---|---|---|---|---|
| D3-01 | Hosting | Art. 16 DSA | No notice & action mechanism | S1 CRITICAL | M | P1 ✅ |
| D5-01 | GDPR | Art. 7 GDPR | Unfulfilled 30-day consent promise | S1 CRITICAL | XS | P1 ✅ |
| D2-01 | Baseline | Art. 11(1)(a) DSA | No authority contact point | S2 HIGH | XS | P1 ✅ |
| D2-02 | Baseline | Art. 11(1)(b) DSA | No user contact point | S2 HIGH | S | P1 ✅ |
| D3-02 | Hosting | Art. 17 DSA | No statement of reasons | S2 HIGH | S | P1 ✅ |
| D6-01 | eCommerce | Art. 5 eCommerce Dir | Incomplete identity disclosure | S2 HIGH | S | P1/P2 ✅ |
| D6-02 | eCommerce | Operational | GSC placeholder in index.html | S2 HIGH | XS | P1 ✅ |
| D5-02 | GDPR | Art. 5(1)(e) GDPR | Retention targets not enforced | S2 HIGH | M | P2 |
| D2-03 | Baseline | Art. 14(1)(c) DSA | T&C lacks complaint procedure | S3 MEDIUM | S | P2 ✅ |
| D2-04 | Baseline | Art. 14(3) DSA | No T&C change notification | S3 MEDIUM | XS | P2 ✅ |
| D2-05 | Baseline | Art. 15 DSA | No transparency statement | S3 MEDIUM | XS | P2 ✅ |
| D4-01 | Platform | Art. 23 DSA | No MAR disclosure | S3 MEDIUM | XS | P2 ✅ |
| D4-02 | Platform | Art. 28 DSA | Minor safeguards undocumented | S3 MEDIUM | S | P2 ✅ |
| D5-05 | GDPR | Art. 28 GDPR | DPA not publicly linked | S3 MEDIUM | S | P2 ✅ |
| D5-06 | GDPR | Art. 8 GDPR / UAVG | Minors policy gap | S3 MEDIUM | S | P2 ✅ |
| D3-03 | Hosting | Art. 18 DSA | No criminal offence SOP | S3 MEDIUM | S | P3 |
| D5-03 | GDPR | Art. 5(1)(e) GDPR | Audit log retention indefinite | S3 MEDIUM | S | P3 |
| D5-04 | GDPR | Art. 35 GDPR | No DPIA | S3 MEDIUM | L | P3 |
| D5-07 | GDPR | Art. 13 GDPR | Anon vs pseudonymous marketing | S4 LOW | XS | P4 |
| D5-08 | GDPR | Art. 33 GDPR | Breach notification runbook | S4 LOW | M | P4 |
| D6-03 | eCommerce | Art. 5 | No Dutch legal docs | S4 LOW | L | P4 |

---

## Section D — Remediation Roadmap

### P1 — Pre-launch (completed in this release)

| Finding | Remediation | Status |
|---|---|---|
| D3-01 | `/legal/report` page + `abuse@qesto.cc` + `NOTICE_AND_ACTION_SOP.md` | ✅ Done |
| D5-01 | Consent copy fixed in all 5 locale files | ✅ Done |
| D2-01 | Authority contact published on `/legal` page | ✅ Done |
| D2-02 | User contact published on `/legal` page | ✅ Done |
| D3-02 | Statement of reasons added to Terms §7 | ✅ Done |
| D2-03 | Complaint procedure added to Terms §3 | ✅ Done |
| D2-04 | Change notification added to Terms §11 | ✅ Done |
| D2-05 | Transparency statement published on `/legal` | ✅ Done |
| D4-01 | MAR disclosure published on `/legal` | ✅ Done |
| D4-02 | Minors clause added to Privacy §2 and Terms §2 | ✅ Done |
| D5-05 | DPA request link on `/legal` page | ✅ Done |
| D5-06 | Educational institution responsibility clause | ✅ Done |
| D6-01 | Company identity on `/legal` (street address TODO) | ⚠️ Partial |
| D6-02 | GSC placeholder removed from `index.html` | ✅ Done |

**Outstanding before go-live:** Insert Qesto B.V. street address on `/legal` page (obtain from KvK registry for KvK 88214503).

### P2 — Within 30 days

- **D5-02:** Extend `worker/index.ts` with `RETENTION-SESSIONS` and `RETENTION-AUDIT-LOG` scheduled crons per plan tier. Schema change: add `planned_deletion_at` column to `sessions` table if needed.
- **D5-03:** Included in D5-02 cron work.
- **D6-01:** Insert actual street address once obtained from KvK.
- **D6-02:** Add real GSC token to `index.html` once property is verified.

### P3 — Within 90 days

- **D3-03:** Create `knowledge-base/compliance/CRIMINAL_REFERRAL_SOP.md`; add law-enforcement cooperation clause to Terms.
- **D5-04:** Draft `knowledge-base/compliance/DPIA_2026.md` — cover ZK mode, AI sentiment processing, anonymous employee feedback.
- **D5-08:** Finalize `knowledge-base/security/BREACH_NOTIFICATION_RUNBOOK.md`.

### P4 — Next product cycle

- **D5-07:** Add anonymity-mode qualifier to `/features/privacy` marketing copy.
- **D6-03:** Priority translation of Terms and Privacy Policy into Dutch (NL locale).
- Pre-draft Art. 20 complaint-handling system and Art. 21 ODR reference for when headcount exceeds 10 FTE.

---

## Section E — Quick-Win Bundles (completed)

**Bundle A — `/legal` hub page** closed D2-01, D2-02, D2-05, D4-01, D5-05 in a single React page.

**Bundle B — Consent copy fix** closed D5-01 with a 5-locale JSON edit.

**Bundle C — T&C revision** closed D2-03, D2-04, D3-02 in a single Terms.tsx edit.

**Bundle D — GSC + footer** closed D6-02 and added legal navigation.

**Bundle E — `/legal/report` page** closed D3-01 with a new React page and API route.

---

## Section F — Scale Triggers

| Excluded obligation | Trigger | Lead time |
|---|---|---|
| Art. 20 Internal complaint-handling | >10 FTE OR >€10M turnover | 60 days |
| Art. 21 Out-of-court dispute settlement | Same | 30 days |
| Art. 22 Trusted flaggers | Same | 30 days |
| Art. 26 Ad transparency | Same | 30 days |
| Art. 27 Recommender systems | Same | 30 days |
| Art. 33–43 VLOP/VLOSE | 45M average monthly EU users | 12 months |

---

## Section G — Residual Risk

After all P1 remediations:

**Low residual risk:**
- Art. 11 (contact points): addressed via `/legal` page
- Art. 14 (T&Cs): substantially addressed; Dutch translation remains P4
- Art. 16 (notice & action): form, SOP, and email in place
- Art. 17 (statement of reasons): clause added to Terms

**Remaining assumptions the compliance posture depends on:**
1. Micro-enterprise exemption applies (Qesto B.V. remains under 10 FTE / €2M turnover)
2. Qesto is not an online platform for most sessions (code/link access control holds)
3. The company street address will be inserted before go-live (D6-01 partial)
4. The `abuse@qesto.cc` mailbox is monitored and responses are sent within 5 business days

**Where ACM would most likely push back:**
1. **Art. 16 adequacy:** A web form and mailbox are necessary but not sufficient. ACM scrutinises whether notices receive timely, non-arbitrary, documented decisions. The `NOTICE_AND_ACTION_SOP.md` procedure must be followed; a log of notices and decisions must be maintained and fed into the annual transparency statement.
2. **D5-02 (retention):** Privacy Policy documents retention targets that are not code-enforced. This is the next highest priority after P1 items. If the AP audits data processing and finds retention targets are not enforced, fines under GDPR Art. 83(4) are possible.
3. **D5-01 prior to fix:** The 30-day consent promise (now fixed) was a clear GDPR Art. 7 violation. Any data collected under the false consent before this fix was collected on invalid consent. Remediation: the consent copy fix applies prospectively; past collected data under the old consent was collected without a valid lawful basis for the "30 days" specific promise, but the broader consent (processing for session analytics) remains valid under legitimate interest and the host's role as data controller.

---

*Audit version: 1.0 | DSA regulation basis: EU 2022/2065 as applicable from 17 February 2024 | Jurisdiction: Netherlands (ACM) | Created: 2026-06-30*
