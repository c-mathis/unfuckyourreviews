# Unfuck Your Reviews - Launch Action Plan

**Goal:** Get first 3-5 clients in 30 days via cold email + Meta ads

**Timeline:** 4 weeks to first revenue

---

## Week 1: Foundation (Setup Week)

### Day 1-2: DNS & Domain Setup ✅

**Already done:**
- D1 database deployed
- Worker API live
- Landing page deployed
- Dashboard deployed

**To do:**
- [ ] Configure custom domains in Cloudflare dashboard (see DEPLOYED.md)
  - `unfuckyourreviews.com` → Landing page
  - `dashboard.unfuckyourweb.com` → Dashboard
  - `leads.unfuckyourweb.com` → Worker (should auto-work)
- [ ] Test end-to-end form submission after DNS propagates
- [ ] Verify dashboard loads and displays test lead

**Time:** 30 minutes

---

### Day 3-4: Cold Email Infrastructure

**Email domain setup:**
- [ ] Create subdomain: `mail.unfuckyourreviews.com`
- [ ] Configure SPF record
- [ ] Configure DKIM
- [ ] Configure DMARC (p=none)

**Email sending tool:**
- [ ] Sign up for Instantly.ai ($37/mo) - **Recommended**
  - OR Smartlead ($39/mo)
  - OR Lemlist ($59/mo)
- [ ] Connect `mail.unfuckyourreviews.com` to sending platform
- [ ] Start domain warmup (auto-sends to warmup pool)
  - Week 1: 25 emails/day
  - Week 2: 50 emails/day
  - Week 3: 100 emails/day
  - Week 4: 150+ emails/day

**Time:** 2 hours

---

### Day 5-7: Lead Scraping & Outreach Setup

**Scrape leads:**
- [ ] Sign up for Outscraper.com ($30/mo) - **Recommended**
  - OR use Apify Google Maps scraper
  - OR manual scraping (slower)

**Target 10 city/industry combos:**
```
[City] + [Service]
Examples:
- Denver HVAC
- Denver plumbing
- Denver restaurants
- Austin roofing
- Austin auto repair
- Phoenix landscaping
- Phoenix cleaning services
- Seattle salons
- Seattle med spas
- Portland dentists
```

**Scraping criteria:**
- Google rating < 4.0 OR review count < 50
- Has website URL
- Phone number available
- Extract: name, rating, review count, website, phone, GBP URL

**Expected yield:** 500-1,000 qualified leads

**Time:** 4-6 hours

---

**Build lead spreadsheet:**

| Column | Description |
|--------|-------------|
| First Name | Decision maker (research on LinkedIn) |
| Business Name | Exact name from GBP |
| Email | Found via website/Hunter.io |
| Phone | From GBP |
| Rating | Current star rating |
| Review Count | Total reviews |
| City | Their city |
| Industry | HVAC, plumbing, etc. |
| GBP URL | Google Business Profile link |
| Website | Their website URL |
| Loom URL | Personalized audit video (record later) |
| Status | New, Contacted, Replied, etc. |

**Time:** 2 hours to organize

---

### Weekend: Create First 10 Loom Videos

**Script:** See `cold-email-campaign.md` → Loom Video Audit Script

**Process:**
1. Open their GBP in Chrome
2. Start Loom screen recording
3. Record 2-3 minute personalized audit
4. Copy Loom link to spreadsheet
5. Repeat for next lead

**Time:** 15-20 min per video = 3-4 hours total

**Target:** 10 videos (test batch for week 2)

---

## Week 2: Launch Cold Email Campaign

### Day 1: Upload to Instantly.ai

**Setup campaign:**
- [ ] Create new campaign: "Review Management - Test Batch"
- [ ] Upload 50 leads (your top 10 Loom videos + 40 with email only)
- [ ] Set up 4-email sequence (see cold-email-campaign.md)
- [ ] Map custom fields:
  - `{{FirstName}}`
  - `{{BusinessName}}`
  - `{{Rating}}`
  - `{{ReviewCount}}`
  - `{{LoomURL}}` (for first 10)
  - `{{City}}`
  - `{{Industry}}`

**Sending settings:**
- Start: 25 emails/day (domain still warming up)
- Sending window: 8am-10am, 2pm-4pm (recipient timezone)
- Days: Tuesday-Thursday only
- Delay between emails: 30-60 seconds

**Time:** 2 hours

---

