# Lead Scraper Configuration - Unfuck Your Reviews

**Goal:** Scrape businesses with review problems (<4.0 stars or <50 reviews)

**Your existing tool:** `/Users/beef/Repository/lead-scraper-agent`

---

## Quick Setup

### 1. Navigate to Lead Scraper
```bash
cd /Users/beef/Repository/lead-scraper-agent
```

### 2. Verify API Keys Configured
```bash
python3 main.py status
```

**Should show:**
- ✅ Apify API key configured
- ✅ Apollo.io API key configured
- ✅ MillionVerifier API key configured
- ✅ Instantly.ai API key configured

If any are missing, edit `.env` file.

---

## Google Maps Scraping for Reviews

### Target Query Format

```
[Service Type] [City]
```

**Examples:**
- "HVAC Denver"
- "plumbing Austin"
- "roofing Phoenix"
- "restaurants Portland"
- "auto repair Seattle"
- "med spa San Diego"
- "dentist Denver"

---

### Scraping Commands

### Option 1: Single City/Service

```bash
python3 main.py run gmaps "HVAC Denver" "Denver, CO" \
  --max-results 100 \
  --campaign "Unfuck_Reviews_HVAC_Denver"
```

**What this does:**
1. Scrapes 100 HVAC businesses in Denver from Google Maps
2. Extracts: name, address, phone, rating, review count, website
3. Enriches with email addresses via Apollo.io
4. Verifies emails via MillionVerifier
5. Exports to Instantly campaign "Unfuck_Reviews_HVAC_Denver"

**Output:** CSV in `data/exported/` with all data

---

### Option 2: Batch Scraping (Multiple Cities/Services)

Create a bash script to scrape multiple targets:

**File:** `/Users/beef/Repository/lead-scraper-agent/scrape-reviews-batch.sh`

```bash
#!/bin/bash

# Unfuck Your Reviews - Batch Lead Scraping
# Target: Businesses with review problems

CAMPAIGN="Unfuck_Reviews_Q2_2026"

# HVAC Companies
python3 main.py run gmaps "HVAC" "Denver, CO" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "HVAC" "Austin, TX" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "HVAC" "Phoenix, AZ" --max-results 50 --campaign "$CAMPAIGN"

# Plumbing Companies
python3 main.py run gmaps "plumbing" "Denver, CO" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "plumbing" "Austin, TX" --max-results 50 --campaign "$CAMPAIGN"

# Roofing Companies
python3 main.py run gmaps "roofing" "Denver, CO" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "roofing" "Austin, TX" --max-results 50 --campaign "$CAMPAIGN"

# Restaurants
python3 main.py run gmaps "restaurants" "Denver, CO" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "restaurants" "Austin, TX" --max-results 50 --campaign "$CAMPAIGN"

# Auto Services
python3 main.py run gmaps "auto repair" "Denver, CO" --max-results 50 --campaign "$CAMPAIGN"
python3 main.py run gmaps "auto detailing" "Austin, TX" --max-results 50 --campaign "$CAMPAIGN"

echo "✅ Batch scraping complete! Total: 550 leads"
echo "📂 Check: data/exported/$CAMPAIGN/"
```

**Run:**
```bash
chmod +x scrape-reviews-batch.sh
./scrape-reviews-batch.sh
```

**Time:** ~30-45 minutes for 550 leads
**Cost:** ~$5 (Apify + MillionVerifier)

---

## Post-Scraping: Filter for Review Problems

Your lead scraper gets ALL businesses. You need to filter for review problems.

### Filtering Criteria

**Target businesses with:**
- Rating < 4.0 ⭐
- OR review count < 50
- AND has website URL
- AND has email address
- AND in business 2+ years (optional)

### Filtering Script

Create this Python script to filter the exported CSV:

**File:** `/Users/beef/Repository/lead-scraper-agent/filter-reviews.py`

