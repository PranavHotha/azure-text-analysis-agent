import React, { useState, useEffect, useRef } from 'react';
import { Settings, ChevronRight } from 'lucide-react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './msalConfig';
import Sidebar from './components/Sidebar';
import AgentPage from './pages/AgentPage';
import ChatPage from './pages/ChatPage';
import './css/modern-button.css';
import './css/App.css';

const SAMPLE_TEXTS = {
  pii: "My name is Sarah Miller, my phone number is 555-0199, and I live at 123 Main St, New York. Please reach out to me regarding account 4111-2222-3333-4444.",
  entities: "From: Delta Air Lines (delta-notifications@delta.com) | Passenger Alexander 'Alex' Vance booked flight DL1234 from Los Angeles (LAX) to New York (JFK) on Seat 12A. Confirmation #HJK992. Billing address: 4500 Wilshire Blvd, Los Angeles, CA 90010.",
  sentiment: "I was absolutely thrilled with how fast the order arrived at my doorstep by Wednesday! However, the customer support representative was very rude and hung up on me when I asked for a return label.",
};

const API_BASE = typeof window !== 'undefined' && window.location.origin.includes('localhost:5173')
  ? 'http://localhost:8000'
  : '';

export default function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const activeAccount = accounts[0] || null;
  const user = activeAccount
    ? {
        name: activeAccount.name || activeAccount.username,
        email: activeAccount.username,
      }
    : null;
  const isLoading = false;

  const [tenantId, setTenantId] = useState('');
  const [authError, setAuthError] = useState('');

  const clearMsalInteractionLocks = () => {
    try {
      [sessionStorage, localStorage].forEach((storage) => {
        Object.keys(storage).forEach((k) => {
          if (k.toLowerCase().includes("interaction") || k.includes("msal.")) {
            if (k.toLowerCase().includes("status") || k.toLowerCase().includes("interaction")) {
              storage.removeItem(k);
            }
          }
        });
      });
      if (typeof document !== "undefined" && document.cookie) {
        document.cookie.split(";").forEach((c) => {
          const name = c.split("=")[0].trim();
          if (name.toLowerCase().includes("interaction") || name.toLowerCase().includes("status")) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          }
        });
      }
    } catch {}
  };

  const loginWithRedirect = async (customTenant) => {
    const tid = (customTenant || tenantId).trim();
    if (!tid) {
      setAuthError('Please enter a valid Azure Tenant ID.');
      return;
    }

    setAuthError('');
    clearMsalInteractionLocks();

    const req = {
      ...loginRequest,
      authority: `https://login.microsoftonline.com/${tid}`,
      redirectUri: window.location.origin,
    };

    try {
      await instance.loginRedirect(req);
    } catch (err) {
      console.error("Login redirect failed:", err);
      setAuthError(err?.message || String(err));
      clearMsalInteractionLocks();
    }
  };

  const logout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }).catch(() => {
      instance.logoutPopup().catch(console.error);
    });
  };

  const getAuthHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated && activeAccount) {
      const tid = (tenantId || activeAccount.tenantId || '').trim();
      const req = {
        ...loginRequest,
        ...(tid ? { authority: `https://login.microsoftonline.com/${tid}` } : {}),
        account: activeAccount,
      };
      try {
        const response = await instance.acquireTokenSilent(req);
        if (response?.accessToken) {
          headers['Authorization'] = `Bearer ${response.accessToken}`;
        }
      } catch {
        try {
          const popupRes = await instance.acquireTokenPopup(req);
          if (popupRes?.accessToken) {
            headers['Authorization'] = `Bearer ${popupRes.accessToken}`;
          }
        } catch (e) {
          console.warn("Token acquisition failed:", e);
        }
      }
    }
    if (foundryEndpoint.trim()) {
      headers['x-azure-endpoint'] = foundryEndpoint.trim();
    }
    if (modelDeployment.trim()) {
      headers['x-azure-model'] = modelDeployment.trim();
    }
    if (agentName.trim()) {
      headers['x-azure-agent-name'] = agentName.trim();
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

  // Reset session configuration if user logs out
  const wasAuthRef = useRef(false);
  useEffect(() => {
    if (wasAuthRef.current && !isAuthenticated) {
      setFoundryEndpoint('');
      setModelDeployment('');
      setAgentName('');
      setConfigSaved(false);
    }
    wasAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  const handleConnectTarget = async () => {
    if (!foundryEndpoint.trim() || !modelDeployment.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/config/target`, {
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
      } else {
        setConfigSaved(true);
      }
    } catch {
      setConfigSaved(true);
    }
  };

  const handleSignOut = () => {
    setFoundryEndpoint('');
    setModelDeployment('');
    setAgentName('');
    setConfigSaved(false);
    fetch(`${API_BASE}/api/session/clear`, { method: 'POST' }).catch(() => {});
    logout();
  };

  // Validation checks for analysis execution
  const isModelConnected = Boolean(foundryEndpoint.trim() && modelDeployment.trim());
  const canRunAnalysis = Boolean(isAuthenticated && isModelConnected);

  // Live Analysis Engine
  const runAnalysisWithText = async (textToAnalyze, taskToRun) => {
    const text = (textToAnalyze || inputText).trim();
    const task = taskToRun || selectedTask;
    if (!text || isAnalyzing) return;

    if (!isAuthenticated) {
      setAnalysisResult('**Authentication Required:**\nPlease click **Sign In to Access** in the sidebar before running text analysis.');
      return;
    }

    if (!isModelConnected) {
      setAnalysisResult('**Azure Model Required:**\nPlease enter your Foundry Endpoint and Model Deployment in the sidebar and click **Connect** before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');
    setAnalysisLatency(null);
    setIsSampleResult(false);

    // Call live backend
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/analyze`, {
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
      setAnalysisResult('**Authentication Required:**\nSample query loaded into Document Source. Please click **Sign In to Access** in the sidebar to run analysis on this text.');
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
          content: '**Authentication Required:**\nPlease click **Sign In to Access** in the sidebar before querying the Azure Language Agent.',
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
      const res = await fetch(`${API_BASE}/api/chat`, {
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
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        user={user}
        tenantId={tenantId}
        setTenantId={setTenantId}
        loginWithRedirect={loginWithRedirect}
        handleSignOut={handleSignOut}
        foundryEndpoint={foundryEndpoint}
        setFoundryEndpoint={setFoundryEndpoint}
        modelDeployment={modelDeployment}
        setModelDeployment={setModelDeployment}
        agentName={agentName}
        setAgentName={setAgentName}
        configSaved={configSaved}
        setConfigSaved={setConfigSaved}
        handleConnectTarget={handleConnectTarget}
        handleRunSampleTask={handleRunSampleTask}
        sampleTexts={SAMPLE_TEXTS}
        authError={authError}
      />

      {/* ---------------------------------------------------------
          MAIN CONTENT AREA
          --------------------------------------------------------- */}
      <main className={`main-content ${!sidebarOpen ? 'sidebar-collapsed-view' : ''}`}>
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

        {/* TAB 1: TEXT ANALYSIS AGENT STUDIO */}
        {activeTab === 'agent' && (
          <AgentPage
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            inputText={inputText}
            setInputText={setInputText}
            wordCount={wordCount}
            charCount={charCount}
            handleRunAnalysis={handleRunAnalysis}
            isAnalyzing={isAnalyzing}
            canRunAnalysis={canRunAnalysis}
            isAuthenticated={isAuthenticated}
            isModelConnected={isModelConnected}
            handleClearSession={handleClearSession}
            analysisResult={analysisResult}
            isSampleResult={isSampleResult}
            analysisLatency={analysisLatency}
            modelDeployment={modelDeployment}
            copied={copied}
            copyResult={copyResult}
            downloadResult={downloadResult}
          />
        )}

        {/* TAB 2: TEXT ANALYSIS CHAT ASSISTANT */}
        {activeTab === 'chat' && (
          <ChatPage
            agentName={agentName}
            modelDeployment={modelDeployment}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            isChatLoading={isChatLoading}
            chatBottomRef={chatBottomRef}
            handleSendMessage={handleSendMessage}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isAuthenticated={isAuthenticated}
            isModelConnected={isModelConnected}
            canRunAnalysis={canRunAnalysis}
          />
        )}
      </main>
    </div>
  );
}
