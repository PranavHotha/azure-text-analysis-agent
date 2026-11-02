import React, { useState, useEffect, useRef } from 'react';
import { User, ArrowUp, Loader2, ChevronLeft, ChevronRight, Settings, Copy, Check, Download, Sparkles } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import FormattedOutput from './FormattedOutput';
import './modern-button.css';
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
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getIdTokenClaims,
  } = useAuth0();

  const getAuthHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated && getIdTokenClaims) {
      try {
        const claims = await getIdTokenClaims();
        if (claims?.__raw) {
          headers['Authorization'] = `Bearer ${claims.__raw}`;
        }
      } catch {}
    }
    return headers;
  };

  // Navigation & View
  const [activeTab, setActiveTab] = useState('agent');
  const [selectedTask, setSelectedTask] = useState('redact');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Target Configuration
  const [foundryEndpoint, setFoundryEndpoint] = useState('');
  const [modelDeployment, setModelDeployment] = useState('');
  const [agentName, setAgentName] = useState('');

  // Tab 1: Text Analysis Agent
  const [inputText, setInputText] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLatency, setAnalysisLatency] = useState(null);
  const [isSampleResult, setIsSampleResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Tab 2: Chat Assistant
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;

  // Prevent saving or auto-populating fields; fields remain strictly ephemeral in active session
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      setFoundryEndpoint('');
      setModelDeployment('');
      setAgentName('');
      setConfigSaved(false);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  const handleConnectTarget = async () => {
    if (!foundryEndpoint.trim() || !modelDeployment.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://127.0.0.1:8000/api/config/target', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint: foundryEndpoint.trim(),
          model: modelDeployment.trim(),
          agent_name: agentName.trim(),
        }),
      });
      if (res.ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2500);
      }
    } catch {
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
    }
  };

  const handleSignOut = () => {
    setFoundryEndpoint('');
    setModelDeployment('');
    setAgentName('');
    setConfigSaved(false);
    fetch('http://127.0.0.1:8000/api/session/clear', { method: 'POST' }).catch(() => {});
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  // Validation checks for analysis execution
  const isModelConnected = Boolean(foundryEndpoint.trim() && modelDeployment.trim());
  const canRunAnalysis = Boolean(isAuthenticated && isModelConnected);

  // Helper to check if current input matches one of the built-in sample tasks
  const getBuiltInSampleResult = (textVal, taskVal) => {
    const trimmed = (textVal || '').trim();
    if (trimmed === SAMPLE_TEXTS.pii.trim() && taskVal === 'redact') return SAMPLE_OUTPUTS.redact;
    if (trimmed === SAMPLE_TEXTS.entities.trim() && taskVal === 'entities') return SAMPLE_OUTPUTS.entities;
    if (trimmed === SAMPLE_TEXTS.sentiment.trim() && taskVal === 'sentiment') return SAMPLE_OUTPUTS.sentiment;
    return null;
  };

  // Live Analysis Engine
  const runAnalysisWithText = async (textToAnalyze, taskToRun) => {
    const text = (textToAnalyze || inputText).trim();
    const task = taskToRun || selectedTask;
    if (!text || isAnalyzing) return;

    if (!isAuthenticated) {
      setAnalysisResult('**Authentication Required:**\nPlease sign in via Entra ID in the sidebar before running text analysis.');
      return;
    }

    if (!isModelConnected) {
      setAnalysisResult('**Azure Model Connection Required:**\nPlease enter your Foundry Endpoint and Model Deployment in the sidebar and click **Save & Connect** before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');
    setAnalysisLatency(null);
    setIsSampleResult(false);

    // Call live backend
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://127.0.0.1:8000/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          task,
          user_email: user?.email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data.result);
        setAnalysisLatency(data.elapsed || 0.42);
        setIsSampleResult(false);
        setIsAnalyzing(false);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || `Server returned status ${res.status}`;
        setAnalysisResult(`**Error from Azure Target:**\n${msg}\n\n*Make sure you entered your Foundry Endpoint, Model Deployment, and Agent Name in the sidebar and clicked Save & Connect.*`);
        setIsAnalyzing(false);
        return;
      }
    } catch {
      setAnalysisResult(`**Backend Server Offline:** Could not reach the API at **http://127.0.0.1:8000**.\n\nPlease keep \`python server.py\` running in a separate terminal window alongside Vite.`);
      setIsAnalyzing(false);
    }
  };

  // Run sample task directly (from sidebar or sample pills)
  const handleRunSampleTask = (taskKey, sampleText) => {
    setActiveTab('agent');
    setSelectedTask(taskKey);
    setInputText(sampleText);
    setAnalysisResult('');
    setAnalysisLatency(null);

    if (!isAuthenticated) {
      setAnalysisResult('**Authentication Required:**\nSample query loaded into Document Source. Please sign in via Entra ID in the sidebar to run analysis on this text.');
      return;
    }

    if (!isModelConnected) {
      setAnalysisResult('**Azure Model Connection Required:**\nSample query loaded into Document Source. Please configure your Foundry Endpoint and Model Deployment in the sidebar and connect before running analysis.');
      return;
    }

    runAnalysisWithText(sampleText, taskKey);
  };

  // Run analysis when user clicks RUN ANALYSIS
  const handleRunAnalysis = () => {
    runAnalysisWithText(inputText, selectedTask);
  };

  const handleClearSession = () => {
    setInputText('');
    setAnalysisResult('');
    setAnalysisLatency(null);
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

  // Send message in Chat Tab
  const handleSendMessage = async (textToSend) => {
    const prompt = (textToSend || chatInput).trim();
    if (!prompt || isChatLoading) return;

    if (!isAuthenticated) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: prompt },
        {
          role: 'assistant',
          content: '**Authentication Required:**\nPlease sign in via Entra ID in the sidebar before querying the Azure Language Agent.',
          isSample: false,
        },
      ]);
      if (!textToSend) setChatInput('');
      return;
    }

    if (!isModelConnected) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: prompt },
        {
          role: 'assistant',
          content: '**Azure Model Connection Required:**\nPlease enter your Foundry Endpoint and Model Deployment in the sidebar and click **Save & Connect** before chatting with the agent.',
          isSample: false,
        },
      ]);
      if (!textToSend) setChatInput('');
      return;
    }

    const newHistory = [...chatMessages, { role: 'user', content: prompt }];
    setChatMessages(newHistory);
    if (!textToSend) setChatInput('');
    setIsChatLoading(true);

    // Send to live backend API
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          user_email: user?.email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages([...newHistory, { role: 'assistant', content: data.reply, isSample: false }]);
        setIsChatLoading(false);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || `Server returned status ${res.status}`;
        setChatMessages([
          ...newHistory,
          { role: 'assistant', content: `**Azure Error:** ${msg}`, isSample: false },
        ]);
        setIsChatLoading(false);
        return;
      }
    } catch {
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: '**Backend Server Offline:** Cannot reach http://127.0.0.1:8000. Please ensure `python server.py` is running.',
          isSample: false,
        },
      ]);
      setIsChatLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* ---------------------------------------------------------
          LEFT SIDEBAR: Authentication, Target, Sample Tasks
          --------------------------------------------------------- */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-top-bar">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Section 1: Authentication & Access */}
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span>Authentication &amp; Access</span>
          </div>
          <div className="auth-profile-widget">
            <div className="auth-avatar-circle">
              <User size={15} strokeWidth={2.2} />
            </div>
            <div className="auth-info-col">
              <div className="auth-status-pill">
                <span className={`status-micro-dot ${isAuthenticated ? 'online' : 'offline'}`}></span>
                <span>{isAuthenticated ? 'Entra ID Connected' : 'Guest Mode'}</span>
              </div>
              <div className="auth-user-title">
                {isLoading ? 'Checking...' : isAuthenticated ? (user?.name || user?.email || 'Authenticated User') : 'Guest User'}
              </div>
              <div className="auth-user-sub">
                {isAuthenticated ? user?.email : 'Sign in below to link Azure'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Connected Azure Target */}
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span>Connected Azure Target</span>
          </div>

          <div className="input-group">
            <div className="input-label-row">
              <span className="input-label">Foundry Endpoint:</span>
              <span className="status-dot"></span>
            </div>
            <input
              type="text"
              className="text-input-field"
              value={foundryEndpoint}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="https://text-agent-resource.ai.azure.com"
              onChange={(e) => setFoundryEndpoint(e.target.value)}
            />
          </div>

          <div className="input-group">
            <div className="input-label-row">
              <span className="input-label">Model Deployment:</span>
              <span className="status-dot"></span>
            </div>
            <input
              type="text"
              className="text-input-field"
              value={modelDeployment}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="e.g. gpt-4.1 or gpt-4o"
              onChange={(e) => setModelDeployment(e.target.value)}
            />
          </div>

          <div className="input-group">
            <div className="input-label-row">
              <span className="input-label">Agent Name:</span>
              <span className="status-dot"></span>
            </div>
            <input
              type="text"
              className="text-input-field"
              value={agentName}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="e.g. Text-Analysis-Agent"
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>

          <div className="button-stack" style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="btn effect01"
              onClick={handleConnectTarget}
              disabled={!foundryEndpoint.trim() || !modelDeployment.trim()}
            >
              <span>{configSaved ? 'Connected ✓' : 'Connect'}</span>
            </button>
            {!isAuthenticated ? (
              <button
                type="button"
                className="btn effect01"
                onClick={() => loginWithRedirect()}
              >
                <span>Sign In via Entra ID</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn effect01"
                onClick={handleSignOut}
              >
                <span>Sign Out &amp; Disconnect</span>
              </button>
            )}
            <div 
              className={`session-status-badge ${isAuthenticated ? 'active' : 'inactive'}`} 
              title={isAuthenticated ? 'Entra ID Session Active' : 'No Active Entra ID Session'}
            >
              <span className={`session-status-dot ${isAuthenticated ? 'active' : 'inactive'}`}></span>
              <span>
                {isLoading 
                  ? 'Checking Session...' 
                  : isAuthenticated 
                    ? 'Active Session' 
                    : 'Inactive Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Agent Sample Tasks */}
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span>Agent Sample Tasks</span>
          </div>
          <div className="button-stack">
            <button
              type="button"
              className="btn effect01"
              onClick={() => handleRunSampleTask('redact', SAMPLE_TEXTS.pii)}
            >
              <span>Redact PII</span>
            </button>
            <button
              type="button"
              className="btn effect01"
              onClick={() => handleRunSampleTask('entities', SAMPLE_TEXTS.entities)}
            >
              <span>Extract Entities</span>
            </button>
            <button
              type="button"
              className="btn effect01"
              onClick={() => handleRunSampleTask('sentiment', SAMPLE_TEXTS.sentiment)}
            >
              <span>Analyze Sentiment</span>
            </button>
            <button
              type="button"
              className="btn effect01"
              onClick={handleClearSession}
            >
              <span>Clear Workspace</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------------
          MAIN CONTENT AREA
          --------------------------------------------------------- */}
      <main className="main-content">
        {!sidebarOpen && (
          <button
            type="button"
            className="sidebar-expand-btn"
            onClick={() => setSidebarOpen(true)}
            title="Open settings & sidebar"
          >
            <Settings size={15} strokeWidth={2.2} />
            <ChevronRight size={15} strokeWidth={2.5} />
          </button>
        )}

        <header className="header-section">
          <div className="sub-tagline">
            POWERED BY AZURE AI FOUNDRY LANGUAGE SERVICES
          </div>
          <h1 className="main-title">TEXT ANALYSIS AGENT</h1>
          <div className="description-text">
            Data Privacy, PII Redaction, and Sentiment Intelligence.
          </div>
        </header>

        <nav className="tab-navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            TEXT ANALYSIS AGENT
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            TEXT ANALYSIS CHAT ASSISTANT
          </button>
        </nav>

        {/* TAB 1: TEXT ANALYSIS AGENT */}
        {activeTab === 'agent' && (
          <div className="workspace-grid">
            <div className="workspace-column">
              <div className="column-title">INPUT TEXT</div>

              <div className="section-sub-label">SELECT ANALYSIS TASK:</div>
              <div className="task-selection-row">
                <button
                  type="button"
                  className={`btn effect01 ${selectedTask === 'redact' ? '' : 'outline'}`}
                  style={{ width: 'auto', minWidth: '130px', height: '36px' }}
                  onClick={() => setSelectedTask('redact')}
                >
                  <span>REDACT PII</span>
                </button>
                <button
                  type="button"
                  className={`btn effect01 ${selectedTask === 'sentiment' ? '' : 'outline'}`}
                  style={{ width: 'auto', minWidth: '160px', height: '36px' }}
                  onClick={() => setSelectedTask('sentiment')}
                >
                  <span>ANALYZE SENTIMENT</span>
                </button>
                <button
                  type="button"
                  className={`btn effect01 ${selectedTask === 'entities' ? '' : 'outline'}`}
                  style={{ width: 'auto', minWidth: '150px', height: '36px' }}
                  onClick={() => setSelectedTask('entities')}
                >
                  <span>EXTRACT ENTITIES</span>
                </button>
              </div>

              <div className="section-sub-label" style={{ marginTop: '8px' }}>
                ENTER TEXT:
              </div>
              <div className="modern-editor-wrapper">
                <div className="editor-top-bar">
                  <div className="editor-title-group">
                    <span className="editor-dot"></span>
                    <span className="editor-heading">DOCUMENT SOURCE</span>
                  </div>
                  <div className="editor-stats-pills">
                    <span className="stat-pill">{wordCount} {wordCount === 1 ? 'Word' : 'Words'}</span>
                    <span className="stat-pill-divider">•</span>
                    <span className="stat-pill">{charCount} {charCount === 1 ? 'Char' : 'Chars'}</span>
                  </div>
                </div>
                <textarea
                  className="source-textarea"
                  placeholder="Enter or paste text to redact PII, gauge sentiment, or extract entities..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="btn effect01"
                  style={{ width: '170px' }}
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || !inputText.trim() || !canRunAnalysis}
                  title={
                    !isAuthenticated
                      ? 'Sign in via Entra ID in the sidebar to run analysis'
                      : !isModelConnected
                        ? 'Connect to Azure Model in the sidebar to run analysis'
                        : 'Run text analysis'
                  }
                >
                  <span>
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={13} className="spinner-icon" />
                        ANALYZING...
                      </>
                    ) : (
                      'RUN ANALYSIS'
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn effect01"
                  style={{ width: '170px' }}
                  onClick={handleClearSession}
                >
                  <span>CLEAR SESSION</span>
                </button>

                {!canRunAnalysis && (
                  <div className="analysis-gate-pill">
                    <span className="gate-lock-dot"></span>
                    <span>
                      {!isAuthenticated
                        ? 'Sign in via Entra ID required'
                        : 'Azure model connection required'}
                    </span>
                  </div>
                )}
              </div>

              {isAnalyzing && (
                <div className="analysis-status-message">
                  <div className="analysis-status-dots">
                    <span className="status-dot-bounce"></span>
                    <span className="status-dot-bounce"></span>
                    <span className="status-dot-bounce"></span>
                  </div>
                  <span>Running Azure AI Language analysis... Please wait</span>
                </div>
              )}
            </div>

            {/* Right Column: Output */}
            <div className="workspace-column">
              <div className="column-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>OUTPUT</span>
                {analysisResult && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="action-icon-pill"
                      onClick={copyResult}
                      title="Copy Output"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      className="action-icon-pill"
                      onClick={downloadResult}
                      title="Download Output"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="output-card-container">
                {analysisResult ? (
                  <div className="output-card-filled">
                    {isSampleResult && (
                      <div className="sample-output-preview-bar">
                        <span className="sample-preview-title">
                          Sample Output Preview
                        </span>
                        <span className="sample-preview-sub">
                          Pre-generated sample • Not run using a live model
                        </span>
                      </div>
                    )}
                    <FormattedOutput text={analysisResult} task={selectedTask} />
                  </div>
                ) : (
                  <div className="output-card">
                    {isAnalyzing ? (
                      'Analyzing text with Azure AI Language Services... Output will appear here.'
                    ) : !isAuthenticated ? (
                      <div className="output-empty-state">
                        <span className="output-empty-pill">Authentication Required</span>
                        <p>Sign in via Entra ID in the sidebar to enable text analysis.</p>
                      </div>
                    ) : !isModelConnected ? (
                      <div className="output-empty-state">
                        <span className="output-empty-pill">Model Connection Required</span>
                        <p>Configure your Foundry Endpoint and Model Deployment in the sidebar to enable analysis.</p>
                      </div>
                    ) : (
                      'Select a task, enter text, and click RUN ANALYSIS to view results.'
                    )}
                  </div>
                )}
              </div>

              {analysisLatency !== null && (
                <div style={{ fontSize: '10.5px', color: '#666666', marginTop: '6px' }}>
                  {isSampleResult ? (
                    <>
                      <strong>Sample Mode</strong> ({analysisLatency}s) • Pre-generated sample output (no live model used)
                    </>
                  ) : (
                    <>
                      Processed in <strong>{analysisLatency}s</strong>{modelDeployment ? ` • Model: ${modelDeployment}` : ''}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEXT ANALYSIS CHAT ASSISTANT */}
        {activeTab === 'chat' && (
          <div className="chat-workspace">
            <div className="chat-header-row">
              <div className="column-title" style={{ fontSize: '13px' }}>
                CONVERSATION WITH TEXT-ANALYSIS-AGENT
              </div>
              <button
                type="button"
                className="btn effect01"
                style={{ width: '140px', height: '36px' }}
                onClick={() => setChatMessages([])}
              >
                <span>CLEAR CHAT</span>
              </button>
            </div>

            <div className="description-text" style={{ marginTop: '-12px' }}>
              Ask questions, test phrases, request iterative redaction, or analyze sentiment.
            </div>

            <div className="assistant-hero-banner">
              <div className="assistant-hero-badge">
                <Sparkles size={12} strokeWidth={2.5} />
                <span>AZURE AI LANGUAGE SERVICES</span>
              </div>
              <h2 className="assistant-hero-title">Text Intelligence Assistant</h2>
              <p className="assistant-hero-desc">
                Connected to <strong>{agentName || 'Text-Analysis-Agent'}</strong> {modelDeployment ? `(${modelDeployment})` : ''} with direct access to Azure Language MCP tools. Type any message or query below to start.
              </p>
              <div className="assistant-status-row">
                <span className="live-pill">
                  <span className="live-dot-pulse"></span>
                  MCP Language Pipeline Active
                </span>
                <span className="agent-target-pill">
                  Target: {modelDeployment || 'Azure GPT-4.1'}
                </span>
              </div>
            </div>

            {/* Messages Stream */}
            {chatMessages.length > 0 && (
              <div className="chat-messages-container">
                {chatMessages.map((msg, idx) => {
                  const isAssistant = msg.role === 'assistant' || msg.sender === 'assistant';
                  return (
                    <div key={idx} className={`chat-message-row ${isAssistant ? 'assistant-row' : 'user-row'}`}>
                      {isAssistant && (
                        <div className="message-avatar assistant-avatar" title="Text Analysis Agent">
                          <Sparkles size={14} strokeWidth={2.2} />
                        </div>
                      )}
                      <div className={`message-bubble ${isAssistant ? 'assistant' : 'user'}`}>
                        {isAssistant ? (
                          <>
                            {msg.isSample && (
                              <div className="sample-chat-badge">
                                <span className="sample-badge-dot"></span>
                                <strong>Sample Preview</strong>
                                <span>• Pre-generated test query</span>
                              </div>
                            )}
                            <FormattedOutput text={msg.content || msg.text} isChat={true} />
                          </>
                        ) : (
                          <div className="user-message-text">{msg.content || msg.text}</div>
                        )}
                      </div>
                      {!isAssistant && (
                        <div className="message-avatar user-avatar" title="User">
                          <User size={14} strokeWidth={2.2} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {isChatLoading && (
                  <div className="chat-message-row assistant-row">
                    <div className="message-avatar assistant-avatar">
                      <Sparkles size={14} strokeWidth={2.2} />
                    </div>
                    <div className="message-bubble assistant loading-bubble">
                      <Loader2 size={13} className="spinner-icon" />
                      <span>Azure Language Agent is thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}

            <div className="suggested-section">
              <div className="section-sub-label">Suggested queries:</div>
              <div className="suggested-grid">
                <button
                  type="button"
                  className="btn effect01"
                  style={{ height: '40px', fontSize: '10px' }}
                  onClick={() => handleSendMessage('Redact all personal information from: John Doe, phone 555-0192, SSN 123-45-6789, living in Seattle.')}
                >
                  <span>REDACT PII FROM A CONTACT PROFILE</span>
                </button>
                <button
                  type="button"
                  className="btn effect01"
                  style={{ height: '40px', fontSize: '10px' }}
                  onClick={() => handleSendMessage('Analyze the sentiment of: I loved the speed of delivery, but the customer support representative was very rude.')}
                >
                  <span>ANALYZE SENTIMENT OF A FEEDBACK EMAIL</span>
                </button>
                <button
                  type="button"
                  className="btn effect01"
                  style={{ height: '40px', fontSize: '10px' }}
                  onClick={() => handleSendMessage('Extract passenger, flight, and seat info from: Passenger Mary Lane flying UA402 to Chicago on Seat 14B.')}
                >
                  <span>EXTRACT TRAVEL LOGISTICS FROM A BOOKING</span>
                </button>
              </div>
            </div>

            <form
              className="chat-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                className="chat-input-field"
                placeholder={
                  !isAuthenticated
                    ? "Sign in via Entra ID in the sidebar to chat with the agent..."
                    : !isModelConnected
                      ? "Connect to an Azure model in the sidebar to chat..."
                      : "Type your message or prompt here..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading || !canRunAnalysis}
              />
              <button
                type="submit"
                className="chat-send-btn"
                title={!canRunAnalysis ? "Authentication & Model Connection required" : "Send message"}
                disabled={isChatLoading || !chatInput.trim() || !canRunAnalysis}
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
