#!/bin/bash
# Sacramento Lead Scraping - All-in-One Script
# Target: 1,500 scraped → enrich emails → verify → filter for < 3.9 stars → 500 verified contacts

set -e

cd /Users/beef/Repository/lead-scraper-agent

echo "🎯 Starting Sacramento metro scraping (1,500 leads total)"
echo "   Goal: 500 verified contacts after < 3.9 star filter"
echo ""
echo "Step 1/4: Scraping Google Maps businesses..."
echo ""

# Sacramento - 300 leads
echo "📍 Scraping Sacramento (300 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Sacramento, CA" \
  --max-results 300

# Roseville - 225 leads
echo "📍 Scraping Roseville (225 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Roseville, CA" \
  --max-results 225

# Elk Grove - 225 leads
echo "📍 Scraping Elk Grove (225 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Elk Grove, CA" \
  --max-results 225

# Folsom - 150 leads
echo "📍 Scraping Folsom (150 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Folsom, CA" \
  --max-results 150

# Rancho Cordova - 150 leads
echo "📍 Scraping Rancho Cordova (150 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Rancho Cordova, CA" \
  --max-results 150

# Citrus Heights - 150 leads
echo "📍 Scraping Citrus Heights (150 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Citrus Heights, CA" \
  --max-results 150

# Fair Oaks - 150 leads
echo "📍 Scraping Fair Oaks (150 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "Fair Oaks, CA" \
  --max-results 150

# West Sacramento - 150 leads
echo "📍 Scraping West Sacramento (150 businesses)..."
python3 main.py scrape gmaps \
  --query "business" \
  --location "West Sacramento, CA" \
  --max-results 150

echo ""
echo "✅ Scraping complete! (1,500 businesses scraped)"
echo ""
echo "Step 2/4: Combining and enriching with emails (Apollo.io)..."
echo ""

# Find all raw GMaps CSVs from this session (last 2 hours)
RAW_FILES=$(find data/raw -name "gmaps_business_*ca_*.csv" -type f -mmin -120)

if [ -z "$RAW_FILES" ]; then
    echo "❌ No raw files found from this scraping session"
    exit 1
fi

# Combine all raw files
cat $RAW_FILES > data/raw/Unfuck_Sac_Combined_Raw.csv

echo "✅ Combined $(echo $RAW_FILES | wc -w) files into Unfuck_Sac_Combined_Raw.csv"
echo ""
echo "📧 Enriching with Apollo.io to find emails..."
python3 main.py enrich \
  --input data/raw/Unfuck_Sac_Combined_Raw.csv \
  --output data/enriched/Unfuck_Sac_Enriched.csv

echo ""
echo "Step 3/4: Verifying emails with MillionVerifier..."
echo ""

python3 main.py verify \
  --input data/enriched/Unfuck_Sac_Enriched.csv \
  --output data/verified/Unfuck_Sac_Verified.csv

echo ""
echo "Step 4/4: Filtering for review problems (< 3.9 stars OR < 50 reviews)..."
echo ""

python3 filter-reviews.py \
  data/verified/Unfuck_Sac_Verified.csv \
  data/exported/Unfuck_Sac_FILTERED.csv \
  --max-rating 3.9 \
  --max-reviews 50

echo ""
echo "🎉 Done!"
echo ""
echo "📂 Final filtered leads: data/exported/Unfuck_Sac_FILTERED.csv"
echo ""
echo "📊 Expected result: ~500 verified contacts ready to upload"
echo ""
echo "Next steps:"
echo "1. Review the filtered CSV"
echo "2. Upload to both Instantly campaigns (A and B)"
echo "3. Launch campaigns Monday morning"
