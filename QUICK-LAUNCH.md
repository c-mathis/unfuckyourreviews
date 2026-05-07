# Quick Launch Checklist - Unfuck Your Reviews Cold Email

**Time to launch:** 2-4 hours
**Time to first replies:** 24-48 hours

---

## ✅ Step 1: Set Up Instantly Campaign (30 minutes)

### Open Instantly Dashboard
1. Go to https://instantly.ai
2. Log in with your existing account

### Create New Campaign
1. Click "Campaigns" → "New Campaign"
2. **Campaign Name:** `Unfuck Reviews - Q2 2026`
3. **Campaign Type:** Regular Campaign
4. Click "Create"

### Configure Email Sequence

**Add Email 1 (The Audit):**
- Subject: `{{firstName}}, spotted this on your Google listing`
- Body: (Copy from `INSTANTLY-SETUP.md` → Email 1)
- Delay: 3 days

**Add Email 2 (The Data):**
- Subject: `Re: {{businessName}}'s reviews`
- Body: (Copy from `INSTANTLY-SETUP.md` → Email 2)
- Delay: 4 days

**Add Email 3 (Social Proof):**
- Subject: `One last thing`
- Body: (Copy from `INSTANTLY-SETUP.md` → Email 3)
- Delay: 4 days

**Add Email 4 (The Breakup):**
- Subject: `Moving on`
- Body: (Copy from `INSTANTLY-SETUP.md` → Email 4)
- No follow-up

### Configure Campaign Settings
- Daily limit: **50 emails/day** (start conservative)
- Sending schedule: Mon-Fri, 8am-6pm (recipient timezone)
- Time between emails: 30-60 seconds

