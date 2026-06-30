const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

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

// ── REGEX RULES (Layer 1) — deterministic, applies to ANY text ───────────────
const RULES = [
  { type: 'EMAIL', pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, confidence: 0.99, status: 'redacted',
    reason: 'Matches standard email format (RFC 5322). Emails directly identify individuals.' },
  { type: 'PHONE_NUMBER', pattern: /(\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}/g, confidence: 0.97, status: 'redacted',
    reason: 'Matches Indian mobile number format. Phone numbers are direct contact identifiers.' },
  { type: 'AADHAAR', pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g, confidence: 0.99, status: 'redacted',
    reason: 'Matches 12-digit Aadhaar format (groups of 4). Aadhaar is a government-issued personal ID.' },
  { type: 'PAN', pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, confidence: 0.99, status: 'redacted',
    reason: 'Matches Indian PAN card format (5 letters, 4 digits, 1 letter). PAN is a tax identity number.' },
  { type: 'URL', pattern: /https?:\/\/[^\s]+/g, confidence: 0.95, status: 'kept',
    reason: 'URLs are flagged but kept visible by default — they reference public resources, not personal data.' },
  { type: 'IP_ADDRESS', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, confidence: 0.93, status: 'redacted',
    reason: 'Matches IPv4 address format. IP addresses can identify devices and indirectly identify individuals.' },
];

// ── HEURISTIC NER (Layer 2) — works on ANY text, not a fixed entity list ─────
// This is a deliberately lightweight, explainable heuristic layer (not a trained
// ML model). It generalizes the same detection logic across demo and uploaded
// documents. Documented limitation: real NER (spaCy/GLiNER/Presidio) would
// generalize further; scoped out given the hackathon timeline.

const KNOWN_ORGS = ['Google', 'Apple', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Tesla', 'IBM', 'Oracle', 'Adobe', 'Salesforce', 'Uber', 'Airbnb'];
const JOB_TITLES = ['CEO', 'CTO', 'CFO', 'COO', 'President', 'Director', 'Manager', 'VP', 'Founder', 'Chairman'];
const ORG_SUFFIXES = /\b([A-Z][\w&.,]*(?:\s[A-Z][\w&.,]*)*\s(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co)\.?)\b/g;
const AMBIGUOUS_TOKENS = ['May', 'June', 'August', 'Jordan', 'Will', 'Mark', 'Grace', 'Rose', 'Dawn', 'Summer', 'April'];
const TITLE_CASE_NAME = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}\b/g;
const NAME_CONTEXT_BOOST = /\b(From|Dear|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Sincerely|Best,|Regards,)\s*$/;

function detectHeuristicEntities(text) {
  const candidates = [];

  // 1. Org suffix matches (e.g. "Acme Corp")
  ORG_SUFFIXES.lastIndex = 0;
  let m;
  while ((m = ORG_SUFFIXES.exec(text)) !== null) {
    candidates.push({ text: m[0], start: m.index, type: 'ORGANIZATION', confidence: 0.9, status: 'kept',
      reason: 'Matches a common organization-name suffix pattern (Inc, Ltd, Corp, etc.).' });
  }

  // 2. Known org names (exact word match)
  for (const org of KNOWN_ORGS) {
    const re = new RegExp(`\\b${org}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({ text: org, start: mm.index, type: 'ORGANIZATION', confidence: 0.93, status: 'kept',
        reason: 'Recognized as a known company name. Organizations are not PII under default policy.' });
    }
  }

  // 3. Job titles, standalone
  for (const title of JOB_TITLES) {
    const re = new RegExp(`\\b${title}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({ text: title, start: mm.index, type: 'JOB_TITLE', confidence: 0.85, status: 'kept',
        reason: 'Job titles alone do not identify individuals without an attached name.' });
    }
  }

  // 4. Ambiguous single tokens (could be a name OR a common word)
  for (const token of AMBIGUOUS_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({ text: token, start: mm.index, type: 'UNKNOWN', confidence: 0.53, status: 'uncertain',
        reason: `"${token}" could be a personal name or a common word depending on context. Confidence near the decision boundary — flagged for review.` });
    }
  }

  // 5. Context-based name matching (salutations, prefix tags, signature block matches)
  const CONTEXT_NAME_RE = /\b(Dear|From|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|Sincerely,?|Regards,?|Best,?|Thanks,?|Warmly,?|Author:|Name:|CPO:|CEO:|CTO:)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
  let cm;
  while ((cm = CONTEXT_NAME_RE.exec(text)) !== null) {
    const nameText = cm[2];
    if (!['Team', 'All', 'Everyone', 'Customer', 'Client', 'Support', 'Conseal', 'Systems', 'Project', 'Department', 'Service'].includes(nameText)) {
      const nameStart = cm.index + cm[0].indexOf(nameText);
      candidates.push({
        text: nameText,
        start: nameStart,
        type: 'PERSON_NAME',
        confidence: 0.96,
        status: 'redacted',
        reason: `Detected following name-introducing context keyword "${cm[1]}".`
      });
    }
  }


  // 7. Title-case sequences (likely person names) — lowest priority, fills remaining gaps
  TITLE_CASE_NAME.lastIndex = 0;
  while ((m = TITLE_CASE_NAME.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    const boosted = NAME_CONTEXT_BOOST.test(before);
    candidates.push({
      text: m[0], start: m.index, type: 'PERSON_NAME',
      confidence: boosted ? 0.95 : 0.78,
      status: 'redacted',
      reason: boosted
        ? 'Appears directly after a name-introducing phrase (From:, Dear, Sincerely, etc.) — strong signal this is a real person\'s name.'
        : 'Matches a capitalized multi-word pattern typical of personal names.',
    });
  }

  return candidates;
}

