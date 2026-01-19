import { useState } from "react";
import { supabase } from "../supabaseClient";
import { API_BASE } from "../apiConfig";

const logEvent = async (event_type: string, data?: any) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch(`${API_BASE}/api/analytics/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event_type, ...data }),
    });
  } catch {}
};

const saveEmailToDatabase = async (emailData: { emailBody: string; company: string; domain: string; purpose: string; tone: string; }) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const response = await fetch(`${API_BASE}/api/emails/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(emailData),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to save email');
  return data;
};

const inferRole = (email: string): string => {
  const e = email.toLowerCase();
  if (e.includes('hr') || e.includes('recruit') || e.includes('talent') || e.includes('careers')) return 'HR Manager';
  if (e.includes('product') || e.includes('pm')) return 'Product Lead';
  if (e.includes('partner') || e.includes('bizdev') || e.includes('alliances')) return 'Partnerships Manager';
  if (e.includes('marketing') || e.includes('growth') || e.includes('brand')) return 'Marketing Lead';
  if (e.includes('engineering') || e.includes('cto') || e.includes('dev') || e.includes('tech')) return 'Tech Lead';
  if (e.includes('sales') || e.includes('business')) return 'Sales Manager';
  return 'General Contact';
};

const getConfidenceBadge = (confidenceLevel: string | number) => {
  const lvl = String(confidenceLevel || '').toLowerCase();
  if (lvl === 'high') return { text: 'High', className: 'bg-green-100 text-green-800' };
  if (lvl === 'medium') return { text: 'Medium', className: 'bg-yellow-100 text-yellow-800' };
  return { text: 'Low', className: 'bg-gray-100 text-gray-800' };
};

