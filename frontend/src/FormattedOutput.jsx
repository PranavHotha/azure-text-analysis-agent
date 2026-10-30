import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { ShieldCheck, Tag, BarChart3, ListFilter, Copy, Check } from 'lucide-react';

// Configure marked for clean, safe rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

const PII_TAG_REGEX = /\[(Person|Phone Number|Email|Address|SSN|Credit Card Number|Date|Organization|Location|IP Address|URL|Account Number|Password|Passport Number)\]/gi;

export default function FormattedOutput({ text, task = 'redact', isChat = false }) {
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' | 'raw'
  const [copied, setCopied] = useState(false);

  // Parse PII tags and count
  const piiTagsFound = useMemo(() => {
    if (!text) return [];
    const matches = text.match(PII_TAG_REGEX);
    return matches ? Array.from(new Set(matches)) : [];
  }, [text]);

  const totalPiiCount = useMemo(() => {
    if (!text) return 0;
    const matches = text.match(PII_TAG_REGEX);
    return matches ? matches.length : 0;
  }, [text]);

  // Detect Sentiment Polarity if present
  const sentimentMeta = useMemo(() => {
    if (!text || (task !== 'sentiment' && !text.toLowerCase().includes('sentiment'))) return null;
    const lower = text.toLowerCase();
    let polarity = null;
    if (lower.includes('positive') && lower.includes('negative')) polarity = 'MIXED';
    else if (lower.includes('positive')) polarity = 'POSITIVE';
    else if (lower.includes('negative')) polarity = 'NEGATIVE';
    else if (lower.includes('neutral')) polarity = 'NEUTRAL';

    // Try extracting confidence percentages
    const posMatch = text.match(/positive[:\s]+(\d+)%/i);
    const negMatch = text.match(/negative[:\s]+(\d+)%/i);
    const neuMatch = text.match(/neutral[:\s]+(\d+)%/i);

    return {
      polarity,
      positive: posMatch ? parseInt(posMatch[1], 10) : null,
      negative: negMatch ? parseInt(negMatch[1], 10) : null,
      neutral: neuMatch ? parseInt(neuMatch[1], 10) : null,
    };
  }, [text, task]);

  // Convert markdown to HTML with enhanced PII tag badges
  const formattedHtml = useMemo(() => {
    if (!text) return '';
    
    // First, convert markdown to raw HTML
    let html = marked.parse(text);

    // Replace [Category] with styled monochrome tag badge
    html = html.replace(PII_TAG_REGEX, (match) => {
      const cleanCategory = match.replace(/[\[\]]/g, '');
      return `<span class="inline-pii-badge"><span class="pii-badge-dot"></span>${cleanCategory}</span>`;
    });

    return html;
  }, [text]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  // In chat messages, render inline formatted markdown
  if (isChat) {
    return (
      <div 
        className="chat-formatted-markdown"
        dangerouslySetInnerHTML={{ __html: formattedHtml }}
      />
    );
  }

  // Full Studio Output Display
  return (
    <div className="formatted-output-container">
      {/* Header bar with Summary and View Toggle */}
      <div className="output-controls-bar">
        <div className="output-meta-pills">
          {task === 'redact' && totalPiiCount > 0 && (
            <div className="output-summary-badge">
              <ShieldCheck size={14} />
              <span>{totalPiiCount} PII Tokens Redacted</span>
            </div>
          )}

          {sentimentMeta?.polarity && (
            <div className="output-summary-badge">
              <BarChart3 size={14} />
              <span>Polarity: {sentimentMeta.polarity}</span>
            </div>
          )}

          {task === 'entities' && (
            <div className="output-summary-badge">
              <ListFilter size={14} />
              <span>Entity Structure Parsed</span>
            </div>
          )}

          {task === 'custom' && (
            <div className="output-summary-badge">
              <ListFilter size={14} />
              <span>Custom Prompt Output</span>
            </div>
          )}
        </div>

        <div className="output-view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'formatted' ? 'active' : ''}`}
            onClick={() => setViewMode('formatted')}
          >
            Formatted
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            Raw
          </button>
          <button
            type="button"
            className="copy-mini-btn"
            onClick={handleCopy}
            title="Copy Output"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Redacted Tags Legend Bar (if PII tags detected) */}
      {viewMode === 'formatted' && piiTagsFound.length > 0 && (
        <div className="pii-tags-legend">
          <span className="legend-title">Detected Categories:</span>
          <div className="legend-chips">
            {piiTagsFound.map((tag) => (
              <span key={tag} className="legend-chip">
                <Tag size={11} />
                {tag.replace(/[\[\]]/g, '')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment Confidence Breakdown (if sentiment detected) */}
      {viewMode === 'formatted' && sentimentMeta && (sentimentMeta.positive !== null || sentimentMeta.negative !== null) && (
        <div className="sentiment-metrics-card">
          <div className="sentiment-metric-row">
            <span className="metric-label">Positive</span>
            <div className="metric-bar-bg">
              <div 
                className="metric-bar-fill" 
                style={{ width: `${sentimentMeta.positive || 0}%` }}
              />
            </div>
            <span className="metric-value">{sentimentMeta.positive || 0}%</span>
          </div>

          <div className="sentiment-metric-row">
            <span className="metric-label">Negative</span>
            <div className="metric-bar-bg">
              <div 
                className="metric-bar-fill" 
                style={{ width: `${sentimentMeta.negative || 0}%` }}
              />
            </div>
            <span className="metric-value">{sentimentMeta.negative || 0}%</span>
          </div>

          {sentimentMeta.neutral !== null && (
            <div className="sentiment-metric-row">
              <span className="metric-label">Neutral</span>
              <div className="metric-bar-bg">
                <div 
                  className="metric-bar-fill" 
                  style={{ width: `${sentimentMeta.neutral || 0}%` }}
                />
              </div>
              <span className="metric-value">{sentimentMeta.neutral || 0}%</span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="output-rendered-body">
        {viewMode === 'formatted' ? (
          <div 
            className="prose-clean-output"
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
          />
        ) : (
          <pre className="raw-code-output">
            <code>{text}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
