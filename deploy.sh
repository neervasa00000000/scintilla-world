#!/bin/bash

# Deployment script for scintilla.world
# This script helps you push your code to GitHub

echo "🚀 Scintilla World Deployment Script"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "website/index.html" ]; then
    echo "❌ Error: website/index.html not found. Make sure you're in the scintilla-world directory."
    exit 1
fi

# Check git status
echo "📋 Checking git status..."
git status

echo ""
echo "⚠️  IMPORTANT: Make sure you've created the repository on GitHub first!"
echo "   Go to: https://github.com/new"
echo "   Repository name: scintilla-world"
echo "   DO NOT initialize with README, .gitignore, or license"
echo ""
read -p "Press Enter to continue after creating the repository on GitHub..."

# Add all files
echo ""
echo "📦 Adding all files..."
git add .

# Commit
echo ""
echo "💾 Committing changes..."
git commit -m "Initial commit - Scintilla World"

# Ensure we're on main branch
echo ""
echo "🌿 Setting branch to main..."
git branch -M main

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your code is now on GitHub."
echo ""
echo "📝 Next steps:"
echo "   1. Go to https://netlify.com (recommended) or https://vercel.com"
echo "   2. Import your repository"
echo "   3. Add custom domain: scintilla.world"
echo "   4. Configure DNS at your domain registrar"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions."

