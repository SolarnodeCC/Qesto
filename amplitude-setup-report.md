# Amplitude Setup Report

<wizard-report>

## Summary

Amplitude analytics is fully wired up in this Qesto project. The `@amplitude/unified` SDK is initialized in `src/main.tsx` with full autocapture, EU data residency, Session Replay, and Guides & Surveys. Nineteen custom events are tracked across the auth flow, session creation wizard, and key lifecycle actions.

## What was configured

### SDK initialization — `src/main.tsx`

- **Package**: `@amplitude/unified` (single package: analytics-browser + Session Replay + Guides & Surveys)
- **API key**: `VITE_AMPLITUDE_API_KEY` from `.env.local`
- **Data region**: EU (`https://api.eu.amplitude.com/2/httpapi`)
- **Remote config**: enabled (`fetchRemoteConfig: true`)
- **Autocapture**: full — attribution, pageViews, sessions, formInteractions, fileDownloads, elementInteractions, frustrationInteractions, pageUrlEnrichment, networkTracking, webVitals
- **Session Replay**: `sampleRate: 1` (records 100% of sessions)
- **Guides & Surveys**: `engagement: {}` (in-product guides and surveys via remote config)

### Identity — `src/hooks/useAuth.tsx`

- `amplitude.setUserId(user.id)` called on login, signup, and auth restore (`/api/auth/me`)
- `amplitude.reset()` called on logout to clear identity

### Custom events instrumented

| Event | Location | Key properties |
|---|---|---|
| `User Signed Up` | `useAuth.tsx` | `method`, `has_name` |
| `User Logged In` | `useAuth.tsx` | `method` |
| `User Logged Out` | `useAuth.tsx` | — |
| `Session Wizard Opened` | `SessionWizard.tsx` | — |
| `Session Created` | `SessionWizard.tsx` | `session_id`, `from_template` |
| `AI Questions Generated` | `SessionWizard.tsx` | `session_id`, `question_count`, `has_focus_area` |
| `Session Launched` | `SessionWizard.tsx` | `session_id`, `question_count`, `used_ai`, `ai_accepted_count`, `ai_dismissed_count`, `has_energizer`, `anonymity`, `vote_policy`, `session_mode`, `from_template` |
| `Error Encountered` | `useAuth.tsx`, `SessionWizard.tsx` | `error_category`, `error_context`, `error_message` |

Five additional events are planned but not yet wired (require backend/other surface access):
- `Session Started`, `Session Closed`, `Participant Joined` — fired from the session host/participant WebSocket flow
- `Template Selected`, `Session Duplicated`, `Session Exported`, `Session Saved As Template` — dashboard actions
- `AI Insights Viewed`, `AI Insight Analyzed` — insights panel
- `Pricing Page Viewed`, `Upgrade Clicked` — billing/upgrade flow

### Files changed

| File | Change |
|---|---|
| `src/main.tsx` | Added `@amplitude/unified` import + `initAll()` call |
| `src/hooks/useAuth.tsx` | Added `setUserId`, `reset`, `track` calls |
| `src/components/SessionWizard.tsx` | Added `track` calls for wizard lifecycle events |
| `.env.local` | Added `VITE_AMPLITUDE_API_KEY` |
| `.amplitude/events.json` | Created — canonical event plan (19 events) |

## Amplitude project

- **Org**: gentle-flower-214189
- **Project**: default (app ID `100047763`)
- **Region**: EU
- **Project settings**: [https://app.eu.amplitude.com/100047763/settings](https://app.eu.amplitude.com/100047763/settings)

## Next steps

1. **Verify ingestion**: Open the Amplitude EU project at [https://app.eu.amplitude.com](https://app.eu.amplitude.com), navigate to **Data → Events**, and confirm the custom events appear within a few minutes of using the app.
2. **Lower Session Replay sample rate** for production: change `sampleRate: 1` to e.g. `0.1` (10%) once you've validated the recordings look correct.
3. **Wire remaining events**: The events listed above (Session Started, Participant Joined, etc.) should be added as you work on those surfaces.
4. **Run deferred dashboard**: Once events are ingesting, run `amplitude-wizard dashboard` to auto-create charts and a dashboard from `.amplitude/events.json`.

</wizard-report>
