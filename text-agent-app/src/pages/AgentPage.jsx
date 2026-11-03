import React from 'react';
import { Loader2, Copy, Check, Download } from 'lucide-react';
import FormattedOutput from '../components/FormattedOutput';

export default function StudioPage({
  selectedTask,
  setSelectedTask,
  inputText,
  setInputText,
  wordCount,
  charCount,
  handleRunAnalysis,
  isAnalyzing,
  canRunAnalysis,
  isAuthenticated,
  isModelConnected,
  handleClearSession,
  analysisResult,
  isSampleResult,
  analysisLatency,
  modelDeployment,
  copied,
  copyResult,
  downloadResult,
}) {
  return (
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
                ? 'Sign in to access text analysis'
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
                  <p>Sign in via the sidebar to access and enable text analysis.</p>
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
  );
}

