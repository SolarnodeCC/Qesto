# Conversie-review — Landing (`Home`), Pricing & Login

**Reviewer:** Senior Content & Conversie Reviewer
**Datum:** 2026-06-20
**Scope:** `src/pages/Home.tsx`, `src/pages/Pricing.tsx`, `src/pages/Login.tsx` (de conversie-trechter: landing → pricing → account-aanmaak). Locale-strings uit `public/locales/en/{home,auth}.json`.

## Wat is gecontroleerd en wat niet

- **Wél:** copy/structuur/CTA's van de landing, de pricing-pagina en de login-stap (het feitelijke conversiepunt — beide hero-CTA's en alle pricing-CTA's eindigen op `/login`).
- **Niet:** mobiele rendering (alleen broncode bekeken, geen device-test), `src/pages/solutions/*`, `use-cases/*` en `features/*` (buiten scope), e-mail/ads-consistentie, en er is **geen A/B-test- of analytics-data** beschikbaar — alle impact-inschattingen zijn op basis van CRO-principes, niet op gemeten cijfers van deze site.

## Context & aannames (open risico's)

De doelgroep is afleidbaar uit de copy: **facilitators, trainers, docenten en teamleiders** (B2B/prosumer SaaS). Funnel-stadium van de landing is gemengd: het taalgebruik veronderstelt dat de bezoeker al weet wat "live polling" is, terwijl een koude bezoeker dat nog niet weet.

**Open risico — primair conversiedoel is niet eenduidig.** De hero biedt twee gelijkwaardige CTA's aan ("Launch your next session" naar `/login`, en "See the anonymity modes" naar `/pricing`). Het is onduidelijk of het doel **account-aanmaak (signup)**, **een sessie starten** of **plan-vergelijking** is. Dit is geen smaakkwestie: zolang het ene doel niet vaststaat, concurreren de CTA's en kan geen enkele pagina daarop geoptimaliseerd worden. Behandel dit als te beslissen vóór verdere optimalisatie.

---

## Bevindingen

### [CRITICAL] Interne/technische copy lekt naar de productie-pricingpagina
**Locatie:** `Pricing.tsx` — Signal-kaart (regels 188–192), `SourceBadge` in feature-matrix (regels 31–39, 316), matrix-voetnoot (regels 342–348)
**Probleem:** Drie stukken interne tekst worden aan bezoekers getoond:
1. "Stripe prices: {price_id} / {price_id}" — letterlijk de Stripe-prijs-ID's onder de Signal-prijs.
2. Badges "Roadmap" en "Static copy" naast matrix-rijen — dit zijn interne review-annotaties.
3. De voetnoot: "Numeric limits … mirror `PLAN_QUOTAS` via `GET /api/plans/catalog`. Rows tagged static copy or roadmap are packaging claims **to review against product/commerce plans before launch.**"
**Conversie-impact:** Dit ondermijnt vertrouwen direct op de pagina waar de aankoopbeslissing valt. Een bezoeker leest "to review before launch" en concludeert: dit product is niet af, de prijzen zijn niet definitief, ik wacht. Technische ID's en "static copy"-labels zien er onprofessioneel uit en zaaien twijfel over of de getoonde features echt bestaan.
**Onderbouwing:** Vertrouwen is de schaarste op een pricingpagina; elk signaal van "onaf/intern" verhoogt de waargenomen aankoop-risico (risk aversion). Interne developer-taal hoort nooit in customer-facing copy.
**Fix:** Verwijder de zichtbare Stripe-ID-regel volledig (of verberg achter een dev-flag). Toon `SourceBadge` alleen in een interne/preview-build. Vervang de voetnoot door een klantgerichte regel: "Limieten in deze tabel zijn exact wat het product afdwingt — geen verrassingen achteraf." Verplaats de "review before launch"-notitie naar de PR/issue, niet de pagina.

