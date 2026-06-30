const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── POLICY CONFIGURATION ───────────────────────────────────────────────────────
const DEFAULT_POLICY = {
  EMAIL: 'REDACT',
  PHONE_NUMBER: 'REDACT',
  AADHAAR: 'REDACT',
  PAN: 'REDACT',
  CREDIT_CARD: 'REDACT',
  IP_ADDRESS: 'REDACT',
  URL: 'KEEP',
  ORGANIZATION: 'KEEP',
  JOB_TITLE: 'KEEP',
  DATE: 'KEEP',
  ADDRESS: 'REVIEW',
  PERSON_NAME: 'REVIEW'
};

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
  { type: 'EMAIL', pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, confidence: 0.99,
    reason: 'Matches standard email format (RFC 5322). Emails directly identify individuals.' },
  { type: 'PHONE_NUMBER', pattern: /(\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}/g, confidence: 0.97,
    reason: 'Matches Indian mobile number format. Phone numbers are direct contact identifiers.' },
  { type: 'AADHAAR', pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g, confidence: 0.99,
    reason: 'Matches 12-digit Aadhaar format (groups of 4). Aadhaar is a government-issued personal ID.' },
  { type: 'PAN', pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, confidence: 0.99,
    reason: 'Matches Indian PAN card format (5 letters, 4 digits, 1 letter). PAN is a tax identity number.' },
  { type: 'URL', pattern: /https?:\/\/[^\s]+/g, confidence: 0.95,
    reason: 'URLs are flagged but kept visible by default — they reference public resources, not personal data.' },
  { type: 'IP_ADDRESS', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, confidence: 0.93,
    reason: 'Matches IPv4 address format. IP addresses identify devices and host servers.' },
];

const KNOWN_ORGS = ['Google', 'Apple', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Tesla', 'IBM', 'Oracle', 'Adobe', 'Salesforce', 'Uber', 'Airbnb'];
const JOB_TITLES = ['CEO', 'CTO', 'CFO', 'COO', 'President', 'Director', 'Manager', 'VP', 'Founder', 'Chairman', 'Lead', 'Engineer', 'Developer', 'Designer'];
const ORG_SUFFIXES = /\b([A-Z][\w&.,]*(?:\s[A-Z][\w&.,]*)*\s(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co)\.?)\b/g;
const AMBIGUOUS_TOKENS = ['May', 'June', 'August', 'Jordan', 'Will', 'Mark', 'Grace', 'Rose', 'Dawn', 'Summer', 'April'];
const TITLE_CASE_NAME = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}\b/g;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STOP_WORDS = ['the', 'and', 'but', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'from', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'we', 'our', 'they', 'he', 'she', 'it', 'you', 'i', 'please', 'us', 'my', 'your', 'his', 'her', 'their'];

// ── HEURISTIC NER ─────────────────────────────────────────────────────────────
function detectHeuristicEntities(text) {
  const candidates = [];

  // Org suffixes
  ORG_SUFFIXES.lastIndex = 0;
  let m;
  while ((m = ORG_SUFFIXES.exec(text)) !== null) {
    candidates.push({
      text: m[0], start: m.index, end: m.index + m[0].length,
      type: 'ORGANIZATION', source: 'Heuristic NER', confidence: 0.85,
      reason: 'Matches common corporate suffix (Inc, Corp, LLC, etc.)'
    });
  }

  // Known corporate names
  for (const org of KNOWN_ORGS) {
    const re = new RegExp(`\\b${org}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({
        text: org, start: mm.index, end: mm.index + org.length,
        type: 'ORGANIZATION', source: 'Heuristic NER', confidence: 0.90,
        reason: 'Matches recognized corporate brand name'
      });
    }
  }

  // Standalone job titles
  for (const title of JOB_TITLES) {
    const re = new RegExp(`\\b${title}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({
        text: title, start: mm.index, end: mm.index + title.length,
        type: 'JOB_TITLE', source: 'Heuristic NER', confidence: 0.85,
        reason: 'Matches recognized job title or professional role'
      });
    }
  }

  // Context-based names (Dear X, Regards X, Author: X)
  const CONTEXT_NAME_RE = /\b(Dear|From|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|Sincerely,?|Regards,?|Best,?|Thanks,?|Warmly,?|Author:|Name:|CPO:|CEO:|CTO:)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
  let cm;
  while ((cm = CONTEXT_NAME_RE.exec(text)) !== null) {
    const nameText = cm[2];
    const cleanLower = nameText.toLowerCase();
    if (!['team', 'all', 'everyone', 'customer', 'client', 'support', 'conseal', 'systems', 'project', 'department', 'service'].includes(cleanLower)) {
      const nameStart = cm.index + cm[0].indexOf(nameText);
      candidates.push({
        text: nameText,
        start: nameStart,
        end: nameStart + nameText.length,
        type: 'PERSON',
        source: 'Heuristic Context',
        confidence: 0.90,
        reason: `Flagged following name-introducing context keyword "${cm[1]}"`
      });
    }
  }

  // Title-case multi-word sequences (likely names)
  TITLE_CASE_NAME.lastIndex = 0;
  while ((m = TITLE_CASE_NAME.exec(text)) !== null) {
    candidates.push({
      text: m[0], start: m.index, end: m.index + m[0].length,
      type: 'PERSON', source: 'Heuristic TitleCase', confidence: 0.75,
      reason: 'Matches capitalized multi-word proper noun pattern'
    });
  }

  // Standalone months (to prevent month name false positive redactions)
  for (const month of MONTHS) {
    const re = new RegExp(`\\b${month}\\b`, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) {
      candidates.push({
        text: month, start: mm.index, end: mm.index + month.length,
        type: 'MONTH', source: 'Heuristic Month', confidence: 0.95,
        reason: 'Identified as calendar month'
      });
    }
  }

  return candidates;
}

