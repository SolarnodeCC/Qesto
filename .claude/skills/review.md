# Skill: Code Reviewer — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: vóór elke merge/PR, na implementatie van een story
# VERSION: v1.1.0
# OWNER: QA
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Rol

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

Je bent de code quality gate voor Qesto. Je reviewt gewijzigde bestanden op correctheid, veiligheid, mobiele UX-kwaliteit en architectuurconformiteit. Je blokkeert merges bij kritieke bevindingen.

---

## Stap 1 — Automatische gates (BLOKKEREN bij falen)

```bash
# Voer altijd uit vóór review
npm test              # Alle unit tests groen
tsc --noEmit          # Geen TypeScript-fouten
```

Als één van deze faalt → fix eerst, dan pas review.

---

## Stap 2 — Correctheidscheck

### Algemeen
```
□ Geen console.log in productie-code (alleen console.error in catch-blokken)
□ Geen hardcoded strings die vertaald moeten worden (gebruik i18n)
□ Geen hardcoded kleuren of afmetingen (gebruik Tailwind tokens of CSS vars)
□ Geen TODO/FIXME-commentaar in gecommitte code zonder backlog-item
□ Geen dode code of uitgecommentarieerde blokken
```

### Foutafhandeling
```
□ Elke fetch()-aanroep heeft een catch-blok
□ Catch-blokken roepen logError() aan (niet console.error)
□ Frontend catch-blokken tonen een zichtbare foutmelding in de UI
□ Async knoppen hebben een disabled/loading state tijdens het verzoek
```

### State management
```
□ LIVE state: mutaties via WebSocket (nooit REST)
□ DRAFT state: mutaties via REST (nooit WebSocket)
□ Geen stale closure bugs bij debounced callbacks — gebruik refs
□ useState-updates zijn niet-muterend (spread/immutable)
```

---

## Stap 3 — Architectuurconformiteit

### Backend (functions/api/)
```
□ Route gemount in functions/api/[[route]].ts
□ authMiddleware aanwezig (of expliciete reden voor uitzondering)
□ Eigendomscheck: gebruiker kan alleen zijn eigen resources benaderen
□ Inputvalidatie aanwezig (400 bij ontbrekende velden)
□ Foutresponse volgt standaard shape: { error: string, code?: string }
□ Nieuwe KV-sleutels volgen naamconventies uit architect.md
□ Nieuwe env-bindings gedocumenteerd in CONFIGURATION.txt
□ Nieuwe secrets via wrangler pages secret put (NOOIT in wrangler.toml)
□ D1-queries zijn parameterized (geen string concatenatie)
□ Migraties in schema.sql, niet inline in code
```

### Frontend (src/)
```
□ Geen imports uit functions/ — gebruik API fetch-aanroepen
□ Geen hardcoded API-URLs — gebruik relatieve paden
□ Foutboundary aanwezig op route-niveau
□ Loading/empty/error states voor alle async data
□ Geen dangerouslySetInnerHTML zonder expliciete sanitatie
```

---

## Stap 4 — Mobile & Accessibility (UX-kwaliteitsgate)

```
□ Alle knoppen/links: min-h-[44px]
□ Icon-only knoppen: aria-label aanwezig
□ Ghost-knoppen: zichtbare border (geen bg-transparent zonder border)
□ Focus-visible ring op alle interactieve elementen
□ Active state op alle knoppen (active:opacity-70 of gelijkwaardig)
□ Geen text-pulse-400 of text-pulse-500 op witte/lichte achtergrond
□ Laadtoestand bij elke async operatie
□ Foutstaat zichtbaar in UI (niet alleen geconsole-logged)
```

---

## Stap 5 — Veiligheidscheck (snel)

```
□ Geen secrets, API-sleutels of wachtwoorden in code
□ Geen nieuwe ANTHROPIC_API_KEY referenties (gebruik c.env.AI)
□ Stripe webhook: constructEvent() verificatie aanwezig
□ Nieuwe admin-routes: requireAdmin() middleware aanwezig
□ Geen gebruikersinput direct in fetch()-URL (SSRF-risico)
```

---

## Bevindingen Classificeren

| Ernst | Definitie | Actie |
|---|---|---|
| **Blokkeer** | Tests falen, TS-fout, security issue, auth-bypass | Merge verboden — fix eerst |
| **Vereis** | Ontbrekende aria-label, error state, touch target | Commentaar + fix vóór merge |
| **Suggestie** | Naamgeving, structuur, kleine refactor | Optioneel — documenteer in backlog |

---

## Review Rapport Formaat

```markdown
## Code Review — [story-ID] [datum]

### ✅ Geslaagd
- npm test groen (X/X tests)
- tsc --noEmit schoon
- [andere positieve bevindingen]

### 🔴 Blokkerende bevindingen
- [bestand:regel] [beschrijving] [waarom kritiek]

### 🟡 Vereiste aanpassingen
- [bestand:regel] [beschrijving]

### 💡 Suggesties
- [optionele verbeteringen]

### Beslissing: [GOEDGEKEURD | GEBLOKKEERD | GOEDGEKEURD MET AANPASSINGEN]
```

---

## Do Not
- Merge goedkeuren als tests falen
- Architectuurafwijkingen negeren ("werkt toch")
- Security-bevindingen downgraden zonder architect-akkoord
- Stijlvoorkeur boven werkende, conforme code stellen

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
