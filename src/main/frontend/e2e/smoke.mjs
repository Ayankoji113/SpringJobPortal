// Real-backend smoke test: no mocks. Registers a throwaway job seeker and an employer through the
// API, then walks the pages each can reach and reports console errors and failed API calls.
//
//   node e2e/smoke.mjs --base http://localhost:5173 --api http://localhost:8081/api
//
// The frontend at --base must be built or served with VITE_API_URL pointing at the same --api.
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({ options: { base: { type: 'string' }, api: { type: 'string' } } });
const base = values.base || 'http://localhost:5173';
const api = values.api || 'http://localhost:8080/api';
const stamp = Date.now();

async function register(role) {
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: `Smoke ${role}`, email: `smoke-${role.toLowerCase()}-${stamp}@example.com`,
      password: 'Smoke-12345', role,
    }),
  });
  if (!res.ok) throw new Error(`register ${role}: ${res.status} ${await res.text()}`);
  return res.json();
}

const jobs = await (await fetch(`${api}/jobs/paginated?size=1`)).json();
const jobId = jobs.content?.[0]?.postId;
if (!jobId) throw new Error('No published job in the database to test against');

const VISITS = {
  anon: ['/', '/jobs', '/jobs?keyword=engineer', `/job/${jobId}`, '/login', '/register', '/nope'],
  JOB_SEEKER: ['/', '/jobs', `/job/${jobId}`, '/my-applications', '/saved-jobs', '/recommendations', '/profile', '/notifications'],
  EMPLOYER: ['/employer-dashboard', '/manage-applications', '/post-job', '/profile', '/notifications'],
};

const browser = await chromium.launch({ channel: 'chrome' });
let problems = 0;

for (const [role, paths] of Object.entries(VISITS)) {
  const session = role === 'anon' ? null : await register(role);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (session) {
    await context.addInitScript((s) => {
      localStorage.setItem('token', s.token);
      if (s.refreshToken) localStorage.setItem('refreshToken', s.refreshToken);
      localStorage.setItem('user', JSON.stringify(s));
    }, session);
  }
  const page = await context.newPage();
  for (const path of paths) {
    const issues = [];
    const onConsole = (m) => m.type() === 'error' && issues.push(`console: ${m.text().slice(0, 160)}`);
    const onResponse = (r) => {
      if (r.url().includes('/api/') && r.status() >= 400) issues.push(`${r.status()} ${r.request().method()} ${r.url().replace(api, '')}`);
    };
    const onCrash = (e) => issues.push(`pageerror: ${String(e).slice(0, 160)}`);
    page.on('console', onConsole); page.on('response', onResponse); page.on('pageerror', onCrash);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const boundary = await page.getByText('Something went wrong').count();
    if (boundary) issues.push('error boundary shown');
    const heading = (await page.locator('h1').first().textContent().catch(() => '')) || '';
    page.off('console', onConsole); page.off('response', onResponse); page.off('pageerror', onCrash);
    problems += issues.length;
    console.log(`${issues.length ? 'FAIL' : 'ok  '} ${role.padEnd(10)} ${path.padEnd(28)} h1="${heading.trim().slice(0, 40)}"`);
    issues.forEach((i) => console.log(`       ${i}`));
  }

  // One real write through the UI for the seeker: apply, then see it in the list.
  if (role === 'JOB_SEEKER') {
    await page.goto(`${base}/job/${jobId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Apply now' }).first().click();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await page.waitForURL('**/my-applications', { timeout: 10000 });
    await page.locator('.jp-clock').first().waitFor({ timeout: 10000 }).catch(() => {});
    const clocks = await page.locator('.jp-clock').count();
    const ok = clocks > 0;
    if (!ok) problems += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} JOB_SEEKER applied to job ${jobId}; response clocks on the applications page: ${clocks}`);
  }
  await context.close();
}

await browser.close();
console.log(problems ? `\n${problems} problem(s)` : '\nNo problems');
process.exit(problems ? 1 : 0);
