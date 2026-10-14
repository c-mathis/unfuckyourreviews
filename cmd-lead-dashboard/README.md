# CMD Lead Desk

Private Cloudflare Pages dashboard for `source = 'cmd'` records in the shared
`unfuck-leads` D1 database.

## Security

- Unauthenticated dashboard routes return `404`; unauthenticated API routes return `401`.
- A private link exchanges `DASHBOARD_LINK_TOKEN` for a derived one-year
  `HttpOnly`, `Secure`, `SameSite=Strict` session cookie, then redirects to the clean URL.
- The dashboard, APIs, and assets use `no-store`; the page also sends `noindex`, CSP,
  frame blocking, MIME sniffing protection, and a no-referrer policy.
- Every read and write query is hard-scoped to `source = 'cmd'`.
- Treat the private link like a password. Never commit it or send it in ordinary email.

## Development

```sh
npm test
npx wrangler pages dev pages-dist --d1 DB=20ec98a7-8f00-48ed-938a-bc1c4946bf40
```

Production project: `cmd-leads-dash`

Required secret: `DASHBOARD_LINK_TOKEN`