// ── INTERVAL MERGING (DEDUPLICATION) ──────────────────────────────────────────
function mergeCandidates(text, candidates) {
  if (candidates.length === 0) return [];

  // Sort intervals by start index, then length descending
  const sorted = [...candidates].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const merged = [];

  let current = {
    start: sorted[0].start,
    end: sorted[0].end,
    evidences: [{
      type: sorted[0].type,
      source: sorted[0].source,
      confidence: sorted[0].confidence,
      reason: sorted[0].reason
    }]
  };
  merged.push(current);

  for (let i = 1; i < sorted.length; i++) {
    const cand = sorted[i];
    if (cand.start < current.end) {
      // Overlap detected: extend boundary and append evidence
      current.end = Math.max(current.end, cand.end);
      current.evidences.push({
        type: cand.type,
        source: cand.source,
        confidence: cand.confidence,
        reason: cand.reason
      });
    } else {
      // No overlap: create new segment
      current = {
        start: cand.start,
        end: cand.end,
        evidences: [{
          type: cand.type,
          source: cand.source,
          confidence: cand.confidence,
          reason: cand.reason
        }]
      };
      merged.push(current);
    }
  }

  // Resolve primary attributes
  for (const m of merged) {
    m.text = text.slice(m.start, m.end);

    // Sort evidence by priority: Regex (4) > Presidio (3) > Context (2) > NER (1)
    const sortedEv = [...m.evidences].sort((a, b) => {
      const priority = (ev) => {
        if (ev.source === 'Regex') return 4;
        if (ev.source === 'Microsoft Presidio') return 3;
        if (ev.source === 'Heuristic Context') return 2;
        return 1;
      };
      return priority(b) - priority(a) || b.confidence - a.confidence;
    });

    m.primaryType = sortedEv[0].type;
    m.confidence = sortedEv[0].confidence;
  }

  return merged;
}

// ── 5-STAGE DETECTION ENGINE ──────────────────────────────────────────────────
const PRESIDIO_MAP = {
  PERSON: 'PERSON',
  EMAIL_ADDRESS: 'EMAIL',
  PHONE_NUMBER: 'PHONE_NUMBER',
  CREDIT_CARD: 'CREDIT_CARD',
  IP_ADDRESS: 'IP_ADDRESS',
  URL: 'URL',
  DATE_TIME: 'DATE',
  LOCATION: 'ADDRESS'
};

