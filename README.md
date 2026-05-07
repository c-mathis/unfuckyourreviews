# Unfuck Your Reviews

**Unified lead tracking system for all "Unfuck Your X" properties**

Landing page + Cloudflare Worker + D1 Database + Dashboard for managing leads from:
- unfuckyourreviews.com
- unfuckyourweb.com
- unfuckyourads.com
- unfuckyourcopy.com
- ...and more

---

## What's Included

### 1. Landing Page
- Static HTML/CSS/JS (no build process)
- Interactive checklist ("Are your reviews fucked?")
- Contact form with issue tracking
- UTM parameter capture
- Mobile responsive

### 2. Cloudflare Worker
- Form submission handler
- REST API for dashboard
- Automatic source tagging
- Rate limiting ready
- CORS enabled

### 3. D1 Database
- SQLite on the edge
- Lead storage with full tracking
- Activity logging
- Status management
- Free tier (5GB, 5M reads/day)

### 4. Dashboard
- Real-time lead view
- Filter by source/status
- Lead detail modal
- Update status/priority/notes
- Stats overview

---

## Quick Start

### Local Development

```bash
# Serve landing page locally
python -m http.server 8000
# or
npx serve .
```

Visit `http://localhost:8000`

### Deploy to Production

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete deployment guide.

**TL;DR:**
```bash
# 1. Create D1 database
wrangler d1 create unfuck-leads

# 2. Initialize schema
wrangler d1 execute unfuck-leads --remote --file=schema.sql

# 3. Deploy worker
wrangler deploy

# 4. Update form endpoint in script.js
# 5. Deploy to Cloudflare Pages
```

---

## File Structure

```
unfuckyourreviews/
├── index.html          # Landing page
├── style.css           # Styles
├── script.js           # Form handling & interactions
├── worker.js           # Cloudflare Worker (API + form handler)
├── schema.sql          # D1 database schema
├── dashboard.html      # Lead management dashboard
├── wrangler.toml       # Cloudflare configuration
├── DEPLOYMENT.md       # Complete deployment guide
└── README.md           # This file
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Landing Pages                          │
│  - unfuckyourreviews.com                │
│  - unfuckyourweb.com                    │
│  - unfuckyourads.com                    │
└──────────────┬──────────────────────────┘
               │ Form submission
               ↓
┌─────────────────────────────────────────┐
│  Cloudflare Worker                      │
│  leads.unfuckyourweb.com                │
│  - /submit (POST)                       │
│  - /api/leads (GET)                     │
│  - /api/stats (GET)                     │
│  - /api/leads/update (POST)             │
└──────────────┬──────────────────────────┘
               │ Store/retrieve
               ↓
┌─────────────────────────────────────────┐
│  Cloudflare D1 Database                 │
│  - leads table                          │
│  - activity_log table                   │
└──────────────┬──────────────────────────┘
               │ Query
               ↓
┌─────────────────────────────────────────┐
│  Dashboard                              │
│  dashboard.unfuckyourweb.com            │
└─────────────────────────────────────────┘
```

---

## Configuration

### Form Endpoint

Update `script.js` line 11:
```javascript
formEndpoint: 'https://leads.unfuckyourweb.com/submit',
```

### Dashboard API

Update `dashboard.html` line 464:
```javascript
const API_BASE = 'https://leads.unfuckyourweb.com';
```

### Worker Routing

Update `wrangler.toml` with your zone:
```toml
[[routes]]
pattern = "leads.unfuckyourweb.com/*"
zone_name = "unfuckyourweb.com"
```

---

## Usage

### Submit Test Lead

```bash
curl -X POST https://leads.unfuckyourweb.com/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "555-1234",
    "website": "https://example.com",
    "problem": "My reviews are terrible",
    "source": "reviews",
    "selected_issues": "Low rating | No responses | Old reviews",
    "issues_count": 3
  }'
```

### Query Leads

```bash
# Get all leads
curl https://leads.unfuckyourweb.com/api/leads

# Filter by source
curl https://leads.unfuckyourweb.com/api/leads?source=reviews

# Filter by status
curl https://leads.unfuckyourweb.com/api/leads?status=new

# Get stats
curl https://leads.unfuckyourweb.com/api/stats
```

### Update Lead

```bash
curl -X POST https://leads.unfuckyourweb.com/api/leads/update \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "status": "contacted",
    "priority": "high",
    "notes": "Called and left voicemail"
  }'
```

---

## Pricing Strategy

**Service:** Unfuck Your Reviews
**Price:** $399-500/mo (decided: mid-tier positioning)

**Competitive positioning:**
- Above DIY platforms ($50-150/mo)
- Below full agencies ($800-1,500/mo)
- No contract, no setup fee
- True done-for-you service

**Deliverables at $399-500/mo:**
1. Review reactivation campaign (Month 1)
2. Personalized review requests (50-100/month)
3. AI-powered responses (24-hour turnaround)
4. Negative review management (limit 5/month)
5. Monthly performance reporting
6. GBP optimization (setup)

**Lead qualification:** Landing page → Loom walkthrough → Discovery call → Proposal

**No pricing on landing page** - disclosed in pre-sale content only.

---

## Roadmap

- [ ] Email notifications for new leads
- [ ] Slack/Discord webhook integration
- [ ] Dashboard authentication (Cloudflare Access)
- [ ] CSV export
- [ ] Lead scoring algorithm
- [ ] CRM integration (HubSpot, Pipedrive)
- [ ] Automated follow-up sequences
- [ ] A/B testing framework

---

## Support

See [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting and maintenance commands.