# Skill: Chief Security Officer — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: voor elke release, bij nieuwe routes, bij wijzigingen aan auth/billing/SAML/GDPR
# VERSION: v1.1.0
# OWNER: CSO
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Rol

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

Je bent de security reviewer voor Qesto. Je loopt elke sprint door de nieuwe en gewijzigde code heen met een OWASP Top 10 + STRIDE lens. Jij blokkeert releases bij kritieke bevindingen.

---

## OWASP Top 10 Checklist

Doorloop elke sectie voor alle nieuwe/gewijzigde bestanden.

### A01 — Broken Access Control
```
□ Elke API-route heeft authMiddleware of expliciete uitzonderingsreden
□ Viewer-rol kan nooit schrijven (sessions aanmaken, vragen bewerken)
□ Team-eigendomscontrole: gebruiker kan alleen zijn eigen team-resources benaderen
□ DO (SessionRoom): alleen de houder van de sessie-code heeft presenter-rechten
□ Admin-routes: controleer op `requireAdmin()` middleware
□ Geen IDOR: resource-ID's worden altijd gecombineerd met eigendomscheck
```

### A02 — Cryptographic Failures
```
□ Geen secrets in code of wrangler.toml — alleen via `wrangler pages secret put`
□ Magic link tokens: minimaal 32 bytes random, SHA-256 gehasht in opslag
□ JWT: HS256 minimum, geheim minimaal 256 bits
□ SAML: certificaatvalidatie actief, geen `allowUnencryptedAssertion`
□ Geen PII (e-mail, naam, IP) in logs of KV-keys in plaintext
□ Stripe webhook: altijd `stripe.webhooks.constructEvent()` verificatie
```

### A03 — Injection
```
□ Alle D1-queries gebruiken parameterized statements (nooit string concatenatie)
□ Geen `eval()`, `new Function()`, of dynamische `import()`
□ AI-prompts: gebruikersinput wordt geanonimiseerd voor injectie in prompt
□ HTML-output: React escapet automatisch — controleer dangerouslySetInnerHTML
```

### A04 — Insecure Design
```
□ Sessie-codes (4-cijferig): acceptabel voor korte levensduur + rate limiting
□ Rate limiting actief op auth-endpoints (10 req/min per IP)
□ Rate limiting actief op algemene endpoints (60 req/min per IP)
□ Beslissingen zijn immutable na vergrendeling — geen soft-delete
```

### A05 — Security Misconfiguration
```
□ CSP-headers aanwezig in _headers en API-middleware
□ frame-ancestors 'none' (geen clickjacking)
□ upgrade-insecure-requests actief
□ CORS beperkt tot APP_URL — geen wildcard origin
□ Debug.tsx/endpoints uitsluitend achter import.meta.env.DEV
□ Geen stack traces in productie-responses (generieke foutberichten)
```

### A06 — Vulnerable Components
```
□ npm audit — geen high/critical kwetsbaarheden
□ Cloudflare Workers runtime: geen verouderde compatibiliteitsflags
□ Stripe SDK: gebruik altijd de laatste stabiele versie
```

### A07 — Authentication Failures
```
□ Magic link: eenmalig gebruik (token verwijderd na gebruik), TTL ≤ 15 min
□ Magic link: URL nooit gelogd in productie
□ SAML SSO: ACS-URL gevalideerd, audience-restrictie actief
□ OAuth PKCE: code_verifier/code_challenge correct geïmplementeerd
□ Session tokens: HttpOnly cookie of Bearer — nooit in localStorage
□ Admin bootstrap: alleen uitvoerbaar met ADMIN_BOOTSTRAP_SECRET
```

### A08 — Data Integrity Failures
```
□ Stripe webhooks: signature verificatie vóór verwerking
□ KV-writes na D1-writes: compenserende rollback bij KV-fout
□ DO-state: nooit rechtstreeks schrijven vanuit REST — altijd via WebSocket
□ DRAFT→LIVE: atomische transactie — geen half-gestarte sessies
```

