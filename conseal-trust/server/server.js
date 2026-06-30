const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── THE DOCUMENT ──────────────────────────────────────────────────────────────
const documentText = `From: John Smith
Subject: Q3 Update

Hi team,

Apple had a strong quarter. Please reach me at john@gmail.com or call my cell at +91-98765-43210.
My birthday is in May, so let's plan something for the team.

Jordan mentioned the new policy at Google. John Smith is CEO of Google.

My Aadhaar is 2345 6789 0123 and PAN is ABCDE1234F.

Best,
John Smith
████████`;

// ── RISK CONFIG ───────────────────────────────────────────────────────────────
const RISK_MAP = {
  EMAIL:            { risk: 'HIGH',   recommendation: 'Keep redacted', riskReason: 'Emails directly identify individuals and enable unsolicited contact.' },
  PHONE_NUMBER:     { risk: 'HIGH',   recommendation: 'Keep redacted', riskReason: 'Phone numbers enable direct contact and can be used for identity verification.' },
  AADHAAR:          { risk: 'CRITICAL', recommendation: 'Keep redacted', riskReason: 'Government-issued ID. Exposure can enable identity theft and fraud.' },
  PAN:              { risk: 'CRITICAL', recommendation: 'Keep redacted', riskReason: 'Tax identity number. Exposure can enable financial fraud.' },
  PERSON_NAME:      { risk: 'HIGH',   recommendation: 'Keep redacted', riskReason: 'Personal names combined with other context can directly identify individuals.' },
  ORGANIZATION:     { risk: 'LOW',    recommendation: 'Safe to keep visible', riskReason: 'Organization names are generally public information and not personal data.' },
  JOB_TITLE:        { risk: 'LOW',    recommendation: 'Safe to keep visible', riskReason: 'Job titles alone do not identify individuals without an attached name.' },
  UNKNOWN:          { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: 'Ambiguous token — could be personal information depending on context.' },
  ALREADY_REDACTED: { risk: 'LOW',    recommendation: 'Already handled', riskReason: 'Content was redacted before reaching this system.' },
  URL:              { risk: 'LOW',    recommendation: 'Safe to keep visible', riskReason: 'URLs reference public resources and are not personal data by default.' },
  CREDIT_CARD:      { risk: 'CRITICAL', recommendation: 'Keep redacted', riskReason: 'Financial identifiers. Exposure enables direct financial fraud.' },
  IP_ADDRESS:       { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: 'IP addresses can indirectly identify devices and individuals.' },
};

// ── REGEX RULES (Layer 1) ─────────────────────────────────────────────────────
const RULES = [
  {
    type: 'EMAIL',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.99,
    status: 'redacted',
    reason: 'Matches standard email format (RFC 5322). Emails directly identify individuals.',
  },
  {
    type: 'PHONE_NUMBER',
    pattern: /(\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}/g,
    confidence: 0.97,
    status: 'redacted',
    reason: 'Matches Indian mobile number format. Phone numbers are direct contact identifiers.',
  },
  {
    type: 'AADHAAR',
    pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    confidence: 0.99,
    status: 'redacted',
    reason: 'Matches 12-digit Aadhaar format (groups of 4). Aadhaar is a government-issued personal ID.',
  },
  {
    type: 'PAN',
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    confidence: 0.99,
    status: 'redacted',
    reason: 'Matches Indian PAN card format (5 letters, 4 digits, 1 letter). PAN is a tax identity number.',
  },
  {
    type: 'URL',
    pattern: /https?:\/\/[^\s]+/g,
    confidence: 0.95,
    status: 'kept',
    reason: 'URLs are flagged but kept visible by default — they reference public resources, not personal data.',
  },
  {
    type: 'IP_ADDRESS',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    confidence: 0.93,
    status: 'redacted',
    reason: 'Matches IPv4 address format. IP addresses can identify devices and indirectly identify individuals.',
  },
];

// ── RULE-BASED NER STUBS (Layer 2) ───────────────────────────────────────────
const NER_ENTITIES = [
  {
    text: 'John Smith',
    type: 'PERSON_NAME',
    confidence: 0.97,
    status: 'redacted',
    reason: 'Appears in "From:" header — strong signal this is the sender\'s real name.',
  },
  {
    text: 'Apple',
    type: 'ORGANIZATION',
    confidence: 0.41,
    status: 'kept',
    reason: 'Recognized as a company name. Organizations are not PII under default policy.',
  },
  {
    text: 'May',
    type: 'UNKNOWN',
    confidence: 0.52,
    status: 'uncertain',
    reason: 'Could be the month May or a first name. Confidence near decision boundary — flagged for review.',
  },
  {
    text: 'Jordan',
    type: 'UNKNOWN',
    confidence: 0.55,
    status: 'uncertain',
    reason: 'Matches person name, country name, and brand. Held as uncertain rather than auto-resolved.',
  },
  {
    text: 'Google',
    type: 'ORGANIZATION',
    confidence: 0.93,
    status: 'kept',
    reason: 'High-confidence company name. Not redacted — organizations are policy-excluded by default.',
  },
  {
    text: 'CEO',
    type: 'JOB_TITLE',
    confidence: 0.88,
    status: 'kept',
    reason: 'Job titles alone do not identify individuals without an attached name.',
  },
  {
    text: '████████',
    type: 'ALREADY_REDACTED',
    confidence: null,
    status: 'skipped',
    reason: 'Content was already redacted before reaching this system. Not re-processed.',
  },
];

