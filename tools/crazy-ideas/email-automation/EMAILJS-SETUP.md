# EmailJS Setup Guide (Super Easy! ⚡)

EmailJS is **much simpler** than Gmail API - just 5 minutes to set up!

## Why EmailJS?

- ✅ **No OAuth setup** - just sign up and connect your email
- ✅ **Free tier**: 200 emails/month
- ✅ **Works with any email**: Gmail, Outlook, Yahoo, etc.
- ✅ **No server needed** - everything runs in the browser

## Step 1: Sign Up (1 minute)

1. Go to [emailjs.com](https://www.emailjs.com/)
2. Click "Sign Up Free"
3. Create an account (or use Google/GitHub)

## Step 2: Connect Your Email (2 minutes)

1. Go to **Email Services** in the dashboard
2. Click **Add New Service**
3. Choose your email provider:
   - **Gmail**: Click "Connect Account" and authorize
   - **Outlook**: Click "Connect Account" and authorize
   - **Other**: Follow the SMTP instructions
4. Give it a name (e.g., "My Gmail")
5. **Copy the Service ID** (looks like `service_xxxxx`)

## Step 3: Create Email Template (1 minute)

1. Go to **Email Templates** in the dashboard
2. Click **Create New Template**
3. Use this template:

```
Subject: {{subject}}

From: {{from_name}} <{{from_email}}>
To: {{to_email}}

{{message}}

---
Reply to: {{reply_to}}
```

4. **Important**: Make sure these variables are in your template:
   - `{{to_email}}`
   - `{{from_email}}`
   - `{{from_name}}`
   - `{{subject}}`
   - `{{message}}`
   - `{{reply_to}}`

5. Click **Save**
6. **Copy the Template ID** (looks like `template_xxxxx`)

## Step 4: Get Your Public Key (30 seconds)

1. Go to **Account** > **General**
2. Find **Public Key**
3. **Copy it**

## Step 5: Configure in Email Automation Tool (30 seconds)

1. Open the Email Automation tool
2. Go to **Settings**
3. Select **EmailJS (Recommended)** as your email client
4. Enter your email address
5. Paste the three values:
   - **Service ID**: `service_xxxxx`
   - **Template ID**: `template_xxxxx`
   - **Public Key**: `xxxxx`
6. Done! ✅

## That's It!

Now you can send emails directly from the tool - no need to open Gmail or any email client!

## Free Tier Limits

- **200 emails/month** (free)
- Upgrade for more if needed

## Troubleshooting

### "EmailJS not loaded" error
- Make sure you have internet connection
- Check browser console for errors

### Emails not sending
- Verify all three IDs are correct
- Check that your email service is connected
- Make sure template variables match exactly

### Template variables not working
- Ensure your template uses `{{variable_name}}` format
- Check that variable names match exactly (case-sensitive)

## Need Help?

- [EmailJS Documentation](https://www.emailjs.com/docs/)
- [EmailJS Support](https://www.emailjs.com/support/)