```python
#!/usr/bin/env python3
"""
Filter scraped leads for review problems
Target: <4.0 stars OR <50 reviews
"""

import pandas as pd
import sys

def filter_review_problems(input_file, output_file):
    # Load scraped data
    df = pd.read_csv(input_file)

    # Filter criteria
    filtered = df[
        (
            (df['rating'] < 4.0) |
            (df['reviewCount'] < 50)
        ) &
        (df['email'].notna()) &  # Must have email
        (df['website'].notna())  # Must have website
    ]

    # Sort by worst reviews first (highest potential)
    filtered = filtered.sort_values('rating')

    # Add custom fields for Instantly
    filtered['industry'] = filtered['category'].apply(extract_industry)
    filtered['reviewIssue'] = filtered.apply(generate_review_issue, axis=1)

    # Export
    filtered.to_csv(output_file, index=False)

    print(f"✅ Filtered {len(filtered)} leads from {len(df)} total")
    print(f"📂 Saved to: {output_file}")

    # Stats
    print(f"\n📊 Stats:")
    print(f"  • Avg rating: {filtered['rating'].mean():.1f} stars")
    print(f"  • Avg reviews: {filtered['reviewCount'].mean():.0f}")
    print(f"  • Under 3.5 stars: {len(filtered[filtered['rating'] < 3.5])}")
    print(f"  • Under 30 reviews: {len(filtered[filtered['reviewCount'] < 30])}")

def extract_industry(category):
    """Extract industry from category"""
    if not category:
        return "local business"

    category_lower = category.lower()

    # Map categories to industry names
    mappings = {
        'hvac': 'HVAC',
        'heating': 'HVAC',
        'cooling': 'HVAC',
        'plumb': 'plumbing',
        'roof': 'roofing',
        'restaurant': 'restaurant',
        'food': 'restaurant',
        'auto': 'auto services',
        'car': 'auto services',
        'repair': 'auto repair',
        'detail': 'auto detailing',
        'salon': 'salon',
        'spa': 'med spa',
        'dent': 'dental',
        'law': 'legal services',
        'attorney': 'legal services',
    }

    for keyword, industry in mappings.items():
        if keyword in category_lower:
            return industry

    return "local business"

def generate_review_issue(row):
    """Generate specific review issue callout for email"""

    rating = row.get('rating', 0)
    review_count = row.get('reviewCount', 0)

    # Priority 1: Very low rating
    if rating < 3.5:
        return f"Your {rating} star rating is driving customers away"

    # Priority 2: Very few reviews
    if review_count < 20:
        return f"You only have {review_count} reviews (competitors have 100+)"

    # Priority 3: Low reviews
    if review_count < 50:
        return f"Your competitors have 3x more reviews than you"

    # Default: Under 4.0 stars
    return f"At {rating} stars, you're losing 47% of potential customers"

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 filter-reviews.py <input.csv> <output.csv>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    filter_review_problems(input_file, output_file)
```

**Run:**
```bash
python3 filter-reviews.py \
  data/exported/Unfuck_Reviews_Q2_2026.csv \
  data/exported/Unfuck_Reviews_Q2_2026_FILTERED.csv
```

---

## Adding Custom Fields for Instantly

Your filtered CSV needs these columns for the Instantly campaign:

| Column | Source | Example |
|--------|--------|---------|
| `email` | From Apollo | `john@abcplumbing.com` |
| `firstName` | From website/LinkedIn | `John` (or "there" if unknown) |
| `businessName` | From Google Maps | `ABC Plumbing` |
| `city` | From Google Maps | `Denver` |
| `industry` | Derived from category | `plumbing` |
| `rating` | From Google Maps | `3.2` |
| `reviewCount` | From Google Maps | `18` |
| `reviewIssue` | Auto-generated | `Your 3.2 star rating is driving customers away` |
| `website` | From Google Maps | `https://abcplumbing.com` |
| `phone` | From Google Maps | `303-555-1234` |
| `gbpURL` | From Google Maps | `https://maps.google.com/...` |

---

## Enriching with First Names

Most scraped leads won't have first names. Here's how to get them:

### Option 1: Manual LinkedIn Lookup (Slow, Free)

1. Google: `[Business Name] [City] owner LinkedIn`
2. Find LinkedIn profile
3. Copy first name to CSV
4. Repeat for top 50 leads (prioritize worst ratings)

**Time:** 2-3 minutes per lead = 2-3 hours for 50 leads

---

### Option 2: Hunter.io Domain Search (Fast, Paid)

```bash
# Install hunter.io CLI
npm install -g hunter.io-cli

# Search for employees by domain
hunter domain-search --domain abcplumbing.com --type owner
```

**Cost:** $49/mo for 500 searches

---

### Option 3: Use "there" as Fallback

If you don't have first name, use "there" in email:

```
there,

I was looking for plumbing in Denver and found ABC Plumbing on Google Maps.
```

Still personalizes with business name, city, rating, etc.

**Conversion impact:** ~10% lower reply rate vs. first name, but still works

---

## Recording Loom Videos (Optional but Recommended)

For your top 50-100 leads, record personalized Loom videos.

### Batch Recording Process

