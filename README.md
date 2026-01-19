# ColdConnect 🚀

ColdConnect is an **end-to-end AI-powered cold email platform** designed to help users generate, send, and track cold emails for internships, jobs, and professional outreach.

Unlike typical college projects, ColdConnect focuses on **real-world usability, deployment, metrics, and product thinking**, showcasing how an idea can be shipped as a complete product.

---

## ✨ Key Features

### 🔐 Authentication & User Management

* Secure authentication using **Supabase Auth**
* Email-based signup, login, and **password reset via email**
* Production-ready auth flows with redirect handling

### ✉️ AI-Powered Email Generation

* Generate **professional cold emails** for:

  * Internships
  * Jobs
  * General outreach
* Uses **LLM-based prompting** (Groq API) for structured, consistent email output
* Locked, high-quality templates to ensure deliverability and professionalism

### 📊 Email Analytics Dashboard

* Track key metrics:

  * Total emails sent
  * Replies received
  * Reply rate
  * Bounce rate
  * Most used tone and purpose
* Visual dashboard with charts and summaries
* Recent emails table with manual status updates (Sent / Replied / Bounced)

### 🌐 Fully Deployed Architecture

* **Frontend**: Vite + React, deployed on **Vercel**
* **Backend**: Node.js + Express, deployed on **Render**
* **Database & Auth**: Supabase
* Environment-based configuration (dev vs prod)

### 🔒 Production-Grade Configuration

* Environment variables for all secrets (API keys, URLs)
* CORS configured for secure frontend-backend communication
* SMTP-based email delivery via Supabase (supports custom providers like Resend)

---

## 🧠 Why ColdConnect?

ColdConnect was built to go beyond a "demo project" and instead demonstrate:

* How **real SaaS products** are structured
* Debugging real production issues (CORS, env vars, email delivery)
* Shipping features that involve **UX, backend logic, infra, and metrics**

This project reflects both **engineering execution** and **product mindset**.

---

## 🛠️ Tech Stack

**Frontend**

* React (Vite)
* TypeScript
* Tailwind CSS
* Chart.js

**Backend**

* Node.js
* Express
* REST APIs

**Auth & Database**

* Supabase (Auth + Database)

**AI & External Services**

* Groq API (LLM-based email generation)
* SMTP email delivery (Supabase / Resend)

**Deployment**

* Frontend: Vercel
* Backend: Render

---

## ⚙️ Environment Setup

### Frontend (Vite)

```bash
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend

```bash
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_key
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

---

## 🚀 Running Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm start
```

---

## 📈 Metrics & Impact

ColdConnect includes a **real analytics layer** to demonstrate product impact:

* Tracks user actions
* Calculates reply and bounce rates
* Designed to scale with real usage

Metrics shown in the dashboard can be generated through real usage or controlled testing, making the project suitable for **resume and portfolio demonstration**.

---

## 📌 What This Project Demonstrates

* Full-stack development (frontend + backend)
* Authentication and email systems
* Environment-based deployments
* Debugging real production issues
* Product-focused feature design

---

## 🔮 Future Improvements

* Automated email sending & scheduling
* A/B testing for email templates
* Team inbox support
* CRM-style contact management
* Advanced analytics & exportable reports

---

## 👤 Author

**Shravya Azmani**
BTech Computer Science (3rd Year)

This project was built as a practical demonstration of shipping a real-world SaaS-style product, not just a college assignment.

---

⭐ If you find this project interesting, feel free to star the repo!

