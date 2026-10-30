import React, { useState, useEffect, useRef } from 'react';
import { User, ArrowUp, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles, Copy, Check, Download, UserPlus, X } from 'lucide-react';
import FormattedOutput from './FormattedOutput';
import { useMsal } from '@azure/msal-react';
import { loginRequest, clearStuckInteraction } from './msalAuth';
import './App.css';

const DEFAULT_SYSTEM_INSTRUCTIONS = `You are an Azure AI Text Analysis Agent specializing in Data Privacy, PII Redaction, Named Entity Recognition (NER), and Sentiment Intelligence. Follow the exact output format below based on the requested function:

1. PII REDACTION (Redact PII)
- Replace every piece of Personally Identifiable Information in the input text using ONLY these standardized bracketed tags:
  [Person], [Phone Number], [Email], [Address], [SSN], [Credit Card Number], [Account Number], [Date], [Organization], [Location], [IP Address], [URL], [Password], [Passport Number]
- Output Structure:
  Redacted Text:
  (Full original text with sensitive values replaced inline by the bracketed tags above)

  Redaction Summary:
  - Total Redactions: (Total count of redacted items)
  - Categories Detected: (Comma-separated list of bracketed tags used)

2. SENTIMENT ANALYSIS (Analyze Sentiment)
- Evaluate emotional tone, polarity, and key drivers.
- Output Structure:
  Overall Sentiment: (POSITIVE, NEGATIVE, NEUTRAL, or MIXED)

  Confidence Scores:
  - Positive: (0-100)%
  - Neutral: (0-100)%
  - Negative: (0-100)%

  Assessment:
  (1-2 sentence executive summary of the overall tone)

  Key Drivers:
  - Positive Drivers: (Key phrases or points driving positive sentiment, or None)
  - Negative Drivers: (Key phrases or points driving negative sentiment, or None)

3. ENTITY EXTRACTION (Extract Entities)
- Identify and group all named entities into structured categories.
- Output Structure:
  People & Identifiers:
  - Name / Role: (Details)

  Organizations & Brands:
  - Organization: (Context or Contact)

  Locations & Addresses:
  - Location: (Address, Airport, or City)

  Dates, Numbers & Reference Codes:
  - Type: (Flight Number, Confirmation Code, Account Number, or Date)`;

const SAMPLE_TEXTS = {
  pii: "My name is Sarah Miller, my phone number is 555-0199, and I live at 123 Main St, New York. Please reach out to me regarding account 4111-2222-3333-4444.",
  entities: "From: Delta Air Lines (delta-notifications@delta.com) | Passenger Alexander 'Alex' Vance booked flight DL1234 from Los Angeles (LAX) to New York (JFK) on Seat 12A. Confirmation #HJK992. Billing address: 4500 Wilshire Blvd, Los Angeles, CA 90010.",
  sentiment: "I was absolutely thrilled with how fast the order arrived at my doorstep by Wednesday! However, the customer support representative was very rude and hung up on me when I asked for a return label.",
  custom: "Client Marcus Reed (marcus.reed@acme.io, 555-0148) requested an urgent contract renewal for Acme Corp by Friday. While he praised the platform's uptime, he expressed concern about the 15% pricing tier increase."
};

const SAMPLE_OUTPUTS = {
  redact: `### Redacted Text
My name is [Person], my phone number is [Phone Number], and I live at [Address]. Please reach out to me regarding account [Credit Card Number].

### Redaction Summary
- **Total Redactions**: 4
- **Categories Detected**: [Person], [Phone Number], [Address], [Credit Card Number]`,

  entities: `### People & Identifiers
- **Passenger**: Alexander 'Alex' Vance

### Organizations & Brands
- **Delta Air Lines**: Airline carrier (\`delta-notifications@delta.com\`)

### Locations & Addresses
- **Departure**: Los Angeles (LAX)
- **Destination**: New York (JFK)
- **Billing Address**: 4500 Wilshire Blvd, Los Angeles, CA 90010

### Dates, Numbers & Reference Codes
- **Flight Number**: DL1234
- **Seat Assignment**: Seat 12A
- **Confirmation Code**: #HJK992`,

  sentiment: `### Overall Sentiment: MIXED

### Confidence Scores
- Positive: 48%
- Neutral: 4%
- Negative: 48%

### Assessment
The review expresses strong satisfaction with delivery speed but severe frustration with customer support behavior, resulting in a polarized mixed sentiment.

### Key Drivers
- **Positive Drivers**: Thrilled with fast delivery arriving by Wednesday
- **Negative Drivers**: Customer support representative was rude and hung up during a return label inquiry`,

  custom: `### Executive Summary (PII Redacted)
- **Renewal Request**: Client [Person] ([Email], [Phone Number]) requested an urgent contract renewal for [Organization] by [Date].
- **Positive Feedback**: Praised the platform's strong reliability and uptime.
- **Key Risk / Action Item**: Expressed concern over the 15% pricing tier increase; requires account manager follow-up.`
};

