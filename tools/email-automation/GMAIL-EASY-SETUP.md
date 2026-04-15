# Gmail API - Super Easy Setup (3 Steps) 🚀

This is the **easiest way** to connect Gmail API. Just 3 steps!

## Step 1: Get Your Client ID (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"APIs & Services"** → **"Credentials"**
3. Click **"Create Credentials"** → **"OAuth client ID"**
4. If asked, configure OAuth consent screen:
   - Choose **"External"**
   - App name: **"Email Automation"**
   - Your email for support
   - Click **"Save and Continue"**
   - Add scopes: `gmail.send` and `gmail.readonly`
   - Add **your email** as a test user
   - Click **"Save and Continue"**
5. Application type: **"Web application"**
6. Authorized JavaScript origins: Add your domain
   - If testing locally: `http://localhost`
   - If on a server: `https://yourdomain.com`
7. Click **"Create"**
8. **Copy the Client ID** (looks like `xxxxx.apps.googleusercontent.com`)

## Step 2: Paste Client ID (10 seconds)

1. Open Email Automation tool
2. Go to **Settings**
3. Select **"Gmail API"**
4. Paste your Client ID

## Step 3: Sign In (5 seconds)

1. Click **"Sign in with Google"** button
2. Grant permissions
3. Done! ✅

## That's It!

Now you can send emails directly via Gmail API!

## Troubleshooting

### "Redirect URI mismatch"
- Make sure you added your domain to "Authorized JavaScript origins" in Google Cloud Console

### "Access blocked"
- Add yourself as a test user in OAuth consent screen

### Can't find Client ID?
- Make sure you created an OAuth 2.0 Client ID (not API key)
- Check "Credentials" page in Google Cloud Console

## Need More Help?

See the detailed guide: [GMAIL-SETUP.md](./GMAIL-SETUP.md)

