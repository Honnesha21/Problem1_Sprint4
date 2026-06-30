const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, '..', 'test-documents');
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath);
}

// 1. Text document with PII
const txtContent = `CONSEAL TEST REPORT — CONFIDENTIAL DATA
---------------------------------------
Author: Devashish Gupta
Role: Chief Product Officer
Company: Conseal Systems Private Limited

Dear Team,
We need to coordinate on the server migration. Please reach out to me at devashish@conseal.io or call +91 99887 76655.
Here are the credential validation details:
- Admin Aadhaar: 1122 3344 5566
- Primary PAN: FYIPA9876K
- Local Server IP: 192.168.1.150

Best Regards,
Devashish
`;

fs.writeFileSync(path.join(dirPath, 'sample_pii_document.txt'), txtContent);
console.log('Created sample_pii_document.txt');

// 2. Selectable PDF document with PII
const piiText = "Hello, this is Aditya Kumar (Senior Director at Acme Corp). " +
  "Please reach out to me at aditya.kumar@conseal.io or call my mobile +91 98765 43210. " +
  "My Aadhaar identity card number is 5544 3322 1100 and tax PAN card is ABCDE1234F. " +
  "My local server IP address is 192.168.1.50.";

const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${piiText.length + 20} >>
stream
BT
/F1 12 Tf
50 700 Td
(${piiText}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000370 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF
`;

fs.writeFileSync(path.join(dirPath, 'sample_pii_document.pdf'), pdfContent);
console.log('Created sample_pii_document.pdf');

// 3. Empty text document
fs.writeFileSync(path.join(dirPath, 'empty_document.txt'), '');
console.log('Created empty_document.txt');

// 4. Scanned PDF simulation (only draws a rectangle, no text stream)
const scannedPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 25 >>
stream
100 100 m 200 200 l S
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
290
%%EOF
`;

fs.writeFileSync(path.join(dirPath, 'scanned_image_simulation.pdf'), scannedPdfContent);
console.log('Created scanned_image_simulation.pdf');

console.log('All test files successfully generated in test-documents/');