// ── DETECTION ENGINE (single pipeline — same logic for every document) ──────
const PRESIDIO_MAP = {
  PERSON: 'PERSON_NAME',
  EMAIL_ADDRESS: 'EMAIL',
  PHONE_NUMBER: 'PHONE_NUMBER',
  CREDIT_CARD: 'CREDIT_CARD',
  IP_ADDRESS: 'IP_ADDRESS',
  URL: 'URL'
};

function claimRange(used, start, len) {
  for (let i = start; i < start + len; i++) used.add(i);
}

async function detectSpans(text) {
  const spans = [];
  const used = new Set();        // character indices already claimed
  const occurrenceCount = {};    // entity text -> count, for consistency across repeats
  let presidioActive = false;

  // Layer 1 — Microsoft Presidio NLP Analyzer
  try {
    const response = await fetch('http://localhost:5001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'en' })
    });
    if (response.ok) {
      const entities = await response.json();
      presidioActive = true;
      for (const ent of entities) {
        const start = ent.start;
        const end = ent.end;
        const len = end - start;
        if (usedRangeOverlaps(used, start, len)) continue;
        claimRange(used, start, len);

        const mappedType = PRESIDIO_MAP[ent.entity_type] || ent.entity_type;
        const riskInfo = RISK_MAP[mappedType] || {
          risk: 'MEDIUM',
          recommendation: 'Review manually',
          riskReason: `Flagged by Presidio NLP analysis as ${ent.entity_type}.`
        };

        const before = text.slice(Math.max(0, start - 20), start);
        const after = text.slice(end, Math.min(text.length, end + 20));

        spans.push({
          id: `span_${spans.length}`,
          text: text.slice(start, end),
          start,
          end,
          type: mappedType,
          status: riskInfo.recommendation === 'Keep redacted' ? 'redacted' : 'uncertain',
          confidence: ent.score,
          source: 'Microsoft Presidio',
          rule: `Presidio NLP — ${ent.entity_type}`,
          reason: `Detected by Microsoft Presidio NLP model with ${(ent.score * 100).toFixed(0)}% confidence.`,
          nearby_context: `${before}[SPAN]${after}`,
          risk: riskInfo.risk,
          recommendation: riskInfo.recommendation,
          riskReason: riskInfo.riskReason
        });
      }
    }
  } catch (err) {
    console.log('[Presidio] Analyzer offline at http://localhost:5001. Running local engine only.');
  }

  // Layer 2 — Regex (highest priority local rules, claims unclaimed positions)
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const start = match.index;
      const len = match[0].length;
      const end = start + len;
      if (usedRangeOverlaps(used, start, len)) continue;
      claimRange(used, start, len);
      const before = text.slice(Math.max(0, start - 20), start);
      const after = text.slice(end, Math.min(text.length, end + 20));
      const riskInfo = RISK_MAP[rule.type] || { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: '' };

      spans.push({
        id: `span_${spans.length}`,
        text: match[0], start, end,
        type: rule.type, status: rule.status, confidence: rule.confidence,
        source: 'Regex',
        rule: `Pattern match — ${rule.type} regex`,
        reason: rule.reason,
        nearby_context: `${before}[SPAN]${after}`,
        risk: riskInfo.risk, recommendation: riskInfo.recommendation, riskReason: riskInfo.riskReason,
      });
    }
  }

  // Layer 3 — Heuristic NER (fills remaining, non-overlapping positions)
  const candidates = detectHeuristicEntities(text)
    .filter(c => !usedRangeOverlaps(used, c.start, c.text.length))
    .sort((a, b) => a.start - b.start);

  for (const c of candidates) {
    const len = c.text.length;
    if (usedRangeOverlaps(used, c.start, len)) continue;
    claimRange(used, c.start, len);

    occurrenceCount[c.text] = (occurrenceCount[c.text] || 0) + 1;
    const isRepeat = occurrenceCount[c.text] > 1;
    const start = c.start, end = c.start + len;
    const before = text.slice(Math.max(0, start - 20), start);
    const after = text.slice(end, Math.min(text.length, end + 20));
    const riskInfo = RISK_MAP[c.type] || { risk: 'MEDIUM', recommendation: 'Review manually', riskReason: '' };

    spans.push({
      id: `span_${spans.length}`,
      text: c.text, start, end,
      type: c.type, status: c.status, confidence: c.confidence,
      source: 'Heuristic NER',
      rule: isRepeat ? `Co-reference of earlier ${c.type} occurrence` : `Heuristic detection — ${c.type}`,
      reason: isRepeat
        ? 'Same entity as an earlier occurrence in this document. Treated consistently to avoid partial disclosure.'
        : c.reason,
      nearby_context: `${before}[SPAN]${after}`,
      risk: riskInfo.risk, recommendation: riskInfo.recommendation, riskReason: riskInfo.riskReason,
    });
  }

  spans.sort((a, b) => a.start - b.start);
  return { spans, presidioActive };
}

