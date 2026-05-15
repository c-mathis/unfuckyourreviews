# Local Lead Scraping Plan - Before You Run Scraper

**Strategy:** Start local, prove the model, expand geographically

---

## Step 1: Define Your Local Market

### Questions to Answer First

**What city/metro are you based in?**
- Example: Denver, Austin, Phoenix, etc.

**What's your service radius?**
- 10 miles? 25 miles? Entire metro area?

**Any nearby cities to include?**
- Example: Denver + Boulder + Aurora + Lakewood

**Population of target area?**
- Helps estimate total addressable market
- 500k+ = plenty of leads for months

---

## Step 2: Choose Target Industries (Prioritize)

### Tier 1: High Revenue + Easy Close (Start Here)

**Best First Targets:**
1. **HVAC** - $500k-5M businesses, always need reviews, understand ROI
2. **Plumbing** - Similar to HVAC, high urgency
3. **Roofing** - Big ticket items, reviews = trust
4. **Auto Repair** - High volume, competitive market

**Why start here:**
- Established businesses (been around 5+ years)
- Revenue to afford $399-500/mo
- Reviews directly impact lead flow
- Easy to find bad reviews (competitive market)

**Start with 1-2 industries** for first batch. Don't spread thin.

---

### Tier 2: High Volume + Good Margin (Week 2-3)

5. **Restaurants** - Tons of them, very review-dependent
6. **Cleaning Services** - Growing market, need differentiation
7. **Landscaping** - Seasonal but profitable
8. **Pest Control** - Year-round, local focus

---

### Tier 3: High Value + Longer Sales Cycle (Month 2)

9. **Dentists** - Can pay $800-1,000/mo, but harder close
10. **Lawyers** - PI/Family law, very review-dependent
11. **Med Spas** - High margin, care about reputation
12. **Chiropractors** - Local health services

---

## Step 3: Define Target Criteria

### Primary Filter (Scrape These)

**Rating Criteria (Pick One):**
- **Option A (Aggressive):** < 3.8 stars only (worst problems)
- **Option B (Balanced):** < 4.0 stars (industry standard threshold)
- **Option C (Volume):** < 4.2 stars (larger pool)

**Review Count Criteria:**
- Under 50 reviews (shows neglect/new)
- OR 50-100 reviews but low rating (shows systemic issue)

**Business Age:**
- In business 2+ years (has customers, has revenue)
- Skip brand new businesses (< 1 year)

---

### Secondary Filter (Manual Review After Scraping)

**Must Have:**
- ✅ Website exists (shows they invest in marketing)
- ✅ Email address found (verified by MillionVerifier)
- ✅ Active on Google (last review within 12 months)

**Nice to Have:**
- Reviews between 10-40 (sweet spot - not too few, not too many)
- Specific negative review you can call out
- Competitor nearby with 4.5+ stars (for comparison)

---

## Step 4: Calculate Lead Volume Needed

### How Many Leads Per Industry?

**Math:**
- Target: 1-3 new clients in first 30 days
- Close rate: 10-20% of booked calls
- Booked call rate: 5-10% of positive replies
- Positive reply rate: 60-70% of replies
- Reply rate: 8-12% of sends
- **Needed: 500-1,000 emails sent to get 1-3 clients**

**With 300 emails/day capacity:**
- Week 1: 1,500 emails (expect 1-2 closes)
- Week 2: 1,500 emails (expect 1-2 closes)
- **Total needed for Month 1: 3,000-6,000 emails**

---

### Lead List Size by Industry

**Conservative Approach (Recommended for Week 1):**
- HVAC: 100 leads
- Plumbing: 100 leads
- **Total: 200 leads** = ~10 days of sending

**Aggressive Approach (If you want full month):**
- HVAC: 250 leads
- Plumbing: 250 leads
- Roofing: 250 leads
- Auto Repair: 250 leads
- **Total: 1,000 leads** = ~30 days of sending

**My Recommendation:** Start with 200-300 leads (1-2 industries, 2 weeks of sending)

---

## Step 5: Scraping Strategy

### Option A: Test Batch (Recommended First)

**Target:** 50 leads total to validate approach

**Scrape:**
- HVAC in your city: 25 leads
- Plumbing in your city: 25 leads

**Filter:**
- Rating < 3.8 stars
- Review count < 50

**Time:** 15-20 minutes
**Cost:** ~$1

**Launch immediately, monitor for 3-5 days:**
- Check open rate (target: 55%+)
- Check reply rate (target: 8%+)
- Check positive replies (target: 60%+)

**If metrics good → proceed to Option B**

---

### Option B: Full Month (After Test Validates)

**Target:** 500-1,000 leads for Month 1

**Scrape:**
- HVAC: 200 leads
- Plumbing: 200 leads
- Roofing: 200 leads
- Auto Repair: 200 leads
- Restaurants: 200 leads (if wanted)

**Filter:**
- Rating < 4.0 stars
- Review count < 50
- Has website + email

**Time:** 45-60 minutes
**Cost:** ~$5-8

**Result:** 300-500 qualified leads (after filtering) = full month of sending

---

## Step 6: Geographic Expansion Plan

### Month 1: Your Primary City
- Example: Denver metro only
- Validate offer, pricing, close process
- Goal: 3-5 clients

