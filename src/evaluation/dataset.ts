/**
 * Langfuse Dataset Creation for nodejs-goof Security Evaluation
 *
 * This module creates a dataset in Langfuse with known vulnerabilities
 * from the nodejs-goof application for model comparison experiments.
 *
 * Run with: bun run src/evaluation/dataset.ts
 */

import 'dotenv/config';
import { Langfuse } from 'langfuse';

// Dataset items based on documented vulnerabilities in nodejs-goof
export const NODEJS_GOOF_VULNERABILITIES = [
  {
    input: {
      file: 'routes/index.js',
      lineRange: '39',
      codeSnippet: `User.find({ username: req.body.username, password: req.body.password }, function (err, users) {`,
      context: 'Login handler accepting user input directly in MongoDB query',
    },
    expectedOutput: {
      category: 'A03:2021-Injection',
      title: 'NoSQL Injection in Login',
      severity: 'critical',
      explanation:
        'User-controlled input passed directly to MongoDB query without validation. Attacker can bypass authentication using operators like {"$gt": ""}',
    },
    metadata: { vulnType: 'nosql-injection', exploitFile: 'exploits/nosql-exploits.sh' },
  },
  {
    input: {
      file: 'routes/index.js',
      lineRange: '160-166',
      codeSnippet: `exec('identify ' + url, function (err, stdout, stderr) {`,
      context: 'Image identification using shell command with user-provided URL',
    },
    expectedOutput: {
      category: 'A03:2021-Injection',
      title: 'Command Injection via Image URL',
      severity: 'critical',
      explanation:
        'User input concatenated directly into shell command. Attacker can execute arbitrary commands using ; or && operators',
    },
    metadata: { vulnType: 'command-injection', exploitFile: 'exploits/shell-injection.md' },
  },
  {
    input: {
      file: 'routes/index.js',
      lineRange: '60-61',
      codeSnippet: `if (redirectPage) {\n    return res.redirect(redirectPage)`,
      context: 'Redirect handler using user-controlled redirectPage parameter',
    },
    expectedOutput: {
      category: 'A01:2021-Broken Access Control',
      title: 'Open Redirect Vulnerability',
      severity: 'medium',
      explanation:
        'User-controlled redirect destination without validation allows phishing attacks',
    },
    metadata: { vulnType: 'open-redirect' },
  },
  {
    input: {
      file: 'routes/index.js',
      lineRange: '347',
      codeSnippet: `_.merge(message, req.body.message, {\n  id: lastId++,\n  timestamp: Date.now(),\n  userName: user.name,\n});`,
      context: 'Chat message creation using lodash merge with user input',
    },
    expectedOutput: {
      category: 'A08:2021-Integrity Failures',
      title: 'Prototype Pollution via lodash merge',
      severity: 'high',
      explanation:
        'User-controlled object merged without sanitization. Attacker can pollute Object.prototype via __proto__ property',
    },
    metadata: { vulnType: 'prototype-pollution', exploitFile: 'exploits/prototype-pollution.sh' },
  },
  {
    input: {
      file: 'routes/index.js',
      lineRange: '254-263',
      codeSnippet: `var zip = AdmZip(importFile.data);\nvar extracted_path = "/tmp/extracted_files";\nzip.extractAllTo(extracted_path, true);`,
      context: 'ZIP file extraction without path validation',
    },
    expectedOutput: {
      category: 'A01:2021-Broken Access Control',
      title: 'Zip Slip Path Traversal',
      severity: 'high',
      explanation:
        'ZIP extraction without validating entry paths. Malicious ZIP can write files outside intended directory using ../ sequences',
    },
    metadata: { vulnType: 'zip-slip' },
  },
  {
    input: {
      file: 'app.js',
      lineRange: '42-46',
      codeSnippet: `app.use(session({\n  secret: 'keyboard cat',\n  name: 'connect.sid',\n  cookie: { path: '/' }\n}))`,
      context: 'Express session configuration',
    },
    expectedOutput: {
      category: 'A02:2021-Cryptographic Failures',
      title: 'Hardcoded Session Secret',
      severity: 'high',
      explanation:
        "Session secret 'keyboard cat' is hardcoded and publicly known. Attacker can forge session cookies",
    },
    metadata: { vulnType: 'hardcoded-secret' },
  },
  {
    input: {
      file: 'package.json',
      lineRange: 'dependencies',
      codeSnippet: `"mongoose": "4.2.4", "st": "0.2.4", "ms": "0.7.0", "marked": "0.3.5"`,
      context: 'Package dependencies with known vulnerabilities',
    },
    expectedOutput: {
      category: 'A06:2021-Vulnerable Components',
      title: 'Multiple Vulnerable Dependencies',
      severity: 'high',
      explanation:
        'mongoose (Buffer exposure), st (Directory traversal), ms (ReDoS), marked (XSS) all have known CVEs',
    },
    metadata: { vulnType: 'vulnerable-dependencies' },
  },
];

// Dataset creation function
export async function createNodejsGoofDataset(): Promise<void> {
  const langfuse = new Langfuse();

  const datasetName = 'nodejs-goof-security-test-cases';

  console.log(`Creating dataset: ${datasetName}`);

  // Create the dataset
  await langfuse.createDataset({
    name: datasetName,
    description:
      'Known security vulnerabilities from Snyk nodejs-goof for OWASP GraphGuard model evaluation',
    metadata: {
      source: 'nodejs-goof',
      owaspCategories: ['A01', 'A02', 'A03', 'A06', 'A08'],
      totalVulnerabilities: NODEJS_GOOF_VULNERABILITIES.length,
    },
  });

  // Create dataset items
  for (const vuln of NODEJS_GOOF_VULNERABILITIES) {
    await langfuse.createDatasetItem({
      datasetName,
      input: vuln.input,
      expectedOutput: vuln.expectedOutput,
      metadata: vuln.metadata,
    });
    console.log(`  Added: ${vuln.expectedOutput.title}`);
  }

  await langfuse.flushAsync();
  console.log(`\n✓ Dataset created with ${NODEJS_GOOF_VULNERABILITIES.length} items`);
}

// Run if executed directly
if (import.meta.main) {
  createNodejsGoofDataset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to create dataset:', err);
      process.exit(1);
    });
}
