import React from 'react';
import { User, ChevronLeft } from 'lucide-react';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  isAuthenticated,
  isLoading,
  user,
  tenantId,
  setTenantId,
  loginWithRedirect,
  handleSignOut,
  foundryEndpoint,
  setFoundryEndpoint,
  modelDeployment,
  setModelDeployment,
  agentName,
  setAgentName,
  configSaved,
  handleConnectTarget,
  handleRunSampleTask,
  sampleTexts,
}) {
  return (
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
              <span>{isAuthenticated ? 'Authenticated' : 'Guest Mode'}</span>
            </div>
            <div className="auth-user-title">
              {isLoading ? 'Checking...' : isAuthenticated ? (user?.name || user?.email || 'Authenticated User') : 'Guest User'}
            </div>
            <div className="auth-user-sub">
              {isAuthenticated ? user?.email : 'Click Sign In to Access below'}
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
          {!isAuthenticated && (
            <div className="input-group" style={{ marginTop: '12px', marginBottom: '4px' }}>
              <div className="input-label-row">
                <span className="input-label">Azure Tenant ID:</span>
                <span className="status-dot"></span>
              </div>
              <input
                type="text"
                className="text-input-field"
                value={tenantId}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Enter your Azure Tenant ID"
                onChange={(e) => setTenantId(e.target.value)}
              />
            </div>
          )}

          {!isAuthenticated ? (
            tenantId.trim() ? (
              <button
                type="button"
                className="btn effect01"
                onClick={() => loginWithRedirect(tenantId.trim())}
              >
                <span>Sign In to Access</span>
              </button>
            ) : null
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
            title={isAuthenticated ? 'Authenticated Session Active' : 'No Active Session'}
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
            onClick={() => handleRunSampleTask('redact', sampleTexts.pii)}
          >
            <span>Redact PII</span>
          </button>
          <button
            type="button"
            className="btn effect01"
            onClick={() => handleRunSampleTask('entities', sampleTexts.entities)}
          >
            <span>Extract Entities</span>
          </button>
          <button
            type="button"
            className="btn effect01"
            onClick={() => handleRunSampleTask('sentiment', sampleTexts.sentiment)}
          >
            <span>Sentiment Analysis</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

