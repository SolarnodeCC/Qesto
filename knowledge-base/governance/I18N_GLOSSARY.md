# Qesto — i18n Terminology Glossary

_Hub: [Documentation map](./README.md)._

_Sprint 17 · I18N-QA-02_

This glossary defines the canonical translations for domain-specific terms across all 5 supported languages (EN, NL, ES, DE, FR). Translators must use these terms consistently — no synonyms.

---

## Platform concepts

| Term (EN) | NL | ES | DE | FR | Notes |
|---|---|---|---|---|---|
| Session | Sessie | Sesión | Sitzung | Session | The core interactive meeting unit |
| Decision | Beslissing | Decisión | Entscheidung | Décision | A recorded group outcome |
| Participant | Deelnemer | Participante | Teilnehmer | Participant | Voter in a session |
| Facilitator | Facilitator | Facilitador | Moderator | Facilitateur | Session owner/presenter |
| Team | Team | Equipo | Team | Équipe | Organisational unit |
| Workspace | Werkruimte | Espacio de trabajo | Arbeitsbereich | Espace de travail | Multi-team container |
| Template | Sjabloon | Plantilla | Vorlage | Modèle | Reusable session config |
| Energizer | Energizer | Dinamizador | Energizer | Activateur | Gamification mini-game |

---

## Enterprise Roles (ENT-ROLE-01)

Session roles control what actions a team member may perform within sessions.

| Role (EN) | NL | ES | DE | FR | Permissions |
|---|---|---|---|---|---|
| Owner | Eigenaar | Propietario | Inhaber | Propriétaire | Full control (create, start, close, edit, export, manage members) |
| Session Manager | Sessiebeheerder | Gestor de sesión | Sitzungsleiter | Gestionnaire de session | Start/close/export, no member management |
| Content Creator | Contentmaker | Creador de contenido | Inhaltsersteller | Créateur de contenu | Create/edit sessions, view results |
| Analyst | Analist | Analista | Analyst | Analyste | View results and export only |
| Viewer | Kijker | Espectador | Betrachter | Spectateur | View results only |

---

## Admin Roles

| Role (EN) | NL | ES | DE | FR | Notes |
|---|---|---|---|---|---|
| Super Admin | Superbeheerder | Super administrador | Super-Admin | Super administrateur | Platform-wide control |
| Admin | Beheerder | Administrador | Administrator | Administrateur | User/team management |
| Viewer | Kijker | Espectador | Betrachter | Spectateur | Read-only admin access |

---

## Achievement Badges (GAM-ADV-01)

| Badge ID | EN | NL | ES | DE | FR |
|---|---|---|---|---|---|
| first-session | First Session | Eerste sessie | Primera sesión | Erste Sitzung | Première session |
| crowd-pleaser | Crowd Pleaser | Publieksfavoriet | Complaciente | Publikumsliebling | Favori du public |
| quick-closer | Quick Closer | Snelle afronder | Cierre rápido | Schnellabschluss | Clôture rapide |
| question-master | Question Master | Vraagmeester | Maestro de preguntas | Fragenmeister | Maître des questions |
| team-player | Team Player | Teamspeler | Jugador de equipo | Teamspieler | Joueur d'équipe |
| ai-powered | AI Powered | AI-gedreven | Impulsado por IA | KI-gestützt | Alimenté par IA |
| streak-3 | On A Roll | Lekker bezig | En racha | Auf Kurs | Sur la lancée |
| energizer-master | Energizer Master | Energizer-meester | Maestro de dinamizadores | Energizer-Meister | Maître des activateurs |

---

## Observability & Ops terms (OBS-ALERT-01)

| Term (EN) | NL | ES | DE | FR |
|---|---|---|---|---|
| Alert Rule | Meldingsregel | Regla de alerta | Warnregel | Règle d'alerte |
| Runbook | Runbook | Runbook | Runbook | Runbook |
| Threshold | Drempelwaarde | Umbral | Schwellenwert | Seuil |
| Severity | Ernst | Gravedad | Schweregrad | Gravité |
| Category | Categorie | Categoría | Kategorie | Catégorie |
| Incident | Incident | Incidente | Vorfall | Incident |
| Issue | Issue | Problema | Problem | Problème |

---

## Translation QA Checklist (I18N-QA-02)

Before each release, verify:

- [ ] All 8 namespaces exist in all 5 languages (`en`, `nl`, `es`, `de`, `fr`)
- [ ] No key present in `en` that is missing from other languages
- [ ] No key present in other languages that is absent from `en`
- [ ] Badge translations use the canonical names from this glossary
- [ ] Enterprise role names match this glossary exactly
- [ ] Alert rule UI strings (alertRules, createAlertRule, etc.) are present in all languages
- [ ] No truncation in key UI elements (use `scripts/check-i18n-missing.mjs`)

Run `node scripts/check-i18n-missing.mjs` and `node scripts/check-i18n-unused.mjs` before merging any i18n changes.

---

_Last updated: 2026-04-11 (Sprint 17 · I18N-QA-02)_
