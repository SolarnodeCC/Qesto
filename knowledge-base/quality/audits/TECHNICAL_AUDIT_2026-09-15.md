# Diepgaande technische audit — Qesto

**Datum:** 2026-09-15
**Scope:** volledige codebase, GitHub repo, CI/CD, infrastructuurconfiguratie, API's, dependencies, security controls, architectuur
**Commit:** `8eab268` (branch `claude/codebase-technical-audit-4wu6hj`)
**Kaders:** OWASP ASVS 4.0, OWASP Top 10 (2021), NIST SP 800-63B / CSF, CIS Benchmarks, Secure SDLC, SOLID, Clean Code, Twelve-Factor App, AWS/Azure Well-Architected, DevSecOps

---

## 0. Managementsamenvatting

Qesto is een technisch bovengemiddeld verzorgde edge-applicatie. De basishygiëne is
opvallend goed: `tsc --noEmit` is schoon, 2.706 tests slagen (316 bestanden), er zijn
2 TODO's, 0 `@ts-ignore` en 26 `any`'s in ~104k regels productiecode. SQL is consequent
geparametriseerd, er is geen enkele XSS-sink in de frontend, de Stripe-webhookverificatie
is correct, de SSRF-filter voor webhooks is zorgvuldiger dan gemiddeld, en de
wachtwoordopslag (PBKDF2-SHA256, 600k iteraties, upgrade-on-login) voldoet aan OWASP.

De problemen zitten niet in de ambachtelijke uitvoering maar in **drie structurele lagen**:

1. **De security-gates zijn theater.** Elke scanner in de pipeline is non-blocking:
   `npm audit || true`, gitleaks met `--exit-code 0`, jankurai in advisory-modus,
   CodeQL met `continue-on-error: true` op een private repo zonder GHAS. Er is
   geen enkele security-check die een merge kan tegenhouden. Er staan 9 high-severity
   advisories open, waaronder één in een *runtime*-dependency (Hono).
2. **De RBAC-laag is grotendeels dood.** `rbacMiddleware` berekent de rolcheck en
   handhaaft die vervolgens alléén voor `platform_admin`-routes; voor de overige ~40
   matrix-entries wordt de uitkomst weggegooid. De kosten (een D1-query per request)
   worden wél betaald.
3. **Scope-explosie.** 395 route-registraties over 84 modules — SCIM, LDAP, SAML,
   federatie, multi-region, sovereign, marketplace-payouts, tenant-namespaces,
   forensics, XR — in een product op `version 0.1.0` met 42% regeldekking. De
   aanvalsoppervlakte en de onderhoudslast staan niet in verhouding tot de fase.

Daarnaast is er één bevinding die direct raakt aan de kernbelofte van het product
("Privacy-by-default", anonimiteitsmodi): de anonieme `voterId` is afgeleid van een
**onversleutelde, afgekapte SHA-256 van het IP-adres** en is daarmee triviaal
omkeerbaar. Elke stem in de database is herleidbaar tot een IP-adres.

**Verdict:** niet productierijp voor enterprise-verkoop zonder de C-bevindingen te
adresseren. Wel een gezonde basis om op te bouwen.

### Scorekaart

| Domein | Score | Toelichting |
|---|---|---|
| Code quality / Clean Code | **B+** | Uitstekende hygiëne; complexiteit beheerst; wel duplicatie in route-laag |
| Architectuur | **C** | Edge-keuzes kloppen; middleware-ordening fragiel; scope-explosie |
| Security (AppSec) | **C−** | Goede primitieven, zwakke handhaving; geen MFA; RBAC dood |
| Compliance / Privacy | **D** | Anonimiteitsclaim houdt geen stand; CMK is leeg omhulsel |
| DevSecOps / CI-CD | **D** | Geen enkele blokkerende security-gate; kapotte deploy-verificatie |
| Performance / Schaalbaarheid | **C** | 2 D1-queries + KV-read per request; KV-rate-limiting niet atomair |
| Kosten | **C** | KV-write per API-call; `purge_everything` per deploy; AI zonder harde cap |
| Observability / Ops | **B−** | Goede tracing/AE-events; kapotte healthcheck; 5/5 cron-slots vol |
| Testbaarheid | **C+** | 2.706 groene tests, maar 42% regels / 30% branches |

---

## 1. Kritieke bevindingen (Critical)

### C-1 · "Anonieme" stemmen zijn herleidbaar tot IP-adres

**Bevinding.** `deriveVoterIdentity()` bouwt de stemmer-identiteit als
`anon_<sha256(ip)[0:8]>_<sha256(ua|lang|enc)[0:12]>` en die string wordt als
`votes.voter_id` in D1 weggeschreven voor élke anonieme stem, in élke
anonimiteitsmodus.

*Bewijs:* [`functions/api/lib/voter.ts:48-55`](../../../functions/api/lib/voter.ts),
[`functions/api/lib/session-room-persistence.ts:86`](../../../functions/api/lib/session-room-persistence.ts),
[`schema.sql:161-169`](../../../schema.sql).

**Waarom dit breekt.** De IPv4-ruimte is 2^32. Een onversleutelde SHA-256 van een
32-bits invoer, afgekapt op 32 bits, is uitputtend omkeerbaar — een volledige
regenboogtabel IPv4 → 8 hex-tekens is in minuten te bouwen op commodity-hardware.
De vingerafdruk (48 bits over `user-agent | accept-language | accept-encoding`) heeft
een nog veel kleinere effectieve entropie. Er is **geen salt, geen peper, geen HMAC-sleutel**.

De code claimt het tegenovergestelde. `schema.sql:176` stelt letterlijk:
`author_hash = opaque voterId (sha256(ip || fingerprint)), never PII`. Dat is
feitelijk onjuist: onder AVG-overweging 26 en EDPB-richtsnoer 05/2014 is een
omkeerbare hash **pseudonimisering, geen anonimisering**, en dus persoonsgegeven.

**Risico.** Een `zero_knowledge`-sessie — verkocht als de zwaarste privacygarantie —
onderdrukt alleen sentiment-analyse, XR-avatars en AI-insights
([`session-room-vote-admission.ts:198`](../../../functions/api/lib/session-room-vote-admission.ts),
[`insights-guards.ts:23`](../../../functions/api/lib/insights-guards.ts)). De stem zelf
wordt onverkort met een herleidbare IP-hash bewaard. Bij een medezeggenschapsstemming,
een integriteitsmelding of een vertrouwensvraag over een leidinggevende is dat het
verschil tussen een geldige en een onrechtmatige verwerking. Voegt zich bij AVG art. 5(1)(c),
art. 25 (privacy by design) en art. 32.

**Severity.** Critical — compliance + kernproductbelofte.

**Aanbevolen fix.**
1. Voer een **per-sessie salt** in: genereer bij `start()` een 32-byte random
   `session_voter_salt`, bewaar die in DO-storage, en hash
   `HMAC-SHA256(salt, ip || fingerprint)`. Dedupe blijft werken (binnen de sessie),
   cross-sessie-correlatie verdwijnt, en bij sessieafsluiting kan de salt gewist
   worden — wat de hashes onomkeerbaar máákt.
2. Gebruik de **volledige** 256-bits digest, niet `slice(0,8)`.
3. Voor `zero_knowledge`: schrijf helemaal geen `voter_id` weg (of een per-stem
   random ULID) en laat dedupe alleen in DO-geheugen leven voor de duur van de sessie.
4. Corrigeer de onjuiste claim in `schema.sql:176` en in de privacydocumentatie.

---

### C-2 · Geen enkele security-gate kan een merge tegenhouden

