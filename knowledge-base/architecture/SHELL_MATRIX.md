# Frontend shell matrix

> **Owner:** Design System / Frontend  
> **Related:** [ADR-0071](../adr/ADR-0071-design-system-v1.md), [DS Day 1–30](../quality/audits/DS_DAY30_FOUNDATIONS_2026-09-16.md)

Every routed page must declare exactly one shell. Do not hand-roll chrome (header, skip link, footer, theme toggle) on new pages.

| Shell | Path | Use for | Content width token |
|---|---|---|---|
| `MainLayout` | `src/layouts/MainLayout.tsx` | Marketing, legal, results, templates, team settings, studio | `--container-marketing` (70rem / 1120px) or `--container-form` for narrow forms |
| `AppShellLayout` | `src/layouts/AppShellLayout.tsx` | Dashboard hub, account settings, admin, marketing ops | `--container-app` (75rem / 1200px); forms `--container-form` (42rem) |
| `HostConsoleShell` | `src/layouts/HostConsoleShell.tsx` | Host/organizer consoles (`*Present`, ideate board, event organizer) | shell default (`max-w-2xl`–`6xl` via prop) |
| `ParticipantShell` | `src/layouts/ParticipantShell.tsx` | Participant join flows (mode joins) + privacy/terms footer | shell default (`max-w-xl`) |
| `BigScreenShell` | `src/layouts/BigScreenShell.tsx` | Audience/projector displays (`*Display`) | full viewport `--surface-stage` |
| *(exception)* Auth chrome | `Login.tsx`, `ResetPassword.tsx` | Auth-only surfaces | centered form; do not invent a sixth shell without ADR |

## Days 31–60 adoption (2026-09-16)

| Route | Status |
|---|---|
| `join/JoinLanding`, `join/WaitingScreen`, Join loading/error | `ParticipantShell` |
| `Present.tsx` outer stage | `bg-[var(--surface-stage)]` (stage scale kept) |
| Live voter chrome (`JoinPage` Voter) | Tokens only — shell migration deferred to Days 61+ |

## Remaining debt (Days 61+)

| Route | Current | Target |
|---|---|---|
| `JoinPage` live Voter | Custom chrome | `ParticipantShell` or dedicated live participant shell |
| `Display.tsx` (classic) | Custom | `BigScreenShell` |
| `EventStagePresent.tsx` | Partial | `HostConsoleShell` |

## Rules

1. Skip link → `#main` required on every shell (already true for the five shells).
2. Icons: Lucide only (Hard Rule 9). CI: `npm run check:lucide-layouts`.
3. Dark colors: semantic CSS vars only — no new `dark:[#…]` in layouts.
4. Cards/panels: `rounded-xl`; buttons/inputs: `rounded-lg` (ADR-0071).
