# ⚡ Quick Start Guide

## 🎯 What You Need

1. ✅ Domain: scintilla.world (you have this!)
2. ✅ GitHub account (create one at github.com if needed)
3. ✅ Choose hosting: Netlify (recommended) or Vercel

## 🚀 Fastest Way to Go Live (5 minutes)

### Step 1: Push to GitHub (2 min)
```bash
cd /Users/neervasa/Desktop/scintilla-world

# Create repo on GitHub first, then:
git remote add origin https://github.com/neervasa00000000/scintilla-world.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Netlify (2 min)
1. Go to https://netlify.com → Sign up/Login
2. Click "Add new site" → "Import from Git"
3. Select GitHub → Choose `scintilla-world`
4. Click "Deploy"
5. Done! You get a URL like `https://random-name.netlify.app`

### Step 3: Add Custom Domain (1 min)
1. In Netlify: Site settings → Domain management
2. Click "Add custom domain"
3. Enter: `scintilla.world`
4. Netlify will show DNS instructions
5. Add DNS records at your domain registrar
6. Wait 5-10 minutes
7. Visit https://scintilla.world ✨

## 📋 DNS Records to Add (at domain registrar)

**For Netlify:**
- Type: `A` → Value: `75.2.60.5`
- Type: `A` → Value: `99.83.190.102`
- Type: `CNAME` → Name: `www` → Value: `your-site.netlify.app`

**OR use Netlify nameservers** (easier):
- Change nameservers at registrar to Netlify's nameservers

## ✅ That's It!

Your site will be live at **scintilla.world** 🎉

---

**Need detailed steps?** See `DEPLOYMENT.md`



