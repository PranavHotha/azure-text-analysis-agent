import React from 'react';
import { Sparkles, User, Loader2, ArrowUp } from 'lucide-react';
import FormattedOutput from '../components/FormattedOutput';

export default function ChatPage({
  agentName,
  modelDeployment,
  chatMessages,
  setChatMessages,
  isChatLoading,
  chatBottomRef,
  handleSendMessage,
  chatInput,
  setChatInput,
  isAuthenticated,
  isModelConnected,
  canRunAnalysis,
}) {
  return (
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
              ? "Sign in to access the chat agent..."
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
  );
}