### [CRITICAL] Geen enkel vertrouwenselement (social proof) op de landing
**Locatie:** `Home.tsx` — volledige pagina
**Probleem:** Er zijn nul testimonials, klantlogo's, gebruikscijfers, reviews, ratings of resultaten. De pagina maakt sterke claims ("Decisions you can defend, with evidence that survives the meeting") zonder enig bewijs.
**Conversie-impact:** Een sceptische, koude bezoeker heeft geen reden om de claim te geloven. Zonder bewijs van anderen ("doen meer mensen dit, werkt het?") blijft de drempel om een account aan te maken hoog — zeker bij een tool die je vóór een groep gaat gebruiken (reputatierisico voor de facilitator).
**Onderbouwing:** Social proof (Cialdini) is een van de sterkste conversiehefbomen in B2B; afwezigheid above-the-fold raakt 100% van de bezoekers.
**Fix:** Voeg een logobalk ("Gebruikt door teams bij …"), 1–2 concrete testimonials met naam/rol, of een hard cijfer toe ("X sessies gedraaid", "gemiddeld Y% respons"). Eén geloofwaardige quote vlak onder de hero-CTA is de hoogste-ROI-toevoeging. Gebruik géén verzonnen cijfers.

### [CRITICAL] "Most chosen"-badge zonder onderbouwing
**Locatie:** `Pricing.tsx` — Signal-kaart (regels 164–169)
**Probleem:** De Signal-kaart draagt het label "Most chosen". Als hier geen data onder ligt, is dit een verzonnen social-proof-claim.
**Conversie-impact:** Werkt averechts bij ontmaskering: een onware "populairste"-claim is een dark pattern dat vertrouwen vernietigt zodra het ongeloofwaardig oogt — en juridisch riskant (misleidende handelspraktijk).
**Onderbouwing:** Anchoring/bandwagon werkt alléén als geloofwaardig; ongefundeerde superlatieven verhogen scepsis.
**Fix:** Alleen behouden als aantoonbaar waar. Anders vervangen door een feitelijke framing: "Best for weekly facilitators" of "Recommended" (een aanbeveling, geen populariteitsclaim).

### [HIGH] Hero-CTA-belofte komt niet overeen met de login-bestemming
**Locatie:** `Home.tsx` (regels 148–162) → `Login.tsx` (regels 25, 100–107)
**Probleem:** De primaire CTA "Launch your next session" met daaronder "No card required · 2-minute setup" suggereert direct starten/aanmaken. De bestemming `/login` opent met de titel **"Log in to Qesto"**, subtitel "For management teams and facilitators", en de **standaard-tab is "Magic link"** ("Send login link →"). "Sign up" is de derde, minst prominente tab.
**Conversie-impact:** Klassieke message-mismatch. De bezoeker verwacht "een sessie starten", krijgt "inloggen". Een nieuwe gebruiker heeft nog geen account, ziet "Log in", en kan afhaken of verdwalen tussen drie tabs. De belofte "2-minute setup" wordt op de volgende stap niet waargemaakt.
**Onderbouwing:** Message match tussen CTA en bestemmingspagina is een kern-CRO-principe; mismatch verhoogt bounce op de stap die er het meest toe doet.
**Fix:** Laat acquisitie-CTA's landen op een staat die signup vooropstelt: of een dedicated `/signup`-route, of `/login?tab=signup`, met header "Maak je workspace aan" wanneer de bezoeker van een acquisitie-CTA komt. Maak CTA-tekst en bestemming consistent ("Start free" → signup-formulier, niet login).

### [HIGH] Hero-waardepropositie faalt de 5-seconden-toets
**Locatie:** `Home.tsx` — H1 (regels 105–114)
**Probleem:** "Feel the pulse of the room, amplified by AI." is een metafoor, geen propositie. Wát het product ís (live polling / audience engagement) staat pas in de derde paragraaf. Een koude bezoeker weet na 5 seconden niet of dit een poll-tool, een AI-analyseproduct of een HR-platform is.
**Conversie-impact:** Als de bezoeker niet binnen seconden begrijpt wat dit is en voor wie, scrolt of bounce't hij. Dit raakt elke koude bezoeker above-the-fold.
**Onderbouwing:** De 5-seconden-test (Krug, "Don't Make Me Think"): waardepropositie moet onmiddellijk de categorie + voordeel benoemen.
**Fix:** Behoud de metafoor als sfeer, maar verbind 'm aan de categorie. Bijv. H1: "Live polls, rankings en consent rounds — feel the pulse of the room." Of houd de poëtische H1 en zet er een glasheldere één-regel-subkop pal onder: "Qesto is live polling voor workshops, lessen en meetings — anoniem of identificeerbaar, jouw keuze."

