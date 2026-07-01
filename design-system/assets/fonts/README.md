# Self-hosting Qesto's fonts

Qesto uses three Google-hosted families: **Syne** (display), **Inter** (body), **JetBrains Mono** (mono). By default `tokens/fonts.css` loads them via a Google Fonts `@import` — same as the live app. No binaries are committed.

To run fully offline / self-hosted, drop these `.woff2` files into **this folder**, then flip the comment blocks in `tokens/fonts.css` (comment out the `@import`, uncomment the `@font-face` block):

| File | Family | Source |
|------|--------|--------|
| `Syne-VariableFont_wght.woff2` | Syne | https://fonts.google.com/specimen/Syne |
| `Inter-VariableFont.woff2` | Inter | https://fonts.google.com/specimen/Inter |
| `JetBrainsMono-VariableFont_wght.woff2` | JetBrains Mono | https://fonts.google.com/specimen/JetBrains+Mono |

Variable fonts cover every weight the system uses (Syne 500–800, Inter 400–700, Mono 400–500). If you prefer static weights, add one `@font-face` per weight instead and match the filenames you use.

> These binaries couldn't be fetched in the environment this system was built in. If you'd like them committed, download them from the links above and add them here.