1. Open spreadsheet with lead data
2. For each lead:
   - Open their GBP in Chrome tab 1
   - Open competitor (high rating) in Chrome tab 2
   - Start Loom screen recording
   - Follow script from INSTANTLY-SETUP.md
   - Record 2-3 minutes
   - Copy Loom URL to spreadsheet
3. Export spreadsheet to CSV with `loomURL` column

**Time:** 15-20 min per video
**Batch of 10:** ~3 hours
**Batch of 50:** ~15 hours (do over weekend)

### Prioritize Loom Videos for:
- Ratings under 3.5 stars (worst problems)
- Businesses with 50+ reviews (established, serious)
- Highest revenue potential (dentists, lawyers, med spas)
- Your local market (easier to close)

---

## Complete Workflow

### Week 1: Setup + Scraping

**Day 1-2:** Configure lead scraper
```bash
cd /Users/beef/Repository/lead-scraper-agent
python3 main.py status  # Verify API keys
```

**Day 3:** Run batch scraping
```bash
./scrape-reviews-batch.sh
# Output: 550 leads in data/exported/
```

**Day 4:** Filter for review problems
```bash
python3 filter-reviews.py \
  data/exported/Unfuck_Reviews_Q2_2026.csv \
  data/exported/Unfuck_Reviews_FILTERED.csv
# Output: ~200-300 qualified leads
```

**Day 5-7:** Record Loom videos for top 50 leads
```bash
# Manual process, use spreadsheet
# Output: CSV with loomURL column
```

---

### Week 2: Launch Campaign

**Day 1:** Upload to Instantly
```bash
# In Instantly dashboard:
# 1. Create new campaign
# 2. Import CSV
# 3. Map custom fields
# 4. Launch
```

**Day 2-7:** Monitor replies, book calls
```bash
# Check Instantly inbox 2x/day
# Respond to positive replies within 1 hour
# Book calls via Calendly
```

---

## Sample Target Cities (Start Here)

**Tier 1: Major Markets (High Volume)**
- Denver, CO
- Austin, TX
- Phoenix, AZ
- Seattle, WA
- Portland, OR
- San Diego, CA

**Tier 2: Mid-Size Markets (Lower Competition)**
- Boulder, CO
- Fort Collins, CO
- Round Rock, TX
- Tempe, AZ
- Bellevue, WA
- Scottsdale, AZ

**Tier 3: Your Local Market (Easiest to Close)**
- Wherever you're based
- Can offer in-person meetings
- Build local reputation faster

---

## Sample Service Categories (Best Converters)

**High Revenue per Client ($800-2,000/mo potential):**
- Dentists
- Lawyers (PI, family law)
- Med spas
- Plastic surgeons

**High Volume (Easy Close, $399-500/mo):**
- HVAC
- Plumbing
- Roofing
- Electrical
- Auto repair
- Restaurants

**Good Balance:**
- Salons & barbers
- Cleaning services
- Landscaping
- Pest control

**Start with:** HVAC, plumbing, roofing in your local market

---

## Expected Results

**From 500 scraped leads:**
- ~200-300 have review problems (40-60%)
- ~150-200 have valid emails (30-40%)
- ~100-150 pass email verification (20-30%)

**From 150 verified leads:**
- Send: 150 emails
- Opens: 60-90 (40-60%)
- Replies: 8-15 (5-10%)
- Positive replies: 3-6 (2-4%)
- Booked calls: 2-3 (1-2%)
- Closed deals: 0-1 (10-20% of calls)

**Weekly at scale (500 emails/week):**
- Positive replies: 10-20/week
- Booked calls: 5-10/week
- Closed deals: 1-3/week
- MRR added: $400-1,500/week

---

## Cost Breakdown

**Per 1,000 scraped leads:**
- Apify (Google Maps): ~$5
- Apollo.io: Free (10k/mo free tier)
- MillionVerifier: ~$4
- **Total: ~$9 per 1,000 scraped**

**Filtered for review problems (30% qualify):**
- ~$30 per 1,000 qualified leads
- ~$0.03 per qualified lead

**ROI:**
- Cost per 1,000 qualified leads: $30
- Expected closes at 1%: 10 clients
- Revenue at $399/mo: $3,990/mo
- **ROI: 133x first month, infinite after**

---

## Quick Start Command (Run This Now)

```bash
cd /Users/beef/Repository/lead-scraper-agent

# Test with small batch (10 leads)
python3 main.py run gmaps "HVAC" "Denver, CO" \
  --max-results 10 \
  --campaign "Unfuck_Reviews_TEST"

# Check output
ls -lh data/exported/

# If successful, scale to 50-100
```

---

**Ready to scrape?** 🔥

Let me know when you're ready and I'll help you run the first batch.
