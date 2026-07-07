# Present UI kit

The projected, in-room view, recreated from `src/pages/Present.tsx`. A fixed **1920×1080 stage** that letterboxes to fit any viewport (JS `transform: scale()`).

Layout: top accent bar + brand mark, live status; huge **Syne question** (76px) with participant count + anonymity; animated stage-scale **tally bars** (gradient-brand fills, leading option highlighted); a **join panel** on the right with the mono room code and a QR placeholder. Soft teal/violet radial glow backdrop.

Uses `TallyBar` (plus a stage-scaled variant) from the bundle; Lucide via CDN. Open `index.html`. Default canvas is light; a dark canvas theme also exists in the system.
