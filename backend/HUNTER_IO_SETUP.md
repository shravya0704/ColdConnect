# Hunter.io API Setup

To enable professional email address suggestions, you need to configure a Hunter.io API key.

## Steps to Get Your Hunter.io API Key:

1. **Sign up at Hunter.io**: Visit https://hunter.io and create a free account
2. **Get your API key**: Go to your dashboard and find your API key
3. **Update your .env file**: Replace `your_hunter_io_api_key_here` with your actual API key

```
HUNTER_API_KEY=your_actual_api_key_here
```

4. **Restart the backend server**: Stop and restart `npm start` in the backend folder

## Free Tier Limits:
- Hunter.io free tier provides 25 requests per month
- Each company search uses 1 request
- Perfect for testing and light usage

## What You Get:
- Professional email addresses for the target company
- Contact names and positions when available
- Confidence scores for each email address
- Copy-to-clipboard functionality in the UI

## Fallback Behavior:
- If no API key is configured, the app works normally without email suggestions
- Groq email generation and recipient suggestions continue to work
- No errors or functionality loss

---

**Note**: Keep your API key secure and never commit it to version control!