### [HIGH] Secundaire CTA "See the anonymity modes" — verkeerd label én verkeerde bestemming
**Locatie:** `Home.tsx` (regels 154–159) → `/pricing`
**Probleem:** De secundaire hero-CTA heet "See the anonymity modes" maar leidt naar de **pricing**-pagina, die anonimiteitsmodi nergens uitlegt. Label en bestemming matchen niet, en "anonymity modes" is een feature-detail, geen logische tweede stap voor een oriënterende bezoeker.
**Conversie-impact:** Verwarring + teleurstelling (klik levert niet wat is beloofd). Een feature-detail als secundaire CTA verspilt de op één na waardevolste klikpositie; "zie hoe het werkt" of "bekijk prijzen" dient de oriënterende bezoeker beter.
**Onderbouwing:** CTA-tekst is een belofte; de bestemming moet die inlossen (informatiegeur / "information scent").
**Fix:** Vervang door een doel dat past bij funnel-oriëntatie, bijv. "See how it works" (naar een demo/uitlegsectie) of "Compare plans" (als de bestemming écht pricing is). Als anonimiteit het kerndifferentiatiepunt is, geef die een eigen sectie op de landing i.p.v. een mislabelde CTA.

### [HIGH] Doodlopende CTA's: enterprise- en nonprofit-leads gaan nergens heen
**Locatie:** `Pricing.tsx` — Chorus "Book a walkthrough" (regel 258 → `/pricing`), nonprofit "Apply for nonprofit pricing" (regel 365 → `/pricing`)
**Probleem:** Drie hoog-intentie CTA's linken naar de pricingpagina zélf (self-link). "Book a walkthrough", "Apply for nonprofit pricing" — de klik herlaadt dezelfde pagina. Er is geen contact-/demo-/aanvraagformulier achter.
**Conversie-impact:** Dit zijn de meest gekwalificeerde leads (enterprise, nonprofit) — exact de bezoekers die je níét wilt verliezen. Een knop die niets doet voelt als een bug en doodt het momentum precies op het intentiehoogtepunt.
**Onderbouwing:** Elke CTA moet de bezoeker een stap verder brengen; een no-op CTA is verloren conversie met maximale intentie.
**Fix:** Koppel aan een echt contact-/demoformulier of `mailto:`/Calendly. Minimaal: een `/contact`-route met onderwerp-preselect (sales / nonprofit). Tot die er is, geen knop tonen die niets doet.

### [HIGH] Roadmap-features staan als plan-features in de lijst
**Locatie:** `Pricing.tsx` — Signal & Chorus feature-lijsten (regels 204, 245, 247–248)
**Probleem:** Bullets als "Webhook integrations on the roadmap", "Customer-managed keys on the roadmap", "Extended data retention & exports (residency on roadmap)", "SSO roadmap — contact sales" presenteren nog-niet-bestaande functionaliteit als planinhoud.
**Conversie-impact:** Tweesnijdend: of de bezoeker leest eroverheen en denkt dat het bestaat (verkeerde verwachting → churn/refund), of hij merkt "on the roadmap" op en concludeert dat het plan half af is. Beide schaden conversie of retentie.
**Onderbouwing:** Verwachtingsmanagement; features beloven die niet bestaan is misleidend en creëert post-purchase dissonance.
**Fix:** Haal roadmap-items uit de feature-bullets. Wil je momentum tonen, plaats ze in een aparte, eerlijk gelabelde "Coming soon"-strook — niet vermengd met afdwingbare planinhoud.

### [HIGH] Geen productbeeld of "hoe werkt het" op de landing
**Locatie:** `Home.tsx` — volledige pagina
**Probleem:** Voor een realtime, interactief product staat er geen screenshot, GIF, demo of stappenplan (3 stappen: maak vraag → deel code → zie resultaten). De pagina is volledig tekst + icoontjes.
**Conversie-impact:** De bezoeker kan zich het product niet voorstellen en kan de werking/het gemak niet beoordelen vóór hij commit. "Show, don't tell" mist volledig.
**Onderbouwing:** Bij interactieve/visuele producten verhoogt een demo/visual de conversie sterk; tekst alleen vraagt te veel verbeeldingskracht.
**Fix:** Voeg een producthero-visual of korte loop toe (deelnemers-join → live resultaten), of een "Zo werkt het in 3 stappen"-sectie met beelden.

