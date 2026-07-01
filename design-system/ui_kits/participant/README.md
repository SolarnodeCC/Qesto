# Participant UI kit

The mobile join-to-thanks flow, recreated from `src/pages/JoinPage.tsx` (390px design width, shown in a phone frame).

Four interactive steps (click the flow rail or the in-screen buttons):
1. **Join** — `EntryCodeField` (6-char mono code) + QR fallback, gradient brand bar.
2. **Consent** — the signature `ConsentPicker` (Identified / Cohort-visible / Anonymous).
3. **Vote** — tap an option, then watch the live `TallyBar` results fill in.
4. **Thanks** — celebration state + note that an AI recap will follow (`AIBadge`).

Uses `Button`, `EntryCodeField`, `ConsentPicker`, `TallyBar`, `AIBadge`; Lucide via CDN. Open `index.html`.
