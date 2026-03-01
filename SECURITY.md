# Security Notes

This is a public, read-only static site hosted on GitHub Pages.  
It has no user accounts, no logins, no forms, no cookies, and no user data.  
The threat model is limited accordingly.

## What's active

### Content Security Policy (meta tag)
Restricts what the browser can load and execute.

| Directive | Allowed |
|---|---|
| `default-src` | `'none'` — everything blocked unless explicitly listed |
| `script-src` | Only `self` + Chart.js (by SRI hash) + jsdelivr.net |
| `style-src` | `self` + cdnjs (Font Awesome) + Google Fonts |
| `font-src` | `self` + fonts.gstatic.com + cdnjs |
| `img-src` | `self` + ESPN CDN + `data:` |
| `connect-src` | `self` + ESPN APIs + Google Sheets (gviz) |
| `object-src` | `'none'` |
| `form-action` | `'none'` |
| `upgrade-insecure-requests` | active |

No `unsafe-inline` in `script-src`. No `unsafe-eval` anywhere.

### Subresource Integrity (SRI)
Both external scripts have `integrity=` hashes. The browser refuses to execute
either if the CDN ever serves modified content.

- Font Awesome 6.5.1: `sha512-DTOQO9...`
- Chart.js 4.4.0: `sha384-mD7chyvs...`

### JavaScript hardening (script.js)
- `SEC.esc()` — HTML-escapes every API value before innerHTML injection, 500 char cap
- `SEC.safeUrl()` — blocks javascript:, data:, vbscript:, non-HTTPS in all hrefs
- `SEC.safeImgSrc()` — restricts image sources to ESPN CDN only
- `SEC.safeYear()` — validates years before interpolation into API URLs
- `fetchJson()` — origin allowlist, AbortController timeout, credentials: omit
- Client-side rate limit — max 120 ESPN API calls per 60s window
- `'use strict'` throughout

### HTTPS
GitHub Pages enforces HTTPS automatically for custom domains.

## What's not in place (and why it's fine here)

HTTP response headers like HSTS, X-Frame-Options, X-Content-Type-Options and
Permissions-Policy require a proxy — GitHub Pages can't set them.  
None of them are meaningful for a public read-only page with no user data.

## If you ever add user accounts or sensitive data
Move to Netlify (free, supports _headers file natively) or add a proxy.
The `_headers` file in this repo is pre-written and ready.