**Save campaign** (don't launch yet - we need leads first)

---

## ✅ Step 2: Scrape Leads with Your Lead Scraper (1-2 hours)

### Navigate to Lead Scraper
```bash
cd /Users/beef/Repository/lead-scraper-agent
```

### Verify API Keys
```bash
python3 main.py status
```

**Should show all green checkmarks** ✅

If any are missing, edit `.env` file with API keys.

---

### Option A: Quick Test (10 leads, 5 minutes)

Test with a small batch first:

```bash
python3 main.py run gmaps "HVAC" "Denver, CO" \
  --max-results 10 \
  --campaign "Unfuck_Test"
```

**Check output:**
```bash
ls -lh data/exported/
cat data/exported/Unfuck_Test.csv | head -5
```

If successful → proceed to Option B

---

### Option B: Full Batch (550 leads, 30-45 minutes)

Run the batch scraping script:

```bash
./scrape-reviews-batch.sh
```

**What this does:**
- Scrapes 550 businesses from Google Maps
- Enriches with emails via Apollo.io
- Verifies emails via MillionVerifier
- Exports to CSV

**Output:** `data/exported/Unfuck_Reviews_Q2_2026.csv`

**Cost:** ~$5 (Apify + MillionVerifier)

---

## ✅ Step 3: Filter for Review Problems (10 minutes)

Most scraped businesses won't have review problems. Filter them:

```bash
python3 filter-reviews.py \
  data/exported/Unfuck_Reviews_Q2_2026.csv \
  data/exported/Unfuck_Reviews_FILTERED.csv
```

**What this does:**
- Filters for businesses with <4.0 stars OR <50 reviews
- Removes businesses without email/website
- Adds `reviewIssue` field (personalization)
- Adds `industry` field (extracted from category)
- Sorts by worst ratings first (prioritize)

**Expected output:** 150-300 qualified leads

---

## ✅ Step 4: Record Loom Videos (Optional, 2-3 hours for 10 videos)

For your best leads, record personalized review audit videos.

### Prioritize:
- Ratings under 3.5 stars (worst problems = easiest sell)
- Review count < 20 (desperate for help)
- High-value industries (dentists, lawyers, med spas)
- Your local market (easier to close)

### Process:
1. Open filtered CSV, sort by worst rating
2. For top 10-20 leads:
   - Open their Google Business Profile in Chrome
   - Start Loom screen recording
   - Follow script from `INSTANTLY-SETUP.md` → Loom Video Audit Script
   - Record 2-3 minutes
   - Copy Loom URL to CSV in `loomURL` column
3. Save CSV

**If you skip this:** Remove `{{loomURL}}` line from Email 1 body

**Conversion impact:** Loom videos increase reply rate by ~50% but take time

---

## ✅ Step 5: Upload Leads to Instantly (15 minutes)

### Prepare CSV

Make sure your CSV has these columns:
- `email`
- `firstName` (use "there" if missing)
- `businessName`
- `city`
- `industry`
- `rating`
- `reviewCount`
- `reviewIssue`
- `loomURL` (optional)

### Upload to Instantly

1. Go to your campaign → "Leads" tab
2. Click "Import Leads"
3. Select "CSV File"
4. Upload `Unfuck_Reviews_FILTERED.csv`
5. **Map columns:**
   - Email → `email`
   - First Name → `firstName`
   - Business Name → `businessName`
   - City → `city`
   - Industry → `industry`
   - Rating → `rating`
   - Review Count → `reviewCount`
   - Review Issue → `reviewIssue`
   - Loom URL → `loomURL` (if you have it)
6. Review preview
7. Click "Import"

**Start with 50-100 leads** for test batch

---

## ✅ Step 6: Launch Campaign (5 minutes)

### Final Checklist

Before launching, verify:
- [ ] Subject lines look natural (no spam words)
- [ ] All `{{variables}}` have values in CSV
- [ ] Loom URLs work (test a few if you're using them)
- [ ] Daily sending limit is set to 50/day
- [ ] Sending schedule is Mon-Fri, 8am-6pm
- [ ] Campaign is in "Draft" status

### Launch

1. Click "Review & Launch"
2. Send test email to yourself
3. Check formatting, links, all variables populated correctly
4. If good → Click "Launch Campaign"

**Emails start sending immediately** based on your schedule.

---

## ✅ Step 7: Monitor & Respond (Ongoing)

### Daily Tasks (2x per day)

**Morning (9am):**
1. Check Instantly inbox for replies
2. Respond to positive replies within 1 hour (use templates from `INSTANTLY-SETUP.md`)
3. Check deliverability metrics:
   - Open rate should be 40%+
   - Bounce rate should be <5%
   - If bounce >10%, pause and troubleshoot

**Afternoon (4pm):**
1. Check Instantly inbox again
2. Respond to new replies
3. Book calls via Calendly
4. Update lead status in Instantly

### Weekly Tasks (Friday)

1. Review metrics:
   - Emails sent
   - Open rate (target: 40-60%)
   - Reply rate (target: 5-10%)
   - Positive replies (target: 2-5%)
   - Booked calls (target: 1-2%)
2. A/B test subject lines if open rate <40%
3. Add more leads to campaign
4. Scale sending volume if all metrics good

---

## Expected Results Timeline

**Day 1-2:** Emails sending, opens coming in (40-60 opens from 100 emails)

**Day 3-5:** First replies (5-10 replies)

**Day 7-10:** First positive replies (2-4 interested leads)

**Day 10-14:** First booked calls (1-2 calls)

**Day 14-21:** First closed deal ($399-500/mo MRR) 🎉

---

## Week 1 Goals

| Metric | Target |
|--------|--------|
| Emails sent | 50-100 |
| Open rate | 40%+ |
| Replies | 5-10 |
| Positive replies | 2-4 |
| Booked calls | 1-2 |
| Closed deals | 0-1 |

---

## Troubleshooting

### "Low open rate (<30%)"

**Causes:**
- Domain not warmed up
- Subject lines too salesy
- Landing in spam

**Fixes:**
- Reduce sending to 25/day
- Test new subject lines
- Check spam score at mail-tester.com

---

### "High bounce rate (>10%)"

**Causes:**
- Bad email verification
- Invalid email addresses

**Fixes:**
- Re-run MillionVerifier on your list
- Pause campaign
- Remove invalid emails

---

### "No replies"

**Causes:**
- Wrong ICP (targeting wrong businesses)
- Email copy not compelling
- Not personalized enough

**Fixes:**
- Filter for worse ratings (<3.5 stars only)
- Add more personalization to Email 1
- Record Loom videos for top leads

---

## What to Do Right Now

**Priority 1 (Do today - 2 hours):**
1. ✅ Set up Instantly campaign (30 min)
2. ✅ Run test scrape: 10 leads (5 min)
3. ✅ Verify test worked, check CSV (5 min)
4. ✅ Run full batch scrape: 550 leads (45 min)
5. ✅ Filter for review problems (10 min)
6. ✅ Upload 50 leads to Instantly (15 min)
7. ✅ Launch campaign (5 min)

**Priority 2 (This weekend - 3 hours):**
8. Record 10-20 Loom videos for best leads
9. Upload to Instantly with Loom URLs
10. Add 50 more leads to campaign

**Priority 3 (Next week - ongoing):**
11. Monitor replies 2x/day
12. Respond within 1 hour
13. Book calls
14. Send proposals
15. Close deals

---

## Quick Commands Reference

```bash
# Navigate to lead scraper
cd /Users/beef/Repository/lead-scraper-agent

# Check API keys
python3 main.py status

# Test scrape (10 leads)
python3 main.py run gmaps "HVAC" "Denver, CO" --max-results 10 --campaign "Test"

# Full batch scrape (550 leads)
./scrape-reviews-batch.sh

# Filter for review problems
python3 filter-reviews.py \
  data/exported/Unfuck_Reviews_Q2_2026.csv \
  data/exported/Unfuck_Reviews_FILTERED.csv

# Check filtered output
wc -l data/exported/Unfuck_Reviews_FILTERED.csv
head -5 data/exported/Unfuck_Reviews_FILTERED.csv
```

---

## Cost Summary

**One-time setup:**
- Instantly.ai: $37/mo (already have)
- Lead scraper API keys: Already configured

**Per campaign:**
- 550 scraped leads: ~$5
- Email verification: Included in scraper
- Email sending: Included in Instantly

**Total cost to launch:** $5

**Expected return (first 30 days):**
- 1-3 closed deals
- $400-1,500/mo MRR
- **ROI: 80x-300x**

---

**Ready to launch?** 🔥

Start with Step 1 right now. I'll help if you get stuck.
