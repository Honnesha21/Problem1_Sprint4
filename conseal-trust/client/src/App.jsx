import { useEffect, useRef, useState } from 'react';
import './App.css';

// ── CUSTOM INLINE SVG ICONS (Professional Look, No Emojis) ────────────────────
const ShieldIcon = ({ className, size = 20 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const FolderIcon = ({ className, size = 20 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const CpuIcon = ({ className, size = 20 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="15" x2="23" y2="15"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="15" x2="4" y2="15"/>
  </svg>
);

const ClipboardIcon = ({ className, size = 20 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

const CheckIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SearchIcon = ({ className, size = 18 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const LockIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const ArrowDownIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <polyline points="19 12 12 19 5 12"/>
  </svg>
);

const RefreshIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const PlusIcon = ({ className, size = 16 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);


const STATUS_COLORS = {
  redacted: '#1a1a1a',
  kept: 'transparent',
  uncertain: '#fff3cd',
  missed: 'transparent',
  skipped: '#e5e7eb',
  anonymous: '#ede9fe',
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
    if (span.start > cursor)
      segments.push({ type: 'plain', text: documentText.slice(cursor, span.start) });
    segments.push({ type: 'span', span });
    cursor = span.end;
  });
  if (cursor < documentText.length)
    segments.push({ type: 'plain', text: documentText.slice(cursor) });
  return segments;
}

function getAnonymousPlaceholder(type) {
  if (type === 'PERSON_NAME') return '<CUSTOMER_NAME>';
  if (type === 'EMAIL') return '<EMAIL>';
  if (type === 'PHONE_NUMBER') return '<PHONE_NUMBER>';
  if (type === 'AADHAAR') return '<AADHAAR>';
  if (type === 'PAN') return '<PAN>';
  if (type === 'IP_ADDRESS') return '<IP_ADDRESS>';
  if (type === 'CREDIT_CARD') return '<CREDIT_CARD>';
  return `<${type}>`;
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
    if (status === 'redacted') {
      result += '█'.repeat(span.text.length);
    } else if (status === 'anonymous') {
      result += getAnonymousPlaceholder(span.type);
    } else {
      result += span.text;
    }
    cursor = span.end;
  });
  if (cursor < documentText.length) result += documentText.slice(cursor);
  return result;
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js library is not loaded. Please check your internet connection.');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}


function computeLiveReadiness(spans, overrides, missedCount) {
  const uncertainCount = spans.filter(s => (overrides[s.id] || s.status) === 'uncertain').length;
  const criticalUnresolved = spans.filter(
    s => s.risk === 'CRITICAL' && (overrides[s.id] || s.status) === 'uncertain'
  ).length;
  let score = 100;
  score -= uncertainCount * 8;
  score -= missedCount * 10;
  score -= criticalUnresolved * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getReviewQueue(spans, overrides) {
  return spans.filter(s => {
    const status = overrides[s.id] || s.status;
    return status === 'uncertain' || s.status === 'missed';
  });
}

// ── READINESS CARD ────────────────────────────────────────────────────────────
function ReadinessCard({ score, uncertainCount, missedCount, redactedCount, keptCount }) {
  const isReady = score >= 90 && uncertainCount === 0;
  const color  = score >= 90 ? '#166534' : score >= 70 ? '#854d0e' : '#991b1b';
  const bg     = score >= 90 ? '#f0fdf4' : score >= 70 ? '#fefce8' : '#fef2f2';
  const border = score >= 90 ? '#86efac' : score >= 70 ? '#fde047' : '#fca5a5';

  return (
    <div className="readiness-card" style={{ background: bg, borderColor: border }}>
      <div className="readiness-left">
        <div className="readiness-score" style={{ color }}>{score}%</div>
        <div className="readiness-label">{isReady ? 'Ready to Share' : 'Requires Review'}</div>
      </div>
      <div className="readiness-right">
        <div className="readiness-status" style={{ color }}>
          {isReady ? 'All checks passed' : 'Unresolved items below'}
        </div>
        <div className="readiness-detail">
          <div>{redactedCount > 0 ? '✓' : '–'} {redactedCount} high-risk item{redactedCount !== 1 ? 's' : ''} redacted</div>
          <div>{keptCount > 0 ? '✓' : '–'} {keptCount} low-risk item{keptCount !== 1 ? 's' : ''} confirmed safe</div>
          <div style={{ color: uncertainCount > 0 ? '#854d0e' : undefined }}>
            {uncertainCount > 0 ? '•' : '✓'} {uncertainCount} uncertain entit{uncertainCount === 1 ? 'y' : 'ies'} {uncertainCount > 0 ? 'still need review' : 'resolved'}
          </div>
          <div style={{ color: missedCount > 0 ? '#991b1b' : undefined }}>
            {missedCount > 0 ? '•' : '✓'} {missedCount} potential exposure{missedCount !== 1 ? 's' : ''} flagged for manual check
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REVIEW QUEUE PANEL ────────────────────────────────────────────────────────
function ReviewQueuePanel({ spans, overrides, onStartReview }) {
  const queue = getReviewQueue(spans, overrides);
  const uncertainItems = queue.filter(s => (overrides[s.id] || s.status) === 'uncertain');
  const missedItems    = queue.filter(s => s.status === 'missed');

  if (queue.length === 0) {
    return (
      <div className="review-queue-panel complete">
        <div className="queue-complete-icon"><CheckIcon size={20} /></div>
        <div className="queue-complete-title">All Items Reviewed</div>
        <div className="queue-complete-sub">No unresolved uncertain or high-risk items remain.</div>
      </div>
    );
  }

  return (
    <div className="review-queue-panel">
      <div className="queue-title">Items Requiring Attention</div>
      <div className="queue-items">
        {missedItems.length > 0 && (
          <div className="queue-item queue-item-missed">
            <AlertIcon size={14} className="icon-alert" /> {missedItems.length} Potential Exposure{missedItems.length !== 1 ? 's' : ''} flagged
          </div>
        )}
        {uncertainItems.length > 0 && (
          <div className="queue-item queue-item-uncertain">
            <span className="queue-status-dot-indicator urgent" /> {uncertainItems.length} Uncertain Item{uncertainItems.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <button className="start-review-btn" onClick={onStartReview}>
        Start Guided Review
      </button>
    </div>
  );
}

// ── GUIDED REVIEW MODAL ───────────────────────────────────────────────────────
function GuidedReview({ queue, currentIndex, onDecision, onClose }) {
  if (queue.length === 0) return null;
  const span = queue[currentIndex];
  const isLast = currentIndex === queue.length - 1;
  const isMissed = span.status === 'missed';
  const risk = span.risk || 'MEDIUM';
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.MEDIUM;
  const progress = Math.round(((currentIndex) / queue.length) * 100);

  return (
    <div className="guided-overlay">
      <div className="guided-modal">
        <div className="guided-header">
          <div className="guided-step">Step {currentIndex + 1} of {queue.length}</div>
          <button className="guided-close" onClick={onClose}>✕</button>
        </div>
        <div className="guided-progress-track">
          <div className="guided-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className={`guided-type-badge ${isMissed ? 'badge-missed' : 'badge-uncertain'}`}>
          {isMissed ? 'Potential Exposure' : 'Uncertain Item'}
        </div>
        <div className="guided-entity">"{span.text}"</div>
        <div className="risk-chip" style={{ background: riskStyle.bg, color: riskStyle.text, borderColor: riskStyle.border }}>
          {risk} RISK
        </div>
        <div className="guided-details">
          <div className="guided-detail-row">
            <span className="guided-detail-label">Why flagged?</span>
            <span className="guided-detail-value">{span.reason}</span>
          </div>
          <div className="guided-detail-row">
            <span className="guided-detail-label">Detected by</span>
            <span className={`source-badge source-${span.source === 'Regex' ? 'regex' : 'ner'}`}>{span.source}</span>
          </div>
          {span.confidence !== null && (
            <div className="guided-detail-row">
              <span className="guided-detail-label">Confidence</span>
              <span className="guided-detail-value">{Math.round(span.confidence * 100)}%</span>
            </div>
          )}
          <div className="guided-detail-row">
            <span className="guided-detail-label">Context</span>
            <span className="guided-detail-value context">{span.nearby_context}</span>
          </div>
        </div>
        <div className="guided-risk-box" style={{ background: riskStyle.bg, borderColor: riskStyle.border }}>
          <div className="guided-risk-title" style={{ color: riskStyle.text }}>Risk if exposed</div>
          <div className="guided-risk-body">{span.riskReason}</div>
        </div>
        <div className="guided-recommendation">
          <span className="rec-label">Recommendation</span>
          <span className="rec-value">{span.recommendation}</span>
        </div>
        <div className="guided-actions">
          <button className="guided-btn guided-btn-redact" onClick={() => onDecision(span, 'redacted')}>
            <LockIcon size={14} style={{ marginRight: '6px' }} /> Redact
          </button>
          <button className="guided-btn guided-btn-anon" onClick={() => onDecision(span, 'anonymous')}>
            <CpuIcon size={14} style={{ marginRight: '6px' }} /> Anonymize
          </button>
          <button className="guided-btn guided-btn-keep" onClick={() => onDecision(span, 'kept')}>
            <EyeIcon size={14} style={{ marginRight: '6px' }} /> Keep visible
          </button>
        </div>
        {isLast && <div className="guided-last-note">This is the last item in your review queue.</div>}
      </div>
    </div>
  );
}

// ── REVIEW COMPLETE MODAL ─────────────────────────────────────────────────────
function ReviewCompleteModal({ score, onClose, onDownload }) {
  return (
    <div className="guided-overlay">
      <div className="guided-modal complete-modal">
        <div className="complete-icon"><CheckIcon size={28} /></div>
        <div className="complete-title">Review Complete</div>
        <div className="complete-sub">All uncertain and high-risk items have been reviewed.</div>
        <div className="complete-score">Privacy Readiness: <strong>{score}%</strong></div>
        <div className="complete-actions">
          <button className="guided-btn guided-btn-download" onClick={onDownload}>
            <ArrowDownIcon size={14} style={{ marginRight: '6px' }} /> Download Redacted Document
          </button>
          <button className="guided-btn guided-btn-secondary" onClick={onClose}>Back to Document</button>
        </div>
      </div>
    </div>
  );
}

// ── AUDIT TRAIL MODAL (on-page, shown after export) ──────────────────────────
function AuditTrailModal({ audit, onClose }) {
  return (
    <div className="guided-overlay">
      <div className="guided-modal audit-modal">
        <div className="guided-header">
          <div className="guided-step">Audit Trail</div>
          <button className="guided-close" onClick={onClose}>✕</button>
        </div>
        <div className="audit-body">
          <div className="audit-success-badge">
            <CheckIcon size={12} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Document Downloaded
          </div>
          <p className="audit-intro">Here is the cryptographic audit trail of the redaction actions performed on this document. You can keep this record for compliance verification.</p>
          <pre className="audit-pre">{audit}</pre>
        </div>
        <div className="guided-actions" style={{ gridTemplateColumns: '1fr' }}>
          <button className="guided-btn guided-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── REVIEW PANEL (click-to-inspect) — risk-first ordering ───────────────────
function ReviewPanel({ span, effectiveStatus, isOverridden, onOverride, onUndo }) {
  const risk = span.risk || 'MEDIUM';
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.MEDIUM;

  return (
    <div className="explanation-panel">
      <div className="panel-header">
        <div className="panel-title">Review Center</div>
        <div className="risk-chip" style={{ background: riskStyle.bg, color: riskStyle.text, borderColor: riskStyle.border }}>
          {risk} RISK
        </div>
      </div>
      <div className="entity-block">
        <div className="entity-label">Entity</div>
        <div className="entity-value">"{span.text}"</div>
      </div>
      <div className="divider" />
      <div className="entity-block">
        <div className="entity-label">Decision</div>
        <span className="status-badge" data-status={effectiveStatus}>{effectiveStatus.toUpperCase()}</span>
      </div>
      <div className="risk-block" style={{ background: riskStyle.bg, borderColor: riskStyle.border }}>
        <div className="risk-block-title" style={{ color: riskStyle.text }}>Risk if exposed</div>
        <div className="risk-block-body">{span.riskReason}</div>
      </div>
      <div className="recommendation-block">
        <div className="rec-label">Recommendation</div>
        <div className="rec-value">{span.recommendation}</div>
      </div>
      <div className="divider" />
      <div className="entity-block">
        <div className="entity-label">Why this decision?</div>
        <div className="rec-value" style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>{span.reason}</div>
      </div>
      <dl>
        <dt>Type</dt>
        <dd>{span.type}</dd>
        <dt>Confidence</dt>
        <dd>{span.confidence !== null ? `${Math.round(span.confidence * 100)}%` : 'N/A'}</dd>
        <dt>Detected by</dt>
        <dd><span className={`source-badge source-${span.source === 'Regex' ? 'regex' : 'ner'}`}>{span.source}</span></dd>
        <dt>Context</dt>
        <dd className="context">{span.nearby_context}</dd>
      </dl>
      <div className="divider" />
      {isOverridden ? (
        <button className="undo-btn" onClick={() => onUndo(span)}>Undo my change</button>
      ) : (
        span.status !== 'skipped' && (
          <div className="override-actions">
            <p>Disagree with this decision?</p>
            <div className="override-btns">
              {effectiveStatus !== 'redacted' && <button className="btn-redact" onClick={() => onOverride(span, 'redacted')}>Redact</button>}
              {effectiveStatus !== 'anonymous' && <button className="btn-anon" onClick={() => onOverride(span, 'anonymous')}>Anonymize</button>}
              {effectiveStatus !== 'kept' && <button className="btn-keep" onClick={() => onOverride(span, 'kept')}>Keep visible</button>}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── DOCUMENT UPLOAD AREA ──────────────────────────────────────────────────────
function UploadArea({ onFiles, isUploading }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList).filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.txt') || ext.endsWith('.pdf');
    });
    if (files.length === 0) {
      alert('Only .txt and .pdf files are supported.');
      return;
    }
    onFiles(files);
  };

  return (
    <div
      className={`upload-area ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      {isUploading ? (
        <div className="upload-status">Scanning documents…</div>
      ) : (
        <>
          <div className="upload-icon"><FolderIcon size={32} style={{ margin: '0 auto', color: 'var(--accent)' }} /></div>
          <div className="upload-text">Drop .txt or .pdf files here, or click to browse</div>
          <div className="upload-sub">You can select multiple files at once</div>
        </>
      )}
    </div>
  );
}

// ── DOCUMENT TABS (switcher) ──────────────────────────────────────────────────
function DocumentTabs({ documents, activeId, onSwitch, onClose, onAddClick }) {
  if (documents.length === 0) return null;
  return (
    <div className="doc-tabs-wrapper">
      <div className="doc-tabs">
        {documents.map(doc => (
          <div
            key={doc.id}
            className={`doc-tab ${doc.id === activeId ? 'active' : ''}`}
            onClick={() => onSwitch(doc.id)}
          >
            <span className={`doc-tab-status-dot ${doc.readinessReady ? 'ready' : 'not-ready'}`} />
            <span className="doc-tab-name">{doc.name}</span>
            <span className={`doc-tab-score ${doc.readinessReady ? 'ready' : 'not-ready'}`}>
              {doc.readinessScore}%
            </span>
            <span className="doc-tab-close" onClick={(e) => { e.stopPropagation(); onClose(doc.id); }} title="Close tab">✕</span>
          </div>
        ))}
        <button className="add-tab-btn" onClick={onAddClick} title="Upload more documents">
          <PlusIcon size={12} style={{ marginRight: '4px' }} /> Add File
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
let nextDocId = 1;

export default function App() {
  // documents: [{ id, name, documentText, spans, documentSummary, closable }]
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // overrides keyed PER document: { [docId]: { [spanId]: status } }
  const [overridesByDoc, setOverridesByDoc] = useState(() => {
    try { return JSON.parse(localStorage.getItem('conseal_overrides_by_doc') || '{}'); } catch { return {}; }
  });

  const [selectedSpan, setSelectedSpan] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const [guidedActive, setGuidedActive] = useState(false);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [guidedQueue, setGuidedQueue] = useState([]);

  const [auditTrail, setAuditTrail] = useState(null); // string | null — shows modal when set
  const fileInputRef = useRef(null);
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };



  useEffect(() => {
    localStorage.setItem('conseal_overrides_by_doc', JSON.stringify(overridesByDoc));
  }, [overridesByDoc]);

  const handleUploadFiles = async (files) => {
    setIsUploading(true);
    try {
      for (const file of files) {
        let text = '';
        if (file.name.toLowerCase().endsWith('.pdf')) {
          text = await extractTextFromPDF(file);
          if (!text || text.trim().length === 0) {
            throw new Error(
              'No text content could be extracted from this PDF. ' +
              'Please ensure the PDF has selectable text (scanned image PDFs are not supported).'
            );
          }
        } else {
          text = await file.text();
          if (!text || text.trim().length === 0) {
            throw new Error('The selected text file is empty.');
          }
        }
        const res = await fetch('http://localhost:4000/api/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, name: file.name }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${res.status}`);
        }
        const data = await res.json();
        const id = `doc_${nextDocId++}`;
        const doc = {
          id,
          name: file.name,
          documentText: data.documentText,
          spans: data.spans,
          documentSummary: data.documentSummary,
          closable: true,
        };
        setDocuments(prev => [...prev, doc]);
        setActiveId(id); // switch to most recently uploaded
        setSelectedSpan(null);
      }
    } catch (err) {
      console.error('Upload/detection failed:', err);
      alert(err.message || 'Something went wrong scanning one of your documents.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseDoc = (id) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    setOverridesByDoc(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (activeId === id) {
      const remaining = documents.filter(d => d.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
      setSelectedSpan(null);
    }
  };

  const activeDoc = documents.find(d => d.id === activeId);
  const overrides = (activeId && overridesByDoc[activeId]) || {};

  if (!activeDoc) {
    return (
      <div className="app app-landing">
        <div className="landing-container">
          <header className="landing-header">
            <div className="landing-badge">Private & Provider-Independent</div>
            <h1>Conseal</h1>
            <p className="landing-subtitle">
              Enterprise PII Redaction & Risk Score Verification Workspace
            </p>
          </header>

          <div className="landing-upload-card">
            <UploadArea onFiles={handleUploadFiles} isUploading={isUploading} />
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><ShieldIcon size={24} style={{ color: 'var(--accent)' }} /></div>
              <h3>100% Local Scanning</h3>
              <p>Scanning occurs entirely on your device. Zero external data transfer, guaranteeing maximum document confidentiality.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><FolderIcon size={24} style={{ color: 'var(--accent)' }} /></div>
              <h3>Multi-File Workspace</h3>
              <p>Upload and manage multiple documents concurrently. Switch between files using tabs with inline readiness indicators.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><CpuIcon size={24} style={{ color: 'var(--accent)' }} /></div>
              <h3>Deterministic & Heuristic NER</h3>
              <p>Harnesses the combined power of custom regex patterns and heuristic Entity Recognition to cover all high-risk identifiers.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><ClipboardIcon size={24} style={{ color: 'var(--accent)' }} /></div>
              <h3>Immutable Audit Trails</h3>
              <p>Generates an embedded compliance report detailing the exact detection source and manual review logs for every export.</p>
            </div>
          </div>
        </div>

        <footer className="landing-footer">
          <span>✓ Local scanning active</span>
          <span>·</span>
          <span>✓ Zero external server calls</span>
          <span>·</span>
          <span>✓ HIPAA & GDPR aligned design</span>
        </footer>
      </div>
    );
  }

  const { documentText, spans, documentSummary } = activeDoc;
  const segments = buildSegments(documentText, spans);

  const effectiveStatus = (span) => overrides[span.id] || span.status;

  const redactedCount  = spans.filter(s => effectiveStatus(s) === 'redacted').length;
  const keptCount      = spans.filter(s => effectiveStatus(s) === 'kept').length;
  const uncertainCount = spans.filter(s => effectiveStatus(s) === 'uncertain').length;
  const missedCount    = documentSummary.missedCount;
  const liveScore      = computeLiveReadiness(spans, overrides, missedCount);
  const isReady        = liveScore >= 90 && uncertainCount === 0;

  // Precompute per-doc readiness for tabs
  const documentsWithReadiness = documents.map(d => {
    const ov = overridesByDoc[d.id] || {};
    const unc = d.spans.filter(s => (ov[s.id] || s.status) === 'uncertain').length;
    const score = computeLiveReadiness(d.spans, ov, d.documentSummary.missedCount);
    return { ...d, readinessScore: score, readinessReady: score >= 90 && unc === 0 };
  });

  const setActiveOverrides = (updater) => {
    setOverridesByDoc(prev => ({
      ...prev,
      [activeId]: updater(prev[activeId] || {}),
    }));
  };

  const handleOverride = (span, newStatus) => {
    setActiveOverrides(prev => ({ ...prev, [span.id]: newStatus }));
    fetch(`http://localhost:4000/api/spans/${span.id}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus }),
    });
  };

  const handleUndo = (span) => {
    setActiveOverrides(prev => { const n = { ...prev }; delete n[span.id]; return n; });
    fetch(`http://localhost:4000/api/spans/${span.id}/override/undo`, { method: 'POST' });
  };

  const handleStartReview = () => {
    const queue = getReviewQueue(spans, overrides);
    if (queue.length === 0) return;
    setGuidedQueue(queue);
    setGuidedIndex(0);
    setGuidedActive(true);
    setShowComplete(false);
  };

  const handleGuidedDecision = (span, newStatus) => {
    handleOverride(span, newStatus);
    const nextIndex = guidedIndex + 1;
    const updatedOverrides = { ...overrides, [span.id]: newStatus };
    const remainingQueue = getReviewQueue(spans, updatedOverrides);
    if (remainingQueue.length === 0) {
      setGuidedActive(false);
      setShowComplete(true);
    } else if (nextIndex < guidedQueue.length) {
      setGuidedIndex(nextIndex);
    } else {
      setGuidedActive(false);
      setShowComplete(true);
    }
  };

  const buildAuditText = () => {
    const now = new Date();
    return `─────────────────────────────────────
CONSEAL — REDACTION AUDIT TRAIL
─────────────────────────────────────
Document          : ${activeDoc.name}
Review completed  : ${now.toLocaleString()}
Detection engine  : Regex + Rule-based NER (local, no API calls)
Data sent off-device : NONE

Entities detected   : ${spans.length}
Redacted            : ${redactedCount}
Kept visible        : ${keptCount}
Uncertain           : ${uncertainCount}
Possibly missed     : ${missedCount}
Manually changed    : ${Object.keys(overrides).length}
Privacy score       : ${liveScore}%

✓ Document never left your machine
✓ Local detection only — no cloud services used
✓ No document stored on any server
─────────────────────────────────────`;
  };

  const handleExport = () => {
    if (!isReady) {
      const go = window.confirm(
        'Warning: This document still has unresolved items.\n\n' +
        `• ${uncertainCount} uncertain detection${uncertainCount !== 1 ? 's' : ''}\n` +
        `• ${missedCount} possible missed entity\n\n` +
        'Download anyway?'
      );
      if (!go) return;
    }
    const redacted = buildRedactedText(documentText, spans, overrides);
    const audit = buildAuditText();
    const blob = new Blob([redacted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conseal_redacted_${activeDoc.name.replace(/\.[^.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    // Show the audit trail on-page right after download
    setAuditTrail(audit);
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all overrides on this document and start review from scratch?')) {
      setActiveOverrides(() => ({}));
      setSelectedSpan(null);
    }
  };

  return (
    <div className="app">
      {guidedActive && (
        <GuidedReview queue={guidedQueue} currentIndex={guidedIndex} onDecision={handleGuidedDecision} onClose={() => setGuidedActive(false)} />
      )}
      {showComplete && (
        <ReviewCompleteModal score={liveScore} onClose={() => setShowComplete(false)} onDownload={() => { setShowComplete(false); handleExport(); }} />
      )}
      {auditTrail && (
        <AuditTrailModal audit={auditTrail} onClose={() => setAuditTrail(null)} />
      )}

      {/* Hidden file input for header & tab bar upload triggers */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <header className="workspace-header">
        <div className="header-top">
          <div className="brand-group">
            <span className="brand-logo"><ShieldIcon size={22} style={{ color: 'var(--accent)' }} /></span>
            <h1>Conseal</h1>
            <span className="doc-name-badge">{activeDoc.name}</span>
          </div>
          <div className="header-actions">
            <button className="upload-header-btn" onClick={triggerFileUpload}>
              <FolderIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Upload Files
            </button>
            <button className={`toggle-btn ${showOriginal ? 'showing-original' : ''}`} onClick={() => setShowOriginal(v => !v)}>
              {showOriginal ? (
                <>
                  <EyeIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Showing original
                </>
              ) : (
                <>
                  <LockIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Show original
                </>
              )}
            </button>
            <button className={`export-btn ${!isReady ? 'export-warning' : ''}`} onClick={handleExport}>
              {isReady ? (
                <>
                  <CheckIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Ready to Share
                </>
              ) : (
                <>
                  <ArrowDownIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Download redacted
                </>
              )}
            </button>
            <button className="reset-btn" onClick={handleResetAll} title="Reset all overrides on this document">
              <RefreshIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Reset
            </button>
          </div>
        </div>
        <p className="trust-banner">{documentSummary.trustMessage}</p>
      </header>

      {/* Document tabs */}
      <DocumentTabs
        documents={documentsWithReadiness}
        activeId={activeId}
        onSwitch={(id) => { setActiveId(id); setSelectedSpan(null); }}
        onClose={handleCloseDoc}
        onAddClick={triggerFileUpload}
      />

      <div className="readiness-wrapper">
        <ReadinessCard score={liveScore} uncertainCount={uncertainCount} missedCount={missedCount} redactedCount={redactedCount} keptCount={keptCount} />
      </div>

      <div className="stats-bar">
        <span className="stat stat-redacted">
          <span className="stat-indicator redacted" />
          {redactedCount} redacted
        </span>
        <span className="stat-divider">·</span>
        <span className="stat stat-kept">
          <span className="stat-indicator kept" />
          {keptCount} kept visible
        </span>
        <span className="stat-divider">·</span>
        <span className={`stat ${uncertainCount === 0 ? 'stat-resolved' : 'stat-uncertain'}`}>
          <span className={`stat-indicator ${uncertainCount === 0 ? 'kept' : 'uncertain'}`} />
          {uncertainCount === 0 ? 'All uncertain items reviewed' : `${uncertainCount} uncertain`}
        </span>
        <span className="stat-divider">·</span>
        <span className="stat stat-missed">
          <span className="stat-indicator missed" />
          {missedCount} possibly missed
        </span>
        {Object.keys(overrides).length > 0 && (
          <>
            <span className="stat-divider">·</span>
            <span className="stat stat-overridden">
              <span className="stat-indicator overridden" />
              {Object.keys(overrides).length} manually changed
            </span>
          </>
        )}
      </div>

      <div className="layout">
        <div className="document-pane">
          {showOriginal && (
            <div className="original-notice">
              <EyeIcon size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Viewing original — all PII visible
            </div>
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
                      onClick={() => setSelectedSpan(span)}
                    >
                      {status === 'redacted'
                        ? '█'.repeat(Math.min(span.text.length, 12))
                        : status === 'anonymous'
                        ? getAnonymousPlaceholder(span.type)
                        : span.text}
                    </span>
                  );
                })}
          </pre>
        </div>

        <div className="explanation-pane">
          <ReviewQueuePanel spans={spans} overrides={overrides} onStartReview={handleStartReview} />
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
              <div className="empty-icon"><SearchIcon size={24} style={{ color: 'var(--text)' }} /></div>
              <p>Click any highlighted text to inspect it.</p>
              <p className="empty-sub">Or use Guided Review above to walk through every uncertain item.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="trust-footer">
        <span>✓ Document never left your machine</span>
        <span>✓ Local detection only</span>
        <span>✓ No cloud services used</span>
        <span>✓ Nothing stored on any server</span>
      </footer>
    </div>
  );
}