# Qesto marketing demo — Playwright script

Reusable shot list for product videos. The goal of every clip is the same: show a real
host turning a room of silent participants into a live, visible conversation — fast to set
up, calm to watch.

Run with:

```bash
# Terminal 1: API (flags for energizers + townhall must be on — see wrangler.toml)
npx wrangler dev --port 8787 --local

# Terminal 2: SPA
npm run dev

# Terminal 3: record demos (1280×720 video → tests/artifacts/marketing-videos/)
$env:PLAYWRIGHT_BASE_URL = "http://localhost:5173"
npm run test:e2e:marketing
```

## Pacing principles

These videos are watched, not skimmed. The script is deliberately slower than a functional
E2E test. Follow these rules in every spec:

- **Let data land.** When results, votes, or questions populate a view, hold the frame so the
  motion reads on screen. Use a settle pause (`settle()`) *after* the UI has updated, not as a
  substitute for a proper wait condition.
- **One idea per beat.** Each row below is a single visual moment. Don't stack two state changes
  into one shot — the eye can't follow it and the VO can't narrate it.
- **Populate incrementally.** Votes and questions arrive one at a time with a short gap between
  them (~600–900 ms), so the audience sees the count climb rather than snap to a final number.
- **Ease the cursor.** Move and click at human speed (`slowMo` in the Playwright project), so
  interactions feel intentional rather than scripted.
- **Breathe on transitions.** Hold ~1 s on a finished state before navigating away, so editors
  have clean cut points and the viewer registers what just happened.

> Fixture defaults: `slowMo: 350`, `settle()` ≈ 1500 ms, `stagger()` ≈ 750 ms — defined in
> `tests/e2e/marketing/fixtures.ts` (re-exported from `helpers/marketing-pacing.ts`). Tune there,
> not by scattering `waitForTimeout` through each spec.

## Cast & data

| Role | Name | Notes |
|------|------|--------|
| Host / facilitator | Alex Rivera | Signs up once per run; Team plan seeded in local D1 for Town hall |
| Audience | Anonymous participants | Join via `/j/{code}` and `/th/{code}` |

All session titles, questions, and copy come from `demo-data.ts` — edit there before re-recording.

---

## Video 1 — Interactive session

**Message:** *From idea to a live, engaged room in minutes.* Show how quickly a host builds a
session, then let the live moment breathe so the audience feels the energy of real participation.

Split into two clips for post-production (energizer setup + live poll):

| Clip | Spec | Output |
|------|------|--------|
| 1a Energizer setup | `energizer-wizard-broll.spec.ts` | `01a-wizard-energizer-setup.webm` |
| 1b Live poll | `interactive-session.spec.ts` | `01b-interactive-live-session.webm` |

Splice 1a → 1b in your editor for a full "wizard → energizer → live" story. Live start with draft
energizers is flaky on local DO; 1b skips the energizer step for a reliable live segment.

| # | Beat | Screen | Action / VO cue | Pacing note |
|---|------|--------|-----------------|-------------|
| 1 | Hook | Dashboard | "Create an interactive session in minutes." | Hold 1 s on a clean dashboard before the first click. |
| 2 | Wizard step 1 | Create new session dialog | Title: **Q4 Product Strategy Review**; goal about roadmap alignment | Type the title at human speed — don't paste it instantly. |
| 3 | Wizard step 2 | Questions | Poll: **Which capability should we prioritize for Q4?** — options *AI session insights* / *Real-time collaboration* | Pause briefly after each option appears in the list. |
| 4 | Wizard step 3 | Energizers | Select **Emoji Poll** — warm up the room before questions | Hold on the selected card so the choice is legible. |
| 5 | Launchpad | Pre-flight | Review join code + QR; session ready to go live | Linger ~1.5 s on the QR + code so viewers can read it. |
| 6 | Open lobby | Start | **Open lobby & start** — participants can join | Let the "waiting for participants" state show before joins. |
| 7 | Energizer | Launchpad host panel | **Start Emoji Poll** → audience picks 🚀 → **Close Poll** | Stagger the emoji votes so reactions trickle in, then settle before closing. |
| 8 | Go live | Launchpad | **Start Questions** — transition to live agenda | Hold on the transition; don't cut mid-animation. |
| 9 | Participate | Join `/j/{code}` | Audience selects **AI session insights** | Seed votes one at a time so the bar grows visibly. |
| 10 | Present | Presenter view | Live results + facilitator controls | Settle on the final result for ~2 s — this is the payoff shot. |

---

## Video 2 — Town hall Q&A

**Message:** *Give every voice a place — and stay in control.* Show a moderator turning raw
audience questions into a curated, on-screen conversation, calmly and confidently.

**File:** `townhall-qa.spec.ts`  
**Output:** `tests/artifacts/marketing-videos/02-townhall-live-qa.webm`

| # | Beat | Screen | Action / VO cue | Pacing note |
|---|------|--------|-----------------|-------------|
| 1 | Entry | Dashboard → New session menu | Choose **Town hall Q&A** (Team / Chorus) | Hold on the menu so the option is readable. |
| 2 | Console | Town hall moderation | Title: **Company All-Hands — Live Q&A** | Type the title at human speed. |
| 3 | Start | Host console | **Start Q&A** — share `/th/{code}` link | Pause on the share link before audience activity begins. |
| 4 | Audience | Town hall join | Submit: *How will the new Chorus plan affect existing customers…* | Submit questions one at a time, ~1 s apart, so the queue fills gradually. |
| 5 | Moderate | Pending tab | **Approve** — question moves to approved queue | Let the card animate from pending to approved; hold on the move. |
| 6 | Optional | Approved tab | Spotlight or mark answered for B-roll | Settle on the spotlighted question as the closing beat. |

---

## Video 3 — Full showcase (single reel)

**Message:** *One platform, the whole journey — from quick poll to company all-hands.*

**File:** `full-showcase.spec.ts`  
**Output:** `tests/artifacts/marketing-videos/00-full-product-showcase.webm`

Runs Video 1 and Video 2 back-to-back in one browser session (same host account). Insert a short
hold (~1.5 s) on a neutral dashboard between the two segments to give editors a clean seam.

---

## Technical notes

- **Plan:** Town hall requires `team` plan + `REALTIME_TOWNHALL_ENABLED=true` on the API worker.
- **Energizers:** Require `LIVE_ENERGIZERS_ENABLED=true`.
- **Language:** E2E fixtures pin `qesto_lang=en`.
- **Pacing helpers:** `slowMo`, `settle()`, and `stagger()` live in `tests/e2e/marketing/fixtures.ts`.
  Tune them there rather than scattering `waitForTimeout` calls through each spec.

After each run, Playwright leaves per-test copies at `tests/artifacts/output/<test-name>/video.webm`.
The npm script copies them to stable names in `marketing-videos/` (`scripts/copy-marketing-videos.mjs`).
