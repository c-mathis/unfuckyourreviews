# Meta Ads Setup Guide

**Status:** Landing page is Meta Ads ready ✅

All tracking and conversion optimization has been implemented. Follow this guide to configure and launch your Meta ad campaigns.

---

## What's Been Implemented

### ✅ Meta Pixel Tracking (Browser-Side)

**Location:** `index.html` (head section)

**Events configured:**
1. **PageView** - Fires on page load
2. **ViewContent** - Fires at 50% scroll
3. **InitiateCheckout** - Fires when form is started (first field clicked)
4. **Lead** - Fires on form submission with advanced matching

**Advanced matching enabled:**
- Email (hashed)
- First name (hashed)
- Last name (hashed)
- Business name as external ID

### ✅ Meta Conversion API (Server-Side)

**Location:** `worker.js`

**Benefits:**
- Survives ad blockers
- iOS 14+ tracking improvement
- Better attribution accuracy
- Duplicate event deduplication

**Events sent:**
- Lead event with full user data (hashed)
- IP address and user agent for matching
- Custom value: $399 (expected service value)

### ✅ Landing Page Optimizations

**Changes made:**
1. ✅ Added headline: "Is Your Google Rating Under 4.0?"
2. ✅ Added subheadline with 47% stat
3. ✅ Added social proof section with before/after case studies
4. ✅ Simplified form (removed dropdown field)
5. ✅ Added trust signals (No contracts, 90-day guarantee, 100+ businesses)
6. ✅ Changed CTA button to "GET YOUR FREE REVIEW AUDIT"

---

## Setup Steps

### Step 1: Get Your Meta Pixel ID

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select your Business Account
3. Click **Connect Data Sources** → **Web** → **Meta Pixel**
4. Copy your **Pixel ID** (16-digit number)

### Step 2: Get Your Meta Access Token

1. In Events Manager, click on your Pixel
2. Go to **Settings** tab
3. Scroll to **Conversions API** section
4. Click **Generate Access Token**
5. Copy the token (starts with `EAA...`)

### Step 3: Update index.html with Pixel ID

Open `index.html` and replace `YOUR_PIXEL_ID_HERE` with your actual Pixel ID:

```html
<!-- Line 23 in index.html -->
fbq('init', 'YOUR_PIXEL_ID_HERE');

<!-- Line 26 in index.html -->
src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID_HERE&ev=PageView&noscript=1"
```

**Find and replace:**
- Find: `YOUR_PIXEL_ID_HERE`
- Replace with: Your 16-digit Pixel ID (e.g., `123456789012345`)

### Step 4: Set Cloudflare Worker Secrets

Run these commands to set environment variables:

```bash
# Navigate to project directory
cd /Users/beef/Repository/unfuckyourreviews

# Set Meta Pixel ID
wrangler secret put META_PIXEL_ID
# When prompted, paste your 16-digit Pixel ID

# Set Meta Access Token
wrangler secret put META_ACCESS_TOKEN
# When prompted, paste your access token (EAA...)
```

### Step 5: Deploy Updated Files

```bash
# Deploy Cloudflare Worker with new secrets
wrangler deploy

# Deploy landing page to Cloudflare Pages (if using Pages)
# Or upload index.html, script.js, style.css to your hosting
```

### Step 6: Test Pixel Installation

