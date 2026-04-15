# Place Near Me - API Integration Guide

## Overview
This page helps users find cheap food deals near them using live APIs.

## Required APIs

### 1. Google Places API (Required)
- **Purpose**: Find restaurants and food places near user location
- **Get API Key**: https://console.cloud.google.com/google/maps-apis
- **Enable**: Places API, Places API (New), Geocoding API
- **Cost**: First $200/month free, then pay-as-you-go

### 2. Google Maps JavaScript API (Optional but Recommended)
- **Purpose**: Display maps, calculate distances
- **Get API Key**: Same as above
- **Enable**: Maps JavaScript API

### 3. Deal APIs (Optional - for real-time deals)
- **Uber Eats API**: Requires partnership
- **DoorDash API**: Requires partnership
- **Custom Backend**: Build your own deals database

## Setup Instructions

### Step 1: Get Google API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Places API" and "Places API (New)"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the key to your domain for security

### Step 2: Add API Key to Page
Replace `YOUR_GOOGLE_API_KEY` in `index.html` with your actual API key.

### Step 3: Configure CORS (if using backend)
If you build a backend API, ensure CORS is enabled for your domain.

## API Integration Code

The page now supports:
- ✅ Google Places API integration
- ✅ Real-time location search
- ✅ Distance calculations
- ✅ Fallback to sample data if API fails

## Security Notes
- **Never commit API keys to Git**
- Use environment variables or server-side proxy
- Restrict API keys to specific domains/IPs
- Monitor API usage to avoid unexpected charges

## Cost Estimation
- **Google Places API**: ~$0.017 per request
- **1000 searches/month**: ~$17
- **Free tier**: $200/month credit (covers ~11,700 requests)

## Alternative: Server-Side Proxy
For better security and cost control, consider:
1. Create a backend API endpoint
2. Store API keys on server
3. Frontend calls your API, not Google directly
4. Cache results to reduce API calls