function usedRangeOverlaps(used, start, len) {
  for (let i = start; i < start + len; i++) if (used.has(i)) return true;
  return false;
}
function overlapsClaimedSpan(spans, start, end) {
  return spans.some(s => start < s.end && end > s.start);
}

// ── PRIVACY READINESS SCORE ───────────────────────────────────────────────────
function computeReadiness(spans, missedCount = 0) {
  const uncertainCount = spans.filter(s => s.status === 'uncertain').length;
  const criticalUnresolved = spans.filter(s => s.risk === 'CRITICAL' && s.status === 'uncertain').length;
  let score = 100;
  score -= uncertainCount * 8;
  score -= missedCount * 10;
  score -= criticalUnresolved * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildSummary(spans, missedCount, trustMessage) {
  return {
    totalSpans: spans.length,
    redactedCount: spans.filter(s => s.status === 'redacted').length,
    keptCount: spans.filter(s => s.status === 'kept').length,
    uncertainCount: spans.filter(s => s.status === 'uncertain').length,
    missedCount,
    readinessScore: computeReadiness(spans, missedCount),
    trustMessage,
  };
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
const overrides = {};

// Single unified endpoint — same detection logic for every uploaded document.
app.post('/api/detect', async (req, res) => {
  const { text, name } = req.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required and must be non-empty' });
  }
  const { spans, presidioActive } = await detectSpans(text);
  const trustMessage = presidioActive
    ? 'Scanned locally using Microsoft Presidio NLP Analyzer combined with Conseal custom business rules.'
    : 'Scanned locally using pattern-based detection and heuristic entity recognition. (Microsoft Presidio service is offline)';
  const summary = buildSummary(
    spans,
    0,
    trustMessage
  );
  res.json({ documentText: text, spans, documentSummary: summary, source: presidioActive ? 'presidio_rules' : 'local_rules', name: name || 'Untitled document' });
});

app.post('/api/spans/:id/override', (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;
  if (!['redacted', 'kept', 'anonymous'].includes(newStatus)) {
    return res.status(400).json({ error: 'newStatus must be "redacted", "kept", or "anonymous"' });
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
app.listen(PORT, () =>
  console.log(`Conseal detection server running on http://localhost:${PORT} — fully local, no API keys`)
);

process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('Rejection:', reason));