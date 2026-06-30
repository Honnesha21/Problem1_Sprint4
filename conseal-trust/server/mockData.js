// mockData.js
const documentText = `From: John Smith
Subject: Q3 Update

Hi team,

Apple had a strong quarter. Please reach me at john@gmail.com or call my cell.
My birthday is in May, so let's plan something for the team.

Jordan mentioned the new policy at Google. John Smith is CEO of Google.

Best,
John Smith
████████`;

const spans = [
  {
    id: "span_1",
    text: "John Smith",
    start: 6,
    end: 16,
    type: "PERSON_NAME",
    status: "redacted",
    confidence: 0.97,
    rule: "Named entity recognition - high-confidence person name",
    reasoning: "Appears in a 'From:' header, a strong signal this refers to an individual sender rather than a company or place.",
    nearby_context: "From: [SPAN]"
  },
  {
    id: "span_2",
    text: "Apple",
    start: 47,
    end: 52,
    type: "ORGANIZATION",
    status: "kept",
    confidence: 0.41,
    rule: "Named entity recognition - ambiguous: common word vs. brand vs. surname",
    reasoning: "Followed by 'had a strong quarter,' a financial/business phrasing pattern strongly associated with company references, not personal names. Kept visible because organizations are not PII under our policy.",
    nearby_context: "[SPAN] had a strong quarter."
  },
  {
    id: "span_3",
    text: "john@gmail.com",
    start: 94,
    end: 108,
    type: "EMAIL",
    status: "redacted",
    confidence: 0.99,
    rule: "Pattern match - email regex + NER overlap suppression",
    reasoning: "Matches email pattern. Although the name 'John' is embedded inside this span, our overlap policy redacts the smallest precise containing span once, rather than double-redacting the substring name separately.",
    nearby_context: "reach me at [SPAN] or call"
  },
  {
    id: "span_4",
    text: "my cell",
    start: 117,
    end: 124,
    type: "PHONE_NUMBER",
    status: "missed",
    confidence: null,
    rule: "No phone number pattern matched in this sentence - flagged manually for demo",
    reasoning: "This is a deliberately injected false negative: the sentence implies a phone number was meant to follow but none was extracted. The risk banner catches this class of miss.",
    nearby_context: "or call [SPAN]."
  },
  {
    id: "span_5",
    text: "May",
    start: 144,
    end: 147,
    type: "UNKNOWN",
    status: "uncertain",
    confidence: 0.52,
    rule: "Ambiguous token - matches both calendar month list and common first-name list",
    reasoning: "Could refer to the month of May, or could be a first name in another context. Confidence sits near the decision boundary (0.52), so this is surfaced as 'uncertain' rather than silently guessing either way.",
    nearby_context: "My birthday is in [SPAN], so let's plan"
  },
  {
    id: "span_6",
    text: "Jordan",
    start: 188,
    end: 194,
    type: "UNKNOWN",
    status: "uncertain",
    confidence: 0.55,
    rule: "Ambiguous token - matches person-name list, country-name list, and brand-name list",
    reasoning: "'Jordan' is grammatically the subject of 'mentioned,' which favors a person. But the term itself is also a country and a well-known brand, so it is held at 'uncertain' rather than auto-resolved.",
    nearby_context: "[SPAN] mentioned the new policy at Google."
  },
  {
    id: "span_7",
    text: "Google",
    start: 223,
    end: 229,
    type: "ORGANIZATION",
    status: "kept",
    confidence: 0.93,
    rule: "Named entity recognition - high-confidence organization",
    reasoning: "Matches known company name with high confidence. Organizations are policy-excluded from redaction unless paired with sensitive context.",
    nearby_context: "the new policy at [SPAN]."
  },
  {
    id: "span_8",
    text: "John Smith",
    start: 231,
    end: 241,
    type: "PERSON_NAME",
    status: "redacted",
    confidence: 0.95,
    rule: "Named entity recognition - co-reference of span_1",
    reasoning: "Same individual as span_1, identified via name match. Linked occurrences are redacted consistently rather than independently scored, avoiding inconsistent treatment of the same entity.",
    nearby_context: "[SPAN] is CEO of Google."
  },
  {
    id: "span_9",
    text: "CEO",
    start: 245,
    end: 248,
    type: "JOB_TITLE",
    status: "kept",
    confidence: 0.88,
    rule: "Job title - policy-excluded by default",
    reasoning: "Job titles alone are not treated as PII under our policy since they don't identify an individual without an attached name.",
    nearby_context: "John Smith is [SPAN] of Google."
  },
  {
    id: "span_10",
    text: "John Smith",
    start: 267,
    end: 277,
    type: "PERSON_NAME",
    status: "redacted",
    confidence: 0.97,
    rule: "Named entity recognition - co-reference of span_1 / span_8",
    reasoning: "Third occurrence of the same individual, redacted consistently with prior occurrences in this document.",
    nearby_context: "Best,\nJohn Smith"
  },
  {
    id: "span_11",
    text: "████████",
    start: 278,
    end: 286,
    type: "ALREADY_REDACTED",
    status: "skipped",
    confidence: null,
    rule: "Pre-redacted content detector",
    reasoning: "This text was already redacted before reaching our system. We do not attempt to re-detect or re-process already-masked content.",
    nearby_context: "[SPAN]"
  }
];

const documentSummary = {
  totalSpans: spans.length,
  redactedCount: spans.filter(s => s.status === "redacted").length,
  keptCount: spans.filter(s => s.status === "kept").length,
  uncertainCount: spans.filter(s => s.status === "uncertain").length,
  missedCount: spans.filter(s => s.status === "missed").length,
  trustMessage: "We detected and labeled sensitive information in this document, but automated detection is not perfect. Consider reviewing uncertain and high-risk sections (highlighted below) before sharing."
};

module.exports = { documentText, spans, documentSummary };