async function detectSpans(text) {
  const rawCandidates = [];
  let presidioActive = false;

  // STAGE 2: Candidate Collection
  // Note: Microsoft Presidio NLP is handled by the Python engine (port 8000) for PDF files.
  // This Node.js server handles .txt files using regex + heuristic rules only.
  // presidioActive remains false here intentionally.


  // Layer 2: Deterministic Regex
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      rawCandidates.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: rule.type,
        source: 'Regex',
        confidence: rule.confidence,
        reason: rule.reason
      });
    }
  }

  // Layer 3: Heuristic NER
  const heuristicList = detectHeuristicEntities(text);
  for (const h of heuristicList) {
    rawCandidates.push(h);
  }

  // STAGE 3: Merge & Resolve Coordinates
  const merged = mergeCandidates(text, rawCandidates);

  // STAGE 4: Business Policy Engine
  const spans = [];
  for (const m of merged) {
    let status = 'kept';
    let risk = 'LOW';
    let recommendation = 'KEEP';
    let reason = '';

    const beforeWindow = text.slice(Math.max(0, m.start - 30), m.start).trim();

    // ID / Email / Phone policy check
    if (['EMAIL', 'PHONE_NUMBER', 'AADHAAR', 'PAN', 'CREDIT_CARD'].includes(m.primaryType)) {
      status = 'redacted';
      risk = ['AADHAAR', 'PAN', 'CREDIT_CARD'].includes(m.primaryType) ? 'CRITICAL' : 'HIGH';
      recommendation = 'REDACT';
      reason = `Always redacted: matches high-sensitivity policy type (${m.primaryType}).`;
    } 
    else if (m.primaryType === 'IP_ADDRESS') {
      status = 'redacted';
      risk = 'MEDIUM';
      recommendation = 'REDACT';
      reason = 'Redacted: IP address identifier flagged by default server policy.';
    }
    else if (['URL', 'ORGANIZATION', 'JOB_TITLE', 'MONTH'].includes(m.primaryType)) {
      status = 'kept';
      risk = 'LOW';
      recommendation = 'KEEP';
      reason = `Kept visible: non-sensitive metadata type (${m.primaryType}).`;
    }
    else if (m.primaryType === 'DATE') {
      // DOB context window checks
      const isDOB = /dob|born|birth/i.test(beforeWindow);
      if (isDOB) {
        status = 'redacted';
        risk = 'HIGH';
        recommendation = 'REDACT';
        reason = 'Redacted: date matched personal Birth Date context (DOB/Born/Birth).';
      } else {
        status = 'kept';
        risk = 'LOW';
        recommendation = 'KEEP';
        reason = 'Kept visible: generic date without personal identity context.';
      }
    }
    else if (m.primaryType === 'ADDRESS') {
      // Address context checks
      const isPersonalAddress = /address|home|office|shipping|billing|residential/i.test(beforeWindow);
      if (isPersonalAddress) {
        status = 'redacted';
        risk = 'HIGH';
        recommendation = 'REDACT';
        reason = 'Redacted: address matched residential/billing/shipping context.';
      } else {
        status = 'uncertain';
        risk = 'MEDIUM';
        recommendation = 'REVIEW';
        reason = 'Uncertain: physical address detected. Flagged for manual review.';
      }
    }
    else if (m.primaryType === 'PERSON') {
      // Weighted Evidence Model for Names
      let score = 0;
      m.evidences.forEach(ev => {
        if (ev.source === 'Microsoft Presidio') score += 60;
        if (ev.source === 'Heuristic Context') score += 30;
        if (ev.source === 'Heuristic TitleCase') score += 20;
        if (ev.source === 'Regex') score += 50;
      });

      // Context boosts
      if (/(From:|Author:|Prepared By:)$/i.test(beforeWindow)) score += 25;
      if (/(Dear|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)$/i.test(beforeWindow)) score += 25;
      if (/(Sincerely,?|Regards,?|Best,?|Thanks,?|Warmly,?)$/i.test(beforeWindow)) score += 30;

      // Penalties
      const lowerText = m.text.toLowerCase();
      if (MONTHS.some(mon => mon.toLowerCase() === lowerText)) score -= 45;
      if (KNOWN_ORGS.some(o => o.toLowerCase() === lowerText)) score -= 50;
      if (JOB_TITLES.some(t => t.toLowerCase() === lowerText)) score -= 35;
      if (STOP_WORDS.includes(lowerText)) score -= 30;

      // Make decisions based on score thresholds
      if (score >= 75) {
        status = 'redacted';
        risk = 'HIGH';
        recommendation = 'REDACT';
        reason = `Auto redacted: name matches weighted evidence score of ${score}.`;
      } else if (score >= 40) {
        status = 'uncertain';
        risk = 'MEDIUM';
        recommendation = 'REVIEW';
        reason = `Uncertain name candidate: evidence score of ${score} (flagged for review).`;
      } else {
        status = 'kept';
        risk = 'LOW';
        recommendation = 'KEEP';
        reason = `Kept visible: name candidate has insufficient evidence score of ${score}.`;
      }
    }

    const contextBefore = text.slice(Math.max(0, m.start - 20), m.start);
    const contextAfter = text.slice(m.end, Math.min(text.length, m.end + 20));

    spans.push({
      id: `span_${spans.length}`,
      text: m.text,
      start: m.start,
      end: m.end,
      type: m.primaryType === 'PERSON' ? 'PERSON_NAME' : m.primaryType,
      status,
      confidence: m.confidence,
      source: [...new Set(m.evidences.map(e => e.source))].join(', '),
      rule: 'Production Decision Pipeline',
      reason,
      nearby_context: `${contextBefore}[SPAN]${contextAfter}`,
      risk,
      recommendation: recommendation === 'REDACT' ? 'Keep redacted' : recommendation === 'KEEP' ? 'Safe to keep visible' : 'Review manually',
      riskReason: RISK_MAP[m.primaryType === 'PERSON' ? 'PERSON_NAME' : m.primaryType]?.riskReason || 'Context-sensitive sensitivity evaluation.'
    });
  }

  spans.sort((a, b) => a.start - b.start);
  return { spans, presidioActive };
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

// Single unified endpoint — .txt file detection (regex + heuristic rules).
// Note: PDF files are handled by the Python engine at http://localhost:8000
app.post('/api/detect', async (req, res) => {
  const { text, name } = req.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required and must be non-empty' });
  }
  const { spans } = await detectSpans(text);
  const trustMessage = 'Scanned locally using pattern-based regex detection and heuristic entity recognition.';
  const summary = buildSummary(spans, 0, trustMessage);
  res.json({ documentText: text, spans, documentSummary: summary, source: 'local_rules', name: name || 'Untitled document' });
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