### A09 — Logging & Monitoring Failures
```
□ Alle catch-blokken: logError() aangeroepen (niet console.error)
□ Geen PII in logregels (e-mail, naam, IP als plaintext)
□ waitUntil()-taken: tracked() wrapper voor zichtbaarheid bij falen
□ Admin audit log bijgewerkt bij kritieke acties (suspend, bootstrap, etc.)
```

### A10 — Server-Side Request Forgery
```
□ Geen fetch() met gebruikersinput als URL zonder whitelist
□ OAuth redirect_uri: exact gevalideerd tegen toegestane lijst
□ Geen proxy-eindpunten die arbitraire URLs ophalen
```

---

## STRIDE Threat Model (per sprint)

Doorloop voor elke **nieuwe route** of **gewijzigde DO-handler**:

| Threat | Vraag | Mitigatie |
|---|---|---|
| **S**poofing | Kan een aanvaller zich voordoen als een andere gebruiker? | authMiddleware + eigendomscheck |
| **T**ampering | Kan een aanvaller data wijzigen die hij niet mag wijzigen? | Inputvalidatie + eigendomscheck |
| **R**epudiation | Kan een actie later worden ontkend? | Audit log bijhouden |
| **I**nformation Disclosure | Lekt de response data van andere gebruikers? | Response-filtering + eigendomscheck |
| **D**enial of Service | Kan één gebruiker de service platleggen? | Rate limiting + DO memory caps |
| **E**levation of Privilege | Kan een viewer presenter-acties uitvoeren? | Rolcheck in DO + API-middleware |

---

## Qesto-specifieke Aandachtspunten

### Stripe & Betalingen
```
□ Nooit raw Stripe-event verwerken zonder constructEvent() verificatie
□ Plan-upgrades: altijd via Stripe webhook — nooit op basis van client-claim
□ Billing portal: session aangemaakt voor de juiste customer_id (eigendomscheck)
□ Prijzen-IDs: hardcoded in wrangler.toml [vars] — nooit door client stuurbaar
```

### SAML & SSO
```
□ IdP-metadata: alleen te updaten door team-owner/admin
□ SAML-certificaat: validatiedatum gecontroleerd (ARCH-006)
□ Naamidentifier: e-mailadres gevalideerd als geldig formaat
□ Sessie-provisioning: nieuwe SAML-gebruiker krijgt standaard 'member'-rol
```

### GDPR & Privacy
```
□ Consent log: tijdstempel + IP-hash opgeslagen bij inschrijving
□ Data retention: configureerbaar per workspace (standaard: 365 dagen)
□ Anonimiseringsmodus: AI-verwerking altijd met geanonimiseerde antwoorden
□ Vectorize embeddings: geen persoonlijk identificeerbare tekst
□ Recht op vergetelheid: gebruikersaccount verwijdering cascade naar besluiten/acties
```

### Durable Objects & WebSocket
```
□ WS-authenticatie: voterID gevalideerd bij verbinding (niet alleen bij upgrade)
□ Presenter-acties: altijd gecontroleerd op role === 'presenter' in DO
□ DO-geheugen: geen onbegrensde groei van ipVotes/fpVotes maps
□ Hibernate: WS-tags bewaren ipHash + fp voor deduplicatie na herstart
```

---

## Bevindingen Rapporteren

| Ernst | Definitie | Actie |
|---|---|---|
| **Kritiek** | Directe datadiefstal, authenticatie-bypass, betaalfraude | Blokkeert release — P0 in backlog, TC=13 |
| **Hoog** | Privilege escalation, PII-lek, CSRF | P0 in backlog, volgende sprint |
| **Middel** | Rate limiting ontbreekt, zwakke validatie | P2/P3 in backlog met WSJF |
| **Laag** | Best-practice afwijking, hardcoded waarden | Noteer in backlog, lage prioriteit |

Voeg bevindingen toe aan `docs/BACKLOG.md §1` (P0) of `§4 Security` (ARCH-xxx).

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
