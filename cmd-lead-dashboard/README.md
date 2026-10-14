# CMD Lead Desk

Cloudflare Pages dashboard for `source = 'cmd'` records in the shared
`unfuck-leads` D1 database.

## Access and safety headers

- The dashboard opens directly at `https://cmd-leads-dash.pages.dev/` with no login or private link.
- The dashboard, APIs, and assets use `no-store`; the page sends `noindex`, CSP,
  frame blocking, MIME sniffing protection, and a no-referrer policy.
- Every read and write query is hard-scoped to `source = 'cmd'`.

## Development

```sh
npm test
npx wrangler pages dev pages-dist --d1 DB=20ec98a7-8f00-48ed-938a-bc1c4946bf40
```

Production project: `cmd-leads-dash`
