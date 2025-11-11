# Unified Email Discovery System

ColdConnect uses a **unified hybrid email discovery system** that combines intelligent pattern generation with optional real email APIs to find company email addresses and decision makers.

## 🚀 **What You Get**

✅ **Unlimited pattern-generated emails** using intelligent corporate patterns  
✅ **50 real emails per month** from Snov.io (optional)  
✅ **100 email verifications per month** from Abstract API (optional)  
✅ **Smart caching** (30 days) to maximize free credits  
✅ **Automatic fallback** when quotas are exhausted  
✅ **Unified discovery** for both emails and decision makers  

## 🎯 **Unified API Endpoints**

### **POST /find-emails** - Email Discovery
Find company email addresses using hybrid approach

### **POST /find-decision-makers** - Decision Maker Discovery  
Find decision makers (redirects to email finder with recruiter role)

### **GET /api-status** - System Status
Check all API configurations and service availability

### **Snov.io (Optional - Real Emails)**
- **What**: Real email finder with verified addresses
- **Free Tier**: 50 emails per month
- **Signup**: https://snov.io/sign-up
- **Setup**: Add `SNOVIO_API_KEY` to your `.env` file

### **Abstract API (Optional - Email Verification)**
- **What**: Email validation and deliverability checking
- **Free Tier**: 100 verifications per month
- **Signup**: https://app.abstractapi.com/api/email-validation
- **Setup**: Add `ABSTRACT_API_KEY` to your `.env` file

### **Pattern Generation (Always Available)**
- **What**: Generates emails using common corporate patterns
- **Examples**: `careers@company.com`, `jobs@company.com`, `hr@company.com`
- **No API required**: Works offline with intelligent domain mapping

## ⚙️ **Setup Instructions**

### **Method 1: Full Setup (Real + Pattern Emails)**

1. **Get Snov.io API Key**:
   ```bash
   # 1. Sign up at https://snov.io/sign-up
   # 2. Go to Settings → API → Create API Key
   # 3. Copy the key
   ```

2. **Get Abstract API Key**:
   ```bash
   # 1. Sign up at https://app.abstractapi.com/api/email-validation
   # 2. Copy your API key from dashboard
   ```

3. **Update .env file**:
   ```bash
   # Add to backend/.env
   SNOVIO_API_KEY=your_snov_io_api_key_here
   ABSTRACT_API_KEY=your_abstract_api_key_here
   ```

4. **Restart server**:
   ```bash
   cd backend
   node server.js
   ```

### **Method 2: Pattern-Only Mode (No APIs Required)**

The system works perfectly without any API keys! It will generate intelligent email patterns:

```bash
# Just start the server - no API keys needed
cd backend
node server.js

# You'll see:
# 📬 Email finder: ✅ Ready (Pattern + Pattern-only)
# ✉️ Email verification: ⚠️ Pattern-only mode
```

## 🧪 **Testing the System**

### **Test Email Finding**:
```bash
# Find emails for any company
curl -X POST http://localhost:5000/find-emails \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Rapido",
    "role": "recruiter",
    "maxResults": 10
  }'
```

### **Expected Response**:
```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "email": "careers@rapido.com",
        "name": "Rapido Careers Team",
        "title": "Careers Manager",
        "department": "Human Resources",
        "source": "pattern-generation",
        "confidence": 0.9,
        "verified": false
      }
    ],
    "count": 10,
    "sources": ["pattern-generation"],
    "verified_count": 0
  },
  "meta": {
    "company": "Rapido",
    "role": "recruiter",
    "snovio_reason": "api_not_configured"
  }
}
```

## 🔄 **System Behavior**

### **With Full API Setup**:
```
[Hybrid Email Finder] Searching for: Google
[Snov.io] Searching domain: google.com
[Snov.io] Found 4 emails for Google
[Hybrid] Snov.io provided 4 emails
[Hybrid] Generated 6 pattern emails  
[Email Verifier] Verifying top 5 emails
[Hybrid] Returning 10 emails from sources: snovio, pattern-generation
[Hybrid] Verified emails: 3
```

### **Pattern-Only Mode**:
```
[Hybrid Email Finder] Searching for: Microsoft
[Snov.io] API not configured, skipping
[Hybrid] Snov.io unavailable: api_not_configured
[Hybrid] Generated 10 pattern emails
[Hybrid] Returning 10 emails from sources: pattern-generation
```

### **After Quota Exhausted**:
```
[Hybrid Email Finder] Searching for: Apple
[Snov.io] Quota exceeded
[Hybrid] Snov.io unavailable: quota_exceeded
[Hybrid] Generated 10 pattern emails
[Hybrid] Returning 10 emails from sources: pattern-generation
```

## 📊 **Email Sources**

### **Real Emails (Snov.io)**:
- ✅ Verified company employees
- ✅ Real names and titles
- ✅ LinkedIn profiles included
- ✅ High deliverability
- ❌ Limited to 50/month

### **Pattern Emails**:
- ✅ Unlimited generation
- ✅ Based on real corporate patterns
- ✅ Department-specific targeting
- ✅ Smart domain mapping
- ⚠️ Not verified (but often real)

## 🎯 **Supported Roles**

- `recruiter` → careers@, jobs@, hiring@, hr@
- `sales` → sales@, business@, partnerships@
- `engineering` → tech@, engineering@, dev@
- `product` → product@, pm@
- `marketing` → marketing@, growth@, brand@
- `general` → contact@, info@, hello@

## 🏢 **Smart Domain Mapping**

The system includes intelligent domain mapping for major companies:

```javascript
// Examples:
'google' → 'google.com'
'microsoft' → 'microsoft.com'
'rapido' → 'rapido.bike'
'swiggy' → 'swiggy.com'
'meta' → 'meta.com'
'facebook' → 'meta.com'
```

## 🔧 **Advanced Configuration**

```javascript
// Custom email finding with options
const result = await findEmailsWithHybrid('TechCorp', 'engineering', {
  maxResults: 15,
  useCache: true,
  verifyEmails: true
});
```

## 📈 **API Endpoint**

### **POST /find-emails**

**Request**:
```json
{
  "company": "CompanyName",
  "role": "recruiter|sales|engineering|product|marketing|general",
  "maxResults": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "emails": [...],
    "count": 10,
    "sources": ["snovio", "pattern-generation"],
    "cached": false,
    "verified_count": 3
  },
  "meta": {
    "company": "CompanyName",
    "role": "recruiter",
    "snovio_reason": null
  }
}
```

## 💡 **Pro Tips**

1. **Start with pattern-only**: No setup required, works immediately
2. **Add Snov.io gradually**: Get 50 real emails when you need them
3. **Use verification**: Abstract API improves email quality
4. **Role targeting**: Use specific roles for better email patterns
5. **Caching**: Results cached for 30 days to save API credits

---

**Questions?** The system provides detailed logs showing exactly what's happening with each email search!