### [MEDIUM] Defensieve/account-mechanica-copy bezet kostbare hero-ruimte
**Locatie:** `Home.tsx` — tweede hero-paragraaf (regels 121–125)
**Probleem:** "Qesto helps teams and facilitators run live polls … **We use sign-in only to manage your account, sessions, and workspace access.**" — de tweede zin is een privacy-/account-disclaimer, geen waardepropositie.
**Conversie-impact:** Above-the-fold ruimte moet overtuigen, niet juridisch geruststellen over iets dat de bezoeker nog niet vroeg. Het verzwakt de momentum-opbouw richting de CTA.
**Onderbouwing:** Hero-copy = hoogste aandachtsdichtheid; alles wat niet verkoopt of verduidelijkt is afleiding.
**Fix:** Verplaats de sign-in-disclaimer naar een vertrouwens-/privacy-sectie lager op de pagina of naar de login-stap. Houd in de hero alleen propositie + bewijs + CTA.

### [MEDIUM] Login zet terugkerende gebruikers voorop, niet nieuwe aanmeldingen
**Locatie:** `Login.tsx` (regels 25, 105) + `auth.json` (`loginTitle: "Log in to Qesto"`, `loginSubtitle: "For management teams and facilitators"`)
**Probleem:** Titel "Log in", standaard-tab "Magic link", signup als derde tab. De hele pagina is geoptimaliseerd voor returnen, terwijl acquisitie-CTA's nieuwe gebruikers hierheen sturen.
**Conversie-impact:** Nieuwe bezoeker (geen account) ziet "Log in" en drie tabs; cognitieve last + verkeerde standaardstaat verhoogt drop-off op het conversiepunt.
**Onderbouwing:** Reduceer keuzes en match de standaardstaat aan de intentie van de inkomende bezoeker (paradox of choice).
**Fix:** Wanneer de bezoeker van een acquisitie-CTA komt: open op de signup-tab, met header "Maak je gratis workspace aan". Eén primaire actie (Google + e-mail-signup), inloggen secundair.

### [MEDIUM] Refund-garantie is niet meetbaar en kent een termijn-mismatch
**Locatie:** `Pricing.tsx` — FAQ "What if my first pulse flops?" (regels 55–57)
**Probleem:** "If your first session doesn't beat the response rate of your last survey … We'll refund the full quarter." Twee problemen: (1) "your last survey" is voor Qesto niet meetbaar/verifieerbaar — onuitvoerbare voorwaarde; (2) Signal wordt **jaarlijks** gefactureerd, maar de garantie spreekt over "the full quarter".
**Conversie-impact:** Een garantie die te mooi/onmeetbaar oogt, wekt scepsis i.p.v. geruststelling; de kwartaal-vs-jaar-mismatch oogt slordig en roept twijfel over de billing-voorwaarden op.
**Onderbouwing:** Een geloofwaardige, ondubbelzinnige garantie verlaagt aankooprisico; een vage verlaagt vertrouwen.
**Fix:** Maak de voorwaarde objectief en de termijn consistent: "Niet tevreden binnen 14 dagen na je eerste betaling? Volledige terugbetaling, zonder vragen." Lijn het terugbetaalde bedrag uit met de werkelijke facturatiecyclus.

### [MEDIUM] Pricing-subkop is defensief en introduceert een bezwaar dat de bezoeker nog niet had
**Locatie:** `Pricing.tsx` — hero-subkop (regels 104–108)
**Probleem:** "… you don't get surprise hard-stops after you've committed to a room." benoemt actief een negatief scenario ("surprise hard-stops") dat de meeste bezoekers niet als zorg hadden.
**Conversie-impact:** Je plant een twijfel ("kan ik dan midden in een sessie geblokkeerd worden?") die je vervolgens moet wegnemen — netto negatief.
**Onderbouwing:** Frame positief; benoem een bezwaar pas als het top-of-mind is bij de doelgroep.
**Fix:** Herschrijf positief: "Transparante limieten per plan — exact wat het product afdwingt." Bewaar de "geen verrassingen"-nuance voor de FAQ.