**Bevinding.** De repo wekt de indruk van een volwassen DevSecOps-pijplijn — CodeQL,
gitleaks, `npm audit`, jankurai, supply-chain-lane. Geen ervan kan falen.

*Bewijs:* [`ops/ci/supply-chain.sh`](../../../ops/ci/supply-chain.sh):
```bash
npm audit --audit-level=moderate || true          # kan nooit falen
docker run ... gitleaks detect --exit-code 0 || true   # kan nooit falen
npm ci --dry-run --silent | grep -q "added 0 packages" && ... || echo "⚠ ..."
```
[`.github/workflows/codeql.yml`](../../../.github/workflows/codeql.yml): beide stappen
staan op `continue-on-error: true`, met de kanttekening dat code scanning op een
private repo GHAS vereist — die er niet is. CodeQL levert dus **niets** op.
[`.github/workflows/jankurai.yml`](../../../.github/workflows/jankurai.yml): `--mode advisory`,
en 6 van de 8 lanes `continue-on-error: true`.

De "dependency provenance"-check is bovendien betekenisloos: een verse `npm ci --dry-run`
meldt altijd *N* toegevoegde packages, nooit `added 0 packages`, dus de `grep -q` faalt
per definitie en het script drukt permanent de waarschuwing af zonder gevolg.

**Risico.** Een kwetsbare dependency, een gelekt secret of een geïntroduceerde
injectie passeert de pipeline groen. De aanwezigheid van de tooling geeft een
vals gevoel van dekking — erger dan geen tooling, omdat het auditvragen afkoopt.

**Severity.** Critical (DevSecOps).

**Aanbevolen fix.**
- `npm audit --audit-level=high` zonder `|| true`, met een expliciet
  `.nsprc`/allowlist voor bewust geaccepteerde advisories inclusief vervaldatum.
- gitleaks: `--exit-code 1`, met `.gitleaksignore` voor bekende false positives.
- CodeQL: GHAS aanzetten (of overstappen op Semgrep OSS, dat wél werkt op private
  repos zonder licentie) en `continue-on-error` schrappen.
- Maak de lanes *required checks* in branch protection; zonder dat verandert een
  exit-code niets.

---

### C-3 · Negen open high-severity advisories, één in runtime-pad

**Bevinding.** `npm audit` levert 15 kwetsbaarheden (1 low, 5 moderate, 9 high).
Verreweg de meeste zitten in devDependencies (`wrangler` → `miniflare` → `sharp`,
`openapi-typescript` → `@redocly/openapi-core` → `js-yaml`, `qs`, `nanoid`).

Eén zit in het **runtime**-pad:

```
hono  <=4.13.4  (moderate ×3)
  GHSA-crvj-82cr-hjcx — query parser leest parameters ná het URL-fragment →
                         cache-key- en proxy-interpretatieverschillen
  GHSA-g6gw-c38x-mqfc — onbegrensde dot-notation-nesting in parseBody() →
                         geheugenuitputting
  GHSA-gqvv-2mrq-wpjv — toSSG() schrijft buiten de outputdirectory
```

**Waarom de eerste hier zwaarder weegt dan "moderate" suggereert.** Qesto draait op
Cloudflare met edge-caching: [`public/_headers`](../../../public/_headers) zet
`s-maxage=60` op de HTML-shell en de API zet cache-relevante headers per route.
Een discrepantie tussen hoe de Cloudflare-cache een URL normaliseert en hoe Hono
de query parseert is precies het recept voor cache-poisoning of cache-deception op
een multi-tenant endpoint.

De `js-yaml`-override in [`package.json`](../../../package.json) (`"js-yaml": "^4.3.1"`)
lost bovendien niets op: de advisory dekt `4.0.0 – 4.3.1` *inclusief*, en npm lost
op naar exact 4.3.1.

**Severity.** Critical (samengenomen; individueel High/Moderate).

**Aanbevolen fix.** `npm audit fix` draaien, Hono naar ≥ 4.13.5 tillen, de
`js-yaml`-override naar `^4.3.2` (of verwijderen zodra upstream meebeweegt), en
daarna C-2 implementeren zodat dit niet opnieuw wegzakt.

---

### C-4 · SAML-SP zonder handtekeningverificatie staat in de codebase

**Bevinding.** [`functions/api/lib/saml.ts`](../../../functions/api/lib/saml.ts)
implementeert `parseAssertion()` met regex-gebaseerde XML-parsing en **verifieert de
XML-DSig-handtekening niet**. Het team is hier volstrekt open over — de header van het
bestand beschrijft de kwetsbaarheid (CWE-347 / CWE-287) letterlijk, er zijn twee
onafhankelijke kill-switches (`SAML_SSO_ENABLED` + `SAML_SIGNATURE_VERIFY_ENABLED`,
beide `"false"` in [`wrangler.toml`](../../../wrangler.toml)), en de routes geven 503
([`routes/auth/saml.ts:33-52`](../../../functions/api/routes/auth/saml.ts)).

**Waarom het tóch Critical is.** De afstand tussen "veilig" en "volledige
authenticatiebypass voor elke gebruiker in elke tenant" is één `wrangler.toml`-regel.
Er is geen technische rem die voorkomt dat iemand die vlag omzet — geen assertie in
code, geen deploy-gate, geen test die faalt. Dat is een enkelvoudig, menselijk
faalpunt op de meest gevoelige control in het systeem.

Bovendien mist de parser náást de handtekening ook:
- `Conditions/@NotBefore` en `@NotOnOrAfter` (geldigheidsvenster)
- `InResponseTo` (koppeling aan de eigen AuthnRequest)
- `Destination` (audience-binding op transportniveau)
- replay-bescherming op `Assertion/@ID`

En regex-gebaseerde XML-parsing is óók ná het toevoegen van DSig kwetsbaar voor
XML Signature Wrapping en comment-truncation (CVE-2017-11427-klasse).

**Severity.** Critical (latent).

**Aanbevolen fix.**
1. Voeg een **compile-time/deploy-time gate** toe: een test die faalt zodra
   `SAML_SSO_ENABLED === 'true'` terwijl `verifyAssertionSignature` niet bestaat.
2. Overweeg de SAML-code tot die tijd uit de main-branch te halen (feature branch).
   Dode, gedocumenteerd-onveilige auth-code in `main` is een aansprakelijkheid.
3. Bij implementatie: gebruik een echte XML-parser + canonicalisatie (C14N), niet regex.
   Valideer `Conditions`, `InResponseTo`, `Destination`, en houd een replay-cache op
   `Assertion/@ID` in `ACTIONS_KV`.

---

## 2. Hoge bevindingen (High)

### H-1 · RBAC-matrix is dood gewicht — behalve voor platform-admin

**Bevinding.** [`functions/api/middleware/rbac.ts`](../../../functions/api/middleware/rbac.ts)
definieert een matrix van ~45 route→rol-mappings, haalt de rollen op uit D1, evalueert
`hasRequiredRole()` … en gooit het resultaat weg tenzij de route `platform_admin` vereist:

```ts
if (!hasRequiredRole(userRoles, requiredRoles)) {
  const isPlatformAuthorityRoute = requiredRoles.has('platform_admin')
  if (isPlatformAuthorityRoute) { /* 403 */ }
  // ← alle andere gevallen: geen return, valt door naar canAccess = true
}
c.set('canAccess', true)
```

De comment legt de redenering uit (grove globale rollen zouden fijnmazige
team-scoped checks *shadowen* en false denials geven). Die redenering is verdedigbaar.
De uitvoering niet: het resultaat is 40+ matrix-entries die suggereren dat er
autorisatie plaatsvindt waar die er niet is, plus een D1-query per request voor een
antwoord dat wordt genegeerd.