### Month 2: Add Nearby Cities
- Example: Denver + Boulder + Fort Collins
- 2-3x lead volume
- Goal: 5-10 new clients

### Month 3: Add Secondary Markets
- Example: Add Colorado Springs, Pueblo
- Or jump to new state (Austin, Phoenix)
- Goal: 10-15 new clients

### Month 4+: Scale Nationally
- Target multiple metros
- Build case studies from early clients
- Hire for fulfillment
- Goal: 20+ new clients/month

---

## Step 7: Lead Prioritization (After Scraping)

### Tier 1: Call Out Immediately (Top 20%)
- Rating under 3.5 stars (desperate)
- 10-30 reviews (established but struggling)
- Specific bad review you can mention
- High-value industry (dentist, lawyer, med spa)

**Action:** Record personalized Loom video for these

---

### Tier 2: Standard Outreach (Middle 60%)
- Rating 3.5-3.9 stars
- Under 50 reviews
- Good website = has budget

**Action:** Standard email sequence (no Loom)

---

### Tier 3: Volume Play (Bottom 20%)
- Rating 3.9-4.0 stars (borderline)
- 40-50 reviews (might not see urgency)
- Restaurants/low-margin businesses

**Action:** Standard email, don't follow up manually

---

## Scraping Commands (Ready to Copy)

### Test Batch (50 Leads)

```bash
cd /Users/beef/Repository/lead-scraper-agent

# HVAC - 25 leads
python3 main.py run gmaps "HVAC" "[YOUR CITY], [STATE]" \
  --max-results 25 \
  --campaign "Unfuck_Test_HVAC"

# Plumbing - 25 leads
python3 main.py run gmaps "plumbing" "[YOUR CITY], [STATE]" \
  --max-results 25 \
  --campaign "Unfuck_Test_Plumbing"

# Combine both
cat data/exported/Unfuck_Test_HVAC.csv data/exported/Unfuck_Test_Plumbing.csv > data/exported/Unfuck_Test_Combined.csv

# Filter for review problems
python3 filter-reviews.py \
  data/exported/Unfuck_Test_Combined.csv \
  data/exported/Unfuck_Test_FILTERED.csv
```

**Expected output:** 20-30 qualified leads after filtering

---

### Full Month (500 Leads)

```bash
cd /Users/beef/Repository/lead-scraper-agent

# HVAC
python3 main.py run gmaps "HVAC" "[YOUR CITY], [STATE]" \
  --max-results 200 \
  --campaign "Unfuck_Local_Month1"

# Plumbing
python3 main.py run gmaps "plumbing" "[YOUR CITY], [STATE]" \
  --max-results 200 \
  --campaign "Unfuck_Local_Month1"

# Roofing
python3 main.py run gmaps "roofing" "[YOUR CITY], [STATE]" \
  --max-results 200 \
  --campaign "Unfuck_Local_Month1"

# Auto Repair
python3 main.py run gmaps "auto repair" "[YOUR CITY], [STATE]" \
  --max-results 200 \
  --campaign "Unfuck_Local_Month1"

# Filter for review problems
python3 filter-reviews.py \
  data/exported/Unfuck_Local_Month1.csv \
  data/exported/Unfuck_Local_Month1_FILTERED.csv
```

**Expected output:** 300-400 qualified leads after filtering

---

## Sample Markets (By Size)

### Large Metro (500k+ population)
- Denver, Austin, Phoenix, Portland, Seattle
- **Available leads per industry:** 200-500
- **Total addressable market:** 2,000-5,000 businesses

### Mid-Size (200k-500k)
- Boulder, Fort Collins, Boise, Spokane
- **Available leads per industry:** 100-200
- **Total addressable market:** 800-2,000 businesses

### Small Metro (50k-200k)
- Smaller cities, suburbs
- **Available leads per industry:** 50-100
- **Total addressable market:** 300-800 businesses

---

## Pre-Scraping Checklist

Before running the scraper, confirm:

- [ ] **City/metro area defined:** ________________
- [ ] **Service radius confirmed:** _____ miles
- [ ] **Target industries chosen (1-2 to start):** ________________
- [ ] **Rating threshold:** < ____ stars
- [ ] **Review count threshold:** < ____ reviews
- [ ] **Lead volume needed:** _____ leads for first 2 weeks
- [ ] **Test batch or full batch?** Test / Full
- [ ] **Lead scraper API keys verified:** `python3 main.py status`

---

## Decision Time

**Answer these 4 questions:**

1. **What's your city/metro?**
   - This determines scraping location

2. **Start with HVAC + Plumbing, or different industries?**
   - Recommendation: HVAC + Plumbing (easiest close)

3. **Test batch (50 leads) or full month (500 leads)?**
   - Recommendation: Test batch first (validate metrics)

4. **Rating filter: < 3.8 or < 4.0 stars?**
   - Recommendation: < 3.8 (worse reviews = easier sell)

---

## What to Tell Me

**Just answer these and I'll give you the exact scraping commands:**

1. City/metro: ________________
2. Industries: ________________
3. Batch size: Test (50) or Full (500)
4. Rating filter: < 3.8 or < 4.0

Then I'll customize the scraping commands for your exact market.

---

**Ready to define your local market?** 🔥
