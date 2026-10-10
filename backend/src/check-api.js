"use strict";

const baseUrl = (process.env.TAMPTOOLS_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const checks = [
  ["/api/health", body => body && body.ok === true],
  ["/api/plans", body => {
    const items = Array.isArray(body) ? body : body && body.plans;
    return Array.isArray(items) && items.length > 0;
  }],
  ["/api/tools", body => {
    const items = Array.isArray(body) ? body : body && body.tools;
    return Array.isArray(items) && items.length > 0;
  }],
  ["/api/locale", body => Boolean(body && body.country && body.currency && body.language && Array.isArray(body.supportedCurrencies))],
  ["/api/i18n?lang=fr", body => Boolean(
  body &&
  body.language === "fr" &&
  body.translations &&
  body.translations["Sign in"] === "Se connecter" &&
  body.translations["Get started"] === "Commencer"
)]];

async function main() {
  console.log("TAMPtools API integration check");
  console.log(`Server: ${baseUrl}\n`);
  let failures = 0;

  for (const [path, validate] of checks) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        response = await fetch(`${baseUrl}${path}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }

      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = null; }

      if (!response.ok) {
        failures++;
        console.log(`✗ GET ${path} — HTTP ${response.status}`);
      } else if (!validate(body)) {
        failures++;
        console.log(`✗ GET ${path} — unexpected response`);
      } else {
        console.log(`✓ GET ${path} — HTTP ${response.status}`);
      }
    } catch (error) {
      failures++;
      console.log(`✗ GET ${path} — ${error.name === "AbortError" ? "timed out" : error.message}`);
    }
  }

  console.log("\n----------------------------------------");
  if (failures) {
    console.log(`FAIL: ${failures} API check(s) failed.`);
    console.log("Start the server first with: npm run dev");
    process.exitCode = 1;
  } else {
    console.log(`PASS: all ${checks.length} API integration checks passed.`);
  }
}

main();