**Risico.** Iedere ontwikkelaar (of agent) die een nieuwe route toevoegt en een regel
in `PERMISSION_MATRIX` zet, gelooft redelijkerwijs dat de route beschermd is. Dat is
zij niet. Dit is een klassieke *broken access control by misleading abstraction*
(OWASP A01:2021). `canAccess` wordt bovendien altijd op `true` gezet en is daarmee
een betekenisloze context-variabele.

**Severity.** High.

**Aanbevolen fix.** Kies één model en wees er eerlijk over:
- **Optie A (aanbevolen):** verwijder alle niet-`platform_admin`-entries uit de matrix
  en hernoem de middleware naar `platformAdminGuard`. Wat overblijft doet wat het zegt.
- **Optie B:** maak de matrix autoritatief door hem *na* de in-route team-check te
  laten draaien en fijnmazige grants als rol te injecteren. Duurder, maar dan klopt
  het model.
Documenteer in `SPEC_BACKEND.md` expliciet dat object-level autorisatie in de route
zelf de enige echte gate is.

Aanvullend: de `SEED_ADMIN_EMAIL`-shortcut (`rbac.ts:236-241`) zet de rollen op
`['owner','admin','member','viewer']` én `canAccess = true` en keert terug **vóór**
de platform-admin-check — een e-mailadres in config is daarmee de facto
platform-superuser zonder `platform_admin`-rol. Hetzelfde patroon staat in
[`middleware/plan.ts:80`](../../../functions/api/middleware/plan.ts) voor
`SUPERUSER_EMAIL`. Beide zijn e-mail-gebaseerde backdoors zonder audit-trail-differentiatie.

---

### H-2 · Geen MFA — nergens

**Bevinding.** Een grep op `totp|mfa|two.factor|authenticator` over `functions/` en
`src/` levert **nul** resultaten.

De volledige authenticatie bestaat uit: magic link (15 min TTL), wachtwoord, of OAuth.
De sessie is een HS256-JWT met **14 dagen TTL**
([`routes/auth/constants.ts:3`](../../../functions/api/routes/auth/constants.ts)), in een
cookie met `SameSite=None`.

**Risico.** Het systeem bevat platform-admin-routes (gebruikersbeheer, suspend/restore,
audit-export, impersonation), SCIM-provisioning, Stripe-billing en tenant-overstijgende
forensics. Al die bevoegdheden hangen aan één wachtwoord plus een 14-daagse cookie.
OWASP ASVS V2.8 vereist MFA voor administratieve functies op L2; NIST SP 800-63B
plaatst dit op AAL2. Dit is bovendien een harde blocker in vrijwel elke enterprise
security-questionnaire — wat het een commercieel en niet alleen technisch probleem maakt.

**Severity.** High.

**Aanbevolen fix.**
1. TOTP (RFC 6238) is in WebCrypto in ~80 regels te bouwen; geen dependency nodig.
   Verplicht voor `platform_admin` en team-`owner`, optioneel daaronder.
2. Verkort de JWT-TTL naar 24 uur met een refresh-token met rotatie, of introduceer
   een `auth_time`-claim en vereis herauthenticatie voor gevoelige acties
   (step-up auth).
3. WebAuthn als vervolgstap voor enterprise-tier.

---

### H-3 · Wachtwoordreset beëindigt bestaande sessies niet

**Bevinding.** `POST /api/auth/password/reset-confirm`
([`routes/auth/password.ts:243-300`](../../../functions/api/routes/auth/password.ts))
schrijft de nieuwe hash, werkt `last_login_at` bij en zet een nieuwe sessiecookie.
Het roept **nooit** `revokedSessionTokenKey()` aan.

Er *is* een intrekkingsmechanisme — `ACTIONS_KV` + `hashSessionToken()`, gebruikt bij
logout ([`routes/auth/session-routes.ts:62,107`](../../../functions/api/routes/auth/session-routes.ts))
en bij admin-ingrijpen ([`routes/admin/user-support.ts:209`](../../../functions/api/routes/admin/user-support.ts)).
Het reset-pad gebruikt het niet.

**Risico.** Het klassieke account-takeover-herstelscenario: een aanvaller heeft een
sessie gekaapt, het slachtoffer reset het wachtwoord, en de aanvaller behoudt tot
14 dagen ongestoorde toegang. Wachtwoordreset is precies de handeling die dit hoort
te beëindigen. OWASP ASVS V3.3.3.

**Severity.** High.

**Aanbevolen fix.** Voer een per-gebruiker `sessions_valid_from`-timestamp in
(D1-kolom of `USERS_KV`). Zet die op `Date.now()` bij reset-confirm, wachtwoordwijziging
en e-mailwijziging; laat `authMiddleware` elke JWT met `iat < sessions_valid_from`
afwijzen. Dat is één KV-read die er al is (de revocation-check) en dekt alle tokens
tegelijk, in plaats van per-token intrekking die het reset-pad niet kan enumereren.

---

### H-4 · Rate limiting valt open en is niet atomair

**Bevinding.** Drie samengestelde problemen:

1. **Fail-open.** [`middleware/rate-limit.ts:109-122`](../../../functions/api/middleware/rate-limit.ts):
   bij een exception wordt alleen 503 teruggegeven als de vlag `RATE_LIMIT_FAIL_CLOSED`
   aan staat. Die vlag staat **niet** in `wrangler.toml`, dus `getFlag()` geeft `false`
   en de request gaat door. Een KV-storing schakelt daarmee álle rate limiting uit.
2. **Niet atomair.** `ATOMIC_RATE_LIMIT_ENABLED = "false"` in
   [`wrangler.toml`](../../../wrangler.toml), dus de Workers Rate Limiting-bindings
   (`RL_AUTH_BURST` et al.) zijn inert. Het actieve pad is een KV read-modify-write —
   zie [`middleware/public-api-auth.ts:37-57`](../../../functions/api/middleware/public-api-auth.ts):
   ```ts
   const count = Number((await rlKv.get(rlKey)) ?? '0')
   if (count >= KEY_LIMIT_PER_MIN) return { limited: true }
   await rlKv.put(rlKey, String(count + 1), ...)
   ```
   Cloudflare KV is *eventually consistent* met een cache-TTL van ~60s per colo.
   Parallelle requests — helemaal vanuit verschillende regio's — lezen dezelfde
   `count` en de limiet is in de praktijk een veelvoud van de bedoelde waarde.
3. **Alleen op IP.** De middleware sleutelt uitsluitend op `sha256(cf-connecting-ip)[0:16]`.
   Een botnet of een IPv6 /64 omzeilt dit; een kantoor achter NAT deelt één emmer.

**Gecombineerd risico.** Het inlogpad doet PBKDF2 met 600.000 iteraties
([`lib/password.ts:13`](../../../functions/api/lib/password.ts)). Dat is correct voor
opslag, maar het is ook ~200–400 ms CPU per poging. Met fail-open rate limiting is
dat een CPU-uitputtings-DoS met een amplificatiefactor van honderden: een
onbevoegde aanvaller dwingt de Worker tot zwaar cryptografisch werk per request.

**Severity.** High.

**Aanbevolen fix.**
- Zet `RATE_LIMIT_FAIL_CLOSED = "true"` in `wrangler.toml` — op auth-routes hoort
  fail-closed het standaardgedrag te zijn, niet een vlag.
- Rond WS-2 af en zet `ATOMIC_RATE_LIMIT_ENABLED = "true"`; de bindings staan al klaar.
- Voeg naast de IP-sleutel een account-sleutel toe (bestaat al op `/password/login`)
  en overweeg een Turnstile-challenge na *n* mislukte pogingen.

