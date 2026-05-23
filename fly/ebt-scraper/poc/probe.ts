/**
 * PoC: ebt.ca.gov unauthenticated reconnaissance.
 *
 * What this script does (no credentials needed):
 *   1. Open the login page in Playwright headless Chromium
 *   2. Record:
 *      - HTML structure of the login form (input names, CSRF tokens, hidden fields)
 *      - Response headers (CORS, Set-Cookie patterns, Server, X-Frame-Options)
 *      - Anti-bot detection (Cloudflare challenge, captcha widgets, JS challenge)
 *      - All cookie names set on the initial GET
 *   3. Append findings to `poc/findings.md` with timestamp
 *
 * Output: `poc/findings.md` (this script appends, never truncates).
 *
 * Run:  npm run probe   (or: npx tsx poc/probe.ts)
 *
 * Resolves: CMT-1 (session cookie names + portal anti-bot posture). The
 * paired probe-authed.ts script measures cookie TTL and transaction depth
 * with a real test card; only Matthew can run that one.
 */

import { chromium, type Response } from "playwright";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const POC_DIR = dirname(fileURLToPath(import.meta.url));
const FINDINGS_PATH = join(POC_DIR, "findings.md");

const TARGET_URLS = [
  { name: "root", url: "https://www.ebt.ca.gov/" },
  { name: "cardholder", url: "https://www.ebt.ca.gov/cardholder/" },
  { name: "login", url: "https://www.ebt.ca.gov/cardholder/login" },
];

interface UrlFinding {
  name: string;
  url: string;
  finalUrl: string;
  status: number | "n/a";
  responseHeaders: Record<string, string>;
  cookies: { name: string; domain: string; expires: number; httpOnly: boolean; secure: boolean; sameSite?: string }[];
  formInputs: { name: string; type: string; required: boolean }[];
  hiddenFields: { name: string; valuePreview: string }[];
  csrfDetected: boolean;
  cloudflareDetected: boolean;
  captchaDetected: boolean;
  jsChallengeDetected: boolean;
  htmlLengthBytes: number;
  errorMessage?: string;
}

async function probeUrl(target: typeof TARGET_URLS[number]): Promise<UrlFinding> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    // Reasonable real-looking UA so we measure "what does the portal show a
    // typical desktop visitor" — not "what does the portal show a bot".
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const finding: UrlFinding = {
    name: target.name,
    url: target.url,
    finalUrl: target.url,
    status: "n/a",
    responseHeaders: {},
    cookies: [],
    formInputs: [],
    hiddenFields: [],
    csrfDetected: false,
    cloudflareDetected: false,
    captchaDetected: false,
    jsChallengeDetected: false,
    htmlLengthBytes: 0,
  };

  try {
    let response: Response | null = null;
    try {
      response = await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } catch (e) {
      finding.errorMessage = `goto failed: ${(e as Error).message}`;
      return finding;
    }

    finding.finalUrl = page.url();
    if (response) {
      finding.status = response.status();
      finding.responseHeaders = await response.allHeaders();
    }

    const cookies = await context.cookies();
    finding.cookies = cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));

    const html = await page.content();
    finding.htmlLengthBytes = html.length;

    // Anti-bot detection
    const lower = html.toLowerCase();
    finding.cloudflareDetected =
      lower.includes("cf-challenge") ||
      lower.includes("cf-turnstile") ||
      lower.includes("just a moment") ||
      (finding.responseHeaders["server"] ?? "").toLowerCase().includes("cloudflare") ||
      "cf-ray" in finding.responseHeaders;
    finding.captchaDetected =
      lower.includes("recaptcha") ||
      lower.includes("hcaptcha") ||
      lower.includes("turnstile") ||
      lower.includes("verify you are human");
    finding.jsChallengeDetected =
      lower.includes("challenge-running") || lower.includes("__cf_chl");

    // Form structure
    finding.formInputs = await page
      .$$eval("input:not([type='hidden'])", (els) =>
        els.map((el) => ({
          name: (el as HTMLInputElement).name || "(no-name)",
          type: (el as HTMLInputElement).type || "text",
          required: (el as HTMLInputElement).required,
        })),
      )
      .catch(() => []);
    finding.hiddenFields = await page
      .$$eval("input[type='hidden']", (els) =>
        els.map((el) => {
          const input = el as HTMLInputElement;
          return {
            name: input.name || "(no-name)",
            valuePreview: (input.value || "").slice(0, 32),
          };
        }),
      )
      .catch(() => []);

    finding.csrfDetected =
      finding.hiddenFields.some((f) => /csrf|token|authenticity/i.test(f.name)) ||
      "x-csrf-token" in finding.responseHeaders ||
      "x-xsrf-token" in finding.responseHeaders;

    return finding;
  } finally {
    await context.close();
    await browser.close();
  }
}