// ── DETECTION ENGINE ──────────────────────────────────────────────────────────
function detectSpans(text) {
  const spans = [];
  const used = new Set();

  // Layer 1 — Regex
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (used.has(start)) continue;
      used.add(start);

      const before = text.slice(Math.max(0, start - 20), start);
      const after = text.slice(end, Math.min(text.length, end + 20));
      const riskInfo = RISK_MAP[rule.type] || { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: '' };

      spans.push({
        id: `span_regex_${spans.length}`,
        text: match[0],
        start,
        end,
        type: rule.type,
        status: rule.status,
        confidence: rule.confidence,
        source: 'Regex',
        rule: `Pattern match — ${rule.type} regex`,
        reason: rule.reason,
        nearby_context: `${before}[SPAN]${after}`,
        risk: riskInfo.risk,
        recommendation: riskInfo.recommendation,
        riskReason: riskInfo.riskReason,
      });
    }
  }

  // Layer 2 — NER stubs
  for (const entity of NER_ENTITIES) {
    let idx = text.indexOf(entity.text);
    let occurrenceCount = 0;
    while (idx !== -1) {
      if (!used.has(idx)) {
        used.add(idx);
        const start = idx;
        const end = idx + entity.text.length;
        const before = text.slice(Math.max(0, start - 20), start);
        const after = text.slice(end, Math.min(text.length, end + 20));
        occurrenceCount++;
        const riskInfo = RISK_MAP[entity.type] || { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: '' };

        spans.push({
          id: `span_ner_${spans.length}`,
          text: entity.text,
          start,
          end,
          type: entity.type,
          status: entity.status,
          confidence: entity.confidence,
          source: 'Rule-based NER',
          rule: occurrenceCount > 1
            ? `Co-reference of earlier ${entity.type} occurrence`
            : `Named entity recognition — ${entity.type}`,
          reason: occurrenceCount > 1
            ? 'Same entity as first occurrence. Redacted consistently to avoid partial disclosure.'
            : entity.reason,
          nearby_context: `${before}[SPAN]${after}`,
          risk: riskInfo.risk,
          recommendation: riskInfo.recommendation,
          riskReason: riskInfo.riskReason,
        });
      }
      idx = text.indexOf(entity.text, idx + 1);
    }
  }

  spans.sort((a, b) => a.start - b.start);
  return spans;
}

// ── PRIVACY READINESS SCORE ───────────────────────────────────────────────────
function computeReadiness(spans) {
  const total = spans.filter(s => s.status !== 'skipped').length;
  if (total === 0) return 100;

  const uncertainCount = spans.filter(s => s.status === 'uncertain').length;
  const missedCount = 1; // intentional demo false negative
  const criticalUnresolved = spans.filter(s => s.risk === 'CRITICAL' && s.status === 'uncertain').length;

  let score = 100;
  score -= uncertainCount * 8;
  score -= missedCount * 10;
  score -= criticalUnresolved * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
const overrides = {};

app.get('/api/document', (req, res) => {
  const spans = detectSpans(documentText);
  const readinessScore = computeReadiness(spans);

  const summary = {
    totalSpans: spans.length,
    redactedCount: spans.filter(s => s.status === 'redacted').length,
    keptCount: spans.filter(s => s.status === 'kept').length,
    uncertainCount: spans.filter(s => s.status === 'uncertain').length,
    missedCount: 1,
    readinessScore,
    trustMessage: 'We scanned this document using a local, provider-independent detection pipeline (Regex + Rule-based NER). No data was sent to any external service. Review uncertain items before sharing.',
  };

  res.json({ documentText, spans, documentSummary: summary, source: 'local_engine' });
});

app.post('/api/spans/:id/override', (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;
  if (!['redacted', 'kept'].includes(newStatus)) {
    return res.status(400).json({ error: 'newStatus must be "redacted" or "kept"' });
  }
  overrides[id] = newStatus;
  res.json({ id, newStatus, overridden: true });
});

app.post('/api/spans/:id/override/undo', (req, res) => {
  const { id } = req.params;
  delete overrides[id];
  res.json({ id, overridden: false });
});

const PORT = 4000;
const server = app.listen(PORT, () =>
  console.log(`Conseal detection server running on http://localhost:${PORT} — fully local, no API keys`)
);

process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('Rejection:', reason));