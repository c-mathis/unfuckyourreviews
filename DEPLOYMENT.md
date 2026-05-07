# Unfuck Leads - Deployment Guide

This guide walks through deploying the unified lead tracking system for all "Unfuck Your X" properties.

## Architecture Overview

```
Landing Pages (unfuckyourreviews.com, unfuckyourweb.com, etc.)
    ↓ (Form submission)
Cloudflare Worker (leads.unfuckyourweb.com)
    ↓ (Store/retrieve)
Cloudflare D1 Database
    ↑ (Read)
Dashboard (dashboard.unfuckyourweb.com)
```

---

## Prerequisites

- Cloudflare account with Workers and D1 enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Domain managed in Cloudflare (unfuckyourweb.com)

---

## Step 1: Create D1 Database

```bash
# Navigate to project directory
cd /Users/beef/Repository/unfuckyourreviews

# Create D1 database
wrangler d1 create unfuck-leads
```

**Expected output:**
```
✅ Successfully created DB 'unfuck-leads'

[[d1_databases]]
binding = "DB"
database_name = "unfuck-leads"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

**Copy the `database_id` and update `wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "unfuck-leads"
database_id = "PASTE_ID_HERE"  # ← Replace this
```

---

## Step 2: Initialize Database Schema

```bash
# Execute schema against remote database
wrangler d1 execute unfuck-leads --remote --file=schema.sql
```

**Verify tables were created:**
```bash
wrangler d1 execute unfuck-leads --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

You should see: `leads` and `activity_log`

---

## Step 3: Deploy Worker

```bash
# Deploy to Cloudflare
wrangler deploy
```

**Expected output:**
```
✅ Published unfuck-leads-worker
   https://unfuck-leads-worker.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 4: Set Up Custom Domain for Worker

### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on `unfuck-leads-worker`
3. Go to Settings → Triggers
4. Under Custom Domains, click "Add Custom Domain"
5. Enter: `leads.unfuckyourweb.com`
6. Click "Add Custom Domain"

### Option B: Via Wrangler

Update `wrangler.toml` with your zone info and run:
```bash
wrangler deploy
```

---

## Step 5: Update Form Endpoint

Edit `script.js` line 11:

**Before:**
```javascript
formEndpoint: 'https://formsubmit.co/your@email.com',
```

**After:**
```javascript
formEndpoint: 'https://leads.unfuckyourweb.com/submit',
```

Commit the change:
```bash
git add script.js
git commit -m "Update form endpoint to production worker"
```

---

## Step 6: Deploy Landing Page to Cloudflare Pages

### Option A: Via GitHub (Recommended)

1. Push to GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/unfuckyourreviews.git
git push -u origin main
```

2. Connect to Cloudflare Pages:
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project" → "Connect to Git"
   - Select your repository
   - Configure build settings:
     - **Build command:** (leave empty)
     - **Build output directory:** `/`
     - **Root directory:** `/`
   - Click "Save and Deploy"

3. Add custom domain:
   - Go to Pages project → Custom domains
   - Click "Set up a custom domain"
   - Enter: `unfuckyourreviews.com`
   - Click "Activate domain"

### Option B: Direct Upload

```bash
wrangler pages deploy . --project-name=unfuckyourreviews
```

---

## Step 7: Deploy Dashboard

The dashboard (`dashboard.html`) needs to be hosted separately.

### Option 1: Cloudflare Pages (Separate Project)

```bash
# Create new directory for dashboard
mkdir unfuck-dashboard
cp dashboard.html unfuck-dashboard/index.html

# Deploy
cd unfuck-dashboard
wrangler pages deploy . --project-name=unfuck-dashboard
```

Then add custom domain: `dashboard.unfuckyourweb.com`

### Option 2: Same Pages Project (Subdirectory)

Move `dashboard.html` to a `/dashboard` folder and access at:
`unfuckyourreviews.com/dashboard.html`

**Update `dashboard.html` line 464** with the correct API endpoint:
```javascript
const API_BASE = 'https://leads.unfuckyourweb.com';
```

---

## Step 8: DNS Configuration

