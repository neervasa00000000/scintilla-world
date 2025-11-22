# API Setup Guide - Place Near Me

## Quick Start: Connect to Live APIs

### Option 1: Google Places API (Recommended)

#### Step 1: Get Your API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Places API** (Legacy)
   - **Places API (New)**
   - **Geocoding API** (optional)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

#### Step 2: Secure Your API Key
1. Click on your API key to edit it
2. Under **API restrictions**, select:
   - Places API
   - Places API (New)
   - Geocoding API
3. Under **Application restrictions**, select **HTTP referrers**
4. Add your domain: `https://nutrithrive.com.au/*`
5. Save

#### Step 3: Add Key to Your Page
1. Open `place-near-me/index.html`
2. Find this line (around line 490):
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_API_KEY&libraries=places"></script>
   ```
3. Replace `YOUR_GOOGLE_API_KEY` with your actual key
4. Find this line in the JavaScript:
   ```javascript
   const USE_LIVE_API = false;
   ```
5. Change to:
   ```javascript
   const USE_LIVE_API = true;
   ```

#### Step 4: Test
1. Open the page in your browser
2. Click "Use my location"
3. Allow location access
4. You should see real places from Google Places API!

---

### Option 2: Build Your Own Backend API (More Control)

#### Why Use a Backend?
- **Security**: Hide API keys from frontend
- **Cost Control**: Cache results, reduce API calls
- **Custom Deals**: Add your own deals database
- **Better Performance**: Pre-process data

#### Backend Setup (Node.js Example)

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(cors({ origin: 'https://nutrithrive.com.au' }));

// Cache to reduce API calls
const cache = new Map();

app.get('/api/places', async (req, res) => {
  const { lat, lng, radius = 2000 } = req.query;
  const cacheKey = `${lat},${lng},${radius}`;
  
  // Check cache first
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  
  try {
    // Call Google Places API from server
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
      {
        params: {
          location: `${lat},${lng}`,
          radius: radius,
          type: 'restaurant',
          key: process.env.GOOGLE_API_KEY // Store in environment variable
        }
      }
    );
    
    // Process and add your deals
    const places = response.data.results.map(place => ({
      ...place,
      deals: getDealsForPlace(place.place_id) // Your deals database
    }));
    
    // Cache for 1 hour
    cache.set(cacheKey, places);
    setTimeout(() => cache.delete(cacheKey), 3600000);
    
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

#### Update Frontend to Use Backend

In `index.html`, replace the API call with:

```javascript
async function fetchPlacesFromBackend(lat, lng) {
  try {
    const response = await fetch(
      `https://your-backend.com/api/places?lat=${lat}&lng=${lng}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend error:', error);
    return null;
  }
}
```

---

### Option 3: Add Real Deals Database

#### Simple JSON Database

Create `deals.json`:

```json
{
  "ChIJ...": [
    {
      "description": "15% off for students",
      "discountPercent": 15,
      "newUserOnly": false,
      "platform": "IN_STORE",
      "validTo": "2025-12-31"
    }
  ]
}
```

#### Load Deals in Your Code

```javascript
async function loadDeals() {
  const response = await fetch('/deals.json');
  const deals = await response.json();
  return deals;
}

// When processing places:
places.forEach(place => {
  place.deals = deals[place.id] || [];
});
```

---

## Cost Estimation

### Google Places API Pricing (as of 2024)
- **Nearby Search**: $0.032 per request
- **Text Search**: $0.032 per request
- **Place Details**: $0.017 per request
- **Free Tier**: $200/month credit

### Example Monthly Costs
- **100 users/day × 1 search each = 3,000 requests/month**
- **Cost**: 3,000 × $0.032 = $96/month
- **With free tier**: $0 (covered by $200 credit)

### Cost Optimization Tips
1. **Cache results** (same location = cached data)
2. **Use backend** to control API calls
3. **Set daily limits** in Google Cloud Console
4. **Combine requests** (batch multiple places)

---

## Security Best Practices

1. **Never expose API keys in frontend code**
   - Use backend proxy (recommended)
   - Or restrict API key to your domain only

2. **Set API key restrictions**
   - HTTP referrers: `https://nutrithrive.com.au/*`
   - API restrictions: Only enable needed APIs

3. **Monitor usage**
   - Set up billing alerts
   - Check Google Cloud Console regularly

4. **Use environment variables**
   ```bash
   # .env file (never commit to Git)
   GOOGLE_API_KEY=your_key_here
   ```

---

## Troubleshooting

### "API key not valid"
- Check API key is correct
- Verify API is enabled in Google Cloud Console
- Check API key restrictions

### "This API project is not authorized"
- Enable Places API in Google Cloud Console
- Wait a few minutes for changes to propagate

### "Quota exceeded"
- You've hit the free tier limit
- Check usage in Google Cloud Console
- Consider upgrading billing account

### "CORS error"
- If using backend, ensure CORS is enabled
- Check server allows requests from your domain

---

## Next Steps

1. ✅ Get Google API key
2. ✅ Add key to HTML file
3. ✅ Set `USE_LIVE_API = true`
4. ✅ Test with your location
5. 🔄 Build deals database
6. 🔄 Add backend (optional)
7. 🔄 Implement caching
8. 🔄 Monitor costs

---

## Support

For issues:
- Google Places API Docs: https://developers.google.com/maps/documentation/places
- Google Cloud Support: https://cloud.google.com/support