### Day 2-7: Monitor & Respond

**Daily tasks:**
- [ ] Check inbox for replies (2x/day)
- [ ] Respond to positive replies within 1 hour
- [ ] Handle objections (see cold-email-campaign.md)
- [ ] Book calls via Calendly
- [ ] Send proposals to interested leads

**Expected results (week 2):**
- 100-125 emails sent
- 40-60 opens (40-50% open rate)
- 5-10 replies (5-10% reply rate)
- 1-3 positive replies
- 0-1 booked calls

**Time:** 1 hour/day

---

### Weekend: Scale Up

**Record 20 more Loom videos:**
- Batch record on Saturday/Sunday
- Target: Next batch of 100 leads for week 3

**Time:** 6-8 hours

---

## Week 3: Scale Cold Email + Start Meta Ads Setup

### Cold Email Scaling

**Upload batch 2:**
- [ ] 150 new leads (with Loom videos)
- [ ] Increase sending to 50 emails/day
- [ ] Continue 4-email sequence

**Expected results (week 3):**
- 250-300 total emails sent (cumulative)
- 100-150 opens
- 12-20 replies
- 3-6 positive replies
- 1-2 booked calls
- 0-1 closed deals

---

### Meta Ads Setup

**Business Manager:**
- [ ] Create Facebook Business Manager
- [ ] Add ad account
- [ ] Add payment method
- [ ] Connect Instagram account

**Pixel installation:**
- [ ] Create Meta Pixel in Events Manager
- [ ] Install pixel on `unfuckyourreviews.com` (see meta-ads-campaign.md)
- [ ] Test with Pixel Helper extension
- [ ] Set up Lead conversion event
- [ ] Test form submission → Lead event fires

**Creative production:**
- [ ] Design 5 static image ads in Canva
  - 3.2-star problem agitation
  - Before/after comparison
  - Stat graphic "47% won't call"
- [ ] Record 2 video ads (talking head + screen share)
  - Educational hook (45 sec)
  - Case study (60 sec)
- [ ] Write 5 ad copy variations

**Time:** 8-10 hours

---

## Week 4: Launch Meta Ads + Optimize Cold Email

### Meta Ads Launch

**Campaign structure:**
- [ ] Create Lead Gen campaign
  - Budget: $50/day
  - Objective: Leads
  - 3 ad sets (audiences)
  - 2-3 ads per ad set
- [ ] Create Video Awareness campaign
  - Budget: $15/day
  - Objective: Video views

**Audiences:**
- Ad Set 1: Business owners + Local services interests
- Ad Set 2: Industry-specific (HVAC, plumbing, restaurants)
- Ad Set 3: Retargeting (website visitors, video viewers)

**Launch:**
- [ ] Set live on Monday morning
- [ ] Monitor hourly first day (check for disapprovals)
- [ ] Check CPL after 48 hours
- [ ] Kill ads with CPL > $150 after 7 days

**Time:** 4-6 hours setup, 30 min/day monitoring

---

### Cold Email Optimization

**Scale sending:**
- [ ] Increase to 100 emails/day
- [ ] Add 200 more leads to pipeline
- [ ] A/B test subject lines
- [ ] Analyze reply rate by industry (double down on winners)

**Expected results (week 4):**
- 700-800 total emails sent (cumulative)
- 300-400 opens
- 35-50 replies
- 10-15 positive replies
- 3-5 booked calls
- 1-2 closed deals

---

## Week 5+: Optimize & Scale

### Cold Email

**What's working:**
- Review open rates by subject line → Use winners
- Review reply rates by industry → Target winners
- Review Loom video engagement → Improve script
- Review close rate by lead source → Double down

**Scale:**
- Add 2nd inbox (2x volume)
- Increase to 200 emails/day total
- Record Looms in batches (Sunday = 50 videos)
- Expand to new cities

**Expected steady state:**
- 1,000+ emails/week
- 50+ replies/week
- 10-15 positive replies/week
- 3-5 booked calls/week
- 1-3 closed deals/week
- **$400-1,500/week MRR added**

---

### Meta Ads

**Optimization:**
- Kill ads with CPL > $150
- Scale ads with CPL < $75 (increase budget 20% every 3 days)
- Refresh creative every 2 weeks (combat fatigue)
- Expand to lookalike audiences (once you have 50+ leads)