1. Install [Meta Pixel Helper Chrome Extension](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Visit your landing page
3. Check that Pixel Helper shows:
   - ✅ PageView event
   - Scroll 50% down → ✅ ViewContent event
   - Click into form → ✅ InitiateCheckout event
   - Submit form → ✅ Lead event

### Step 7: Verify Conversion API

After submitting a test lead:

1. Go to Meta Events Manager
2. Click **Test Events** tab
3. You should see both:
   - **Browser** event (from pixel)
   - **Server** event (from Conversion API)
4. They should be deduplicated (not counted twice)

---

## Campaign Launch Checklist

Use this checklist when launching your first Meta ad campaign:

### Pre-Launch (Week 1)

- [ ] Meta Pixel ID added to `index.html`
- [ ] Cloudflare Worker secrets configured
- [ ] All files deployed
- [ ] Pixel Helper shows all events firing
- [ ] Conversion API events visible in Events Manager
- [ ] Test lead submitted successfully
- [ ] Lead appears in dashboard at `dashboard.unfuckyourweb.com`

### Campaign Setup (Week 2)

- [ ] Business Manager account created
- [ ] Ad account created and payment method added
- [ ] Audiences created (cold + warm)
- [ ] 10-15 ad creatives designed (static + video)
- [ ] 5-10 ad copy variations written
- [ ] Campaign structure built (Lead Gen + Video Awareness)
- [ ] Daily budget set ($50-100/day recommended)

### Launch Day

- [ ] Launch lead gen campaign
- [ ] Launch video awareness campaign
- [ ] Monitor for first 3 days
- [ ] Check for ad disapprovals
- [ ] Verify pixel is firing on real traffic
- [ ] Confirm leads are coming through

### Week 1 After Launch

- [ ] Daily: Check CPL, kill ads > $150 CPL
- [ ] Every 3 days: Scale winning ads by 20%
- [ ] Refresh creative (add 3-5 new ads)
- [ ] Test new audience segment

---

## Expected Performance

### Learning Phase (Days 1-14)

**Budget:** $1,500-3,000/month
**Expected CPL:** $75-150 (high during learning)
**Expected leads:** 10-20 in first 2 weeks
**Focus:** Gather data, let algorithm optimize

### Optimization Phase (Days 15-30)

**Budget:** $2,000-3,000/month
**Expected CPL:** $50-100
**Expected leads:** 20-40/month
**Focus:** Kill losers, scale winners, refresh creative

### Scaling Phase (Month 2+)

**Budget:** $5,000+/month
**Expected CPL:** $50-100 (stabilizes)
**Expected leads:** 50-80/month
**Close rate:** 10-20% (if sales process is tight)
**New clients:** 5-16/month
**Revenue:** $2,000-8,000/month

---

## Troubleshooting

### Pixel Not Firing

**Check:**
1. Pixel Helper extension shows errors?
2. Browser console shows JavaScript errors?
3. Ad blocker disabled for testing?
4. Correct Pixel ID in both places (init + noscript)?

### Conversion API Not Working

**Check:**
1. Secrets set correctly: `wrangler secret list`
2. Worker deployed: `wrangler deploy`
3. Check worker logs: `wrangler tail`
4. Test Events tab in Events Manager shows server events?

### High CPL (Cost Per Lead)

**Possible issues:**
1. Still in learning phase (need 50+ conversions per ad set)
2. Audience too broad or too narrow
3. Creative fatigue (refresh every 2-3 weeks)
4. Landing page conversion rate too low (aim for 5-10%+)

### Low Form Conversion Rate

**Test:**
1. Form loads on mobile (80% of traffic)?
2. Page speed under 2 seconds?
3. Trust signals visible?
4. CTA button clear and compelling?

---

## Form Changes Made for Better Conversion

**Original form had 5 fields:**
1. Name
2. Email
3. Business name
4. Review situation dropdown ❌ **REMOVED**
5. Optional problem description

**New simplified form has 3 fields:**
1. Name
2. Email
3. Business name

**Why:** Lower friction = higher conversion rate. Meta ads traffic converts better with simpler forms.

---

## What to Track

### Key Metrics (Weekly)

- **CPL (Cost Per Lead):** Target $50-100
- **Landing page conversion rate:** Target 5-10%+
- **Form starts:** How many InitiateCheckout events
- **Form completion rate:** Leads / Form starts (target 50%+)
- **Close rate:** Closed clients / Total leads (target 10-20%)
- **ROAS (Return on Ad Spend):** Target 2x+ after learning phase

### Red Flags

- CPL consistently > $150
- Landing page conversion < 3%
- Form completion rate < 30%
- Close rate < 5%
- Ad frequency > 3x/week (fatigue)

---

## Next Steps After Setup

1. **Design ad creatives** (see `meta-ads-campaign.md` for examples)
2. **Build ad audiences** (business owners, local services, industry-specific)
3. **Launch with $50/day** for 14 days
4. **Monitor and optimize** daily for first week
5. **Scale winners** by 20% every 3 days
6. **Refresh creative** every 2-3 weeks

---

## Support Resources

- [Meta Pixel Helper Extension](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
- [Meta Events Manager](https://business.facebook.com/events_manager2)
- [Meta Ads Manager](https://business.facebook.com/adsmanager)
- [Cloudflare Workers Dashboard](https://dash.cloudflare.com/)
- [Full campaign strategy](./meta-ads-campaign.md)

---

**Questions or issues?** Check worker logs with `wrangler tail` or inspect browser console for errors.
