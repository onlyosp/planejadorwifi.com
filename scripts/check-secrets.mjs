#!/usr/bin/env node
// Fails when the repository contains something that looks like a credential.
// Credentials belong in the CI secret store, never in the code.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.pdf']);

const RULES = [
  { name: 'API key (AIza...)', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Hard-coded secret', re: /\b(?:api[_-]?key|api[_-]?token|secret|password|access[_-]?token)\b\s*[:=]\s*['"][^'"\s$]{12,}['"]/gi },
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (!SKIP_DIRS.has(name)) yield* files(path); }
    else if (!BINARY.has(extname(name).toLowerCase())) yield path;
  }
}

const problems = [];
const self = fileURLToPath(import.meta.url);
for (const path of files(ROOT)) {
  if (path === self) continue;
  const text = readFileSync(path, 'utf8');
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      if (rule.ok && rule.ok(m)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      problems.push(`${relative(ROOT, path)}:${line}  ${rule.name}`);
    }
  }
}

if (problems.length) {
  console.error('Possible secrets found. Move them to the CI secret store:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('No secrets found.');