---

### H-5 · Post-deploy verificatie in CI is structureel kapot

**Bevinding.** De deploy-job in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
verifieert de API-gezondheid zo:

```bash
health=$(curl -sf https://qesto.cc/api/admin/health)
d1_ok=$(echo "$health" | jq -r '.d1')
kv_ok=$(echo "$health" | jq -r '.kv')
do_ok=$(echo "$health" | jq -r '.do')
if [ "$d1_ok" != "ok" ] || ... ; then exit 1; fi
```

De daadwerkelijke handler ([`functions/api/app.ts:275-292`](../../../functions/api/app.ts))
retourneert:

```json
{ "ok": true, "data": { "env": ..., "ts": ..., "region": ..., "readRegion": ... } }
```

Er is geen `.d1`, `.kv` of `.do` — op geen enkel niveau. `jq -r '.d1'` geeft `null`,
de vergelijking faalt, en de stap **exit 1**. Altijd. Er is geen tweede
`/api/admin/health`-registratie die dit zou kunnen redden (geverifieerd: de enige
handler staat in `app.ts`, vóór `mountAdminRoutes`, en Hono laat de eerste match winnen).

**Risico.** Drie gevolgen, oplopend in ernst:
1. De health-verificatie test niets.
2. De erna volgende stap (`smoke:platform`) draait nooit.
3. De deploy-job op `main` is permanent rood — ná de Pages-deploy en de cachepurge.
   Structureel rood groen-vinkje-gedrag traint een team om falende CI te negeren,
   wat de waarde van élke andere gate ondermijnt.

De healthcheck controleert daarnaast noch de Worker-API (die door deze workflow
helemaal niet gedeployed wordt, zie H-6), noch de echte D1/KV/DO-connectiviteit.

**Severity.** High.

**Aanbevolen fix.** Breid de handler uit met echte probes
(`SELECT 1`, een KV-`get` op een sentinel-key, een DO-`fetch` naar `/state`) onder
`data.checks.{d1,kv,do}`, en corrigeer de `jq`-paden naar `.data.checks.d1` etc.
Voeg een unittest toe die het contract tussen handler en CI-script vastlegt.

---

### H-6 · De Worker-API deployt buiten elke quality gate om

> **Correctie (2026-09-15, na publicatie).** De eerste versie van deze bevinding
> stelde dat de Worker-API handmatig gedeployed werd. Dat is onjuist. PR #872
> liet zien dat Cloudflare **Workers Builds** (Git-integratie) `qesto-api` bouwt
> en deployt op elke commit. De bevinding hieronder is herschreven op basis van
> dat bewijs; het werkelijke probleem is ernstiger dan het oorspronkelijk
> beschreven probleem.

**Bevinding.** Zowel `qesto-api` (Workers Builds) als `qesto` (Pages) zijn
**Git-geïntegreerd** in het Cloudflare-dashboard. Beide bouwen en deployen
rechtstreeks vanuit GitHub, buiten GitHub Actions om.

*Bewijs:* op PR #872 — een docs-only PR — meldde de `cloudflare-workers-and-pages`-bot:

```
✅ Deployment successful!  qesto-api   e4b747c5   Sep 15 2026, 07:03 AM
✅ Deploy successful!      qesto       e4b747c5   → 69bd9913.qesto.pages.dev
```

**Waarom dit een probleem is.** De wijziging raakte uitsluitend
`knowledge-base/`, wat in [`ci.yml`](../../../.github/workflows/ci.yml) onder
`paths-ignore` valt. Er draaide dus **geen enkele** test, geen `tsc --noEmit`,
geen architectuur-ratchet — en tóch is `qesto-api` gebouwd en gedeployed.

Dat is het algemene geval, niet een randgeval van docs-only PR's: de
Workers-Builds-pijplijn is *geen* consument van `ops/ci/quality-gates.sh`. Ze
draait haar eigen buildcommando en kent de gates niet. Concreet betekent dat:

1. **De quality gates bewaken de productie-API niet.** `npm test`, `tsc --noEmit`
   en de ratchets zijn hard rule #3/#4 in `CLAUDE.md`, maar ze staan niet in het
   pad dat de Worker daadwerkelijk live zet. Een rode CI blokkeert de
   API-deploy niet.
2. **De `environment: production`-approval gate wordt omzeild.** `ci.yml` zet die
   gate bewust op de deploy-job (met een comment die naar finding C2 van de
   infra-audit van juli verwijst). Workers Builds kent hem niet.
3. **`scripts/deploy-api.mjs` is niet het productiepad.** Dat script zet
   `--var=COMMIT_SHA:<sha>`, een `--tag` en een dirty-tree-guard. Workers Builds
   draait het niet, dus `COMMIT_SHA` blijft `"dev"` uit
   [`wrangler.toml`](../../../wrangler.toml). Geverifieerd tegen de live API:

   ```
   $ curl -s https://qesto.cc/api/version
   {"ok":true,"data":{"env":"production","commit":"dev"},"trace_id":"..."}

   $ curl -sI https://qesto.cc/api/version | grep x-qesto-api-commit
   x-qesto-api-commit: dev
   ```

   De productie-API kan dus niet zeggen welke commit zij draait. Daarmee is de
   commit-pariteitscheck in `scripts/verify-deploy.mjs` structureel onhaalbaar
   (hij vergelijkt `GITHUB_SHA` met deze waarde), en is er geen enkele manier om
   een productie-incident aan een commit te koppelen. Dit sluit direct aan op H-5.
4. **De Pages-deploy gebeurt twee keer.** `ci.yml` draait
   `wrangler pages deploy dist` terwijl de Pages-Git-integratie hetzelfde project
   al deployt. Op elke push naar `main` racen twee deploys van dezelfde commit
   naar hetzelfde project.
5. **De configuratie staat nergens in de repo.** Er is geen build-config in
   `wrangler.toml` en geen deployment-doc die de Git-integratie beschrijft. Het
   werkelijke deploymentmodel is alleen zichtbaar in het Cloudflare-dashboard —
   niet reviewbaar, niet versiebeheerd, niet herstelbaar bij accountverlies.

**Severity.** High.

**Aanbevolen fix.** Kies één pad en maak het het enige:
- **Optie A (aanbevolen):** zet de Git-integratie uit voor beide projecten en laat
  GitHub Actions deployen, met de API vóór de frontend, beide onder
  `environment: production` en achter de gates. `deploy-api.mjs` wordt dan wél
  het productiepad en `COMMIT_SHA` klopt.
- **Optie B:** houd Workers Builds, maar zet in het buildcommando van het
  dashboard `npm run check:rc && npx wrangler deploy --var=COMMIT_SHA:$CF_VERSION_METADATA_ID`,
  beperk de Git-integratie tot de `main`-branch, en leg de dashboardconfiguratie
  vast in `knowledge-base/operations/deployment/`.

Verwijder in beide gevallen de dubbele Pages-deploy.

---

### H-7 · Publieke source maps in productie

**Bevinding.** [`vite.config.ts:43`](../../../vite.config.ts) zet `sourcemap: true` in
de productiebuild. De `.map`-bestanden worden mee gedeployed naar Pages en zijn via
`/assets/*` publiek bereikbaar — met `Cache-Control: max-age=31536000, immutable`.

**Risico.** Volledige, onverkleinde broncode van de SPA is voor iedereen leesbaar:
interne routenamen, feature-flag-namen, plan-gating-logica, commentaren over
niet-uitgerolde functionaliteit en de exacte vorm van elke API-aanroep. Dat verkort
de verkenningsfase van een aanvaller aanzienlijk (OWASP A05:2021 — Security
Misconfiguration).

