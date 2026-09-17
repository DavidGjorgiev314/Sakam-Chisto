import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const sourcePath = join(root, 'docs', 'REPORT.md');
const pdfPath = join(root, 'docs', 'report.pdf');

const CSS = `
@page { size: A4; margin: 17mm 15mm; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 9.4pt; line-height: 1.34; color: #16181d; }
h1 { font-size: 17pt; }
h2 { font-size: 13pt; margin-top: 0.9em; margin-bottom: 0.35em; border-bottom: 1px solid #d9dde3; padding-bottom: 3px; page-break-after: avoid; }
h3 { font-size: 11pt; margin-top: 0.8em; margin-bottom: 0.3em; page-break-after: avoid; }
p { margin: 0.42em 0; }
code { font-family: Consolas, "Courier New", monospace; font-size: 8.8pt; background: #f2f4f7; padding: 1px 3px; border-radius: 3px; }
pre { background: #f7f8fa; border: 1px solid #e2e6eb; border-radius: 4px; padding: 6px 8px; margin: 0.5em 0; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 8.2pt; line-height: 1.32; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0; font-size: 8.8pt; }
th, td { border: 1px solid #ccd2da; padding: 3px 5px; text-align: left; vertical-align: top; }
th { background: #eef1f5; }
tr { page-break-inside: avoid; }
img { max-width: 100%; max-height: 62mm; display: block; margin: 6px auto 2px; border: 1px solid #d9dde3; page-break-inside: avoid; }
p:has(> em:only-child) { font-size: 8.8pt; color: #444; text-align: center; margin: 0 0 9px; }
a { color: #0b5fa5; text-decoration: none; word-break: break-all; }
ul, ol { margin: 0.4em 0 0.6em; padding-left: 1.4em; }
li { margin: 0.15em 0; }
blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid #ccd2da; color: #444; }
.titlepage { text-align: center; margin-top: 52mm; }
.titlepage h1 { font-size: 21pt; border: none; margin: 0 0 6px; line-height: 1.25; }
.titlepage .subtitle { font-size: 14pt; color: #555; margin: 0; }
.titlepage table.meta { width: 74%; margin: 26mm auto 0; font-size: 11pt; }
.titlepage table.meta td { border: none; padding: 3px 8px; }
.titlepage table.meta td:first-child { text-align: right; color: #5a6270; width: 34%; }
.titlepage table.meta td:last-child { text-align: left; font-weight: 600; }
.pagebreak { page-break-after: always; height: 0; }
`;

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const markedModule = await import('marked');
const marked = markedModule.marked ?? markedModule.default?.marked ?? markedModule.default;

if (!existsSync(sourcePath)) {
  console.error(`Report source not found at ${sourcePath}`);
  console.error('The report source is kept out of version control; place it there before running this script.');
  process.exit(1);
}

const markdown = readFileSync(sourcePath, 'utf8');
const body = marked.parse(markdown, { gfm: true });
const docsDir = join(root, 'docs');
const baseHref = pathToFileURL(docsDir).href + '/';

const html = `<!doctype html>
<html lang="mk"><head><meta charset="utf-8">
<base href="${baseHref}">
<title>SakamChisto - проектна задача</title>
<style>${CSS}</style>
</head><body>${body}</body></html>`;

const workDir = mkdtempSync(join(tmpdir(), 'report-'));
const htmlPath = join(workDir, 'report.html');
writeFileSync(htmlPath, html, 'utf8');

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chrome or Edge found. Point BROWSERS at your browser executable.');
  process.exit(1);
}

const result = spawnSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
  '--virtual-time-budget=8000',
  `--print-to-pdf=${pdfPath}`,
  pathToFileURL(htmlPath).href,
], { stdio: ['ignore', 'ignore', 'inherit'] });

if (!existsSync(pdfPath)) {
  console.error('PDF was not produced. Browser exit code:', result.status);
  process.exit(1);
}

const raw = readFileSync(pdfPath).toString('latin1');
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`browser : ${browser}`);
console.log(`written : ${pdfPath}`);
console.log(`pages   : ${pages > 0 ? pages : 'could not determine from PDF structure'}`);
if (pages > 10) console.log('WARNING : over the 10 page limit - trim before submitting');
if (pages > 0 && pages < 3) console.log('WARNING : under the 3 page minimum');
