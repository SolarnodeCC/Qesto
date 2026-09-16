# Frontend shell matrix

> **Owner:** Design System / Frontend  
> **Related:** [ADR-0071](../adr/ADR-0071-design-system-v1.md), [DS Day 1–30](../quality/audits/DS_DAY30_FOUNDATIONS_2026-09-16.md), [DS Day 31–60](../quality/audits/DS_DAY60_ADOPTION_2026-09-16.md), [DS Day 61–90](../quality/audits/DS_DAY90_COMPLETION_2026-09-16.md)

Every routed page must declare exactly one shell. Do not hand-roll chrome (header, skip link, footer, theme toggle) on new pages.

| Shell | Path | Use for | Content width token |
|---|---|---|---|
| `MainLayout` | `src/layouts/MainLayout.tsx` | Marketing, legal, results, templates, team settings, studio | `--container-marketing` (70rem / 1120px) or `--container-form` for narrow forms |
| `AppShellLayout` | `src/layouts/AppShellLayout.tsx` | Dashboard hub, account settings, admin, marketing ops | `--container-app` (75rem / 1200px); forms `--container-form` (42rem) |
| `HostConsoleShell` | `src/layouts/HostConsoleShell.tsx` | Host/organizer consoles (`*Present`, ideate board, event organizer) | shell default (`max-w-2xl`–`7xl` via prop) |
| `ParticipantShell` | `src/layouts/ParticipantShell.tsx` | Participant join flows (mode joins + live voter) + privacy/terms footer | shell default (`max-w-xl`–`lg`) |
| `BigScreenShell` | `src/layouts/BigScreenShell.tsx` | Audience/projector displays (`*Display`) | full viewport `--surface-stage` (canvas theme via `style`) |
| *(exception)* Auth chrome | `Login.tsx`, `ResetPassword.tsx` | Auth-only surfaces | centered form; do not invent a sixth shell without ADR |

## Adoption status (2026-09-16)

| Route | Shell |
|---|---|
| `join/JoinLanding`, `join/WaitingScreen`, Join loading/error, live Voter | `ParticipantShell` |
| `Present.tsx` outer stage | `bg-[var(--surface-stage)]` (stage scale kept) |
| Classic `Display.tsx` | `BigScreenShell` / `BigScreenFallback` |
| `EventStagePresent.tsx` | `HostConsoleShell` (`maxWidth="7xl"`) |

## Remaining non-shell debt (not shell-matrix)

| Item | Notes |
|---|---|
| Exhaustive Button migration | Remaining icon/tool chrome buttons outside Day 60/90 CTA set |
| Marketing template pipeline merge | Separate marketing workstream |
| Login Google brand SVG fills | Brand marks, not Lucide icons |

## Rules

1. Skip link → `#main` required on every shell (already true for the five shells).
2. Icons: Lucide only (Hard Rule 9). CI: `npm run check:lucide-layouts`.
3. Dark colors: semantic CSS vars only — no new `dark:[#…]` in layouts.
4. Cards/panels: `rounded-xl`; buttons/inputs: `rounded-lg` (ADR-0071).
5. Optional trailing header slots (`headerTrailing`) are the extension point for page-specific actions — do not fork shells.
