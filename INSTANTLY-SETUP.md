# Instantly Campaign Setup - Unfuck Your Reviews

**Campaign Goal:** Generate qualified leads from businesses with bad Google reviews

**Expected Results:** 5-10% reply rate, 2-5% positive replies, 1-2% booked calls

---

## Step 1: Create Campaign in Instantly

1. Log in to Instantly.ai
2. Click "Campaigns" → "New Campaign"
3. **Campaign Name:** `Review Management - [Month] [Year]`
4. **Campaign Type:** Regular Campaign
5. Click "Create"

---

## Step 2: Configure Campaign Settings

### General Settings
- **Daily Limit:** 50 emails/day (start conservative, scale up weekly)
- **Sending Schedule:**
  - Monday-Friday: 8:00 AM - 6:00 PM (recipient timezone)
  - Skip weekends
- **Time Between Emails:** 30-60 seconds
- **Max Active Leads:** Unlimited

### Email Warmup
- If domain is new: Keep at 25-50/day for Week 1
- After 2 weeks: Scale to 100/day
- After 4 weeks: Scale to 150+/day

---

## Step 3: Set Up Email Sequence

### Email 1 - The Audit (Day 1)

**Subject Line:** (Rotate these - A/B test)
```
{{firstName}}, spotted this on your Google listing
```
```
Your Google reviews are costing you customers
```
```
{{rating}} stars = losing 47% of potential customers
```

**Email Body:**
```
{{firstName}},

I was looking for {{industry}} in {{city}} and found {{businessName}} on Google Maps.

Then I saw your rating: {{rating}} stars.

Here's the problem:

• 47% of people won't call a business under 4.0 stars
• You have {{reviewCount}} reviews total (competitors have 100+)
• {{reviewIssue}}

That's customers choosing your competitors before they even see your work.

I put together a quick 3-minute video breaking down what's fixable:
{{loomURL}}

No pitch, no obligation. Just showing you what's costing you money.

Worth a look?

— Cameron
Unfuck Your Reviews
unfuckyourreviews.com
```

**Delay to next email:** 3 days

---

### Email 2 - The Data (Day 4)

**Subject Line:**
```
Re: {{businessName}}'s reviews
```

**Email Body:**
```
Quick follow-up — did you get a chance to check out the video?

Here's what the math looks like:

If you're getting 50 calls/month from Google Maps right now...

→ At {{rating}} stars, 47% of people scroll past you
→ That's ~24 potential customers lost every month
→ If your close rate is 30%, that's 7 jobs
→ At $1,500 average job value = $10,500/month left on the table

Getting to 4.5 stars in 90 days changes that.

Most of our clients see a 40-60% increase in calls within 60 days. That's real money.

Want to see exactly how we'd do it for {{businessName}}?

— Cameron
```

**Delay to next email:** 4 days

---

### Email 3 - Social Proof (Day 8)

**Subject Line:**
```
One last thing
```

**Email Body:**
```
{{firstName}},

I'll stop bugging you after this.

But I wanted to share what we did for a {{industry}} company in {{nearbyCity}}:

Before: 3.4 stars, 18 reviews
After (90 days): 4.6 stars, 87 reviews

Result: Phone calls up 120%, booked jobs up 40%.

They were skeptical too. Most people are.

But here's the thing: your competitors are doing this. The ones with 4.7 stars and 200+ reviews? They're not getting lucky. They have a system.

If you ever want to talk about fixing this for {{businessName}}, I'm here:
unfuckyourreviews.com

Otherwise, good luck out there.

— Cameron
```

**Delay to next email:** 4 days

---

### Email 4 - The Breakup (Day 12)

**Subject Line:**
```
Moving on
```

**Email Body:**
```
{{firstName}},

I'm closing out my outreach for this quarter, so this is probably the last you'll hear from me.

If you ever want help fixing the review situation at {{businessName}}, you know where to find me.

In the meantime, a few things you can do right now (for free):

1. Respond to every review (even the 5-stars) — shows you're active
2. Ask your last 10 customers for a review via text (not email)
3. Fix that negative review from {{specificIssue}} — address it publicly

These won't solve the problem, but they'll stop the bleeding.

If you want the full fix, hit reply.

— Cameron
Unfuck Your Reviews
```