**Scale:**
- Week 5-6: $65/day ($2,000/mo)
- Week 7-8: $100/day ($3,000/mo)
- Week 9+: $150+/day ($4,500/mo)

**Expected steady state (at $3,000/mo spend):**
- 30-60 leads/month
- $50-100 CPL
- 3-6 booked calls/month
- 0-2 closed deals/month
- **$0-1,000/month MRR added**

---

### Combined Results (Week 5+)

**Total acquisition:**
- Cold email: 10-15 leads/week, 1-3 closes/week
- Meta ads: 7-15 leads/week, 0-2 closes/week
- **Total: 1-5 new clients/week**
- **MRR growth: $400-2,500/week**

**At this pace:**
- Month 1: $400-2,000 MRR
- Month 2: $2,000-6,000 MRR
- Month 3: $4,000-10,000 MRR

**Break-even:**
- Cold email costs: $67/mo (Instantly) + $30/mo (Outscraper) = $97/mo
- Cold email break-even: 1 client
- Meta ads costs: $2,000-3,000/mo
- Meta ads break-even: 5-7 clients
- **Combined break-even: 6-8 clients** ($2,400-4,000 MRR)

---

## This Week's Action Items (Start Now)

**Priority 1 (Do today):**
1. Configure custom domains in Cloudflare (30 min)
2. Sign up for Instantly.ai ($37/mo)
3. Sign up for Outscraper ($30/mo)

**Priority 2 (Do this week):**
4. Set up cold email domain + warmup (2 hours)
5. Scrape 500 leads (4-6 hours)
6. Record 10 Loom videos (3-4 hours)
7. Upload to Instantly, launch test campaign (2 hours)

**Priority 3 (Next week):**
8. Monitor cold email replies, book calls
9. Start Meta ads setup (pixel + creative)

**Time commitment this week:** 12-15 hours

**Time commitment ongoing:** 10-15 hours/week
- 5 hours: Loom videos (batch record Sundays)
- 3 hours: Email follow-up & sales calls
- 2 hours: Meta ads monitoring & optimization
- 2 hours: Lead scraping & list building

---

## Quick Wins (Do These First)

1. **Domain DNS** → 30 min → Landing page live
2. **Instantly signup + warmup start** → 1 hour → Email sending in 2 weeks
3. **Scrape 50 leads** → 2 hours → Pipeline ready
4. **Record 5 Loom videos** → 90 min → Test campaign ready
5. **Send first 25 emails** → 30 min → First replies incoming

**Total time to first outreach:** 5-6 hours

---

## Tools & Costs Summary

### Required (Month 1):
- Instantly.ai: $37/mo
- Outscraper: $30/mo
- Loom: Free
- Canva: Free (or $13/mo Pro)
- **Total: $67-80/mo**

### Optional (Month 2+):
- Meta Ads: $2,000-3,000/mo
- Hunter.io (email finding): $49/mo
- Calendly Pro: $12/mo
- **Total: $2,128-3,141/mo**

---

## Success Metrics (Track Weekly)

**Cold Email:**
- Emails sent
- Open rate (target: 40-60%)
- Reply rate (target: 5-10%)
- Positive reply rate (target: 2-5%)
- Booked calls (target: 1-2%  of sends)
- Close rate (target: 10-20% of calls)

**Meta Ads:**
- Impressions
- CPM
- CTR (target: 1-3%)
- CPL (target: $50-100)
- Lead quality score (1-5)
- Booked call rate (target: 10-20%)
- Close rate (target: 10-20%)

**Business:**
- New clients/week (target: 1-5)
- MRR growth/week (target: $400-2,500)
- Total MRR (target: $10k by month 3)
- Churn rate (target: < 10%/mo)

---

## First 30 Days Timeline

**Week 1:** Setup (DNS, email infrastructure, lead scraping)
**Week 2:** Launch cold email (50-100 sends/day)
**Week 3:** Scale cold email (100-150 sends/day) + Meta ads setup
**Week 4:** Launch Meta ads ($50/day) + scale cold email (200+ sends/day)

**Expected results by day 30:**
- 700-1,000 cold emails sent
- 35-50 cold email replies
- 10-15 positive replies
- 3-5 booked calls from email
- 1-3 closed deals from email
- 15-30 Meta ads leads
- 1-3 booked calls from ads
- 0-1 closed deals from ads
- **Total: 1-4 new clients, $400-2,000 MRR**

---

**Let's fucking launch.** 🔥
