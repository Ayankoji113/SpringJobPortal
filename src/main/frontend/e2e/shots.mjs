/* Screenshot harness. Needs a running dev server; the API is mocked in the browser.
     npx vite --port 5180 --strictPort
     node e2e/shots.mjs --base http://localhost:5180 --out design-audit/before [--only name[,name]]
   Uses the system Chrome (or Edge) — no Playwright browser download. */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { mockApi } from './fixtures.mjs';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

/* Add a page: { name, path, role }. role is 'anon' | 'seeker' | 'employer' | 'newemployer' | 'admin'.
   Optional: `action(page)` runs after load to reach an interaction state (return false to
   skip the shot, e.g. a control that does not exist at this viewport); `viewports` limits
   which viewports the entry runs at. */
const ROUTES = [
  { name: 'anon-home', path: '/', role: 'anon' },
  { name: 'anon-jobs', path: '/jobs', role: 'anon' },
  { name: 'anon-jobs-filtered', path: '/jobs?location=Bengaluru', role: 'anon' },
  { name: 'anon-job-detail', path: '/job/1', role: 'anon' },
  { name: 'anon-login', path: '/login', role: 'anon' },
  { name: 'anon-register', path: '/register', role: 'anon' },
  { name: 'anon-forgot-password', path: '/forgot-password', role: 'anon' },
  { name: 'anon-reset-password', path: '/reset-password?token=mock-reset-token', role: 'anon' },
  { name: 'anon-not-found', path: '/this-page-does-not-exist', role: 'anon' },

  { name: 'seeker-home', path: '/', role: 'seeker' },
  { name: 'seeker-jobs', path: '/jobs', role: 'seeker' },
  { name: 'seeker-job-detail', path: '/job/1', role: 'seeker' },
  { name: 'seeker-my-applications', path: '/my-applications', role: 'seeker' },
  { name: 'seeker-saved-jobs', path: '/saved-jobs', role: 'seeker' },
  { name: 'seeker-recommendations', path: '/recommendations', role: 'seeker' },
  { name: 'seeker-profile', path: '/profile', role: 'seeker' },
  { name: 'seeker-notifications', path: '/notifications', role: 'seeker' },

  { name: 'employer-dashboard', path: '/employer-dashboard', role: 'employer' },
  { name: 'employer-manage-applications', path: '/manage-applications', role: 'employer' },
  { name: 'employer-post-job', path: '/post-job', role: 'employer' },
  { name: 'employer-edit-job', path: '/post-job/1', role: 'employer' },
  { name: 'employer-profile', path: '/profile', role: 'employer' },
  { name: 'employer-notifications', path: '/notifications', role: 'employer' },

  { name: 'employer-dashboard-new', path: '/employer-dashboard', role: 'newemployer' },
  { name: 'admin-review', path: '/admin', role: 'admin' },
  { name: 'admin-audit-log', path: '/admin?tab=log', role: 'admin' },

  // Interaction states
  {
    name: 'seeker-job-detail-apply-modal', path: '/job/1', role: 'seeker',
    action: async (page) => {
      await page.getByRole('button', { name: 'Apply now' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'seeker-my-applications-history', path: '/my-applications', role: 'seeker',
    action: async (page) => {
      await page.locator('summary', { hasText: 'History' }).nth(2).click();
      await page.locator('.jp-timeline__list').waitFor();
    },
  },
  {
    name: 'employer-dashboard-remove-modal', path: '/employer-dashboard', role: 'employer',
    action: async (page) => {
      await page.getByRole('button', { name: /^Close or delete/ }).first().click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'employer-manage-applications-move', path: '/manage-applications', role: 'employer',
    action: async (page) => {
      await page.getByRole('button', { name: 'Reject' }).first().click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'admin-reject-modal', path: '/admin', role: 'admin',
    action: async (page) => {
      await page.getByRole('button', { name: 'Reject' }).first().click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'seeker-nav-open', path: '/jobs', role: 'seeker',
    action: async (page) => {
      const toggle = page.getByRole('button', { name: 'Open menu' });
      if (!(await toggle.isVisible())) return false;
      await toggle.click();
    },
  },
  {
    name: 'anon-jobs-filter-drawer', path: '/jobs', role: 'anon',
    action: async (page) => {
      const trigger = page.locator('.jp-filters__trigger');
      if (!(await trigger.isVisible())) return false;
      await trigger.click();
      await page.getByRole('dialog').waitFor();
    },
  },
];

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5180' },
    out: { type: 'string', default: 'design-audit/before' },
    only: { type: 'string' },
  },
});
const only = args.only?.split(',');
const routes = only ? ROUTES.filter((r) => only.includes(r.name)) : ROUTES;
if (routes.length === 0) throw new Error(`--only matched nothing. Names: ${ROUTES.map((r) => r.name).join(', ')}`);

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const report = [];

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  await mkdir(path.join(args.out, viewportName), { recursive: true });

  for (const route of routes) {
    if (route.viewports && !route.viewports.includes(viewportName)) continue;
    const label = `${viewportName}/${route.name}`;
    const issues = [];
    // A context per shot: nothing (storage, query cache) leaks between pages or roles.
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') issues.push(`console: ${msg.text()}`); });
    page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => issues.push(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText})`));
    page.on('response', (res) => { if (res.status() >= 400) issues.push(`HTTP ${res.status()}: ${res.request().method()} ${res.url()}`); });
    const unmocked = await mockApi(page, route.role);

    let state = 'ok';
    try {
      await page.goto(args.base + route.path, { waitUntil: 'networkidle' });
      const landed = new URL(page.url()).pathname;
      if (landed !== new URL(args.base + route.path).pathname) issues.push(`redirected to ${landed}`);
      if (route.action && (await route.action(page)) === false) state = 'skipped (not applicable at this viewport)';
      if (state === 'ok') {
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(args.out, viewportName, `${route.name}.png`), fullPage: true, animations: 'disabled' });
      }
    } catch (err) {
      state = 'FAILED';
      issues.push(`harness: ${err.message.split('\n')[0]}`);
    }
    issues.push(...unmocked.map((u) => `UNMOCKED API: ${u}`));
    await context.close();

    console.log(`${state === 'ok' ? 'ok  ' : state === 'FAILED' ? 'FAIL' : 'skip'} ${label}${state.startsWith('skipped') ? ` — ${state}` : ''}`);
    issues.forEach((i) => console.log(`       ${i}`));
    report.push({ label, state, issues });
  }
}
await browser.close();

const shot = report.filter((r) => r.state === 'ok').length;
const failed = report.filter((r) => r.state === 'FAILED');
const noisy = report.filter((r) => r.issues.length > 0);
console.log(`\n${shot} screenshots in ${args.out}; ${noisy.length} page(s) reported issues; ${failed.length} failed to capture.`);
// Console errors are reported, not fatal. Only a page the harness could not capture fails the run.
process.exitCode = failed.length ? 1 : 0;
