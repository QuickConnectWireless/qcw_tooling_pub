#!/bin/bash

echo "🚀 Setting up simple-mongo-proxy for GitHub"
echo "=========================================="
echo ""
echo "This will create a new GitHub repo for the proxy so Render can deploy it."
echo ""
echo "Steps:"
echo "1. Create a new repo on GitHub: https://github.com/new"
echo "   - Name: qcw-mongo-proxy"
echo "   - Description: MongoDB HTTP Proxy for QCW Dashboard"
echo "   - Public or Private: Your choice"
echo "   - Don't initialize with README"
echo ""
echo "2. After creating, come back here and enter your repo URL"
echo ""
read -p "Enter your new repo URL (e.g., https://github.com/YOUR-USERNAME/qcw-mongo-proxy): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

echo ""
echo "📦 Initializing git..."
git init

echo "📝 Adding files..."
git add .

echo "💾 Committing..."
git commit -m "Initial commit: MongoDB proxy for Cloudflare Workers"

echo "🔗 Adding remote..."
git remote add origin "$REPO_URL"

echo "⬆️  Pushing to GitHub..."
git push -u origin master || git push -u origin main

echo ""
echo "✅ Done!"
echo ""
echo "Your proxy is now on GitHub at: $REPO_URL"
echo ""
echo "Save this URL - you'll need it for Render deployment!"

