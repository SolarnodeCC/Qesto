---
id: live-features
title: Live Features — Captions, Reactions, Copilot, and Embeds
topic: getting-started
scope: starter
excerpt: Make sessions more accessible and interactive with live captions and translation, live reactions, the AI facilitator copilot, and embeddable widgets.
updated: 2026-06-21
version: 1.0
---

# Live Features

These features add real-time interactivity and reach to a running session. Plan availability
varies — each section notes the plan it's included on.

| Feature | What it does | Plan |
|---------|--------------|------|
| Live Captions & Translation | Real-time captions, translated per participant | Chorus |
| Live Reactions | Lightweight emoji reactions during a session | Signal, Chorus |
| Live Facilitator Copilot | AI suggestions for the host during a live session | Signal, Chorus |
| Embed Widgets | Put a live Qesto board on your own website | Chorus |

---

## Live Captions & Translation

Real-time captions of what's being said in the room, so participants who are deaf or hard of
hearing — or who speak a different language — can follow along.

- Captions appear live as the session runs.
- Participants can read captions **translated into their own language**.
- Captions improve accessibility and are part of Qesto's WCAG commitment.

Live Captions & Translation is included on the **Chorus** plan.

---

## Live Reactions

Participants can send lightweight reactions (emoji) during a session without interrupting the
flow — a quick way to gauge the room's mood in the moment. Live Reactions is available on
**Signal** and **Chorus**.

---

## Live Facilitator Copilot

An AI assistant for the **host** during a live session. The copilot watches the session
context and offers suggestions — for example, what to ask next or how to respond to where the
discussion is going — so a solo facilitator gets a second set of hands.

The copilot is suggestion-only: nothing changes in your session unless you accept it. Like all
Qesto AI, it runs on Cloudflare Workers AI — your session content is never sent to a
third-party AI provider. The Live Facilitator Copilot is available on **Signal** and
**Chorus**.

---

## Embed Widgets

Embed a live Qesto board directly in your own website, intranet page, or event microsite, so
your audience can participate without leaving your page.

- Generate a widget from your team settings; Qesto issues a signed widget token.
- The widget is **origin-sandboxed** — it only runs on the domains you authorize, so your
  embed can't be lifted and reused elsewhere.
- Participants interact with the embedded board exactly as they would on a Qesto join page.

Embed Widgets are included on the **Chorus** plan. For the developer-facing details (token
minting, allowed origins), see your team's embed settings.

---

## XR / Spatial Sessions (Beta)

Qesto has an experimental **spatial (XR) session mode** that renders a session in an immersive
3D space on WebXR-capable devices (such as VR headsets).

- **Beta and opt-in** — XR is behind a beta flag and is off by default.
- **Never required to vote** — XR is purely an alternative way to view a session. If a device
  doesn't support immersive WebXR, Qesto automatically shows a **2D fallback** of the same
  scene, so no participant is ever blocked from taking part.

Because it's in beta, availability and behaviour may change. If you'd like to trial XR, contact
support@qesto.cc.

---

## Plan summary

For exact plan inclusions and limits, see [Pricing and Plans](billing.md) or
[qesto.cc/pricing](https://qesto.cc/pricing). Plan capabilities mirror in-app enforcement, so
what's listed is what you get.
