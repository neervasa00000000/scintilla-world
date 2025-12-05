# Gmail API Setup Guide

This guide will help you set up Gmail API integration for the Email Automation tool, allowing you to send emails directly and track replies.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Email Automation")
5. Click "Create"

## Step 2: Enable Gmail API

1. In your project, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required fields:
     - App name: "Email Automation"
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Add scopes: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.readonly`
   - Add test users (your email address)
   - Click "Save and Continue"
4. For Application type, select "Web application"
5. Add authorized JavaScript origins:
   - `http://localhost` (for local testing)
   - Your production domain (e.g., `https://yourdomain.com`)
6. Add authorized redirect URIs:
   - `http://localhost` (for local testing)
   - Your production domain
7. Click "Create"
8. Copy the **Client ID** (it looks like `xxxxx.apps.googleusercontent.com`)

## Step 4: Configure in Email Automation Tool

1. Open the Email Automation tool
2. Go to Settings
3. Select "Gmail" as your email client
4. Paste your Client ID in the "Gmail API Client ID" field
5. Click "Authenticate with Gmail"
6. Grant permissions when prompted

## Features Enabled

Once set up, you can:

- ✅ **Send emails directly** via Gmail API (no need to open Gmail manually)
- ✅ **Track sent emails** automatically
- ✅ **Check for replies** from your contacts
- ✅ **View email statistics** in the Dashboard tab
- ✅ **See reply rates** and contact statuses

## Troubleshooting

### "Authentication failed" error
- Make sure you've entered the correct Client ID
- Ensure Gmail API is enabled in your project
- Check that you've added the correct authorized origins

### "Access blocked" error
- Make sure you've added yourself as a test user in OAuth consent screen
- For production use, you'll need to publish your app (requires verification)

### Emails not sending
- Check that you've granted the `gmail.send` permission
- Verify your email address is set correctly in Settings

## Security Notes

- Never share your Client ID publicly
- The Client ID is safe to use in client-side code (it's public)
- For production, consider restricting the Client ID to specific domains
- Regularly review and revoke access if needed in your Google Account settings

## API Quotas

Gmail API has the following quotas (free tier):
- 1 billion quota units per day
- Sending an email: ~100 quota units
- Reading messages: ~5 quota units per message

This should be more than enough for personal use. For high-volume sending, consider using a service like SendGrid or Mailgun.

