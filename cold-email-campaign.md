# Unfuck Your Reviews - Cold Email Campaign

**Goal:** Generate 10-15 qualified leads per week targeting businesses with obvious review problems

**Pricing:** $399-500/mo (disclosed in Loom/call, not in email)

---

## Target Profile

### ICP (Ideal Customer Profile)

**Business Type:**
- Local service businesses (high review dependency)
- Contractors (HVAC, plumbing, roofing, electrical)
- Home services (cleaning, landscaping, pest control)
- Auto services (repair, detailing, car wash)
- Restaurants & cafes
- Med spas, salons, barbers
- Dentists, chiropractors, physical therapy
- Law firms (personal injury, family law)

**Review Red Flags (Target These):**
- ⭐ **Below 4.0 stars** on Google
- 🔴 **Fewer than 50 reviews** (especially if 3+ years old)
- 😶 **No responses to reviews** (shows neglect)
- 📉 **Recent negative reviews** with no response
- 👻 **Unclaimed or incomplete Google Business Profile**
- ⏰ **Last review 6+ months ago** (dead activity)

**Business Maturity:**
- In business 2+ years
- Likely doing $500k-$5M annual revenue
- 5-50 employees
- Has existing customers (proof: some reviews exist)

**Disqualifiers (Skip):**
- Brand new businesses (< 1 year)
- 4.5+ stars with 100+ reviews (they don't need you)
- National chains (too big, corporate procurement)
- Businesses with zero reviews (might be closed)

---

## Lead Scraping Workflow

### Method 1: Google Maps Scraper (Recommended)

**Tools:**
- Outscraper.com ($30/mo for 5,000 leads)
- Apify.com (Google Maps scraper)
- Phantombuster (GBP scraper)

**Search Queries:**
```
[City] + [Service] (e.g., "Denver HVAC", "Austin roofing")
```

**Extract:**
- Business name
- Website URL
- Google Business Profile URL
- Phone number
- Email (if available)
- Current star rating
- Review count
- Last review date
- Address

**Filter in spreadsheet:**
- Rating < 4.0 OR review count < 50
- Has website URL (shows they invest in marketing)
- In business 2+ years (check GBP founded date)

**Expected yield:** 50-100 qualified leads per city/service combo

---

### Method 2: Manual Scraping (Free, Slower)

1. Google Maps: Search "[City] + [Service]"
2. Sort by rating (low to high)
3. Click businesses with 3.0-3.9 stars
4. Check review count, last review date
5. Copy to spreadsheet
6. Find email via:
   - Website contact page
   - Hunter.io
   - Apollo.io
   - [firstname]@[domain].com guessing

**Expected yield:** 10-20 leads per hour

---

### Method 3: Use Lead Scraper Agent (Automated)

If you have the lead-scraper-agent repo set up:
```bash
cd /Users/beef/Repository/lead-scraper-agent
# Configure for Google Maps + review data
# Run automated scraping workflow
```

---

## Email Sequence

### Email 1: The Audit (Day 1)

**Goal:** Call out their review problem with specifics, offer free audit

**Subject Lines (A/B Test):**
- `Your Google reviews are costing you customers`
- `[FirstName] - spotted this on your Google listing`
- `3.2 stars = losing 47% of potential customers`
- `Quick question about [BusinessName]'s reviews`

**Body:**

```
[FirstName],

I was looking for [service type] in [city] and found [BusinessName] on Google Maps.

Then I saw your rating: [X.X stars].

Here's the problem:

• 47% of people won't call a business under 4.0 stars
• You have [X] reviews total (competitors have 100+)
• [Your last review was in 2023 / You have unanswered negative reviews / etc.]

That's customers choosing your competitors before they even see your work.

I put together a quick 3-minute video breaking down what's fixable:
[Loom link]

No pitch, no obligation. Just showing you what's costing you money.

Worth a look?

— Cameron
Unfuck Your Reviews
unfuckyourreviews.com
```

**Personalization Variables:**
- `[FirstName]` - Decision maker name (research on LinkedIn)
- `[BusinessName]` - Their business name
- `[service type]` - What they do (HVAC, plumbing, etc.)
- `[city]` - Their city
- `[X.X stars]` - Their actual rating
- `[X]` - Their actual review count
- `[Loom link]` - Personalized video audit (see Loom script below)

---

### Email 2: The Data (Day 4 - If No Reply)

**Goal:** Hit them with ROI numbers, make it tangible

**Subject:** `Re: [BusinessName]'s reviews`

**Body:**

```
Quick follow-up — did you get a chance to check out the video?

Here's what the math looks like:

If you're getting 50 calls/month from Google Maps right now...

→ At 3.2 stars, 47% of people scroll past you
→ That's ~24 potential customers lost every month
→ If your close rate is 30%, that's 7 jobs
→ At $1,500 average job value = $10,500/month left on the table

Getting to 4.5 stars in 90 days changes that.

Most of our clients see a 40-60% increase in calls within 60 days. That's real money.

Want to see exactly how we'd do it for [BusinessName]?

— Cameron
```

---

### Email 3: The Social Proof (Day 8 - If No Reply)

**Goal:** Show results, lower risk perception

**Subject:** `One last thing`

**Body:**

```
[FirstName],

I'll stop bugging you after this.

But I wanted to share what we did for [Similar Business Type] in [Nearby City]:

Before: 3.4 stars, 18 reviews
After (90 days): 4.6 stars, 87 reviews

Result: Phone calls up 120%, booked jobs up 40%.

They were skeptical too. Most people are.

But here's the thing: your competitors are doing this. The ones with 4.7 stars and 200+ reviews? They're not getting lucky. They have a system.

If you ever want to talk about fixing this for [BusinessName], I'm here:
unfuckyourreviews.com

Otherwise, good luck out there.

— Cameron
```

---

### Email 4: The Breakup (Day 12 - Final)

**Goal:** Create urgency, last chance

**Subject:** `Moving on`

**Body:**

```
[FirstName],

I'm closing out my outreach for this quarter, so this is probably the last you'll hear from me.

If you ever want help fixing the review situation at [BusinessName], you know where to find me.

In the meantime, a few things you can do right now (for free):

1. Respond to every review (even the 5-stars) — shows you're active
2. Ask your last 10 customers for a review via text (not email)
3. Fix that negative review from [specific date/issue] — address it publicly

These won't solve the problem, but they'll stop the bleeding.

If you want the full fix, hit reply.

— Cameron
Unfuck Your Reviews
```

---

## Loom Video Audit Script

**Goal:** Personalized 2-3 minute video pointing out their specific review problems and showing fixes

**Tools:**
- Loom (free for 5 min videos)
- Chrome extension for screen recording
- Google Maps + their GBP open

**Script:**

```
[SCREEN: Their Google Business Profile open]

Hey [FirstName], Cameron here.

I was looking at [BusinessName]'s Google listing and wanted to show you a few things that are costing you customers.

[SHOW: Their star rating]
So first — 3.2 stars. Here's why that matters:

[PULL UP: Competitor with 4.5+ stars nearby]
This is one of your competitors, same service, same city — 4.6 stars, 140 reviews.

When someone searches for [service] in [city], they see both of you side by side.

Guess who they're calling first?

[BACK TO: Their reviews]
Second thing — you've got [X] total reviews. That's not bad, but...

[SHOW: Last review date]
Your last review was [timeframe ago]. That tells Google — and your customers — that you're not actively getting new business. It's a red flag.

[SCROLL TO: Unanswered reviews]
Third — [point out specific unanswered negative review].

This review has been sitting here for [X months] with no response. That's a lost opportunity to fix the narrative.

[SHOW: What good response looks like from competitor]
Here's what a good response looks like. See how they acknowledge the issue, offer a solution, and invite them back? That turns a 1-star into a recovery story.

So here's what I'd do for [BusinessName]:

1. Month 1: Review reactivation campaign — reach out to your last 500 customers, get 50-100 new 5-star reviews in 60 days. That pushes the bad ones down the page.

2. Ongoing: Set up automated review requests after every job. Personalized, with their name and photo. Way higher response rate.

3. Handle the negatives: Draft professional responses for every bad review, attempt removals where applicable (like that one from the disgruntled ex-employee).

Within 90 days, you'd be at 4.5+ stars with 100+ reviews. That's a completely different customer perception.

If you want to see exactly how this works for [BusinessName], just hit reply to my email.

No obligation, just wanted to show you what's fixable.

Talk soon,
Cameron
```

**Recording Tips:**
- Keep it under 3 minutes
- Use their actual business name 5+ times
- Point to specific reviews (good and bad)
- Show competitor comparison (visual proof)
- End with clear CTA: "Hit reply"

**Thumbnail:** Screenshot of their bad rating with red arrow

---

## Email Sending Setup

### Deliverability Essentials

**Domain Setup:**
- Use subdomain: `mail.unfuckyourreviews.com` (protects main domain)
- SPF record: Include sending service
- DKIM: Enable signing
- DMARC: Set to `p=none` initially, monitor
- Warm up: 50 emails/day week 1, increase 20%/week

**Tools:**
- **Instantly.ai** ($37/mo) - Best for cold email, built-in warmup
- **Smartlead** ($39/mo) - Multi-inbox rotation
- **Lemlist** ($59/mo) - Video personalization
- **DIY:** Gmail + Streak + Mailshake ($29/mo)

**Recommendation:** Instantly.ai (easiest, best deliverability)

---

### Sending Strategy

**Volume:**
- Start: 50 emails/day per inbox
- Scale to: 100-150 emails/day per inbox after 4 weeks
- Use 2-3 inboxes for redundancy

**Cadence:**
- Day 1: Email 1 (Audit)
- Day 4: Email 2 (Data)
- Day 8: Email 3 (Social proof)
- Day 12: Email 4 (Breakup)

**Timing:**
- Send 8am-10am or 2pm-4pm local time (best open rates)
- Tuesday-Thursday (avoid Monday/Friday)

**Metrics to Track:**
- Open rate: Target 40-60%
- Reply rate: Target 5-10%
- Positive reply rate: Target 2-5%
- Booked calls: Target 1-2% of sends

**Expected Results:**
- Send 500 emails/week
- Get 25-50 replies
- Book 5-10 calls
- Close 1-3 clients/week at $399-500/mo

---

## Personalization at Scale

### Must Customize (Per Lead):
- First name
- Business name
- Star rating
- Review count
- Specific review issue (find 1 bad review, mention it)

### Partially Customize (Per Batch):
- City
- Service type (HVAC, plumbing, etc.)
- Competitor comparison

### Template (Reuse):
- Email structure
- Value prop
- CTA

**Tools:**
- Google Sheets for lead list
- Instantly.ai variables: `{{FirstName}}`, `{{BusinessName}}`, etc.
- Loom for personalized video (1-2 min to record each)

---

## Follow-Up After Reply

### Positive Reply ("Tell me more")

**Your Response:**
```
Hey [FirstName]!

Great to hear from you. Quick question before I put anything together:

What's the biggest review issue you're dealing with right now?

1. Not enough reviews in general
2. Bad reviews you can't get rid of
3. Competitors outranking you because of their reviews
4. Something else

Once I know that, I can show you exactly how we'd fix it for [BusinessName].

— Cameron
```

Then send proposal/pricing (see proposal template below).

---

### Objection: "How much?"

**Your Response:**
```
Fair question.

Most review management platforms charge $300-600/month but you still have to do all the work yourself.

Full-service agencies charge $800-1,500/month but bundle it with SEO and other stuff you might not need.

We're $399/month, no contract, and we do everything for you:
• Review reactivation campaign (month 1)
• Automated review requests (ongoing)
• Response to every review (24-hour turnaround)
• Negative review management
• Monthly reporting

Want to hop on a quick call to see if it makes sense for [BusinessName]?

[Calendly link]

— Cameron
```

---

### Objection: "I'll think about it"

**Your Response:**
```
Totally get it. Most people do.

One thing I'd recommend: respond to your reviews in the meantime (even the good ones). Shows customers you're active.

If you change your mind, I'm here. Just hit reply.

— Cameron
```

Then add to nurture sequence (1 email every 2 weeks with review tips).

---

### Objection: "Can you guarantee results?"

**Your Response:**
```
I can't guarantee you'll hit 4.5 stars (depends on your actual service quality), but here's what I can guarantee:

1. We'll send 50-100 review requests per month to your customers
2. We'll respond to every review within 24 hours
3. We'll attempt removal on any policy-violating reviews
4. You'll get a monthly report showing progress

Most clients see 40-60% more reviews in the first 90 days and a 0.5-1.0 star increase.

If we don't move the needle in 60 days, we'll refund your first two months. No questions asked.

Sound fair?

— Cameron
```

---

## Proposal Template

### Subject: "[BusinessName] - Review Management Proposal"

**Body:**

```
Hey [FirstName],

Here's exactly what we'd do for [BusinessName]:

---

**MONTH 1: REVIEW REACTIVATION**

Goal: Get 50-100+ new reviews from your existing customers in 60 days.

What we do:
• You give us your customer list (last 500-1,000 customers)
• We send personalized review requests via email/SMS
• 3-touch sequence with automatic follow-ups
• We monitor responses and track who leaves reviews

This alone moves the needle fast. Most businesses see their rating jump 0.3-0.5 stars in the first 30 days.

---

**ONGOING: AUTOMATED REVIEW SYSTEM**

Goal: Never stop getting new reviews (50-100/month).

What we do:
• Set up automated review request system
• Every customer gets a personalized request after their job
• We customize the landing page with your branding
• Track response rates and optimize over time

This keeps your review count climbing month over month.

---

**ONGOING: REVIEW RESPONSE MANAGEMENT**

Goal: Every review gets a response within 24 hours.

What we do:
• Monitor your Google Business Profile daily
• Draft responses for every review (AI-assisted, human-approved)
• Send you drafts for approval, then post
• Customize responses to your brand voice

This shows customers (and Google) that you're engaged.

---

**ONGOING: NEGATIVE REVIEW CLEANUP**

Goal: Fix or remove the bad ones.

What we do:
• Flag negative reviews immediately
• Draft professional responses to minimize damage
• Reach out privately to unhappy customers (if you want)
• Attempt removal on policy-violating reviews (fake, competitor, etc.)
• Limit: 5 negative reviews/month included (additional $50 each)

Can't guarantee removal, but we'll try everything.

---

**MONTHLY REPORTING**

Goal: Track progress and ROI.

What we do:
• Send monthly report with:
  - New reviews this month
  - Rating trend (before/after)
  - Response rate
  - Top review keywords
  - Competitor comparison

You'll see exactly what's working.

---

**PRICE: $399/month**

• No contract (cancel anytime)
• No setup fee
• Month-to-month billing

If we don't increase your reviews by 40%+ in 60 days, I'll refund your first two months.

---

Sound good? Reply with "Let's do it" and I'll send over the onboarding form.

— Cameron
Unfuck Your Reviews
unfuckyourreviews.com
```

---

## Next Steps After Close

1. Send onboarding form (Google Form or Typeform)
   - Business info
   - Google Business Profile access
   - Customer list (CSV upload)
   - Billing info

2. Set up in dashboard
   - Create client record
   - Tag as "onboarding"
   - Set next action: "Launch reactivation campaign"

3. Kick off fulfillment
   - Month 1: Reactivation campaign
   - Ongoing: Review automation

---

## Launch Checklist

- [ ] Set up `mail.unfuckyourreviews.com` subdomain
- [ ] Configure SPF/DKIM/DMARC
- [ ] Sign up for Instantly.ai or Smartlead
- [ ] Warm up sending domain (2 weeks)
- [ ] Scrape 500 leads (50 per city/industry combo)
- [ ] Create lead spreadsheet with custom fields
- [ ] Write 10 personalized Loom videos (test batch)
- [ ] Upload to Instantly.ai with email sequence
- [ ] Launch campaign (50 emails/day)
- [ ] Monitor replies daily
- [ ] Book calls via Calendly
- [ ] Send proposals
- [ ] Close deals

**Timeline:** 2-3 weeks from now to first client

**Expected Investment:**
- Outscraper: $30/mo
- Instantly.ai: $37/mo
- Loom: Free
- Time: 10-15 hours upfront, 5 hours/week ongoing

**Expected ROI:**
- 500 emails/week → 25 replies → 5 calls → 1-2 clients
- Revenue: $800-1,000/week
- Payback on time investment: Week 1

---

**Let's get some leads.** 🔥
