import { useEffect, useState } from 'react';
import './App.css';

const STATUS_COLORS = {
  redacted: '#1a1a1a',
  kept: 'transparent',
  uncertain: '#fff3cd',
  missed: 'transparent',
  skipped: '#e5e7eb',
};

const RISK_COLORS = {
  CRITICAL: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  HIGH:     { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
  MEDIUM:   { bg: '#fefce8', text: '#854d0e', border: '#fde047' },
  LOW:      { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
};

function buildSegments(documentText, spans) {
  const sorted = [...spans]
    .filter(s => s.status !== 'missed')
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  sorted.forEach(span => {
    if (span.start > cursor) {
      segments.push({ type: 'plain', text: documentText.slice(cursor, span.start) });
    }
    segments.push({ type: 'span', span });
    cursor = span.end;
  });
  if (cursor < documentText.length) {
    segments.push({ type: 'plain', text: documentText.slice(cursor) });
  }
  return segments;
}

function buildRedactedText(documentText, spans, overrides) {
  const sorted = [...spans]
    .filter(s => s.status !== 'missed')
    .sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;
  sorted.forEach(span => {
    if (span.start > cursor) result += documentText.slice(cursor, span.start);
    const status = overrides[span.id] || span.status;
    result += status === 'redacted' ? '█'.repeat(span.text.length) : span.text;
    cursor = span.end;
  });
  if (cursor < documentText.length) result += documentText.slice(cursor);
  return result;
}

function computeLiveReadiness(spans, overrides) {
  const uncertainCount = spans.filter(s => (overrides[s.id] || s.status) === 'uncertain').length;
  const missedCount = 1;
  const criticalUnresolved = spans.filter(
    s => s.risk === 'CRITICAL' && (overrides[s.id] || s.status) === 'uncertain'
  ).length;
  let score = 100;
  score -= uncertainCount * 8;
  score -= missedCount * 10;
  score -= criticalUnresolved * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function ReadinessScore({ score, uncertainCount, missedCount }) {
  const isReady = score >= 90 && uncertainCount === 0;
  const color = score >= 90 ? '#166534' : score >= 70 ? '#854d0e' : '#991b1b';
  const bg = score >= 90 ? '#f0fdf4' : score >= 70 ? '#fefce8' : '#fef2f2';
  const border = score >= 90 ? '#86efac' : score >= 70 ? '#fde047' : '#fca5a5';

  return (
    <div className="readiness-card" style={{ background: bg, borderColor: border }}>
      <div className="readiness-left">
        <div className="readiness-score" style={{ color }}>{score}%</div>
        <div className="readiness-label" style={{ color }}>Privacy Readiness</div>
      </div>
      <div className="readiness-right">
        {isReady ? (
          <>
            <div className="readiness-status ready">✅ Ready to Share</div>
            <div className="readiness-detail">All items reviewed. Document is safe to export.</div>
          </>
        ) : (
          <>
            <div className="readiness-status not-ready" style={{ color }}>⚠ Needs Review</div>
            <div className="readiness-detail">
              {uncertainCount > 0 && <div>• {uncertainCount} uncertain detection{uncertainCount > 1 ? 's' : ''} unresolved</div>}
              {missedCount > 0 && <div>• {missedCount} possible missed entity</div>}
              <div style={{ marginTop: 4, fontWeight: 600 }}>Review highlighted items before exporting.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [selectedSpan, setSelectedSpan] = useState(null);
  const [overrides, setOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('conseal_overrides') || '{}'); }
    catch { return {}; }
  });
  const [showOriginal, setShowOriginal] = useState(false);
  const [reviewedIds, setReviewedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('conseal_reviewed') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    fetch('http://localhost:4000/api/document')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load document:', err));
  }, []);

  useEffect(() => {
    localStorage.setItem('conseal_overrides', JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    localStorage.setItem('conseal_reviewed', JSON.stringify(reviewedIds));
  }, [reviewedIds]);

  if (!data) return <div className="loading">Loading document…</div>;

  const { documentText, spans, documentSummary } = data;
  const segments = buildSegments(documentText, spans);
  const missedSpans = spans.filter(s => s.status === 'missed');

  const effectiveStatus = (span) => overrides[span.id] || span.status;

  const redactedCount = spans.filter(s => effectiveStatus(s) === 'redacted').length;
  const keptCount = spans.filter(s => effectiveStatus(s) === 'kept').length;
  const uncertainCount = spans.filter(s => effectiveStatus(s) === 'uncertain').length;
  const missedCount = documentSummary.missedCount;
  const liveScore = computeLiveReadiness(spans, overrides);
  const isReady = liveScore >= 90 && uncertainCount === 0;

  const handleOverride = (span, newStatus) => {
    setOverrides(prev => ({ ...prev, [span.id]: newStatus }));
    setReviewedIds(prev => prev.includes(span.id) ? prev : [...prev, span.id]);
    fetch(`http://localhost:4000/api/spans/${span.id}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus }),
    });
  };

  const handleUndo = (span) => {
    setOverrides(prev => { const n = { ...prev }; delete n[span.id]; return n; });
    fetch(`http://localhost:4000/api/spans/${span.id}/override/undo`, { method: 'POST' });
  };

  const markReviewed = (span) => {
    setReviewedIds(prev => prev.includes(span.id) ? prev : [...prev, span.id]);
  };

  const handleExport = () => {
    if (!isReady) {
      const go = window.confirm(
        '⚠ Warning: This document still has unresolved items.\n\n' +
        `• ${uncertainCount} uncertain detection${uncertainCount !== 1 ? 's' : ''}\n` +
        `• ${missedCount} possible missed entity\n\n` +
        'Download anyway?'
      );
      if (!go) return;
    }

    const redacted = buildRedactedText(documentText, spans, overrides);
    const now = new Date();
    const auditTrail = `
─────────────────────────────────────
CONSEAL — REDACTION AUDIT TRAIL
─────────────────────────────────────
Review completed : ${now.toLocaleString()}
Detection engine : Regex + Rule-based NER
Data sent off-device : NONE

Entities detected  : ${spans.length}
Redacted           : ${redactedCount}
Kept visible       : ${keptCount}
Uncertain          : ${uncertainCount}
Possibly missed    : ${missedCount}
Manually changed   : ${Object.keys(overrides).length}
Privacy score      : ${liveScore}%

✓ Document never left your machine
✓ Local detection only — no cloud services used
✓ No document stored on any server
─────────────────────────────────────`;

    const blob = new Blob([redacted + '\n\n' + auditTrail], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conseal_redacted_document.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all overrides and start review from scratch?')) {
      setOverrides({});
      setReviewedIds([]);
      localStorage.removeItem('conseal_overrides');
      localStorage.removeItem('conseal_reviewed');
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-top">
          <h1>Conseal — Document Review</h1>
          <div className="header-actions">
            <button
              className={`toggle-btn ${showOriginal ? 'showing-original' : ''}`}
              onClick={() => setShowOriginal(v => !v)}
            >
              {showOriginal ? '👁 Showing original' : '🔒 Show original'}
            </button>
            <button
              className={`export-btn ${!isReady ? 'export-warning' : ''}`}
              onClick={handleExport}
            >
              {isReady ? '✅ Download — Ready to Share' : '⬇ Download redacted'}
            </button>
            <button className="reset-btn" onClick={handleResetAll} title="Reset all overrides">↺ Reset</button>
          </div>
        </div>
        <p className="trust-banner">{documentSummary.trustMessage}</p>
      </header>

      {/* Privacy Readiness Score */}
      <div className="readiness-wrapper">
        <ReadinessScore
          score={liveScore}
          uncertainCount={uncertainCount}
          missedCount={missedCount}
        />
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <span className="stat stat-redacted">⬛ {redactedCount} redacted</span>
        <span className="stat-divider">·</span>
        <span className="stat stat-kept">🟢 {keptCount} kept visible</span>
        <span className="stat-divider">·</span>
        <span className="stat stat-uncertain">🟡 {uncertainCount} uncertain</span>
        <span className="stat-divider">·</span>
        <span className="stat stat-missed">🔴 {missedCount} possibly missed</span>
        {Object.keys(overrides).length > 0 && (
          <>
            <span className="stat-divider">·</span>
            <span className="stat stat-overridden">✏ {Object.keys(overrides).length} manually changed</span>
          </>
        )}
      </div>

      {missedSpans.length > 0 && (
        <div className="risk-banner">
          ⚠ This document may still contain undetected sensitive information.
          We flagged {missedSpans.length} pattern{missedSpans.length > 1 ? 's' : ''} that
          automated detection could not confidently classify. Review manually before sharing.
        </div>
      )}

      <div className="layout">
        <div className="document-pane">
          {showOriginal && (
            <div className="original-notice">👁 Viewing original — all PII visible. Click "Show original" again to return.</div>
          )}
          <pre className="document-text">
            {showOriginal
              ? documentText
              : segments.map((seg, i) => {
                  if (seg.type === 'plain') return <span key={i}>{seg.text}</span>;
                  const span = seg.span;
                  const status = effectiveStatus(span);
                  const isSelected = selectedSpan?.id === span.id;
                  return (
                    <span
                      key={i}
                      className={`span span-${status} ${isSelected ? 'span-selected' : ''}`}
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                      onClick={() => { setSelectedSpan(span); markReviewed(span); }}
                    >
                      {status === 'redacted'
                        ? '█'.repeat(Math.min(span.text.length, 12))
                        : span.text}
                    </span>
                  );
                })}
          </pre>
        </div>

        <div className="explanation-pane">
          {selectedSpan ? (
            <ReviewPanel
              span={selectedSpan}
              effectiveStatus={effectiveStatus(selectedSpan)}
              isOverridden={!!overrides[selectedSpan.id]}
              onOverride={handleOverride}
              onUndo={handleUndo}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Click any highlighted or redacted text to open the Review Center.</p>
              <p className="empty-sub">Every decision comes with a reason, a risk level, and a recommendation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Trust signals footer */}
      <footer className="trust-footer">
        <span>✓ Document never left your machine</span>
        <span>✓ Local detection only</span>
        <span>✓ No cloud services used</span>
        <span>✓ Nothing stored on any server</span>
      </footer>
    </div>
  );
}

function ReviewPanel({ span, effectiveStatus, isOverridden, onOverride, onUndo }) {
  const risk = span.risk || 'MEDIUM';
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.MEDIUM;

  return (
    <div className="explanation-panel">
      <div className="panel-header">
        <div className="panel-title">Review Center</div>
        <div
          className="risk-chip"
          style={{ background: riskStyle.bg, color: riskStyle.text, borderColor: riskStyle.border }}
        >
          {risk} RISK
        </div>
      </div>

      <div className="entity-block">
        <div className="entity-label">Entity</div>
        <div className="entity-value">"{span.text}"</div>
      </div>

      <div className="divider" />

      <dl>
        <dt>Decision</dt>
        <dd>
          <span className="status-badge" data-status={effectiveStatus}>
            {effectiveStatus.toUpperCase()}
          </span>
        </dd>

        <dt>Type</dt>
        <dd>{span.type}</dd>

        <dt>Confidence</dt>
        <dd>{span.confidence !== null ? `${Math.round(span.confidence * 100)}%` : 'N/A'}</dd>

        <dt>Detected by</dt>
        <dd>
          <span className={`source-badge source-${span.source === 'Regex' ? 'regex' : 'ner'}`}>
            {span.source}
          </span>
        </dd>

        <dt>Why?</dt>
        <dd>{span.reason}</dd>

        <dt>Nearby context</dt>
        <dd className="context">{span.nearby_context}</dd>
      </dl>

      <div className="divider" />

      <div className="risk-block" style={{ background: riskStyle.bg, borderColor: riskStyle.border }}>
        <div className="risk-block-title" style={{ color: riskStyle.text }}>Risk if exposed</div>
        <div className="risk-block-body">{span.riskReason}</div>
      </div>

      <div className="recommendation-block">
        <div className="rec-label">Recommendation</div>
        <div className="rec-value">{span.recommendation}</div>
      </div>

      <div className="divider" />

      {isOverridden ? (
        <button className="undo-btn" onClick={() => onUndo(span)}>↺ Undo my change</button>
      ) : (
        span.status !== 'skipped' && (
          <div className="override-actions">
            <p>Disagree with this decision?</p>
            <div className="override-btns">
              {effectiveStatus !== 'redacted' && (
                <button className="btn-redact" onClick={() => onOverride(span, 'redacted')}>Redact this</button>
              )}
              {effectiveStatus !== 'kept' && (
                <button className="btn-keep" onClick={() => onOverride(span, 'kept')}>Keep visible</button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}