function formatFinding(f: UrlFinding): string {
  const lines: string[] = [];
  lines.push(`### \`${f.name}\` — \`${f.url}\``);
  lines.push("");
  lines.push(`- **Final URL:** \`${f.finalUrl}\``);
  lines.push(`- **HTTP status:** \`${f.status}\``);
  lines.push(`- **HTML length:** ${f.htmlLengthBytes} bytes`);
  if (f.errorMessage) {
    lines.push(`- **ERROR:** ${f.errorMessage}`);
  }
  lines.push("");
  lines.push("#### Anti-bot detection");
  lines.push(`- Cloudflare detected: **${f.cloudflareDetected}**`);
  lines.push(`- Captcha detected: **${f.captchaDetected}**`);
  lines.push(`- JS challenge detected: **${f.jsChallengeDetected}**`);
  lines.push("");
  lines.push("#### Cookies (Set-Cookie on initial GET)");
  if (f.cookies.length === 0) {
    lines.push("- (none)");
  } else {
    for (const c of f.cookies) {
      const expiry = c.expires > 0 ? new Date(c.expires * 1000).toISOString() : "session";
      lines.push(`- \`${c.name}\` (domain=\`${c.domain}\`, expires=${expiry}, httpOnly=${c.httpOnly}, secure=${c.secure}, sameSite=${c.sameSite ?? "?"})`);
    }
  }
  lines.push("");
  lines.push("#### Form inputs (non-hidden)");
  if (f.formInputs.length === 0) {
    lines.push("- (none)");
  } else {
    for (const i of f.formInputs) {
      lines.push(`- \`name=${i.name}\` type=\`${i.type}\` required=${i.required}`);
    }
  }
  lines.push("");
  lines.push("#### Hidden fields (CSRF / authenticity tokens)");
  if (f.hiddenFields.length === 0) {
    lines.push("- (none)");
  } else {
    for (const h of f.hiddenFields) {
      lines.push(`- \`${h.name}\` = \`${h.valuePreview}${h.valuePreview.length === 32 ? "…" : ""}\``);
    }
  }
  lines.push(`- CSRF detected: **${f.csrfDetected}**`);
  lines.push("");
  lines.push("#### Notable response headers");
  const interesting = [
    "server",
    "cf-ray",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "content-security-policy",
    "access-control-allow-origin",
    "set-cookie",
  ];
  for (const k of interesting) {
    if (k in f.responseHeaders) {
      lines.push(`- \`${k}\`: \`${f.responseHeaders[k]!.slice(0, 200)}\``);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  mkdirSync(POC_DIR, { recursive: true });

  const header = `# ebt.ca.gov PoC findings

> Auto-generated by \`fly/ebt-scraper/poc/probe.ts\`. Each run **appends** a new
> section so you can compare day-over-day changes.

`;

  // Truncate-then-write only if the file doesn't exist yet; otherwise append.
  let existing = "";
  try {
    existing = (await import("node:fs")).readFileSync(FINDINGS_PATH, "utf8");
  } catch {
    /* file does not exist; we'll create it */
  }
  if (!existing) {
    writeFileSync(FINDINGS_PATH, header, "utf8");
  }

  const runHeader = `\n## Run @ ${new Date().toISOString()}\n\nProbe target list: ${TARGET_URLS.map((t) => t.name).join(", ")}.\n\n`;
  appendFileSync(FINDINGS_PATH, runHeader);

  const findings: UrlFinding[] = [];
  for (const target of TARGET_URLS) {
    // eslint-disable-next-line no-console
    console.log(`[probe] fetching ${target.name} (${target.url})`);
    const finding = await probeUrl(target);
    findings.push(finding);
    appendFileSync(FINDINGS_PATH, formatFinding(finding) + "\n");
  }

  // Cross-target summary at the end of the run
  const summary: string[] = [];
  summary.push("### Run summary");
  summary.push("");
  summary.push(`- Cloudflare detected on any target: **${findings.some((f) => f.cloudflareDetected)}**`);
  summary.push(`- Captcha detected on any target: **${findings.some((f) => f.captchaDetected)}**`);
  summary.push(`- All targets returned HTTP 2xx: **${findings.every((f) => typeof f.status === "number" && f.status >= 200 && f.status < 300)}**`);
  const allCookies = new Set<string>();
  for (const f of findings) for (const c of f.cookies) allCookies.add(`${c.name}@${c.domain}`);
  summary.push(`- Total unique cookies observed: ${allCookies.size}`);
  if (allCookies.size > 0) {
    summary.push("");
    summary.push("Observed cookie names:");
    for (const c of [...allCookies].sort()) summary.push(`- \`${c}\``);
  }
  summary.push("");
  summary.push("---");
  appendFileSync(FINDINGS_PATH, "\n" + summary.join("\n") + "\n");

  // eslint-disable-next-line no-console
  console.log(`[probe] findings appended to ${FINDINGS_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[probe] fatal:", err);
  process.exit(1);
});
