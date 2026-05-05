# Google OAuth Verification Notes

Use this checklist when submitting or resubmitting Google OAuth verification for `https://qesto.cc/`.

## 1) Domain ownership (Search Console DNS TXT)

1. Open Google Search Console and add property `qesto.cc` (Domain property).
2. Copy the TXT verification record value from Google.
3. In Cloudflare DNS for `qesto.cc`, add:
   - Type: `TXT`
   - Name: `@`
   - Content: `google-site-verification=...`
4. Wait for DNS propagation and click **Verify** in Search Console.
5. Capture proof:
   - Screenshot of Search Console property status as verified.
   - Screenshot of Cloudflare DNS TXT record.

## 2) Homepage checks required by Google

Confirm all are visible on `https://qesto.cc/`:

- Clear app purpose statement in hero copy (what Qesto does and who it serves).
- Visible `Privacy Policy` link above the fold.
- Additional `Privacy Policy` links in top navigation and footer.

## 3) Public policy and crawlability endpoints

Verify these production URLs resolve:

- `https://qesto.cc/privacy`
- `https://qesto.cc/terms`
- `https://qesto.cc/robots.txt`
- `https://qesto.cc/sitemap.xml`

## 4) Suggested notes for Google review form

Use concise language:

> We verified ownership of `qesto.cc` via Google Search Console DNS TXT record.  
> Our homepage clearly explains the app purpose: Qesto is a live session platform for polls, rankings, and consent rounds used by teams, educators, and facilitators.  
> The homepage includes a prominent `Privacy Policy` link (above the fold), with additional policy links in navigation and footer.