export default function Generate() {
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [activeDomain, setActiveDomainState] = useState<string | null>(null);
  const [domainSuggestions, setDomainSuggestions] = useState<Array<{domain:string; probability:number; explanation:string}>>([]);
  const [isSuggestingDomain, setIsSuggestingDomain] = useState(false);
  const [location, setLocation] = useState("");
  const [tone, setTone] = useState("Formal");
  const [purpose, setPurpose] = useState("job");
  const [comments, setComments] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [editableEmailBody, setEditableEmailBody] = useState<string>("");
  const [experienceSuggestion, setExperienceSuggestion] = useState<string>("");
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState<boolean>(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [decisionMakers, setDecisionMakers] = useState<any[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);
  const [showConfirmButtons, setShowConfirmButtons] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const fetchDomainSuggestions = async () => {
    if (!company) { alert('Please enter a company name first'); return; }
    setIsSuggestingDomain(true);
    setDomainSuggestions([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(`${API_BASE}/domains/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ company, location })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to suggest domains');
      setDomainSuggestions(data.data || []);
    } catch (err: any) {
      alert(err.message || 'Failed to suggest domains');
    } finally {
      setIsSuggestingDomain(false);
    }
  };

  const isValidDomain = (v: string) => {
    const d = (v || '').trim().toLowerCase();
    return !!d && d.includes('.') && !d.includes(' ') && /^[a-z0-9.-]+$/.test(d);
  };

  const autoGenerateEmail = async () => {
    if (!role || !company || !location) return;
    if (!activeDomain) return;
    setIsLoading(true); setResult(null); setEmailSaved(false); setShowConfirmButtons(false);
    try {
      const formData = new FormData();
      if (resume) formData.append("resume", resume);
      formData.append("role", role); formData.append("company", company); formData.append("location", location); formData.append("tone", tone); formData.append("purpose", purpose);
      if (comments && comments.trim().length > 0) formData.append("comments", comments.trim());
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${API_BASE}/generate-email`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json(); setResult(data); setEditableEmailBody(String(data.emailBody || '')); setShowConfirmButtons(true); logEvent('generate_email', { tone, purpose, company, result: 'success' });
    } catch {
    } finally { setIsLoading(false); }
  };

  const setActiveDomain = async (d: string) => {
    const nd = (d || '').trim().toLowerCase();
    if (!isValidDomain(nd)) return;
    setDomain(nd);
    setActiveDomainState(nd);
    setDomainSuggestions([]);
    setResult(null);
    setEmailSaved(false);
    setShowConfirmButtons(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch(`${API_BASE}/domains/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ domain: nd, replace: true })
      });
    } catch {}
    await autoGenerateEmail();
  };

  const openGmail = (to: string, subject: string, body: string) => {
    logEvent('compose_click');
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || "")}&su=${encodeURIComponent(subject || "Exciting Opportunity")}&body=${encodeURIComponent(body || "")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const showToastNotification = (message: string) => { setToastMessage(message); setShowToast(true); setTimeout(() => setShowToast(false), 3000); };

  const handleEmailSent = async () => {
    if (!(editableEmailBody && editableEmailBody.trim().length > 0) || !company) { showToastNotification("Error: Missing email data"); return; }
    setIsSavingEmail(true);
    try {
      const d = (activeDomain || '').trim().toLowerCase();
      if (!d) { showToastNotification('Please confirm a domain before saving'); setIsSavingEmail(false); return; }
      await saveEmailToDatabase({ emailBody: editableEmailBody, company, domain: d, purpose, tone });
      setEmailSaved(true); setShowConfirmButtons(false); showToastNotification("Email saved to dashboard!");
      logEvent('email_sent', { company, tone, purpose });
    } catch (error: any) { console.error('Failed to save email:', error); showToastNotification("Failed to save email. Please try again."); } finally { setIsSavingEmail(false); }
  };

  const handleDidntSend = () => { setShowConfirmButtons(false); logEvent('email_not_sent', { company, tone, purpose }); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowed.includes(file.type)) setResume(file); else { alert('Please select a PDF, DOC, or DOCX file'); e.target.value = ''; }
    }
  };

  const findDecisionMakers = async () => {
    if (!company) { alert('Please enter a company name first'); return; }
    const chosenDomain = (activeDomain || domain || '').trim().toLowerCase();
    if (!chosenDomain) { setContactError('Domain not confirmed. Please confirm a domain first.'); return; }
    setIsLoadingContacts(true); setContactError(null); setDecisionMakers([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${API_BASE}/find-decision-makers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ company, domain: chosenDomain, location: location || 'India', role: role || 'any', seniority: ['manager','director','vp','senior'], maxResults: 10 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
      if (data.success && data.data) setDecisionMakers(data.data.contacts || []);
      else throw new Error(data.error || 'Failed to find suggested contact inboxes');
    } catch (error: any) { console.error('Error finding suggested inboxes:', error); setContactError(error.message || 'Failed to find suggested contact inboxes. Please try again.'); }
    finally { setIsLoadingContacts(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !company || !location) { alert('Please fill in all required fields'); return; }
    if (!activeDomain) { alert('Please select a domain (Use) before generating email'); return; }
    setIsLoading(true); setResult(null); setEmailSaved(false); setShowConfirmButtons(false);
    try {
      const formData = new FormData();
      if (resume) formData.append("resume", resume);
      formData.append("role", role); formData.append("company", company); formData.append("location", location); formData.append("tone", tone); formData.append("purpose", purpose);
      if (comments && comments.trim().length > 0) formData.append("comments", comments.trim());
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${API_BASE}/generate-email`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json(); setResult(data); setEditableEmailBody(String(data.emailBody || '')); setShowConfirmButtons(true); logEvent('generate_email', { tone, purpose, company, result: 'success' });
    } catch (error) { console.error('Error generating email:', error); alert('Failed to generate email. Please check if the backend is running.'); }
    finally { setIsLoading(false); }
  };

  const fetchExperienceSuggestion = async () => {
    try {
      setIsLoadingSuggestion(true);
      const formData = new FormData();
      if (resume) formData.append('resume', resume);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(`${API_BASE}/experience-suggestion`, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      const data = await resp.json();
      setExperienceSuggestion(String(data?.suggestion || ''));
    } catch (err) {
      setExperienceSuggestion('');
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const insertSuggestionIntoEmail = () => {
    if (!experienceSuggestion) return;
    const placeholder = '[Optional: add 1 line about a relevant project or past experience]';
    const body = editableEmailBody || '';
    if (body.includes(placeholder)) {
      setEditableEmailBody(body.replace(placeholder, experienceSuggestion));
    } else {
      // Insert before the "I have attached my resume" line or before signature
      const beforeAttach = body.indexOf('I have attached my resume');
      if (beforeAttach !== -1) {
        const head = body.slice(0, beforeAttach).replace(/\n+$/, '');
        const tail = body.slice(beforeAttach);
        setEditableEmailBody(`${head}\n\n${experienceSuggestion}\n\n${tail}`);
      } else {
        setEditableEmailBody(`${body.trimEnd()}\n\n${experienceSuggestion}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary-50 to-primary-100 flex items-center justify-center py-12">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-4xl mx-6 border border-gray-100">
        <div className="text-center mb-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1"></div>
            <h1 className="text-4xl font-bold text-gradient flex-1">Generate Your Perfect Email</h1>
            <div className="flex-1 flex justify-end">
              <button onClick={() => window.location.href = '/dashboard'} className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors">📊 View Dashboard</button>
            </div>
          </div>
          <div className="w-20 h-1 bg-gradient-to-r from-primary-600 to-primary-800 mx-auto rounded-full"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose *</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" required>
              <option value="job">Job</option>
              <option value="internship">Internship</option>
              <option value="client">Client</option>
              <option value="feedback">Feedback</option>
              <option value="networking">Networking</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose your Domain *</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" placeholder="e.g., Software Engineer, Marketing Manager" required />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose your Company *</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" placeholder="e.g., Google, Microsoft, Startup Inc." required />
            <div className="mt-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company Domain *</label>
              <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} onBlur={(e) => setActiveDomain(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" placeholder="e.g., microsoft.com" aria-required={false} />
              <p className="text-xs text-gray-500 mt-1">Optional: If left blank, we will suggest likely domains. Manual input is treated as immutable.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={fetchDomainSuggestions} disabled={isSuggestingDomain || !company} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50">{isSuggestingDomain ? 'Suggesting…' : 'Suggest Domains'}</button>
                {activeDomain && (<span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">Active: {activeDomain}</span>)}
              </div>
              {domainSuggestions.length > 0 && (
                <div className="mt-3 bg-white border rounded p-3">
                  <div className="text-sm font-semibold mb-2">Suggested Domains (not verified):</div>
                  <ul className="space-y-2">
                    {domainSuggestions.map((s, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-mono text-sm">{s.domain}</div>
                          <div className="text-xs text-gray-600">Probability: {s.probability}% • {s.explanation}</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200" onClick={() => setActiveDomain(s.domain)}>Use</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button type="button" onClick={findDecisionMakers} disabled={isLoadingContacts || !company} className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
              {isLoadingContacts ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Finding Decision Makers...</>) : (<>🎯 Find Decision Makers</>)}
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose your Location *</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" placeholder="e.g., San Francisco, New York, Remote" required />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose Email Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200">
              <option value="Formal">Formal</option>
              <option value="Friendly">Friendly</option>
              <option value="Bold">Bold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Resume (Optional)</label>
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
            {resume && (<p className="text-sm text-primary-600 mt-2 font-medium">✓ {resume.name} selected</p>)}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Extra Comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 h-28 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" placeholder="Any additional information or specific requests..." />
          </div>

          <button type="submit" disabled={isLoading} className="w-full btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
            {isLoading ? (<span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Generating...</span>) : ('Generate Email')}
          </button>
        </form>

        {result && (
          <div className="mt-10 p-8 bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl border border-primary-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Your Generated Email</h2>
            <div className="space-y-6">
              {Array.isArray(result.subjectSuggestions) && result.subjectSuggestions.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-primary-200">
                  <span className="text-sm font-semibold text-primary-700">Subject Suggestions:</span>
                  <ul className="mt-3 space-y-2">
                    {result.subjectSuggestions.map((subj: string, idx: number) => (
                      <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="text-gray-900 font-medium">{subj}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigator.clipboard.writeText(subj)} className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors">Copy</button>
                          <button onClick={() => openGmail("", subj, editableEmailBody || "")} className="ml-2 inline-flex items-center px-3 py-1.5 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">Compose in Gmail</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-white p-6 rounded-lg border border-primary-200">
                <span className="text-sm font-semibold text-primary-700">Email Body (editable):</span>
                <textarea
                  className="mt-3 w-full border rounded p-3 leading-relaxed min-h-[220px]"
                  value={editableEmailBody}
                  onChange={(e) => setEditableEmailBody(e.target.value)}
                />
              </div>

              <div className="bg-white p-4 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Suggested (from resume)</span>
                  <div className="flex gap-2">
                    <button onClick={fetchExperienceSuggestion} disabled={isLoadingSuggestion} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium disabled:opacity-50">{isLoadingSuggestion ? 'Generating…' : (experienceSuggestion ? 'Regenerate' : 'Generate')}</button>
                    <button onClick={insertSuggestionIntoEmail} disabled={!experienceSuggestion} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium disabled:bg-gray-300">Insert</button>
                  </div>
                </div>
                {experienceSuggestion ? (
                  <p className="mt-2 text-sm text-gray-900">{experienceSuggestion}</p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">No suggestion yet. Generate to see a one-line option you can insert.</p>
                )}
              </div>
              {showConfirmButtons && !emailSaved && (
                <div className="bg-white p-4 rounded-lg border border-primary-200">
                  <span className="text-sm font-semibold text-primary-700">Did you send this email?</span>
                  <div className="mt-3 flex gap-3">
                    <button onClick={handleEmailSent} disabled={isSavingEmail} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2">{isSavingEmail ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Saving...</>) : (<>✅ I sent this email</>)}</button>
                    <button onClick={handleDidntSend} disabled={isSavingEmail} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">❌ Didn't send</button>
                  </div>
                </div>
              )}
              {emailSaved && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-center gap-2 text-green-700"><span className="text-lg">✅</span><span className="text-sm font-semibold">Email saved to dashboard!</span><button onClick={() => window.location.href = '/dashboard'} className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">View Dashboard</button></div>
                </div>
              )}
              {result.newsSummary && result.newsSummary.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold mb-2">Recent Company News</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">{result.newsSummary.map((news: string, idx: number) => (<li key={idx}>{news}</li>))}</ul>
                </div>
              )}
            </div>
          </div>
        )}

        {(decisionMakers.length > 0 || contactError) && (
          <div className="mt-10 p-8 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center gap-2">🎯 Suggested contact inboxes at {company}</h2>
            {contactError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
                <div className="font-semibold">Error finding contacts:</div>
                <div className="mt-1">{contactError}</div>
              </div>
            )}
            {decisionMakers.length > 0 && (
              <div className="space-y-4">
                <div className="text-center text-sm text-gray-600 mb-4">Found {decisionMakers.length} inbox{decisionMakers.length !== 1 ? 'es' : ''}</div>
                {decisionMakers.map((contact, idx) => {
                  const inferredRole = inferRole(contact.email || '');
                  const confidenceBadge = getConfidenceBadge(contact.confidenceLevel || contact.confidence || 'Low');
                  return (
                    <div key={idx} className="bg-white p-6 rounded-lg border border-blue-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${confidenceBadge.className}`}>{confidenceBadge.text}</span>
                          </div>
                          <p className="text-gray-600">{contact.title || inferredRole} {contact.category ? `• ${contact.category}` : ''}</p>
                          <div className="text-sm text-gray-500">{contact.location && <span>{contact.location}</span>}</div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {contact.email && (
                            <button onClick={() => openGmail(contact.email, result?.subjectSuggestions?.[0] || "Exciting Opportunity", editableEmailBody || "")} className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">📧 Email</button>
                          )}
                          {contact.linkedin && (
                            <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-md bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">🔗 LinkedIn</a>
                          )}
                        </div>
                      </div>
                      {contact.email && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-semibold text-gray-600">Email:</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-mono text-gray-800">{contact.email}</span>
                            <button onClick={() => navigator.clipboard.writeText(contact.email)} className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors">Copy</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showToast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in"><span className="text-lg">✅</span><span className="font-medium">{toastMessage}</span></div>
      )}
    </div>
  );
}
 
