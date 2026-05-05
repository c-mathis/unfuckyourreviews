
# Unfuck Your Reviews

A landing page for review management services - helping businesses fix their Google review problems.

## Static Site

This is a simple static HTML/CSS/JS site with no build process required.

**Files:**
- `index.html` - Main page
- `style.css` - Styles
- `script.js` - Interaction logic

## Local Development

Just open `index.html` in your browser, or use any simple HTTP server:

```bash
python -m http.server 8000
# or
npx serve .
```

## Deployment

Deploy directly to Cloudflare Pages:
1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Set build command: (leave empty)
4. Set build output directory: `/`
5. Deploy

No build step needed - it's just static files.