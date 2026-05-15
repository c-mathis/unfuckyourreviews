#!/bin/bash
# Outscraper Batch - Skip to Low-Rated Businesses
# Strategy: Skip first 60 results, scrape next 40 (positions 60-100)
# This targets lower-rated businesses while staying within Google Maps limits

set -e

cd /Users/beef/Repository/lead-scraper-agent

echo "🎯 Scraping low-rated businesses (skip=60, targeting positions 60-100)"
echo "   Expected hit rate: ~10% under 3.9 stars"
echo ""

SKIP=60
MAX=40

# Restaurants
echo "📍 Restaurants (40)..."
python3 main.py scrape outscraper --query "restaurant" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Auto Repair
echo "📍 Auto Repair (40)..."
python3 main.py scrape outscraper --query "auto repair" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Hair Salons
echo "📍 Hair Salons (40)..."
python3 main.py scrape outscraper --query "hair salon" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# HVAC
echo "📍 HVAC (40)..."
python3 main.py scrape outscraper --query "HVAC" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Plumbing
echo "📍 Plumbing (40)..."
python3 main.py scrape outscraper --query "plumbing" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Roofing
echo "📍 Roofing (40)..."
python3 main.py scrape outscraper --query "roofing" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Electrician
echo "📍 Electricians (40)..."
python3 main.py scrape outscraper --query "electrician" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Landscaping
echo "📍 Landscaping (40)..."
python3 main.py scrape outscraper --query "landscaping" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Carpet Cleaning
echo "📍 Carpet Cleaning (40)..."
python3 main.py scrape outscraper --query "carpet cleaning" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Pest Control
echo "📍 Pest Control (40)..."
python3 main.py scrape outscraper --query "pest control" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Dental
echo "📍 Dentists (40)..."
python3 main.py scrape outscraper --query "dentist" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Chiropractor
echo "📍 Chiropractors (40)..."
python3 main.py scrape outscraper --query "chiropractor" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Car Wash
echo "📍 Car Washes (40)..."
python3 main.py scrape outscraper --query "car wash" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Dry Cleaning
echo "📍 Dry Cleaners (40)..."
python3 main.py scrape outscraper --query "dry cleaning" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

# Towing
echo "📍 Towing Services (40)..."
python3 main.py scrape outscraper --query "towing" --location "Sacramento, CA" --max-results $MAX --skip $SKIP

echo ""
echo "✅ Scraping complete! (15 categories × 40 = 600 businesses)"
echo ""

# Find all Outscraper files from this session (last 15 minutes)
echo "📦 Combining results..."
RAW_FILES=$(find data/raw -name "outscraper_*.csv" -type f -mmin -15)

if [ -z "$RAW_FILES" ]; then
    echo "❌ No files found from this session"
    exit 1
fi

# Combine all CSVs (with header from first file only)
FIRST_FILE=true
OUTPUT_FILE="data/raw/Unfuck_Outscraper_Batch_Raw.csv"

for file in $RAW_FILES; do
    if [ "$FIRST_FILE" = true ]; then
        cat "$file" > "$OUTPUT_FILE"
        FIRST_FILE=false
    else
        tail -n +2 "$file" >> "$OUTPUT_FILE"
    fi
done

echo "✅ Combined $(echo $RAW_FILES | wc -w) files"
echo ""
echo "📊 Quick stats..."
python3 -c "
import pandas as pd

df = pd.read_csv('$OUTPUT_FILE')
df_unique = df.drop_duplicates(subset=['name', 'address'])
df_rated = df_unique[df_unique['rating'].notna()].copy()

print(f'Total businesses: {len(df_unique)}')
print(f'With ratings: {len(df_rated)}')
print(f'With emails: {df_unique[\"email\"].notna().sum()}')
print(f'Avg rating: {df_rated[\"rating\"].mean():.2f}')
under_3_9 = (df_rated['rating'] < 3.9).sum()
print(f'Under 3.9 stars: {under_3_9} ({under_3_9/len(df_rated)*100:.1f}%)')
"

echo ""
echo "📂 Saved to: $OUTPUT_FILE"
echo ""
echo "Next: Filter for < 3.9 stars, verify emails, upload to Instantly"
