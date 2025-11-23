# 🚀 Deployment Guide for scintilla.world

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `scintilla-world` (or any name you prefer)
4. Description: "Scintilla World - Tools & Utilities Platform"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

## Step 2: Connect Local Repository to GitHub

```bash
cd /Users/neervasa/Desktop/scintilla-world

# Add remote repository
git remote add origin https://github.com/neervasa00000000/scintilla-world.git

# Add all files
git add .

# Commit
git commit -m "Initial commit - Scintilla World"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Choose Hosting Platform

### Option A: GitHub Pages (Free & Easy)

1. Go to your repository on GitHub
2. Click **Settings** → Scroll to **Pages**
3. Under **Source**, select **"Deploy from a branch"**
4. Branch: `main`, Folder: `/ (root)`
5. Click **Save**
6. Your site will be live at: `https://neervasa00000000.github.io/scintilla-world`

**To use custom domain (scintilla.world):**
- In GitHub Pages settings, add `scintilla.world` in the **Custom domain** field
- Follow DNS setup steps below

### Option B: Netlify (Recommended - Free & Fast)

1. Go to [Netlify.com](https://netlify.com) and sign up/login
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to GitHub and select `scintilla-world` repository
4. Build settings:
   - Build command: (leave empty for static site)
   - Publish directory: `/` (root)
5. Click **"Deploy site"**
6. Your site will be live at: `https://random-name.netlify.app`

**To use custom domain:**
- Go to **Domain settings** → **Add custom domain**
- Enter `scintilla.world`
- Follow DNS setup steps below

### Option C: Vercel (Free & Fast)

1. Go to [Vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New Project"**
3. Import `scintilla-world` repository from GitHub
4. Click **"Deploy"**
5. Your site will be live at: `https://scintilla-world.vercel.app`

**To use custom domain:**
- Go to **Project Settings** → **Domains**
- Add `scintilla.world`
- Follow DNS setup steps below

## Step 4: DNS Configuration for scintilla.world

### If using GitHub Pages:
1. Go to your domain registrar (where you bought scintilla.world)
2. Add DNS records:
   - **Type:** `A`
   - **Name:** `@` (or root domain)
   - **Value:** `185.199.108.153`
   - **TTL:** 3600
   
   Add 3 more A records:
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
   
3. Add CNAME record:
   - **Type:** `CNAME`
   - **Name:** `www`
   - **Value:** `neervasa00000000.github.io`
   - **TTL:** 3600

### If using Netlify:
1. Go to Netlify → Domain settings → DNS
2. Netlify will show you DNS records to add:
   - **Type:** `A`
   - **Value:** (Netlify will provide IP addresses)
   
   OR use Netlify's nameservers:
   - Change nameservers at your domain registrar to Netlify's nameservers

### If using Vercel:
1. Go to Vercel → Project → Domains
2. Vercel will show DNS records:
   - **Type:** `A` or `CNAME`
   - **Value:** (Vercel will provide)

## Step 5: SSL Certificate (Automatic)

- **GitHub Pages:** SSL is automatic when you add custom domain
- **Netlify:** SSL is automatic (Let's Encrypt)
- **Vercel:** SSL is automatic

## Step 6: Verify Deployment

1. Wait 5-10 minutes for DNS propagation
2. Visit `https://scintilla.world` in your browser
3. You should see your website!

## 🔧 Troubleshooting

- **DNS not working?** Wait up to 48 hours for full propagation
- **SSL not working?** Wait 24-48 hours for certificate generation
- **Site not updating?** Clear browser cache or wait a few minutes

## 📝 Quick Commands

```bash
# Make changes locally
cd /Users/neervasa/Desktop/scintilla-world

# Add changes
git add .

# Commit
git commit -m "Your commit message"

# Push to GitHub (auto-deploys on Netlify/Vercel)
git push origin main
```

---

**Need help?** Check the hosting platform's documentation or support.