**Severity.** High.

**Aanbevolen fix.** `sourcemap: 'hidden'` — de maps worden dan wél gegenereerd
(bruikbaar voor een error-tracker) maar niet via een `//# sourceMappingURL`-comment
aan de browser aangeboden. Upload ze naar Sentry/Cloudflare en sluit `*.map` uit
van de Pages-publicatie, of blokkeer ze in `public/_headers`.

---

### H-8 · Geen e-mailverificatie bij wachtwoord-signup

**Bevinding.** `POST /api/auth/password/signup`
([`routes/auth/password.ts:29-113`](../../../functions/api/routes/auth/password.ts))
maakt de gebruiker aan, roept `ensurePersonalTeam()` aan en zet direct een geldige
14-daagse sessiecookie. Er wordt geen verificatiemail verstuurd en `email_verified`
bestaat niet in het model.

De enige rem is `isDisposableEmail()` — een domeinblokkade, geen bewijs van bezit.

**Risico.** Iedereen kan een account registreren op een e-mailadres dat hij niet
bezit. Wanneer daar later domeingebaseerde teamkoppeling, SSO-domeinclaims of
uitnodigingsflows op worden gebouwd (`lib/email-domain.ts`, `lib/connect-invite.ts`
bestaan al), wordt dit een tenant-overname-primitief. Ook direct: reputatieschade
en spamblokkade doordat onbevestigde adressen productmail ontvangen.

**Severity.** High.

**Aanbevolen fix.** Voeg `users.email_verified_at` toe. Sta na signup een beperkte
sessie toe (eigen sessies aanmaken mag; teamkoppeling, uitnodigingen accepteren en
billing niet) totdat de verificatielink gevolgd is. De magic-link-infrastructuur
(`lib/tokens.ts`) is hier één-op-één voor herbruikbaar.

---

### H-9 · Wachtwoordreset-aanvraag heeft geen rate limit

**Bevinding.** `POST /api/auth/password/reset-request`
([`routes/auth/password.ts:205-242`](../../../functions/api/routes/auth/password.ts))
is het enige auth-endpoint zónder limiter. `/password/login` en `/password/signup`
hebben er twee (IP + e-mail); `/api/auth/request` heeft er een in `app.ts`. Dit endpoint
heeft er geen.

**Risico.**
- **E-mailbombardement**: onbeperkt resetmails naar een slachtoffer, met directe
  Resend-kosten en een reëel risico op domeinreputatieschade.
- **Gebruikersenumeratie via timing**: het antwoord is altijd `202`, maar de
  `if (user)`-tak doet een KV-write plus een netwerkcall naar Resend. Het
  responstijdverschil is in de tientallen tot honderden milliseconden — ruim
  meetbaar. ASVS V2.2.1 / V3.2.

**Severity.** High.

**Aanbevolen fix.** Pas hetzelfde `atomicRateLimitDual`-patroon toe als op
`/password/login` (IP + e-mail). Verplaats de mailverzending naar
`c.executionCtx.waitUntil()` zodat de responstijd constant is ongeacht of het
account bestaat.

---

## 3. Middelhoge bevindingen (Medium)

### M-1 · Middleware-ordening bepaalt autorisatie — en de volgorde is fragiel

`createApp()` ([`functions/api/app.ts`](../../../functions/api/app.ts)) is 380 regels
waarvan een groot deel bestaat uit ~90 `mountXxxRoutes(app)`-aanroepen waarvan de
**volgorde beveiligingsbetekenis heeft**. Het bestand documenteert dit uitvoerig:

> "PUBLIC routes must be mounted before the first auth-middleware sub-app"

`softAuthMiddleware` en `rbacMiddleware` worden op `/api/*` geregistreerd ná
`mountPublicApiV1/2/3Routes`, `mountPlatformRoutes`, `mountDeveloperPortalRoutes` en
`mountScimRoutes`. In Hono geldt registratievolgorde, dus die sub-apps zien **nooit**
RBAC. Ze hebben eigen auth (API-key of `adminMiddleware`), dus er is vandaag geen gat —
maar het model is dat een verkeerd geplaatste regel stilzwijgend autorisatie uitschakelt,
zonder dat een test of type dat opmerkt.

De tracker noemt dit ARCH-HONO-01/02 en het staat al open sinds een D1-incident op
2026-07-03 (waar dezelfde dubbele registratie een 10× D1-versterking veroorzaakte).

**Fix.** Hoist auth/plan naar één `app.use('/api/*', …)` met een expliciete
`PUBLIC_ROUTES`-allowlist, en voeg een test toe die over alle geregistreerde routes
itereert en asserteert dat elke niet-allowlisted route 401 geeft zonder credentials.
Dat maakt de ordening controleerbaar in plaats van conventioneel.

### M-2 · Twee D1-queries plus een KV-read vóór elke route

Per geauthenticeerde request:
- `authMiddleware` → KV-read op de intrekkingslijst
- `planMiddleware` → `SELECT plan FROM users WHERE id = ?`
- `rbacMiddleware` → `SELECT role FROM user_roles WHERE user_id = ?`

Er is geen caching (`middleware/kv-cache.ts` bestaat maar wordt hier niet gebruikt).
Dat is ~15–40 ms extra latency per request bij een warme D1, en een lineair
meeschalende D1-leesrekening. Het is bovendien precies het pad dat in het
D1-incident van juli tot 13-secondenrequests leidde.

De RBAC-query is extra pijnlijk omdat de uitkomst voor de meeste routes wordt
weggegooid (H-1).

**Fix.** Neem `plan` en `roles` op als claims in de JWT met een korte TTL, of cache
ze per gebruiker in KV met een `expirationTtl` van 60s en invalideer bij
rolwijziging. Sla de RBAC-query volledig over zodra H-1 is opgelost.

### M-3 · KV-write per API-key-request

[`middleware/public-api-auth.ts:111-114`](../../../functions/api/middleware/public-api-auth.ts)
schrijft na élke geslaagde API-key-request het volledige key-record terug om
`lastUsedAt` bij te werken.

Cloudflare KV staat ~1 write/seconde per key toe. De key-limiet is 120 req/min
(2/s) — dus bij normaal gebruik zit de write-rate boven de limiet, met
write-contentie en verloren updates tot gevolg. Daarnaast: KV-writes kosten ~$5 per
miljoen, dus dit is een directe, lineair meeschalende kostenpost voor een veld dat
niemand per seconde nodig heeft.

**Fix.** Update `lastUsedAt` hoogstens één keer per 5 minuten (vergelijk de
opgeslagen waarde voordat je schrijft), of schrijf het als Analytics-Engine-event
in plaats van als KV-write.

### M-4 · `/display/*` heeft tegenstrijdige framing-headers

[`public/_headers`](../../../public/_headers) zet voor `/display/*`:
`X-Frame-Options: SAMEORIGIN` én `Content-Security-Policy: … frame-ancestors *`.

Die spreken elkaar tegen. Moderne browsers geven voorrang aan `frame-ancestors`, dus
het effectieve beleid is "iedereen mag framen" — terwijl de XFO-regel suggereert dat
het beperkt is. Voor een pagina die live sessieresultaten toont is dat een
clickjacking- en misleidingsvector (een aanvallerspagina frame't een echte Qesto-display
en zet er eigen context omheen).

**Fix.** Kies bewust. Als embedding gewenst is (PowerPoint-viewer wordt genoemd):
verwijder de XFO-regel en vervang `frame-ancestors *` door een allowlist van de
daadwerkelijk benodigde origins.

### M-5 · CSP mist `base-uri` en `object-src`

