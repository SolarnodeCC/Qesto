#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../public/locales');
const LANGUAGES = ['nl', 'de', 'es', 'fr'];

// Files to backfill (defaults to solutions.json if not provided)
const FILES_TO_PROCESS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['solutions.json'];

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenKeys(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function unflattenKeys(flat) {
  const result = {};
  for (const key in flat) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = flat[key];
  }
  return result;
}

// Process each file
FILES_TO_PROCESS.forEach((fileName) => {
  console.log(`\nProcessing ${fileName}:`);

  // Read English as reference
  const enPath = path.join(LOCALES_DIR, 'en', fileName);
  if (!fs.existsSync(enPath)) {
    console.log(`  ✗ EN file not found: ${fileName}`);
    return;
  }

  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const enFlat = flattenKeys(enData);

  console.log(`  EN has ${Object.keys(enFlat).length} keys`);

  // For each non-EN language, add missing keys with [TODO] prefix
  LANGUAGES.forEach((lang) => {
    const langPath = path.join(LOCALES_DIR, lang, fileName);
    const langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    const langFlat = flattenKeys(langData);

    const missing = [];
    for (const key in enFlat) {
      if (!(key in langFlat)) {
        langFlat[key] = `[TODO] ${enFlat[key]}`;
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      const updated = unflattenKeys(langFlat);
      fs.writeFileSync(langPath, JSON.stringify(updated, null, 2) + '\n');
      console.log(`    ${lang}: added ${missing.length} missing keys`);
    } else {
      console.log(`    ${lang}: no missing keys`);
    }
  });
});

console.log('\nDone!');