**No follow-up after this** - Lead goes into nurture sequence

---

## Step 4: Variable Mapping

Set up these custom fields in Instantly:

| Variable Name | Example | How to Get |
|---------------|---------|------------|
| `{{firstName}}` | John | From LinkedIn/website, or use "there" if unknown |
| `{{businessName}}` | ABC Plumbing | From Google Business Profile |
| `{{city}}` | Denver | From GBP address |
| `{{industry}}` | plumbing | HVAC, plumbing, roofing, restaurants, etc. |
| `{{rating}}` | 3.2 | Current star rating from GBP |
| `{{reviewCount}}` | 18 | Total review count from GBP |
| `{{reviewIssue}}` | Your last review was in 2023 | Specific callout (see options below) |
| `{{loomURL}}` | https://loom.com/share/... | Personalized audit video |
| `{{nearbyCity}}` | Aurora | Nearby city for social proof |
| `{{specificIssue}}` | parking complaints | Mention from a bad review |

---

### Review Issue Templates (Pick One Per Lead)

Choose the most relevant for each lead:

```
Your last review was in [date/timeframe]
```
```
You have unanswered negative reviews sitting there for months
```
```
Your competitors have 3x more reviews than you
```
```
You haven't responded to a single review (good or bad)
```
```
Your Google listing says you're "Permanently Closed" (you're not)
```
```
Someone left you 1 star because "[specific complaint]" with no response
```

---

## Step 5: CSV Upload Format

Your lead scraper should export a CSV with these columns:

```csv
email,firstName,businessName,city,industry,rating,reviewCount,reviewIssue,loomURL,nearbyCity,specificIssue
john@abcplumbing.com,John,ABC Plumbing,Denver,plumbing,3.2,18,Your last review was in 2023,https://loom.com/share/xyz,Aurora,parking was hard
sarah@hvacpros.com,Sarah,HVAC Pros,Austin,HVAC,3.7,12,You have unanswered negative reviews,https://loom.com/share/abc,Round Rock,slow response times
```

**Important:**
- Email must be verified/valid
- First name can be "there" if unknown (fallback)
- loomURL can be blank for non-video leads (remove {{loomURL}} line from Email 1)

---

## Step 6: Upload Leads to Instantly

1. Go to your campaign → "Leads" tab
2. Click "Import Leads"
3. Select "CSV File"
4. Upload your CSV
5. Map columns to Instantly variables
6. Review preview
7. Click "Import"

**Start with 50-100 leads** for test batch

---

## Step 7: Campaign Launch Settings

### Before Launching - Double Check:

- [ ] Subject lines look natural (no caps lock, no spam words)
- [ ] All variables have fallback values (e.g., "there" for missing firstName)
- [ ] Loom URLs are working (test a few)
- [ ] Signature includes website link
- [ ] Daily sending limit is appropriate for domain age
- [ ] Unsubscribe link is in footer (Instantly adds automatically)

### Launch:

1. Click "Review & Launch"
2. Send test email to yourself
3. Check formatting, links, variables
4. If good → Click "Launch Campaign"
5. Emails start sending based on schedule

---

## Step 8: Monitor & Optimize

### Daily (First Week):
- Check deliverability (open rate should be 40%+)
- Check bounce rate (should be <5%)
- Respond to replies within 1 hour
- Pause campaign if bounce rate >10%

### Weekly:
- Review metrics:
  - Open rate (target: 40-60%)
  - Reply rate (target: 5-10%)
  - Positive reply rate (target: 2-5%)
- A/B test subject lines
- Adjust sending volume
- Add more leads

### Monthly:
- Analyze by industry (which converts best?)
- Analyze by city (which replies most?)
- Refresh email copy if reply rate drops
- Scale sending volume

---

## Reply Handling Templates

### Positive Reply: "Tell me more"

**Your Response:**
```
Hey {{firstName}}!

Great to hear from you. Quick question before I put anything together:

What's the biggest review issue you're dealing with right now?

1. Not enough reviews in general
2. Bad reviews you can't get rid of
3. Competitors outranking you because of their reviews
4. Something else

Once I know that, I can show you exactly how we'd fix it for {{businessName}}.

— Cameron
```

---

### Positive Reply: "How much?"

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