De SPA-CSP zet `default-src 'self'` maar geen `base-uri` en geen `object-src`.
`default-src` dekt `object-src` wel maar `base-uri` níét — dat valt terug op "alles
toegestaan". Bij een toekomstige HTML-injectie maakt een `<base href>` alle relatieve
script-URL's kaapbaar. Nu geen exploiteerbaar pad (er zijn nul XSS-sinks), maar het is
één regel defense-in-depth. De API-CSP dóét dit wel goed
(`base-uri 'none'` in `middleware/security-headers.ts`) — de inconsistentie is het signaal.

**Fix.** `base-uri 'self'; object-src 'none';` toevoegen aan beide CSP-regels in
`public/_headers`.

### M-6 · De API is bereikbaar op een tweede, ongeharde origin

`public/_headers` staat `connect-src … https://qesto-api.oostelaar.workers.dev` toe.
Die `workers.dev`-route omzeilt alles wat op de `qesto.cc`-zone is geconfigureerd:
WAF-regels, bot management, rate limiting op zoneniveau, custom firewall rules.
De hostname lekt bovendien de persoonlijke Cloudflare-accountnaam.

**Fix.** Zet `workers_dev = false` in `wrangler.toml` en verwijder de host uit de CSP.
Als de route nodig is voor debugging, zet er Cloudflare Access voor.

### M-7 · CSRF laat requests zonder `Origin` én `Referer` door

[`middleware/csrf.ts:104-134`](../../../functions/api/middleware/csrf.ts) weigert alleen
wanneer een `Origin`- of `Referer`-header aanwezig is én afwijkt. Ontbreken beide, dan
gaat de request door. De code documenteert de restrisico's uitvoerig en de redenering
(niet-browser-integraties niet breken) is legitiem, want moderne browsers sturen
`Origin` op alle state-changing requests inclusief form-POSTs.

Het restrisico is reëel maar smal: elke houder van een geldige sessiecookie die
requests zonder `Origin` kan uitlokken. De code noemt zelf de juiste mitigatie
(verplichte custom header op muterende requests) maar implementeert die niet.

**Fix.** Vereis `X-Qesto-Client: web` op alle muterende requests vanuit de SPA
(`src/api/client.ts` zet hem, `csrfMiddleware` eist hem). CORS blokkeert het zetten
van custom headers cross-origin zonder geslaagde preflight, dus dit dicht het gat
zonder server-naar-server-integraties te breken (die gebruiken API-keys, niet cookies).

### M-8 · CORS en CSRF vertrouwen elke `*.qesto.pages.dev`-preview

Zowel [`app.ts:130`](../../../functions/api/app.ts) als
[`csrf.ts:121`](../../../functions/api/middleware/csrf.ts) accepteren
`^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$` als volwaardige origin, mét
`credentials: true`.

Elke preview-deploy — inclusief die van een niet-gereviewde branch — is daarmee een
volledig vertrouwde origin tegen **productie**. PR #872 bevestigt de vorm: de
hash-preview `https://69bd9913.qesto.pages.dev` matcht de regex exact. (De
branch-preview `claude-codebase-technical-au.qesto.pages.dev` matcht níét, omdat
de regex geen koppeltekens toestaat — de dekking is dus grillig, niet bewust.) Eén kwaadaardige of gecompromitteerde
preview-build kan geauthenticeerde, state-changing requests doen namens elke ingelogde
gebruiker die hem bezoekt.

**Fix.** Laat previews tegen een staging-API praten, niet tegen productie. Of vereis
Cloudflare Access op preview-deploys. De regex-uitzondering hoort niet in het
productie-pad thuis.

### M-9 · Impersonatie-tokens zijn niet onderscheidbaar op sleutelniveau

[`middleware/auth.ts:75-88`](../../../functions/api/middleware/auth.ts) accepteert een
impersonatie-cookie als het een geldige JWT is waarvan `jti` begint met `imp:`. Het
token wordt ondertekend met **hetzelfde** `JWT_SECRET` als gewone sessies.

De veiligheid berust er volledig op dat geen enkel ander codepad ooit een JWT mint
met een aanroeper-beïnvloedbare `jti`. Dat klopt vandaag (geverifieerd), maar het is
een niet-afgedwongen invariant over ~90 route-modules heen, zonder test die hem bewaakt.
Er is bovendien geen server-side registratie van actieve impersonatie-sessies — wordt
een platform-admin gedegradeerd, dan blijft zijn impersonatie-cookie geldig tot de
JWT verloopt.

**Fix.** Onderteken impersonatie-tokens met een apart secret (`IMPERSONATION_SECRET`),
geef ze een TTL van maximaal 30 minuten, en registreer elke actieve impersonatie in
`ACTIONS_KV` zodat intrekken mogelijk is. Voeg een test toe die asserteert dat geen
enkel mint-pad een `jti` met prefix `imp:` accepteert uit gebruikersinvoer.

### M-10 · Protocol-v2-onderhandeling is dood code

[`lib/session-room-ws-upgrade.ts:74-76`](../../../functions/api/lib/session-room-ws-upgrade.ts)
leest `x-qesto-protocol-version` om `attachment.protocolVersion` te zetten, en regel
104-112 vuurt een `realtime.v2_negotiated`-metric wanneer die gelijk is aan
`LIVE_PROTOCOL_VERSION_V2`.

De enige plek die `x-qesto-*`-headers zet is
[`routes/sessions/public.ts:136-145`](../../../functions/api/routes/sessions/public.ts),
en die zet `x-qesto-protocol-version` **niet**. Het veld is dus altijd `undefined`,
v2 wordt nooit onderhandeld, en de metric vuurt nooit. Wie de dashboards leest
concludeert dat niemand v2 gebruikt — terwijl de oorzaak een ontbrekende header is.

**Fix.** Zet de header in `public.ts` op basis van het aangeboden subprotocol, of
verwijder de tak en de metric.

### M-11 · Customer-Managed Keys is een leeg omhulsel

[`lib/cmk.ts`](../../../functions/api/lib/cmk.ts) definieert een `CmkEnvelope` met
`algorithm: 'AES-256-GCM'`, `rotatedAt` en `status` — en verder niets. Er is geen
sleutelmateriaal, geen envelope-wrapping, geen encryptie. `GET /api/forensics/cmk/:teamId`
([`routes/forensics.ts:48-51`](../../../functions/api/routes/forensics.ts)) geeft dit terug
aan admins alsof het een echte crypto-configuratie is.

**Positief:** de marketingpagina's zijn hier wél eerlijk over —
[`src/pages/Pricing.tsx:294`](../../../src/pages/Pricing.tsx) en
[`src/pages/Privacy.tsx:233`](../../../src/pages/Privacy.tsx) plaatsen CMK expliciet op
de roadmap. De `check:compliance-claims`-gate bewaakt dat actief. Dat is goed werk.

**Risico.** Het interne endpoint suggereert een control die niet bestaat. In een
SOC 2- of klantaudit is een endpoint dat `AES-256-GCM` rapporteert zonder encryptie
een bevinding, ongeacht wat de pricingpagina zegt.

**Fix.** Hernoem het type naar `CmkIntentDeclaration`, laat het endpoint expliciet
`"status": "not_implemented"` teruggeven, of verwijder het tot de implementatie er is.

### M-12 · Scope-explosie in verhouding tot de fase

395 route-registraties over 84 modules, op `version 0.1.0`, met 42% regeldekking.
De routelijst bevat onder meer: SCIM, LDAP, SAML, federation, multi-region-admin,
sovereign, marketplace-connect + payouts, partner-portal + SLA + branding,
tenant-namespaces, forensics, breach, workflows, LTI, XR, captions, developer-portal
en drie versies van een publieke API.

