#!/usr/bin/env node
/**
 * TAMPtools localization audit. Checks actual locale resources, not runtime
 * English fallback, so incomplete dictionaries cannot appear 100% complete.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'frontend', 'ui-translations.json');
const reportDir = path.join(root, 'reports');
const expectedLocales = ['en','en_gb','zh','es','fr','de','pt','ru','id','tr','hi','bn','ar','ar_eg','ur','ja','mr','vi','te','ha','zu','pcm'];
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const canonical = catalog.en || {};
const keys = Object.keys(canonical);
const placeholderPattern = /\{\{?\s*([\w.-]+)\s*\}?\}/g;
function placeholders(s) { return [...String(s).matchAll(placeholderPattern)].map(m=>m[1]).sort(); }
const locales = expectedLocales.map(locale => {
  const dict = catalog[locale] || {};
  const missing = keys.filter(k => !(k in dict));
  const empty = keys.filter(k => (k in dict) && (typeof dict[k] !== 'string' || !dict[k].trim()));
  const extras = Object.keys(dict).filter(k => !(k in canonical));
  const mismatchedPlaceholders = keys.filter(k => typeof dict[k] === 'string' && dict[k].trim() && JSON.stringify(placeholders(canonical[k])) !== JSON.stringify(placeholders(dict[k]))).map(k=>({key:k,source:placeholders(canonical[k]),translation:placeholders(dict[k])}));
  const identical = locale === 'en' ? [] : keys.filter(k => typeof dict[k] === 'string' && dict[k].trim() && dict[k] === canonical[k]);
  const translated = keys.filter(k => typeof dict[k] === 'string' && dict[k].trim() && (locale === 'en' || dict[k] !== canonical[k])).length;
  const coverage = keys.length ? +(translated / keys.length * 100).toFixed(2) : 100;
  return {locale,requiredKeys:keys.length,presentKeys:keys.length-missing.length,translatedKeys:translated,missingKeys:missing.length,emptyValues:empty.length,extraKeys:extras.length,placeholderMismatches:mismatchedPlaceholders.length,suspectedUntranslated:identical.length,coveragePercent:coverage,status:missing.length||empty.length||mismatchedPlaceholders.length?'FAIL':identical.length?'REVIEW':'PASS',missing,empty,extras,mismatchedPlaceholders,suspectedUntranslatedKeys:identical};
});
const absentLocales = expectedLocales.filter(l=>!(l in catalog));
const unexpectedLocales = Object.keys(catalog).filter(l=>!expectedLocales.includes(l));
const report = {generatedAt:new Date().toISOString(),source:'frontend/ui-translations.json',canonicalLocale:'en',expectedLocaleCount:22,configuredLocaleCount:Object.keys(catalog).length,canonicalKeyCount:keys.length,absentLocales,unexpectedLocales,locales,overall:{allLocalesPresent:absentLocales.length===0,allKeysPresent:locales.every(l=>l.missingKeys===0&&l.emptyValues===0),allPlaceholdersValid:locales.every(l=>l.placeholderMismatches===0),minimumCoveragePercent:Math.min(...locales.map(l=>l.coveragePercent)),fullyTranslatedLocales:locales.filter(l=>l.coveragePercent===100).length}};
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'i18n-audit.json'),JSON.stringify(report,null,2)+'\n');
const lines=['# TAMPtools 22-language localization audit','',`Generated: ${report.generatedAt}`,'',`- Expected locales: ${report.expectedLocaleCount}`,`- Configured locales: ${report.configuredLocaleCount}`,`- Canonical English keys: ${report.canonicalKeyCount}`,`- Fully translated locales (excluding English): ${locales.filter(l=>l.locale!=='en'&&l.coveragePercent===100).length}/21`,`- Minimum estimated translation coverage: ${report.overall.minimumCoveragePercent}%`,'','Coverage is computed from locale-specific strings that differ from English. Identical strings are flagged for review because some may be legitimate shared terms. Runtime English fallback is not counted as a translation.','','| Locale | Coverage | Missing keys | Empty | Placeholder mismatches | Suspected English | Status |','|---|---:|---:|---:|---:|---:|---|'];
for(const l of locales) lines.push(`| ${l.locale} | ${l.coveragePercent}% | ${l.missingKeys} | ${l.emptyValues} | ${l.placeholderMismatches} | ${l.suspectedUntranslated} | ${l.status} |`);
lines.push('','## Acceptance status','','This audit is diagnostic, not a claim of translation completion. A release should be blocked until each locale has full required-key coverage, placeholder checks pass, suspected English is reviewed, and native-speaker quality assurance is recorded.','','## Missing keys');
for(const l of locales.filter(x=>x.missing.length)) lines.push(`### ${l.locale}`, ...l.missing.map(k=>`- ${k}`));
lines.push('','## Placeholder mismatches');
for(const l of locales.filter(x=>x.mismatchedPlaceholders.length)) lines.push(`### ${l.locale}`, ...l.mismatchedPlaceholders.map(x=>`- ${x.key}: source [${x.source.join(', ')}], translation [${x.translation.join(', ')}]`));
fs.writeFileSync(path.join(reportDir,'i18n-audit.md'),lines.join('\n')+'\n');
console.log(`TAMPtools i18n audit: ${report.overall.fullyTranslatedLocales}/21 non-English locales at 100% coverage; minimum ${report.overall.minimumCoveragePercent}%.`);
console.log(`Reports: reports/i18n-audit.md and reports/i18n-audit.json`);
if(absentLocales.length||unexpectedLocales.length||!report.overall.allKeysPresent||!report.overall.allPlaceholdersValid||report.overall.minimumCoveragePercent<100) process.exitCode=1;