If not automatically configured by Cloudflare Pages, add these DNS records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | unfuckyourreviews.com | unfuckyourreviews.pages.dev | ✅ Proxied |
| CNAME | leads | unfuck-leads-worker.workers.dev | ✅ Proxied |
| CNAME | dashboard | unfuck-dashboard.pages.dev | ✅ Proxied |

---

## Step 9: Test End-to-End

### Test Form Submission

1. Visit `https://unfuckyourreviews.com`
2. Fill out the contact form
3. Submit

### Verify in Database

```bash
wrangler d1 execute unfuck-leads --remote --command="SELECT * FROM leads ORDER BY created_at DESC LIMIT 1"
```

### Check Dashboard

1. Visit `https://dashboard.unfuckyourweb.com`
2. Verify the lead appears in the table
3. Click on the lead to open details
4. Update status/notes and save
5. Verify changes persist

---

## Step 10: Add Additional Properties

To add more "Unfuck Your X" sites to the same system:

1. Deploy new landing page (e.g., `unfuckyourweb.com`, `unfuckyourads.com`)
2. Update their `script.js` to use the same worker endpoint:
   ```javascript
   formEndpoint: 'https://leads.unfuckyourweb.com/submit',
   ```
3. Optionally add a hidden field to tag the source:
   ```html
   <input type="hidden" name="source" value="web">
   ```

The worker will automatically detect the source from the referer if not provided.

---

## Maintenance Commands

### View Recent Leads
```bash
wrangler d1 execute unfuck-leads --remote --command="SELECT name, email, source, status, created_at FROM leads ORDER BY created_at DESC LIMIT 10"
```

### Count Leads by Source
```bash
wrangler d1 execute unfuck-leads --remote --command="SELECT source, COUNT(*) as count FROM leads GROUP BY source"
```

### View Worker Logs
```bash
wrangler tail
```

### Update Database Schema
```bash
# Make changes to schema.sql, then:
wrangler d1 execute unfuck-leads --remote --file=schema.sql
```

---

## Security Considerations

1. **Dashboard Authentication:** The dashboard is currently public. Consider adding:
   - Cloudflare Access (Zero Trust)
   - Basic HTTP auth via Worker
   - Email-based magic link auth

2. **Rate Limiting:** Add rate limiting to the worker to prevent spam:
   ```javascript
   // Check if IP has submitted recently
   // Implement in worker.js handleFormSubmission()
   ```

3. **CORS:** Currently allows all origins. Restrict in production:
   ```javascript
   const corsHeaders = {
     'Access-Control-Allow-Origin': 'https://unfuckyourreviews.com',
     // ...
   };
   ```

---

## Troubleshooting

### Form submissions not saving

1. Check worker logs: `wrangler tail`
2. Verify D1 binding in wrangler.toml
3. Test worker directly:
   ```bash
   curl -X POST https://leads.unfuckyourweb.com/submit \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@test.com","source":"reviews"}'
   ```

### Dashboard not loading leads

1. Check browser console for CORS errors
2. Verify API_BASE in dashboard.html matches worker URL
3. Test API endpoint:
   ```bash
   curl https://leads.unfuckyourweb.com/api/leads
   ```

### DNS not resolving

1. Wait 5-10 minutes for DNS propagation
2. Check DNS records in Cloudflare Dashboard
3. Verify proxy status is enabled (orange cloud)

---

## Next Steps

- [ ] Add email notifications for new leads
- [ ] Implement webhook to Slack/Discord
- [ ] Add CSV export functionality
- [ ] Build lead scoring algorithm
- [ ] Integrate with CRM (HubSpot, Pipedrive, etc.)
- [ ] Add dashboard authentication
- [ ] Set up automated follow-up sequences

---

## Cost Estimate

**Free Tier Limits:**
- D1: 5 GB storage, 5M reads/day, 100K writes/day
- Workers: 100K requests/day
- Pages: Unlimited requests

**Expected at 100 leads/day:**
- D1 writes: ~200/day (lead + activity log)
- Worker requests: ~300/day (forms + dashboard)
- **Cost: $0/month** (well within free tier)

**At scale (1,000 leads/day):**
- Still free tier for D1 and Pages
- Workers might need paid plan at $5/month for 10M requests