Voor een realtime-pollingproduct dat v1 nog niet heeft gehaald is dit een
YAGNI-schending op systeemniveau. De concrete kosten die deze audit aanwijsbaar
maakt: elke module is aanvalsoppervlak dat de RBAC-laag niet dekt (H-1), elke module
is code die de 42%-dekking verdunt, en elke module is een pad dat de ordeningsregel
in `app.ts` (M-1) moet respecteren zonder dat iets dat afdwingt.

**Fix.** Dit is een productbeslissing, geen refactor. Concreet voorstel: markeer elke
module die geen betalende gebruiker heeft als `EPIC-VALID`-gated (het mechanisme
bestaat al per ADR-0064), haal ze uit `app.ts` achter één feature-flag per module, en
laat ze niet meetellen in het RC-gate. Dat verkleint het productie-oppervlak zonder
werk weg te gooien.

### M-13 · Testdekking van 42% regels / 30% branches

[`vite.config.ts:113-118`](../../../vite.config.ts) legt de drempels vast op
41/30/37/42 (statements/branches/functions/lines). De commentaarregels zijn
voorbeeldig eerlijk — inclusief de vermelding dat de drempels onder vitest v3 op de
verkeerde plek stonden en stilzwijgend genegeerd werden terwijl de dekking ~31% was.

Maar 30% branchdekking op een codebase met deze hoeveelheid autorisatie-,
plan-gating- en state-machine-vertakkingen betekent dat het merendeel van de
beslispunten ongetest is. De 2.706 slagende tests geven een geruststelling die de
dekking niet onderbouwt.

**Fix.** Ratchet gericht in plaats van uniform: eis 90% branchdekking op
`functions/api/middleware/**`, `functions/api/lib/{jwt,password,authz,embed-token}.ts`
en `functions/api/lib/session-room-vote*.ts`. Die bestanden zijn klein en
veiligheidskritiek; het totaalgetal mag daarna langzaam meestijgen.

### M-14 · Vijf van vijf cron-slots bezet

`wrangler.toml` merkt op: "Cloudflare allows at most 5 cron triggers per Worker — we
are at the limit." De vijf triggers dragen samen zes verschillende taken (KB-health,
KV-backup, Content Engine, Mention Monitor, OAuth-refresh), gemultiplext op
expressie-matching in `handleScheduled`.

**Risico.** Dit is een harde platformmuur die al geraakt is. Elke volgende
achtergrondtaak moet meeliften op een bestaande expressie, wat de scheduling-logica
tot een groeiende `if/else`-keten op cron-strings maakt — en een fout in één taak
kan de andere in dezelfde invocatie meeslepen.

**Fix.** Verplaats achtergrondwerk naar Cloudflare Queues (de producer-binding staat
al uitgecommentarieerd klaar in `wrangler.toml`) of splits een tweede Worker af die
uitsluitend scheduled work draait.

### M-15 · Geen omgevingsscheiding in `wrangler.toml`

`[vars]` bevat `ENV = "production"` en er is geen `[env.staging]` of `[env.preview]`
(bewust weggelaten, aldus de comment). Het gevolg is dat lokale `wrangler dev`
draait met `ENV="production"` — wat de code op meerdere plekken moet compenseren,
bijvoorbeeld in `csrf.ts:130` met een `apiIsLocal`-detectie.

Dit is een Twelve-Factor-schending (factor III: strikte scheiding config/code) en
tegelijk het soort compensatielogica dat later een gat wordt.

**Fix.** Definieer `[env.staging]` en `[env.dev]` met de juiste `ENV`-waarde en
gescheiden resource-ID's. Dat maakt de `apiIsLocal`-heuristiek overbodig.

### M-16 · Dev-only audittool in `dependencies`

`jankurai-workspace` (`github:neverhuman/jankurai#v1.6.10`) staat in `dependencies`,
niet in `devDependencies`. Het wordt door `npm ci` in de deploy-job geïnstalleerd.

**Positief:** de lockfile pint op een volledige commit-SHA
(`3c804453e6c7a6e0e4028d95cc3bccea467277ef`) met integrity-hash, dus het
verplaatsbare-git-tag-risico is afgedekt. Dat is correct gedaan.

**Risico.** Het is een Rust-CLI van een externe GitHub-gebruiker die in CI wordt
gebouwd (`cargo install --path node_modules/...`) en uitgevoerd. In `dependencies`
plaatsen is een classificatiefout die het in het productie-installatiepad brengt.

**Fix.** Verplaats naar `devDependencies`.

### M-17 · Dependabot ziet meer dan `npm audit`, en negeert major-bumps

Bij het pushen van deze audit meldde GitHub:

> GitHub found 23 vulnerabilities on SolarnodeCC/Qesto's default branch (15 high, 8 moderate).

Lokaal levert `npm audit` er 15 (9 high). Het verschil van acht komt doordat
Dependabot ook GitHub-Actions-dependencies en transitieve paden meeneemt die
`npm audit` niet in dezelfde vorm rapporteert. Er staan dus meer open advisories
dan de lokale lane laat zien — en omdat geen enkele lane blokkeert (C-2) wordt
geen van beide getallen ergens afgedwongen.

Daarnaast bevat [`.github/dependabot.yml`](../../../.github/dependabot.yml) voor het
npm-ecosysteem:

```yaml
ignore:
- dependency-name: "*"
  update-types: [version-update:semver-major]
```

Version-update-PR's voor majors worden daarmee onderdrukt. Dat is een redelijke
keuze voor routine-updates, maar het betekent dat een advisory waarvan de fix pas
in een nieuwe major landt, nooit als PR verschijnt. (Dependabot *security* updates
zijn een aparte repo-instelling en negeren deze regel; of die aanstaat is vanuit
de repo niet vast te stellen — zie §7.)

**Fix.** Zet Dependabot security updates expliciet aan in de repo-instellingen,
werk de 23 openstaande advisories weg, en koppel de telling aan de blokkerende
`npm audit`-gate uit C-2 zodat er één getal is dat telt.

---

## 4. Lage bevindingen (Low)

| # | Bevinding | Bestand | Fix |
|---|---|---|---|
| L-1 | `timingSafeEqual` keert vroeg terug bij lengteverschil — lekt alleen lengte, acceptabel, maar niet voor variabele-lengte secrets | `lib/shared/crypto.ts:31` | Documenteer de aanname of hash beide zijden eerst |
| L-2 | PII-redactiepatroon `[a-f0-9]{40}` redigeert élke 40-hex-string, inclusief git-SHA's | `lib/log.ts:54` | Anker op context (`token=`, `Bearer `) |
| L-3 | 41 rauwe `console.*`-aanroepen omzeilen de redactielaag; enkele loggen `userId` | `middleware/rbac.ts:190`, `routes/auth/password.ts:176` e.a. | Route alles via `logEvent`/`safeLogContext` en voeg een lint-regel toe |
| L-4 | `SUPERUSER_EMAIL`-shortcut zet `plan` maar niet `plan_stored` → billing rapporteert `team` i.p.v. de werkelijke tier | `middleware/plan.ts:80-85` | Zet beide |
| L-5 | `manualChunks` matcht `id.includes('react')` — vangt elk pad met "react" erin | `vite.config.ts:55` | Match op `/node_modules/react(-dom)?/` |
| L-6 | Wachtwoordbeleid is `min(8).max(128)` zonder breach-check | `routes/auth/schemas.ts:6` | NIST 800-63B: check tegen HIBP k-anonymity of een top-10k-lijst |
| L-7 | `purge_everything: true` bij elke deploy — wereldwijde koude cache | `.github/workflows/ci.yml` | Purge op prefix/tag, of vertrouw op content-hashing |
| L-8 | `img-src` staat `api.qrserver.com` toe terwijl `react-qr-code` lokaal rendert | `public/_headers` | Verwijderen — anders lekken joincodes naar een derde partij |
| L-9 | DNS-rebinding blijft open in de SSRF-filter (erkend in de code) | `lib/webhook-url.ts:96` | Accepteer als restrisico; documenteer in het threat model |
| L-10 | `API_KEY_RECORD_TTL_SECONDS = 1 jaar` op het KV-record — een ongebruikte key verdwijnt stil | `lib/constants.ts:53` | Zet geen TTL op het record; verloop hoort in `expiresAt` |

