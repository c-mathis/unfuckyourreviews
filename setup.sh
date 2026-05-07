#!/bin/bash

# Unfuck Leads - Quick Setup Script
# This script automates the deployment process

set -e

echo "🔥 Unfuck Leads - Deployment Setup"
echo "===================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"
echo ""

# Step 1: Create D1 Database
echo "📦 Step 1: Creating D1 database..."
echo ""
echo "Run this command and copy the database_id:"
echo "wrangler d1 create unfuck-leads"
echo ""
read -p "Press Enter when you've copied the database_id..."
echo ""

read -p "Paste your database_id here: " DB_ID
echo ""

# Update wrangler.toml with database_id
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
else
    # Linux
    sed -i "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
fi

echo "✅ Updated wrangler.toml with database_id"
echo ""

# Step 2: Initialize Schema
echo "📊 Step 2: Initializing database schema..."
wrangler d1 execute unfuck-leads --remote --file=schema.sql
echo "✅ Database schema initialized"
echo ""

# Step 3: Deploy Worker
echo "🚀 Step 3: Deploying Cloudflare Worker..."
wrangler deploy
echo "✅ Worker deployed"
echo ""

# Step 4: Update script.js
echo "⚙️  Step 4: Updating form endpoint..."
echo ""
echo "You need to manually update script.js line 11:"
echo "Change formEndpoint to: 'https://leads.unfuckyourweb.com/submit'"
echo ""
read -p "Press Enter when you've updated script.js..."
echo ""

# Step 5: Commit changes
echo "📝 Step 5: Committing changes..."
git add .
git commit -m "Configure production endpoints and database"
echo "✅ Changes committed"
echo ""

# Step 6: Deploy to Pages
echo "🌐 Step 6: Deploy to Cloudflare Pages"
echo ""
echo "Option A - Via GitHub:"
echo "  1. Push to GitHub: git push origin main"
echo "  2. Connect repo to Cloudflare Pages"
echo "  3. Set custom domain: unfuckyourreviews.com"
echo ""
echo "Option B - Direct Deploy:"
echo "  wrangler pages deploy . --project-name=unfuckyourreviews"
echo ""
read -p "Press Enter when landing page is deployed..."
echo ""

# Step 7: Deploy Dashboard
echo "📊 Step 7: Deploy Dashboard"
echo ""
echo "Update dashboard.html line 464 with:"
echo "const API_BASE = 'https://leads.unfuckyourweb.com';"
echo ""
echo "Then deploy dashboard.html to dashboard.unfuckyourweb.com"
echo ""
read -p "Press Enter when dashboard is deployed..."
echo ""

# Step 8: Test
echo "🧪 Step 8: Testing..."
echo ""
echo "Test form submission:"
echo "curl -X POST https://leads.unfuckyourweb.com/submit \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"name\":\"Test\",\"email\":\"test@test.com\",\"source\":\"reviews\"}'"
echo ""
echo "Test API:"
echo "curl https://leads.unfuckyourweb.com/api/leads"
echo ""
echo "Visit dashboard:"
echo "https://dashboard.unfuckyourweb.com"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Visit unfuckyourreviews.com and test form submission"
echo "2. Check dashboard.unfuckyourweb.com for leads"
echo "3. Add more 'Unfuck' properties using the same system"
echo ""
echo "🔥 Let's unfuck some reviews!"
