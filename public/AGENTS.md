# Public static assets (`public/`)

**Owns:** favicons, locale bundles, PWA manifest, service worker  
**Forbidden:** API secrets, D1 access, hand-edited generated tokens  
**Proof lane:** `just ux-qa`

`sw.js` is plain browser service-worker JavaScript (not TypeScript) by platform requirement.  
Owner: tools. Review expiry: 2027-06-01.