### [MEDIUM] Plan-naamgeving inconsistent tussen kaarten, FAQ en CTA-belofte
**Locatie:** `Pricing.tsx` — kaarten (Pulse/Signal/Chorus) vs FAQ (regels 41–66) vs Home-CTA "See the anonymity modes"
**Probleem:** De FAQ noemt "Pulse" en "Chorus" maar nóóit "Signal" (de featured, betaalde middenplan-kaart). De Home-CTA belooft "anonymity modes" maar pricing legt die modi niet uit.
**Conversie-impact:** De koper van het meest waarschijnlijke betaalplan (Signal) vindt zijn plan niet terug in de FAQ; de funnel-belofte (anonimiteit) wordt op de bestemming niet ingelost → onbeantwoorde vragen = afhaken.
**Onderbouwing:** Consistente naamgeving en het beantwoorden van precies de vraag waarmee de bezoeker arriveert, houden de informatiegeur intact.
**Fix:** Voeg minimaal één Signal-specifieke FAQ toe en lijn alle plan-namen uit. Beantwoord de "anonymity modes"-belofte expliciet als de Home-CTA daarheen blijft wijzen.

### [LOW] "No card required · 2-minute setup" als platte tekst, niet als geruststelling bij de knop
**Locatie:** `Home.tsx` (regel 162)
**Probleem:** De risico-wegnemer staat als losse grijze tekst (`text-pulse-400`) ná beide knoppen, visueel zwak (lichte kleur, kleine grootte).
**Conversie-impact:** Microcopy die aankoopangst wegneemt ("geen kaart nodig") werkt het best pal onder de primaire CTA en goed leesbaar; nu is hij makkelijk te missen.
**Onderbouwing:** Risk-reversal-microcopy bij het beslismoment verhoogt klikbereidheid.
**Fix:** Plaats "Geen creditcard · klaar in 2 minuten" direct onder de primaire knop, met voldoende contrast.

### [LOW] Subtiele claim-asymmetrie in de feature-strip
**Locatie:** `Home.tsx` — `FEATURE_STRIP` (regels 9–14)
**Probleem:** "Question ideas ready in under 90 seconds" is concreet en sterk; de andere drie ("Live results …", "Anonymous … your choice", "Responses stay private, always") zijn algemener. "always" is een absolute claim die je moet kunnen waarmaken.
**Conversie-impact:** Gemengde specificiteit verzwakt het geheel; absolute woorden ("always") nodigen uit tot scepsis als ze niet hard onderbouwd zijn.
**Onderbouwing:** Specifieke, verifieerbare claims overtuigen meer dan algemene; absolute claims vergroten bewijslast.
**Fix:** Trek de andere drie naar hetzelfde concreetheidsniveau (bijv. "Resultaten live, <200ms") en onderbouw of nuanceer "always".

---

## Samenvatting

| Severity | Aantal |
|---|---|
| Critical | 3 |
| High | 6 |
| Medium | 5 |
| Low | 2 |
| **Totaal** | **16** |

## Top 3 prioriteiten

1. **Verwijder alle interne/technische copy van de pricingpagina** (Stripe-ID's, "Roadmap"/"Static copy"-badges, de "review before launch"-voetnoot). Snel te fixen, en het ondermijnt vertrouwen exact op het beslispunt. *(Critical)*
2. **Repareer de doodlopende high-intent CTA's** ("Book a walkthrough", "Apply for nonprofit pricing", Chorus "Talk to us") — koppel aan een echt contact-/demoformulier. Je verliest nu je meest gekwalificeerde leads op hun intentiehoogtepunt. *(High)*
3. **Los de message-mismatch CTA → login op** én **voeg social proof toe aan de landing.** Laat acquisitie-CTA's op een signup-eerst staat landen, en geef de koude bezoeker minimaal één geloofwaardig bewijselement above-the-fold. *(High + Critical)*

## Wat wél goed werkt (behouden)

- **"Question ideas ready in under 90 seconds"** — concreet, tijdsgebonden, gelooft als voordeel (niet als feature). Modelvoorbeeld voor de andere claims.
- **Privacy-positionering is consistent en geloofwaardig** ("No third-party AI, no data sold, no training on anything your room shared") — een echt differentiatiepunt voor de doelgroep, helder verwoord.
- **De feature-matrix met expliciete quota-koppeling** (numerieke limieten = wat het product afdwingt) is eerlijk en sterk — mits de interne labels eruit gaan.
- **Eén visueel gemarkeerd aanbevolen plan** (de featured Signal-kaart met `-translate-y-2`) is een goede keuzehulp — mits "Most chosen" wordt onderbouwd of vervangen.
- **Login biedt meerdere laagdrempelige methoden** (Google OAuth, magic link, wachtwoord) en een "continue without account"-escape voor deelnemers — goede flexibiliteit, alleen de standaardstaat moet matchen met de inkomende intentie.
