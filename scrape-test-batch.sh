#!/bin/bash
# Sacramento Full Batch - 1,000 Diverse Service Businesses
# Mix of restaurants, auto repair, salons, HVAC, plumbers (200 each)

set -e

cd /Users/beef/Repository/lead-scraper-agent

echo "🎯 Scraping 1,000 diverse service businesses from Sacramento"
echo "   (200 per category - will filter for < 3.9 stars after)"
echo ""

# Restaurants - 200
echo "📍 Restaurants (200)..."
python3 main.py scrape gmaps --query "restaurant" --location "Sacramento, CA" --max-results 200

# Auto Repair - 200
echo "📍 Auto Repair Shops (200)..."
python3 main.py scrape gmaps --query "auto repair" --location "Sacramento, CA" --max-results 200

# Hair Salons - 200
echo "📍 Hair Salons (200)..."
python3 main.py scrape gmaps --query "hair salon" --location "Sacramento, CA" --max-results 200

# HVAC - 200
echo "📍 HVAC Companies (200)..."
python3 main.py scrape gmaps --query "HVAC" --location "Sacramento, CA" --max-results 200

# Plumbing - 200
echo "📍 Plumbing Companies (200)..."
python3 main.py scrape gmaps --query "plumbing" --location "Sacramento, CA" --max-results 200

echo ""
echo "✅ Scraping complete! (1,000 service businesses)"
echo ""

# Find all files from this scraping session (last 30 minutes)
echo "📦 Combining results..."
RAW_FILES=$(find data/raw -name "gmaps_*.csv" -type f -mmin -30)

if [ -z "$RAW_FILES" ]; then
    echo "❌ No files found from this session"
    exit 1
fi

# Combine
cat $RAW_FILES > data/raw/Unfuck_Sac_Full_Batch_Raw.csv

echo "✅ Combined $(echo $RAW_FILES | wc -w) files"
echo ""
echo "📊 Quick stats..."
python3 -c "
import pandas as pd
df = pd.read_csv('data/raw/Unfuck_Sac_Full_Batch_Raw.csv')
df_unique = df.drop_duplicates(subset=['name', 'address'])
df_unique['rating_num'] = pd.to_numeric(df_unique['rating'], errors='coerce')
df_unique['reviews_num'] = pd.to_numeric(df_unique['reviews_count'], errors='coerce')
print(f'Total businesses: {len(df_unique)}')
print(f'With websites: {df_unique[\"website\"].notna().sum()}')
print(f'Avg rating: {df_unique[\"rating_num\"].mean():.2f}')
print(f'Avg reviews: {df_unique[\"reviews_num\"].mean():.0f}')
under_3_9 = (df_unique[\"rating_num\"] < 3.9).sum()
print(f'Under 3.9 stars: {under_3_9} ({under_3_9/len(df_unique)*100:.1f}%)')
"

echo ""
echo "📂 Saved to: data/raw/Unfuck_Sac_Full_Batch_Raw.csv"
echo ""
echo "Next: Filter for < 3.9 stars and find owner emails"