Want to hop on a quick call to see if it makes sense for {{businessName}}?

[Calendly link]

— Cameron
```

---

### Objection: "Not interested"

**Your Response:**
```
No worries, {{firstName}}.

One quick tip: respond to your reviews in the meantime (even the good ones). Shows customers you're active.

If you change your mind, I'm here.

— Cameron
```

Then stop sequence, mark as "Not Interested"

---

### Objection: "We handle it ourselves"

**Your Response:**
```
That's great - most businesses don't even do that.

Quick question: are you getting 20+ new reviews per month consistently?

If not, there's probably some quick wins I could point out (no charge). Worth a 10-minute call?

[Calendly link]

— Cameron
```

---

### Neutral Reply: "Send me info"

**Your Response:**
```
Sure thing.

Rather than send you a generic PDF, I'd rather understand your specific situation first. Takes 2 minutes:

1. What's your current Google rating?
2. How many reviews do you have?
3. What's the biggest issue - not enough reviews, or bad ones you can't fix?

Then I can show you exactly what we'd do for {{businessName}}.

— Cameron
```

---

## Metrics to Track (Spreadsheet or Instantly Dashboard)

| Metric | Formula | Target |
|--------|---------|--------|
| **Emails Sent** | Count | Start: 50/day → Scale to 150+/day |
| **Delivered** | Sent - Bounced | 95%+ |
| **Opened** | Opens / Delivered | 40-60% |
| **Clicked** | Clicks / Delivered | 5-15% |
| **Replied** | Replies / Delivered | 5-10% |
| **Positive Replies** | Interested / Total Replies | 40-60% |
| **Booked Calls** | Calls / Sent | 1-2% |
| **Closed Deals** | Closed / Calls | 10-20% |
| **Cost Per Lead** | Tool costs / Closed | Target: $5-20 |
| **ROI** | (MRR - Costs) / Costs | Target: 10x+ |

---

## Scaling Timeline

**Week 1-2:** 50 emails/day (test batch, monitor deliverability)
**Week 3-4:** 100 emails/day (scale if open rate >40%, bounce <5%)
**Week 5-6:** 150 emails/day (add 2nd inbox if needed)
**Week 7+:** 200+ emails/day (2-3 inboxes, fully warmed)

---

## Troubleshooting

### Low Open Rate (<30%)

**Possible causes:**
- Domain not warmed up enough
- Subject lines are spammy
- Emails landing in spam folder
- Email list quality is bad

**Fixes:**
- Slow down sending
- Test subject lines (A/B test)
- Check spam score (mail-tester.com)
- Verify email addresses better

---

### High Bounce Rate (>10%)

**Possible causes:**
- Bad email list (invalid addresses)
- Domain reputation damaged
- Email verification skipped

**Fixes:**
- Verify emails before import (NeverBounce, ZeroBounce)
- Clean your list (remove role emails: info@, admin@)
- Pause campaign, fix domain reputation

---

### Low Reply Rate (<3%)

**Possible causes:**
- ICP is wrong (targeting wrong businesses)
- Offer not compelling
- Email copy not personalized enough
- Loom videos not engaging

**Fixes:**
- Narrow ICP (target worse reviews: <3.5 stars)
- Test new email copy
- Make Loom videos shorter (under 2 min)
- Add more specific callouts in Email 1

---

### No Positive Replies

**Possible causes:**
- Price objection (they assume too expensive)
- Offer not clear
- Not building enough trust

**Fixes:**
- Add social proof earlier (Email 2 → Email 1)
- Address pricing upfront ("No contracts, month-to-month")
- Improve Loom quality (show real results)

---

## Quick Launch Checklist

- [ ] Campaign created in Instantly
- [ ] 4-email sequence configured
- [ ] Variables mapped correctly
- [ ] 50-100 leads ready in CSV format
- [ ] Loom videos recorded (if using)
- [ ] Daily limit set appropriately
- [ ] Test email sent to yourself
- [ ] Campaign launched
- [ ] Reply monitoring set up (check 2x/day)
- [ ] Calendly link ready for bookings

**Time to launch:** 1-2 hours

**Time to first replies:** 24-48 hours

**Time to first booked call:** 3-7 days

---

**Let's get some leads.** 🔥
