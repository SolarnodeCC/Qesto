---
id: session-modes
title: Advanced Session Modes — Townhall, Retro, Ideate, Deliberate
topic: getting-started
scope: team
excerpt: Beyond standard polls, Qesto offers four board-style session modes — Townhall Q&A, Retrospectives, Ideation, and Deliberate verifiable voting — available on the Chorus plan.
updated: 2026-06-21
version: 1.0
---

# Advanced Session Modes

Standard Qesto sessions are question-driven (polls, rankings, consent votes, open
questions). On top of those, Qesto offers four **board-style session modes** for richer
formats. All four are **generally available** (shipped at v6.0.0) and are included on the
**Chorus** plan.

| Mode | What it's for | Plan |
|------|---------------|------|
| Townhall Q&A | Large-audience question boards with upvoting and moderation | Chorus |
| Retro | Team retrospectives across three columns with dot-voting | Chorus |
| Ideate | Brainstorming boards with AI clustering and dot-voting | Chorus |
| Deliberate | Formal votes with verifiable, anonymous, re-checkable results | Chorus |

---

## Townhall Q&A

A live Q&A board for all-hands meetings and large audiences. Participants submit
questions and **upvote** the ones they care about, so the most-supported questions rise to
the top instead of getting lost in a chat stream.

**How to run one**

1. From your dashboard, click **Create Townhall** (visible on eligible accounts).
2. Configure the board while it is still in **Draft**:
   - **Moderation** — choose `pre` (questions are reviewed by a moderator before they appear)
     or `post` (questions appear immediately and can be moderated afterward).
   - **Anonymity** — full, partial, none, or zero-knowledge.
3. Open the session. Share the join code with your audience.
4. As host you can **group** duplicate or related questions together, and **spotlight** a
   question so it appears prominently on the presenter screen while it is being answered.

**Good to know**

- Townhall scales to large audiences — up to the participant cap on your plan (5,000 on
  Chorus).
- Author identity is never exported, even when you download the question list, so anonymity
  is preserved end-to-end.

---

## Retro (Retrospectives)

A structured retrospective board for recurring team rituals. The board has three columns:

- **Went well**
- **Didn't go well**
- **Actions**

**How it works**

1. Create a **Retro workspace** (a recurring workspace) for your team.
2. Each time you run it, a fresh retro instance is created — participants add cards to each
   column.
3. **Dot-voting** lets each participant spend a fixed number of votes (3 by default,
   configurable up to 10) to prioritize the cards that matter most.
4. Choose an anonymity mode so people can speak candidly.

Because retros run as a **recurring workspace**, Qesto tracks **team health trends** across
instances, so you can see how sentiment and recurring themes change over time.

---

## Ideate (Ideation Boards)

A brainstorming board for divergent-then-convergent idea generation. Participants add idea
cards, and Qesto helps you make sense of them.

**Key features**

- **AI clustering** — as ideas come in, Qesto automatically groups similar ones into themes
  (clustering settles a few seconds after activity, so it groups in near real time without
  thrashing).
- **Dot-voting** — each participant gets a set number of votes (5 by default, up to 20) to
  surface the strongest ideas.
- **Ranking reveal** — reveal the top-ranked ideas to the room once voting is done.

Like Retro, Ideate runs as a **recurring workspace**, so you can re-run the same board for a
standing group.

---

## Deliberate (Verifiable Voting)

A governance-grade voting mode for decisions that need to be **trustworthy and auditable** —
board resolutions, formal approvals, or elections.

**What makes it different**

- Every ballot is written to an **append-only, anonymous commitment ledger** — votes can't be
  altered or deleted after the fact.
- Each voter receives a **receipt** they can keep. Receipts are *coercion-resistant*: a
  receipt lets you confirm your vote was counted without revealing how you voted to anyone
  else.
- The final tally publishes a **Merkle root** that **any participant or observer can
  independently re-verify** against the ledger — you don't have to take Qesto's word that the
  count is correct.

**How to run one**

1. Mark the session as **Deliberate** while it is in Draft.
2. Open the session and let participants cast ballots; each gets a receipt.
3. After voting closes, share the tally. Anyone can re-verify a receipt or the Merkle root.

---

## Which plan do I need?

All four advanced modes (Townhall, Retro, Ideate, Deliberate) are on the **Chorus** plan. See
[Pricing and Plans](billing.md) or [qesto.cc/pricing](https://qesto.cc/pricing) for current
details. Standard polls, rankings, consent votes, and open questions are available on every
plan, including the free **Pulse** tier.
