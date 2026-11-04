import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { ShieldCheck, Tag, BarChart3, ListFilter, Copy, Check } from 'lucide-react';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const PII_TAG_REGEX = /\[(Person|Name|Full Name|Phone Number|Phone|Email|Address|Street Address|Location|City|State|Zip Code|Postal Code|SSN|Credit Card Number|Credit Card|Date|Organization|Company|IP Address|URL|Account Number|Account|Password|Passport Number|ID Number)\]/gi;
const PII_LINK_REGEX = /\[(Person|Name|Full Name|Phone Number|Phone|Email|Address|Street Address|Location|City|State|Zip Code|Postal Code|SSN|Credit Card Number|Credit Card|Date|Organization|Company|IP Address|URL|Account Number|Account|Password|Passport Number|ID Number)\]\([^)]+\)/gi;

export default function FormattedOutput({ text, task = 'redact', isChat = false }) {
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' | 'raw'
  const [copied, setCopied] = useState(false);

  // Clean raw text from accidental markdown links on PII tags: e.g. [Email](val) -> [Email]
  const cleanSourceText = useMemo(() => {
    if (!text) return '';
    return text.replace(PII_LINK_REGEX, '[$1]');
  }, [text]);

  // Parse PII tags and count
  const piiTagsFound = useMemo(() => {
    if (!cleanSourceText) return [];
    const matches = cleanSourceText.match(PII_TAG_REGEX);
    return matches ? Array.from(new Set(matches.map(m => m.trim()))) : [];
  }, [cleanSourceText]);

  const totalPiiCount = useMemo(() => {
    if (!cleanSourceText) return 0;
    // Check if the summary explicitly states total redactions
    const summaryMatch = cleanSourceText.match(/Total Redactions:\s*(\d+)/i);
    if (summaryMatch) {
      return parseInt(summaryMatch[1], 10);
    }
    // Fall back to counting the inline redacted entity tags
    const matches = cleanSourceText.match(PII_TAG_REGEX);
    return matches ? matches.length : 0;
  }, [cleanSourceText]);

  // Detect Sentiment Polarity if present
  const sentimentMeta = useMemo(() => {
    if (!cleanSourceText || (task !== 'sentiment' && !cleanSourceText.toLowerCase().includes('sentiment'))) return null;
    const lower = cleanSourceText.toLowerCase();
    let polarity = null;
    if (lower.includes('positive') && lower.includes('negative')) polarity = 'MIXED';
    else if (lower.includes('positive')) polarity = 'POSITIVE';
    else if (lower.includes('negative')) polarity = 'NEGATIVE';
    else if (lower.includes('neutral')) polarity = 'NEUTRAL';

    // Try extracting confidence percentages
    const posMatch = cleanSourceText.match(/positive[:\s]+(\d+)%/i);
    const negMatch = cleanSourceText.match(/negative[:\s]+(\d+)%/i);
    const neuMatch = cleanSourceText.match(/neutral[:\s]+(\d+)%/i);

    return {
      polarity,
      positive: posMatch ? parseInt(posMatch[1], 10) : null,
      negative: negMatch ? parseInt(negMatch[1], 10) : null,
      neutral: neuMatch ? parseInt(neuMatch[1], 10) : null,
    };
  }, [cleanSourceText, task]);

  // Convert markdown to HTML with enhanced PII tag badges
  const formattedHtml = useMemo(() => {
    if (!cleanSourceText) return '';

    // First convert markdown to raw HTML on sanitized text
    let html = marked.parse(cleanSourceText);

    // Replace [Category] with styled monochrome tag badge
    html = html.replace(PII_TAG_REGEX, (match) => {
      const cleanCategory = match.replace(/[[\]]/g, '');
      return `<span class="inline-pii-badge"><span class="pii-badge-dot"></span>${cleanCategory}</span>`;
    });

    return html;
  }, [cleanSourceText]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  // In chat messages, render enhanced formatted view with compliance headers and category legend
  if (isChat) {
    return (
      <div className="chat-formatted-output-wrapper">
        {(totalPiiCount > 0 || sentimentMeta?.polarity) && (
          <div className="chat-output-header-bar">
            <div className="chat-output-meta-pills">
              {totalPiiCount > 0 && (
                <div className="chat-summary-badge pii">
                  <ShieldCheck size={12} strokeWidth={2.5} />
                  <span>{totalPiiCount} PII {totalPiiCount === 1 ? 'ENTITY' : 'ENTITIES'} REDACTED</span>
                </div>
              )}
              {sentimentMeta?.polarity && (
                <div className="chat-summary-badge sentiment">
                  <BarChart3 size={12} strokeWidth={2.5} />
                  <span>Polarity: {sentimentMeta.polarity}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="chat-copy-mini-btn"
              onClick={handleCopy}
              title="Copy message"
            >
              {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2.5} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {piiTagsFound.length > 0 && (
          <div className="chat-pii-legend">
            <span className="chat-legend-title">Categories Masked:</span>
            <div className="chat-legend-chips">
              {piiTagsFound.map((tag) => (
                <span key={tag} className="chat-legend-chip">
                  <Tag size={10} strokeWidth={2.2} />
                  {tag.replace(/[[\]]/g, '')}
                </span>
              ))}
            </div>
          </div>
        )}

        {sentimentMeta && (sentimentMeta.positive !== null || sentimentMeta.negative !== null) && (
          <div className="chat-sentiment-compact-card">
            {sentimentMeta.positive !== null && (
              <div className="chat-metric-row">
                <span className="chat-metric-label">Positive</span>
                <div className="chat-metric-bar-bg">
                  <div className="chat-metric-bar-fill" style={{ width: `${sentimentMeta.positive || 0}%` }} />
                </div>
                <span className="chat-metric-value">{sentimentMeta.positive}%</span>
              </div>
            )}
            {sentimentMeta.negative !== null && (
              <div className="chat-metric-row">
                <span className="chat-metric-label">Negative</span>
                <div className="chat-metric-bar-bg">
                  <div className="chat-metric-bar-fill" style={{ width: `${sentimentMeta.negative || 0}%` }} />
                </div>
                <span className="chat-metric-value">{sentimentMeta.negative}%</span>
              </div>
            )}
            {sentimentMeta.neutral !== null && (
              <div className="chat-metric-row">
                <span className="chat-metric-label">Neutral</span>
                <div className="chat-metric-bar-bg">
                  <div className="chat-metric-bar-fill" style={{ width: `${sentimentMeta.neutral || 0}%` }} />
                </div>
                <span className="chat-metric-value">{sentimentMeta.neutral}%</span>
              </div>
            )}
          </div>
        )}

        <div 
          className="chat-formatted-markdown"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      </div>
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
              <span>{totalPiiCount} PII {totalPiiCount === 1 ? 'ENTITY' : 'ENTITIES'} REDACTED</span>
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
                {tag.replace(/[[\]]/g, '')}
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