const SAMPLE_CHAT_REPLIES = {
  "Redact all personal information from: John Doe, phone 555-0192, SSN 123-45-6789, living in Seattle.": `### Redacted Text
[Person], phone [Phone Number], SSN [SSN], living in [Location].

### Redaction Summary
- **Total Redactions**: 4
- **Categories Detected**: [Person], [Phone Number], [SSN], [Location]`,

  "Analyze the sentiment of: I loved the speed of delivery, but the customer support representative was very rude.": `### Overall Sentiment: MIXED

### Confidence Scores
- Positive: 50%
- Neutral: 2%
- Negative: 48%

### Assessment
The customer praises logistics performance while criticizing support interaction quality.`,

  "Extract passenger, flight, and seat info from: Passenger Mary Lane flying UA402 to Chicago on Seat 14B.": `### People & Identifiers
- **Passenger**: Mary Lane

### Locations & Addresses
- **Destination**: Chicago

### Dates, Numbers & Reference Codes
- **Flight Number**: UA402
- **Seat Assignment**: Seat 14B`
};

export default function App() {
  // Navigation & View ('chat' is default matching studio layout)
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedTask, setSelectedTask] = useState('redact');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Authentication State (genuine MSAL)
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0] || null;
  const isSignedIn = !!activeAccount;
  const userProfile = {
    name: activeAccount?.name || '',
    email: activeAccount?.username || '',
    tenantId: activeAccount?.tenantId || '',
  };
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showAuthInfo, setShowAuthInfo] = useState(false);

  // Target Settings (Not prefilled by default)
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [agentName, setAgentName] = useState('');

  // Additional Settings & System Instructions State
  const [showAdditionalSettings, setShowAdditionalSettings] = useState(false);
  const [showSystemInstructionsEditor, setShowSystemInstructionsEditor] = useState(false);
  const [systemInstructions, setSystemInstructions] = useState(() => {
    const saved = localStorage.getItem('agent_system_instructions');
    if (!saved || saved.includes('<Full original text') || saved.includes('1. PII Redaction:\nReplace all')) {
      return DEFAULT_SYSTEM_INSTRUCTIONS;
    }
    return saved;
  });
  const [instructionsSaved, setInstructionsSaved] = useState(false);

  // Studio Tab 1 state
  const [inputText, setInputText] = useState(SAMPLE_TEXTS.pii);
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLatency, setAnalysisLatency] = useState(null);
  const [isSampleResult, setIsSampleResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat Tab 2 state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  const API_BASE = window.location.port === '8000' ? '' : 'http://127.0.0.1:8000';

  const safeFetchJson = async (endpointPath, options = {}) => {
    const res = await fetch(`${API_BASE}${endpointPath}`, options);
    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { detail: rawText || `Server responded with status ${res.status}` };
    }
    return { ok: res.ok, status: res.status, data };
  };

  // Acquire the signed-in user's MSAL token silently (never triggers a second login redirect)
  const getAuthHeaders = async () => {
    if (!activeAccount) throw new Error('Not signed in. Please sign in with Microsoft first.');
    let token = activeAccount.idToken || '';
    try {
      const result = await instance.acquireTokenSilent({
        scopes: loginRequest.scopes,
        account: activeAccount,
      });
      token = result.idToken || result.accessToken || token;
    } catch {
      if (!token) {
        throw new Error('Your Microsoft session expired. Please click Sign in with Microsoft again.');
      }
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Genuine Microsoft Entra ID sign-in via MSAL redirect (same tab, no popup window)
  const handleMicrosoftSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setIsSigningIn(false);
      setAuthError(err?.message || 'Microsoft sign-in failed.');
    }
  };

  // Save Target Configuration (stays Connected until inputs change or session clears)
  const [configSaved, setConfigSaved] = useState(false);
  const handleSaveTargetConfig = async () => {
    try {
      await safeFetchJson('/api/config/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, model, agent_name: agentName })
      });
    } catch {
      // ignore
    }
    setConfigSaved(true);
  };

  // Sign Out Handler (clears local and backend state, then MSAL logoutRedirect in the same tab)
  const handleSignOut = async () => {
    const account = activeAccount;
    await handleClearCacheAndSession();
    try {
      await instance.logoutRedirect({
        account,
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (err) {
      setAuthError(err?.message || 'Sign out failed.');
    }
  };

  // Clear Cache & Session Handler
  const [cacheCleared, setCacheCleared] = useState(false);
  const handleClearCacheAndSession = async () => {
    try {
      instance.setActiveAccount(null);
      clearStuckInteraction();
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      // ignore storage errors
    }
    try {
      await safeFetchJson('/api/session/clear', { method: 'POST' });
    } catch {
      // ignore backend clear errors
    }
    setAuthError(null);
    setIsSigningIn(false);
    setShowAuthInfo(false);
    setConfigSaved(false);
    setEndpoint('');
    setModel('');
    setAgentName('');
    setAnalysisResult('');
    setAnalysisLatency(null);
    setChatMessages([]);
    setChatInput('');
    setSystemInstructions(DEFAULT_SYSTEM_INSTRUCTIONS);
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  // Save System Instructions
  const handleSaveSystemInstructions = async () => {
    const cleaned = systemInstructions.trim() || DEFAULT_SYSTEM_INSTRUCTIONS;
    setSystemInstructions(cleaned);
    try {
      localStorage.setItem('agent_system_instructions', cleaned);
    } catch {
      // ignore storage errors
    }
    try {
      await safeFetchJson('/api/config/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: cleaned }),
      });
    } catch {
      // ignore
    }
    setInstructionsSaved(true);
    setTimeout(() => setInstructionsSaved(false), 2000);
  };

  const handleResetSystemInstructions = async () => {
    setSystemInstructions(DEFAULT_SYSTEM_INSTRUCTIONS);
    try {
      localStorage.removeItem('agent_system_instructions');
    } catch {
      // ignore
    }
    try {
      await safeFetchJson('/api/config/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: DEFAULT_SYSTEM_INSTRUCTIONS }),
      });
    } catch {
      // ignore
    }
  };

  // Helper to check if current input is one of the built-in sample tasks
  const getBuiltInSampleResult = (textVal, taskVal) => {
    if (taskVal === 'custom') return null;
    const trimmed = (textVal || '').trim();
    if (trimmed === SAMPLE_TEXTS.pii.trim() && taskVal === 'redact') return SAMPLE_OUTPUTS.redact;
    if (trimmed === SAMPLE_TEXTS.entities.trim() && taskVal === 'entities') return SAMPLE_OUTPUTS.entities;
    if (trimmed === SAMPLE_TEXTS.sentiment.trim() && taskVal === 'sentiment') return SAMPLE_OUTPUTS.sentiment;
    return null;
  };

  // Run a sample task directly from the sidebar without needing a model
  const handleRunSampleTask = (taskKey, sampleText) => {
    setActiveTab('agent');
    setSelectedTask(taskKey);
    setInputText(sampleText);
    setIsAnalyzing(true);
    setAnalysisResult('');
    setAnalysisLatency(null);
    setIsSampleResult(true);
    setTimeout(() => {
      setAnalysisResult(SAMPLE_OUTPUTS[taskKey] || SAMPLE_OUTPUTS.redact);
      setAnalysisLatency(0.38);
      setIsAnalyzing(false);
    }, 220);
  };

  // Execute Analysis (Tab 1)
  const handleRunAnalysis = async () => {
    if (!inputText.trim() || isAnalyzing) return;
    if (selectedTask === 'custom' && !customPrompt.trim()) {
      setAnalysisResult('**Custom Prompt Required:** Please enter an instruction in the **Custom Instruction / Prompt** field above before running analysis.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult('');
    setAnalysisLatency(null);
    setIsSampleResult(false);

    // Built-in sample tasks run without requiring a configured model
    const sampleMatch = getBuiltInSampleResult(inputText, selectedTask);
    if (sampleMatch) {
      setIsSampleResult(true);
      setTimeout(() => {
        setAnalysisResult(sampleMatch);
        setAnalysisLatency(0.38);
        setIsAnalyzing(false);
      }, 220);
      return;
    }

    const startTime = performance.now();
    try {
      let ok = false;
      let data = {};

      if (selectedTask === 'custom') {
        const customMessages = [];
        if (systemInstructions.trim()) {
          customMessages.push({ role: 'system', content: systemInstructions.trim() });
        }
        customMessages.push({
          role: 'user',
          content: `${customPrompt.trim()}\n\nText to process:\n${inputText}`,
        });
        const chatRes = await safeFetchJson('/api/chat', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            messages: customMessages,
            system_instructions: systemInstructions,
          }),
        });
        ok = chatRes.ok;
        data = chatRes.ok
          ? { result: chatRes.data.reply, elapsed: Number(((performance.now() - startTime) / 1000).toFixed(2)) }
          : chatRes.data;
      } else {
        const analyzeRes = await safeFetchJson('/api/analyze', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            text: inputText,
            task: selectedTask,
            system_instructions: systemInstructions,
          }),
        });
        ok = analyzeRes.ok;
        data = analyzeRes.data;
      }

      if (!ok) {
        const rawErr = data.detail || 'Service call failed';
        const formattedErr =
          rawErr.includes('Please verify FOUNDRY_ENDPOINT') || rawErr.includes('not configured')
            ? 'Azure AI target is not configured.'
            : rawErr;
        setAnalysisResult(
          `**Error:** ${formattedErr}\n\n**Connect a Model to Continue:**\nPlease sign in with your authorized Microsoft account, enter your **Foundry Endpoint**, **Model Deployment**, and **Agent Name** in the sidebar under **Connected Azure Target**, and click **Connect** (or use **Agent Sample Tasks** in the sidebar to test with built-in sample data).`
        );
      } else {
        setAnalysisResult(data.result);
        setAnalysisLatency(data.elapsed);
      }
    } catch (err) {
      setAnalysisResult(
        `**Connection Error:** ${err.message}\n\n**Connect a Model to Continue:**\nPlease ensure the backend server is running and connect your **Foundry Endpoint**, **Model Deployment**, and **Agent Name** in the sidebar under **Connected Azure Target**.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send Chat Turn (Tab 2)
  const handleSendMessage = async (textToSend) => {
    const prompt = (textToSend || chatInput).trim();
    if (!prompt || isChatLoading) return;

    const newHistory = [...chatMessages, { role: 'user', content: prompt }];
    setChatMessages(newHistory);
    if (!textToSend) setChatInput('');
    setIsChatLoading(true);

    // Built-in sample suggested queries run without requiring a configured model
    if (SAMPLE_CHAT_REPLIES[prompt]) {
      setTimeout(() => {
        setChatMessages([
          ...newHistory,
          { role: 'assistant', content: SAMPLE_CHAT_REPLIES[prompt], isSample: true },
        ]);
        setIsChatLoading(false);
      }, 240);
      return;
    }

    const payloadMessages = systemInstructions.trim()
      ? [{ role: 'system', content: systemInstructions.trim() }, ...newHistory]
      : newHistory;

    try {
      const { ok, data } = await safeFetchJson('/api/chat', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          messages: payloadMessages,
          system_instructions: systemInstructions,
        })
      });
      if (!ok) {
        const rawErr = data.detail || 'Failed to receive reply';
        const formattedErr =
          rawErr.includes('Please verify FOUNDRY_ENDPOINT') || rawErr.includes('not configured')
            ? 'Azure AI target is not configured.'
            : rawErr;
        setChatMessages([
          ...newHistory,
          {
            role: 'assistant',
            content: `**Error:** ${formattedErr}\n\n**Connect a Model to Continue:**\nPlease sign in with your authorized Microsoft account, enter your **Foundry Endpoint**, **Model Deployment**, and **Agent Name** in the sidebar under **Connected Azure Target**, and click **Connect** (or click any **Suggested Query** below to test with built-in sample data).`,
          },
        ]);
      } else {
        setChatMessages([...newHistory, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `**Connection Error:** ${err.message}\n\n**Connect a Model to Continue:**\nPlease ensure the backend server is running and connect your **Foundry Endpoint**, **Model Deployment**, and **Agent Name** in the sidebar under **Connected Azure Target** (or click any **Suggested Query** below to test with built-in sample data).`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyResult = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadResult = () => {
    if (!analysisResult) return;
    const blob = new Blob([analysisResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_output_${selectedTask}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;

  return (
    <div className="layout-root">
      {/* -----------------------------------------------------------------------
          SIDEBAR: Modern Elevated Studio Panel
          ----------------------------------------------------------------------- */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        {/* Toggle Collapse Button */}
        <div className="sidebar-top-bar">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Authentication & Access */}
        <div>
          <div className="sidebar-section-title">Authentication & Access</div>
          {isSignedIn ? (
            <div className="user-auth-card">
              <div className="auth-badge-label">
                <User size={13} strokeWidth={2.2} />
                <span>Signed In via Entra ID</span>
              </div>
              <div className="auth-user-name">{userProfile.name}</div>
              <div className="auth-user-email">{userProfile.email}</div>

              <button
                type="button"
                className="btn effect01"
                onClick={() => setShowAuthInfo((prev) => !prev)}
                style={{
                  marginTop: '10px',
                  height: '32px',
                  minHeight: '32px',
                  lineHeight: '32px',
                  fontSize: '0.72rem',
                }}
              >
                <span>
                  {showAuthInfo ? 'Hide Info' : 'Show Info'}
                  {showAuthInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>

              {showAuthInfo && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #E2E8F0',
                    fontSize: '0.72rem',
                    color: '#000000',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    lineHeight: '1.4',
                  }}
                >
                  <div>
                    <span style={{ color: '#555555', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.66rem', display: 'block' }}>
                      Status
                    </span>
                    <span style={{ fontWeight: '600' }}>Connected to Azure account</span>
                  </div>
                  <div>
                    <span style={{ color: '#555555', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.66rem', display: 'block' }}>
                      Tenant ID
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.68rem',
                        wordBreak: 'break-all',
                        display: 'block',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        padding: '4px 6px',
                        marginTop: '2px',
                      }}
                    >
                      {userProfile.tenantId && userProfile.tenantId !== 'common'
                        ? userProfile.tenantId
                        : 'Microsoft Account (Consumer / Common)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-signin-box">
              <p className="auth-signin-subtext">
                Sign in with Microsoft Entra ID to authenticate against your Azure subscription and connect your AI Foundry agents.
              </p>

              <div
                style={{
                  padding: '8px 10px',
                  background: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#444444',
                  lineHeight: '1.4',
                }}
              >
                <strong style={{ color: '#000000', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>
                  Access Requirement
                </strong>
                Sign in with the Microsoft account that owns your Azure AI project, or enter that account's own <strong>Foundry Endpoint</strong>, <strong>Model</strong>, and <strong>Agent Name</strong> after signing in.
              </div>

              <button
                type="button"
                className="ms-signin-button"
                onClick={handleMicrosoftSignIn}
                disabled={isSigningIn}
              >
                <span className="ms-logo-grid">
                  <span className="ms-sq ms-red"></span>
                  <span className="ms-sq ms-green"></span>
                  <span className="ms-sq ms-blue"></span>
                  <span className="ms-sq ms-yellow"></span>
                </span>
                <span className="ms-btn-text">
                  {isSigningIn ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
                </span>
              </button>

              {authError && (
                <div className="auth-error-banner">
                  {authError}
                </div>
              )}

              <button
                type="button"
                className="btn effect01"
                onClick={handleClearCacheAndSession}
              >
                <span>{cacheCleared ? 'Cache & Session Cleared!' : 'Clear Cache & Session'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Connected Azure Target - ONLY DISPLAYED WHEN SIGNED IN */}
        {isSignedIn ? (
          <div>
            <div className="sidebar-section-title">Connected Azure Target</div>

            <div
              style={{
                marginBottom: '12px',
                padding: '8px 10px',
                background: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: '#444444',
                lineHeight: '1.4',
              }}
            >
              <strong style={{ color: '#000000', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>
                Access Requirement
              </strong>
              Sign in with the Microsoft account that owns your Azure AI project, or enter that account's own <strong>Foundry Endpoint</strong>, <strong>Model</strong>, and <strong>Agent Name</strong> below.
            </div>

            <div className="form-group">
              <div className="form-label">
                <span>Foundry Endpoint</span>
                <span className="form-label-dot"></span>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Enter Foundry Endpoint URL..."
                value={endpoint}
                onChange={(e) => {
                  setEndpoint(e.target.value);
                  setConfigSaved(false);
                }}
              />
            </div>

            <div className="form-group">
              <div className="form-label">
                <span>Model Deployment</span>
                <span className="form-label-dot"></span>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Enter Model Deployment (e.g. gpt-4.1)..."
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setConfigSaved(false);
                }}
              />
            </div>

            <div className="form-group">
              <div className="form-label">
                <span>Agent Name</span>
                <span className="form-label-dot"></span>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Enter Agent Name..."
                value={agentName}
                onChange={(e) => {
                  setAgentName(e.target.value);
                  setConfigSaved(false);
                }}
              />
            </div>

            <button
              className="btn effect01"
              style={{ marginBottom: '8px' }}
              onClick={handleSaveTargetConfig}
            >
              <span>
                {configSaved ? (
                  <>
                    <Check size={13} />
                    Connected
                  </>
                ) : (
                  'Connect'
                )}
              </span>
            </button>

            <button
              className="btn effect01"
              style={{ marginBottom: '8px' }}
              onClick={handleSignOut}
            >
              <span>Sign Out & Disconnect</span>
            </button>

            <button
              className="btn effect01"
              style={{ marginBottom: '8px' }}
              onClick={handleClearCacheAndSession}
            >
              <span>{cacheCleared ? 'Cache & Session Cleared!' : 'Clear Cache & Session'}</span>
            </button>

            <div className="active-session-box">
              <span className="active-session-dot"></span>
              Active Session
            </div>
          </div>
        ) : (
          <div className="signin-prompt-card">
            <div className="signin-prompt-text">
              Target configuration fields will appear once signed in via Microsoft Entra ID.
            </div>
          </div>
        )}

        {/* Agent Sample Tasks */}
        <div>
          <div className="sidebar-section-title">Agent Sample Tasks</div>
          <div className="sample-tasks-group">
            <button
              className="btn effect01"
              onClick={() => handleRunSampleTask('redact', SAMPLE_TEXTS.pii)}
            >
              <span>Redact PII</span>
            </button>

            <button
              className="btn effect01"
              onClick={() => handleRunSampleTask('entities', SAMPLE_TEXTS.entities)}
            >
              <span>Extract Entities</span>
            </button>

            <button
              className="btn effect01"
              onClick={() => handleRunSampleTask('sentiment', SAMPLE_TEXTS.sentiment)}
            >
              <span>Analyze Sentiment</span>
            </button>

            <button
              className="btn effect01"
              onClick={() => {
                setInputText('');
                setAnalysisResult('');
                setChatMessages([]);
              }}
            >
              <span>Clear Workspace</span>
            </button>
          </div>
        </div>

        {/* Additional Settings */}
        <div>
          <div className="sidebar-section-title">Configuration</div>
          <button
            type="button"
            className="btn effect01"
            onClick={(e) => {
              const next = !showAdditionalSettings;
              setShowAdditionalSettings(next);
              if (next) {
                const container = e.currentTarget.parentElement;
                setTimeout(() => container?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
              }
            }}
          >
            <span>
              {showAdditionalSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Additional Settings
            </span>
          </button>

          {showAdditionalSettings && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn effect01"
                style={{ fontSize: '0.68rem', letterSpacing: '0.03em', padding: '8px 8px' }}
                onClick={(e) => {
                  const next = !showSystemInstructionsEditor;
                  setShowSystemInstructionsEditor(next);
                  if (next) {
                    const container = e.currentTarget.parentElement;
                    setTimeout(() => container?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
                  }
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>
                  {showSystemInstructionsEditor ? 'Hide System Instructions' : 'Modify System Instructions'}
                </span>
              </button>

              {showSystemInstructionsEditor && (
                <div
                  style={{
                    padding: '10px',
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div className="form-label" style={{ marginBottom: '2px' }}>
                    <span>System Instructions</span>
                    <span className="form-label-dot"></span>
                  </div>
                  <textarea
                    className="form-input"
                    style={{
                      minHeight: '115px',
                      height: 'auto',
                      resize: 'vertical',
                      lineHeight: '1.45',
                      fontSize: '0.76rem',
                      padding: '8px 10px',
                    }}
                    placeholder="Enter system instructions for the agent..."
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn effect01"
                    style={{ minHeight: '34px', fontSize: '0.72rem' }}
                    onClick={handleSaveSystemInstructions}
                  >
                    <span>{instructionsSaved ? 'Instructions Saved!' : 'Save Instructions'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn effect01"
                    style={{ minHeight: '34px', fontSize: '0.72rem' }}
                    onClick={handleResetSystemInstructions}
                  >
                    <span>Reset Default</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* -----------------------------------------------------------------------
          MAIN CONTENT AREA
          ----------------------------------------------------------------------- */}
      <main className="main-content">
        {/* Floating Expand Sidebar Button when collapsed */}
        {!sidebarOpen && (
          <button
            type="button"
            className="sidebar-expand-btn"
            onClick={() => setSidebarOpen(true)}
            title="Expand sidebar"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        )}

        {/* Top Header */}
        <div className="top-header">
          <div className="top-brand-tag-pill">
            <span className="top-brand-dot"></span>
            Powered by Azure AI Foundry Language Services
          </div>
          <h1 className="top-title">Text Analysis Agent</h1>
          <div className="top-subtitle">Data Privacy, PII Redaction, and Sentiment Intelligence.</div>
        </div>

        {/* 2 Main Navigation Tabs */}
        <div className="main-tab-bar">
          <button
            className={`tab-btn ${activeTab === 'agent' ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab('agent')}
          >
            Text Analysis Agent
          </button>
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab('chat')}
          >
            Text Analysis Chat Assistant
          </button>
        </div>

        {/* TAB 1: TEXT ANALYSIS AGENT */}
        {activeTab === 'agent' && (
          <div className="studio-columns">
            {/* Input Card */}
            <div className="studio-card">
              <div className="section-headline">Input Text</div>
              <div style={{ fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', marginBottom: '8px' }}>
                Select Analysis Task:
              </div>
              <div className="task-pills-row">
                <button
                  className={`task-pill-btn ${selectedTask === 'redact' ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedTask('redact')}
                >
                  Redact PII
                </button>
                <button
                  className={`task-pill-btn ${selectedTask === 'sentiment' ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedTask('sentiment')}
                >
                  Analyze Sentiment
                </button>
                <button
                  className={`task-pill-btn ${selectedTask === 'entities' ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedTask('entities')}
                >
                  Extract Entities
                </button>
                <button
                  className={`task-pill-btn ${selectedTask === 'custom' ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedTask('custom')}
                >
                  Custom Prompt
                </button>
              </div>

              {selectedTask === 'custom' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <div className="form-label" style={{ marginBottom: '6px' }}>
                    <span>Custom Instruction / Prompt</span>
                    <span className="form-label-dot"></span>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Summarize key risks in 3 bullet points and redact any PII..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                </div>
              )}

              <div className="editor-shell">
                <div className="editor-toolbar">
                  <div className="editor-toolbar-left">
                    <span className="editor-live-dot"></span>
                    <span className="editor-toolbar-title">Source Document</span>
                    <span className="editor-mode-badge">
                      {selectedTask === 'redact'
                        ? 'PII Redaction'
                        : selectedTask === 'sentiment'
                        ? 'Sentiment'
                        : selectedTask === 'entities'
                        ? 'Entities'
                        : 'Custom Prompt'}
                    </span>
                  </div>
                  <div className="editor-toolbar-actions">
                    <button
                      type="button"
                      className="editor-mini-btn"
                      onClick={() => {
                        const sampleMap = {
                          redact: SAMPLE_TEXTS.pii,
                          sentiment: SAMPLE_TEXTS.sentiment,
                          entities: SAMPLE_TEXTS.entities,
                          custom: SAMPLE_TEXTS.custom,
                        };
                        setInputText(sampleMap[selectedTask] || SAMPLE_TEXTS.pii);
                      }}
                      title="Load sample text for current task"
                    >
                      <Sparkles size={11} />
                      <span>Sample</span>
                    </button>
                    {inputText && (
                      <button
                        type="button"
                        className="editor-mini-btn"
                        onClick={() => setInputText('')}
                        title="Clear text"
                      >
                        <X size={11} />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  className="main-textarea"
                  placeholder="Paste or type text here to redact personal data, gauge sentiment, or extract entities..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />

                <div className="editor-statusbar">
                  <div className="editor-metrics">
                    <span className="editor-metric-pill">
                      <strong>{wordCount}</strong> {wordCount === 1 ? 'Word' : 'Words'}
                    </span>
                    <span className="editor-metric-divider">•</span>
                    <span className="editor-metric-pill">
                      <strong>{charCount}</strong> {charCount === 1 ? 'Char' : 'Chars'}
                    </span>
                  </div>
                  <div className="editor-status-state">
                    {inputText.trim() ? 'Ready to Analyze' : 'Awaiting Input'}
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button
                  className="btn effect01"
                  style={{ width: '180px' }}
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || !inputText.trim()}
                >
                  <span>
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={13} className="spinner-icon" />
                        Analyzing...
                      </>
                    ) : (
                      'Run Analysis'
                    )}
                  </span>
                </button>

                <button
                  className="btn effect01"
                  style={{ width: '180px' }}
                  onClick={() => {
                    setInputText('');
                    setAnalysisResult('');
                  }}
                >
                  <span>Clear Session</span>
                </button>
              </div>
            </div>

            {/* Output Card */}
            <div className="studio-card">
              <div className="section-headline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Output</span>
                {analysisResult && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="action-icon-pill"
                      onClick={copyResult}
                      title="Copy Output"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      className="action-icon-pill"
                      onClick={downloadResult}
                      title="Download Output"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="output-box">
                {analysisResult ? (
                  <>
                    {isSampleResult && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 12px',
                          marginBottom: '14px',
                          background: '#FFFFFF',
                          border: '1.5px dashed #000000',
                          fontSize: '0.72rem',
                          color: '#000000',
                        }}
                      >
                        <span style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Sample Output Preview
                        </span>
                        <span style={{ color: '#444444', fontWeight: '600' }}>
                          Pre-generated sample • Not run using a live model
                        </span>
                      </div>
                    )}
                    <FormattedOutput text={analysisResult} task={selectedTask} />
                  </>
                ) : (
                  <div className="output-empty">
                    Select a task, enter text, and click <strong>RUN ANALYSIS</strong> to view results.
                  </div>
                )}
              </div>
              {analysisLatency !== null && (
                <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '10px' }}>
                  {isSampleResult ? (
                    <>
                      <strong>Sample Mode</strong> ({analysisLatency}s) • Pre-generated sample output (no live model used)
                    </>
                  ) : (
                    <>
                      Processed in <strong>{analysisLatency}s</strong>{model ? ` • Model: ${model}` : ''}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEXT ANALYSIS CHAT ASSISTANT */}
        {activeTab === 'chat' && (
          <div>
            {/* Header row with Clear Chat button on the right */}
            <div className="chat-header-row">
              <div className="chat-title">Conversation with Text-Analysis-Agent</div>
              <button
                className="btn effect01"
                style={{ width: '140px', height: '36px', minHeight: '36px', lineHeight: '36px' }}
                onClick={() => setChatMessages([])}
              >
                <span>Clear Chat</span>
              </button>
            </div>
            <div className="chat-subtext">
              Ask questions, test phrases, request iterative redaction, or analyze sentiment.
            </div>

            {/* Modern Hero Welcome Card */}
            <div className="chat-welcome-box">
              <div className="chat-welcome-badge">
                <Sparkles size={12} />
                <span>Azure AI Language Engine</span>
              </div>
              <div className="chat-welcome-title">Text Intelligence Assistant</div>
              <div className="chat-welcome-desc">
                Connected to {agentName || 'Azure AI Agent'}{model ? ` (${model})` : ''} with direct access to Azure Language MCP tools. Type any message or prompt below to start.
              </div>
            </div>

            {/* Messages Stream */}
            {chatMessages.length > 0 && (
              <div className="chat-messages-container">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.role}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {msg.isSample && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '4px 10px',
                              marginBottom: '10px',
                              background: '#F8FAFC',
                              border: '1px dashed #000000',
                              fontSize: '0.68rem',
                              color: '#000000',
                            }}
                          >
                            <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Sample Output
                            </strong>
                            <span style={{ color: '#555555' }}>• Not run using a live model</span>
                          </div>
                        )}
                        <FormattedOutput text={msg.content} isChat={true} />
                      </>
                    ) : (
                      msg.content
                    )}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="message-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={14} className="spinner-icon" />
                    Azure Language tool executing...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}

            {/* Suggested Queries */}
            <div className="suggested-label">Suggested queries:</div>
            <div className="suggested-chips-grid">
              <button
                className="btn effect01"
                onClick={() => handleSendMessage("Redact all personal information from: John Doe, phone 555-0192, SSN 123-45-6789, living in Seattle.")}
              >
                <span>Redact PII from a contact profile</span>
              </button>

              <button
                className="btn effect01"
                onClick={() => handleSendMessage("Analyze the sentiment of: I loved the speed of delivery, but the customer support representative was very rude.")}
              >
                <span>Analyze sentiment of a feedback email</span>
              </button>

              <button
                className="btn effect01"
                onClick={() => handleSendMessage("Extract passenger, flight, and seat info from: Passenger Mary Lane flying UA402 to Chicago on Seat 14B.")}
              >
                <span>Extract travel logistics from a booking</span>
              </button>
            </div>

            {/* Elevated Modern Bottom Input Bar */}
            <form
              className="chat-bottom-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                className="chat-text-input"
                placeholder="Type your message or prompt here..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button
                type="submit"
                className="chat-send-arrow-btn"
                disabled={isChatLoading || !chatInput.trim()}
                title="Send"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        )}
      </main>

    </div>
  );
}