---

## 5. Wat expliciet goed is

Deze punten zijn geverifieerd en verdienen vermelding, al was het maar zodat ze bij
een refactor niet per ongeluk sneuvelen.

- **SQL-injectie: geen enkele vindplaats.** Alle 19 gevallen van dynamische
  SQL-opbouw interpoleren uitsluitend *structuur* (kolomlijsten, `SET`-fragmenten,
  placeholder-nummers) die uit vaste veldnamen komt; élke waarde gaat via `.bind()`.
  Dit is consequent volgehouden over de hele codebase.
- **XSS: nul sinks.** Geen `dangerouslySetInnerHTML`, geen `innerHTML =`, geen `eval`,
  geen `new Function` in `src/` of `functions/`.
- **Wachtwoordopslag.** PBKDF2-SHA256, 600k iteraties (OWASP 2023-minimum),
  16-byte salt, zelfbeschrijvend hashformaat met transparante upgrade-on-login voor
  legacy-hashes. Exemplarisch.
- **SSRF-filter.** `normalizeIpv4()` dekt decimale, hex-, octale en short-form
  IPv4-notaties plus IPv4-mapped IPv6 — inclusief `169.254.169.254`. Beduidend
  grondiger dan de gebruikelijke dotted-quad-check.
- **Stripe-webhookverificatie.** Meerdere `v1`-handtekeningen tijdens rotatie,
  tolerantievenster in beide richtingen, event-ID-idempotentie in D1. Correct.
- **WebSocket-vertrouwensgrens.** `routes/sessions/public.ts` bouwt een **nieuw**
  header-object voor de DO-fetch in plaats van de client-request door te sturen.
  Rol, voter-ID en permissies zijn daardoor niet spoofbaar. De expliciete
  intrekkings-hercontrole op het presenter-pad (regel 104-110) toont dat er over
  nagedacht is.
- **Analytics-consent.** Microsoft Clarity laadt pas ná expliciete toestemming
  (`useCookieConsent` → `loadClarity`). Geen tag in `index.html`. Correct uitgevoerd.
- **Codehygiëne.** 2 TODO's, 0 `@ts-ignore`, 26 `any`'s en 10 `as unknown as` op
  104k regels; `tsc --noEmit` schoon; 2.706/2.706 tests groen. Dit is beter dan
  het overgrote deel van vergelijkbare codebases.
- **Architectuur-ratchets.** `check-kv-access`, `check-d1-access`, `check-ai-gateway`,
  `check-error-response`, `check-no-any`, `check-test-traceability` — anti-patronen
  worden geteld en mogen alleen krimpen. Dit is een goed mechanisme, en het is
  wél blokkerend (in tegenstelling tot de security-lanes).
- **Eerlijke documentatie.** Opvallend veel commentaar benoemt actief de eigen
  tekortkomingen (de vitest-drempelbug, de CSRF-restrisico's, de SAML-kwetsbaarheid,
  het D1-incident). Dat is zeldzaam en maakt een audit als deze aanzienlijk sneller.

---

## 6. Aanbevolen volgorde

**Sprint 1 — stop de bloeding (≈ 13 pt)**
1. C-2: security-gates blokkerend maken (`|| true` weg, `--exit-code 1`, required checks)
2. C-3: `npm audit fix`; Hono ≥ 4.13.5; `js-yaml`-override corrigeren
3. H-5: healthcheck-contract repareren (handler + `jq`-paden + contracttest)
4. H-7: `sourcemap: 'hidden'`
5. H-4: `RATE_LIMIT_FAIL_CLOSED = "true"`

**Sprint 2 — authenticatie-integriteit (≈ 21 pt)**
6. H-3: `sessions_valid_from` + intrekking bij reset/wachtwoordwijziging
7. H-8: e-mailverificatie met beperkte sessie tot bevestiging
8. H-9: rate limit op reset-request + constante responstijd
9. H-2: TOTP voor `platform_admin` en team-`owner`
10. C-4: deploy-gate die SAML-activering zonder DSig onmogelijk maakt

**Sprint 3 — privacy-kernbelofte (≈ 13 pt)**
11. C-1: per-sessie salt op de voter-hash; `zero_knowledge` schrijft geen `voter_id`;
    migratiepad voor bestaande rijen; documentatieclaims corrigeren

**Sprint 4 — structurele schuld (≈ 21 pt)**
12. H-1: RBAC eerlijk maken (Optie A) — schrapt tegelijk een D1-query per request
13. M-1: auth/plan hoisten met allowlist + route-dekkingstest
14. H-6: één deploypad kiezen — gates en approval gate vóór de API-deploy
15. M-2/M-3: caching van plan/rollen; `lastUsedAt` niet per request schrijven

**Doorlopend**
16. M-12: scope-beslissing over de 84 routemodules
17. M-13: gerichte branch-dekkingsratchet op de veiligheidskritieke bestanden

---

## 7. Verificatie

Uitgevoerd tijdens deze audit op commit `8eab268`:

```
npx tsc --noEmit          → exit 0, geen fouten
npx vitest run            → 316 bestanden, 2.706 tests, allemaal groen (78,8s)
npm audit                 → 15 kwetsbaarheden (1 low, 5 moderate, 9 high)
npm audit --omit=dev      → 1 moderate (hono)
GitHub Dependabot         → 23 kwetsbaarheden op de default branch (15 high, 8 moderate)
curl https://qesto.cc/api/version  → {"env":"production","commit":"dev"}
PR #872 checks            → Cloudflare Pages ✅ + Workers Builds ✅ op een docs-only
                            PR waar ci.yml door paths-ignore geen enkele test draaide
git grep <secret-patronen> → geen gecommitteerde secrets
```

Niet uitgevoerd (buiten bereik van een statische audit): dynamische pentest tegen
de draaiende omgeving, load-/stresstests tegen de Durable Object, verificatie van
de daadwerkelijke branch-protection-instellingen en Environment-reviewers op GitHub,
inspectie van de live Cloudflare-configuratie (WAF, zone-instellingen,
secret-inventaris) en de Dependabot-security-update-instelling.
Bevindingen H-5, M-6 en C-2 zouden met toegang tot die oppervlakken scherper te
kwantificeren zijn.

**Correctie na publicatie.** H-6 is herschreven nadat de deploy-bots op PR #872
aantoonden dat de oorspronkelijke lezing ("de API-deploy is handmatig") onjuist
was. De Git-integratie van Cloudflare is dashboardconfiguratie en daarom niet
vanuit de repo zichtbaar; zij kwam pas aan het licht doordat deze audit zelf een
PR opende. Dat is precies het punt van H-6 §5: het werkelijke deploymentmodel
staat nergens in versiebeheer. Andere bevindingen die op dashboardconfiguratie
leunen (branch protection, Environment-reviewers, Dependabot security updates,
WAF-regels) kunnen om dezelfde reden afwijken van wat de repo suggereert en
verdienen verificatie in het dashboard vóór triage.
