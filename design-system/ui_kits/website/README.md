# Website UI kit

Qesto's public marketing homepage, recreated from `src/pages/Home.tsx`.

Composition (top→bottom): sticky blurred **nav** (gains a hairline border on scroll) → **hero** with AI-assisted pill, gradient-clipped Syne H1, CTA row, feature strip, and the animated dark "live results" preview card (mirrors `HeroPollPreview.tsx`) → **feature grid** (6 cards, AI card carries the AIBadge) → dark **CTA band** (32px radius) → 4-column **footer** on `--pulse-900`.

Uses `Button`, `AIBadge`, `Eyebrow` from the bundle; Lucide icons via CDN. Open `index.html`.
