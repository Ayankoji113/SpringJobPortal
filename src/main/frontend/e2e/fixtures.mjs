/* Mock data + API mock for the screenshot harness. Shapes follow the Java DTOs
   (JobResponse, ApplicationResponse, UserResponse, ...). No backend is involved. */

// LocalDateTime on the wire has no zone; the app parses it as local time.
const at = (daysAgo, hours = 0) => {
  const d = new Date(Date.now() - daysAgo * 864e5 - hours * 36e5);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
};

/* ------------------------------------------------------------------ users */
export const USERS = {
  seeker: {
    id: 1, fullName: 'Rohan Mehta', email: 'rohan.mehta@example.in', role: 'JOB_SEEKER',
    phone: '+91 98200 41276', location: 'Pune, Maharashtra',
    bio: 'Backend engineer with six years building payment and logistics systems on the JVM. Comfortable owning a service from schema design to on-call. Looking for a senior role with real distributed-systems problems.',
    profilePhotoPath: 'uploads/photos/rohan-mehta.jpg', resumePath: 'uploads/resumes/rohan-mehta-2026.pdf',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'React'],
    experienceYears: 6, currentJobTitle: 'Software Engineer II',
    linkedinUrl: 'https://www.linkedin.com/in/rohan-mehta-dev', githubUrl: 'https://github.com/rohan-mehta-dev',
    portfolioUrl: 'https://rohanmehta.dev', isEmailVerified: true, isProfilePublic: true, createdAt: at(210),
  },
  employer: {
    id: 2, fullName: 'Ananya Iyer', email: 'ananya.iyer@kaverisystems.in', role: 'EMPLOYER',
    phone: '+91 80 4718 2290', location: 'Bengaluru, Karnataka',
    bio: 'Head of Talent at Kaveri Systems. We build core-banking infrastructure for co-operative banks and NBFCs across India.',
    profilePhotoPath: 'uploads/photos/ananya-iyer.jpg', resumePath: null,
    skills: [], experienceYears: 11, currentJobTitle: 'Head of Talent',
    linkedinUrl: 'https://www.linkedin.com/in/ananya-iyer-talent', githubUrl: '', portfolioUrl: 'https://kaverisystems.in/careers',
    isEmailVerified: true, isProfilePublic: true, createdAt: at(400),
  },
};

const summary = (u) => ({ id: u.id, fullName: u.fullName, email: u.email, profilePhotoPath: u.profilePhotoPath, currentJobTitle: u.currentJobTitle });

/** What authService stores under localStorage 'user' (AuthResponse). */
export const authUser = (role) => {
  const u = USERS[role];
  return {
    token: `mock.jwt.${role}`, refreshToken: `mock.refresh.${role}`,
    id: u.id, fullName: u.fullName, email: u.email, role: u.role,
    profilePhotoPath: u.profilePhotoPath, skills: u.skills,
  };
};

const RECRUITERS = [
  summary(USERS.employer),
  { id: 3, fullName: 'Vikram Nair', email: 'vikram@nimbuspay.in', profilePhotoPath: null, currentJobTitle: 'Engineering Manager' },
  { id: 4, fullName: 'Sneha Kulkarni', email: 'sneha.k@taranglabs.com', profilePhotoPath: null, currentJobTitle: 'Talent Partner' },
  { id: 5, fullName: 'Arjun Reddy', email: 'arjun@mandiroute.in', profilePhotoPath: null, currentJobTitle: 'CTO' },
  { id: 6, fullName: 'Farah Sheikh', email: 'farah@swasthcloud.in', profilePhotoPath: null, currentJobTitle: 'People Operations Lead' },
];

/* -------------------------------------------------------------- companies */
export const COMPANIES = [
  { id: 1, name: 'Kaveri Systems', industry: 'Banking software', size: '201-500', location: 'Bengaluru, Karnataka', website: 'https://kaverisystems.in', description: 'Core-banking and lending infrastructure for co-operative banks and NBFCs.' },
  { id: 2, name: 'Nimbus Pay', industry: 'Fintech', size: '501-1000', location: 'Mumbai, Maharashtra', website: 'https://nimbuspay.in', description: 'UPI and card payment gateway processing 40M transactions a day.' },
  { id: 3, name: 'Tarang Labs', industry: 'Developer tools', size: '51-200', location: 'Pune, Maharashtra', website: 'https://taranglabs.com', description: 'Observability platform for teams running Kubernetes at scale.' },
  { id: 4, name: 'MandiRoute', industry: 'Agri-logistics', size: '51-200', location: 'Hyderabad, Telangana', website: 'https://mandiroute.in', description: 'Routing and cold-chain tracking for farm-to-market produce.' },
  { id: 5, name: 'Swasth Cloud', industry: 'Health tech', size: '11-50', location: 'Chennai, Tamil Nadu', website: 'https://swasthcloud.in', description: 'ABDM-compliant electronic health records for clinics and diagnostic labs.' },
].map((c, i) => ({ ...c, logoPath: null, owner: RECRUITERS[i], createdAt: at(300 + i * 40) }));

const companySummary = (c) => ({ id: c.id, name: c.name, logoPath: c.logoPath, location: c.location });

/* ------------------------------------------------------------------- jobs */
const job = (postId, companyIdx, postProfile, salaryMin, salaryMax, location, reqExperience, postTechStack, daysAgo, extra = {}) => ({
  postId, postProfile, reqExperience, postTechStack,
  postedBy: RECRUITERS[companyIdx], company: companySummary(COMPANIES[companyIdx]),
  salaryMin, salaryMax, location, jobType: 'FULL_TIME', isRemote: false, isActive: true, isFeatured: false,
  status: 'PUBLISHED', moderationReason: null, viewCount: 120 + postId * 73, postedDate: at(daysAgo, postId),
  postDesc: `We are hiring a ${postProfile} to join the ${COMPANIES[companyIdx].name} engineering team in ${location}.\n\nYou will work in a small, senior team that ships to production every day. Expect design reviews, a shared on-call rotation with a real follow-the-sun handover, and direct access to customers.\n\nWhat you will do\n• Own services end to end: design, build, deploy, and operate\n• Review code and designs, and mentor engineers earlier in their careers\n• Work with product and data teams to decide what to build next\n\nWhat we look for\n• ${reqExperience}+ years of relevant experience with ${postTechStack.slice(0, 3).join(', ')}\n• Clear written communication; most of our decisions happen in documents\n• Evidence that you have run what you built in production`,
  ...extra,
});

export const JOBS = [
  job(1, 0, 'Senior Backend Engineer (Java)', 2800000, 3800000, 'Bengaluru', 5, ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'AWS'], 1, { isFeatured: true }),
  job(2, 1, 'Staff Engineer, Payments Platform', 5500000, 7500000, 'Mumbai', 9, ['Go', 'Kafka', 'Cassandra', 'Kubernetes', 'gRPC'], 2),
  job(3, 2, 'Frontend Engineer (React)', 1800000, 2600000, 'Pune', 3, ['React', 'TypeScript', 'Vite', 'TanStack Query', 'CSS'], 2, { isRemote: true }),
  job(4, 0, 'DevOps Engineer', 2200000, 3200000, 'Bengaluru', 4, ['AWS', 'Terraform', 'Kubernetes', 'Prometheus', 'GitHub Actions'], 4),
  job(5, 3, 'Android Developer (Kotlin)', 1600000, 2400000, 'Hyderabad', 3, ['Kotlin', 'Jetpack Compose', 'Room', 'Coroutines'], 5),
  job(6, 4, 'Full Stack Developer', 1400000, 2000000, 'Chennai', 2, ['Node.js', 'React', 'PostgreSQL', 'Docker'], 6),
  job(7, 1, 'Data Engineer', 3000000, 4200000, 'Gurugram', 5, ['Python', 'Spark', 'Airflow', 'Snowflake', 'dbt', 'Kafka'], 8),
  job(8, 2, 'Site Reliability Engineer', 3200000, 4500000, 'Pune', 6, ['Linux', 'Kubernetes', 'Go', 'Grafana', 'PostgreSQL'], 9, { isRemote: true }),
  job(9, 0, 'QA Automation Engineer', 1200000, 1800000, 'Bengaluru', 2, ['Java', 'Selenium', 'Playwright', 'REST Assured'], 11, { jobType: 'CONTRACT' }),
  job(10, 3, 'Machine Learning Engineer', 3500000, 5000000, 'Hyderabad', 4, ['Python', 'PyTorch', 'MLflow', 'AWS SageMaker'], 13),
  job(11, 4, 'Backend Developer Intern', 480000, 600000, 'Chennai', 0, ['Java', 'Spring Boot', 'MySQL'], 16, { jobType: 'INTERNSHIP' }),
  job(12, 0, 'Engineering Manager, Lending', null, null, 'Noida', 10, ['Java', 'System Design', 'People Management'], 21),
];
const jobById = (id) => JOBS.find((j) => j.postId === Number(id));
const MY_JOBS = JOBS.filter((j) => j.postedBy.id === USERS.employer.id);

/* ----------------------------------------------------------- applications */
const NEXT = {
  PENDING: ['REVIEWED', 'REJECTED'], NO_RESPONSE: ['REVIEWED', 'REJECTED'], REVIEWED: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFERED', 'REJECTED'], OFFERED: ['ACCEPTED', 'REJECTED'], ACCEPTED: [], REJECTED: [], WITHDRAWN: [],
};
const COVER = 'I have spent the last four years building high-throughput Spring Boot services backed by PostgreSQL and Kafka, most recently a ledger that reconciles 12 million transactions a day. Your posting describes exactly the kind of ownership I am looking for, and I would like to bring that experience to your team.';

const application = (id, jobId, applicant, status, appliedDaysAgo, respondedDaysAgo) => ({
  id, jobPost: jobById(jobId), applicant, coverLetter: id % 4 === 0 ? null : COVER, status,
  appliedDate: at(appliedDaysAgo), respondBy: at(appliedDaysAgo - 14),
  respondedAt: respondedDaysAgo == null ? null : at(respondedDaysAgo), nextStatuses: NEXT[status],
});

const me = summary(USERS.seeker);
export const MY_APPLICATIONS = [
  application(101, 1, me, 'PENDING', 2, null),
  application(102, 3, me, 'REVIEWED', 6, 3),
  application(103, 2, me, 'INTERVIEW', 12, 9),
  application(104, 8, me, 'OFFERED', 24, 20),
  application(105, 7, me, 'REJECTED', 30, 22),
  application(106, 6, me, 'NO_RESPONSE', 19, null),
  application(107, 10, me, 'WITHDRAWN', 15, null),
];

const CANDIDATES = [
  ['Priya Sharma', 'Senior Software Engineer'], ['Karthik Subramanian', 'Backend Developer'], ['Aditi Deshpande', 'Software Engineer'],
  ['Mohammed Imran Khan', 'Java Developer'], ['Neha Agarwal', 'SDE II'], ['Siddharth Banerjee', 'Tech Lead'], ['Lakshmi Venkataraman', 'Platform Engineer'],
].map(([fullName, currentJobTitle], i) => ({
  id: 20 + i, fullName, email: `${fullName.toLowerCase().replaceAll(' ', '.')}@example.in`, profilePhotoPath: null, currentJobTitle,
}));
const applicationsForJob = (jobId) => [
  application(201, jobId, CANDIDATES[0], 'PENDING', 11, null), // deadline in 3 days -> danger badge
  application(202, jobId, CANDIDATES[1], 'PENDING', 2, null),
  application(203, jobId, CANDIDATES[2], 'REVIEWED', 5, 3),
  application(204, jobId, CANDIDATES[3], 'INTERVIEW', 9, 6),
  application(205, jobId, CANDIDATES[4], 'OFFERED', 20, 16),
  application(206, jobId, CANDIDATES[5], 'REJECTED', 13, 10),
  application(207, jobId, CANDIDATES[6], 'ACCEPTED', 34, 30),
  application(208, jobId, me, 'NO_RESPONSE', 17, null),
];

/** TimelineEntry[] — a plausible history ending in the application's status. */
const timeline = (id) => {
  const app = [...MY_APPLICATIONS, ...applicationsForJob(1)].find((a) => a.id === Number(id));
  const status = app?.status || 'INTERVIEW';
  const path = { WITHDRAWN: ['PENDING', 'WITHDRAWN'], NO_RESPONSE: ['PENDING', 'NO_RESPONSE'], REJECTED: ['PENDING', 'REVIEWED', 'REJECTED'] }[status]
    || ['PENDING', 'REVIEWED', 'INTERVIEW', 'OFFERED', 'ACCEPTED'].slice(0, ['PENDING', 'REVIEWED', 'INTERVIEW', 'OFFERED', 'ACCEPTED'].indexOf(status) + 1);
  const NOTE = {
    REVIEWED: 'Thanks for applying. Your profile has been shortlisted by the hiring manager.',
    INTERVIEW: 'We would like to schedule a 60-minute system design round next week. Please share three slots.',
    OFFERED: 'Offer letter sent to your registered email. It is valid for seven days.',
    REJECTED: 'We have decided to move ahead with candidates whose experience is closer to the role.',
  };
  const ACTOR = { PENDING: 'APPLICANT', WITHDRAWN: 'APPLICANT', NO_RESPONSE: 'SYSTEM' };
  return path.map((toStatus, i) => ({
    fromStatus: i === 0 ? null : path[i - 1], toStatus, actor: ACTOR[toStatus] || 'EMPLOYER',
    note: NOTE[toStatus] || null, createdAt: at(Math.max(1, 18 - i * 4)),
  }));
};

/* ------------------------------------------------------------- the rest */
const SAVED = [3, 8, 2, 10].map((jobId, i) => ({ id: 300 + i, jobPost: jobById(jobId), savedAt: at(i + 1) }));

const RECOMMENDED = [[1, 92, []], [4, 81, ['Terraform']], [8, 76, ['Go', 'Grafana']], [6, 68, ['Node.js']], [9, 61, ['Selenium', 'Playwright']], [3, 54, ['TypeScript', 'Vite']]]
  .map(([jobId, score, missingSkills], i) => {
    const jobPost = jobById(jobId);
    return { id: 400 + i, jobPost, score, matchedSkills: jobPost.postTechStack.filter((s) => !missingSkills.includes(s)), missingSkills, generatedAt: at(0, 2) };
  });

const SALARY_ESTIMATE = {
  currency: 'INR', p25: 2600000, p50: 3200000, p75: 4000000, sampleSize: 37, confidence: 'HIGH',
  narrative: {
    rangeDrivers: 'Bengaluru postings asking for Kafka and AWS alongside Spring Boot sit at the top of the band; roles limited to CRUD services cluster near the 25th percentile.',
    positioning: 'This posting spans the median and reaches just under the 75th percentile, so the upper half of its range is competitive for five years of experience.',
    outlierAssessment: 'Not an outlier. Three comparable postings from late-stage fintechs pay above ₹45L and pull the upper quartile up slightly.',
  },
};

const NOTIFICATIONS = {
  seeker: [
    ['Interview scheduled', 'Nimbus Pay moved your application for Staff Engineer, Payments Platform to Interview.', 0.2, false],
    ['Application reviewed', 'Tarang Labs reviewed your application for Frontend Engineer (React).', 3, false],
    ['Offer received', 'Tarang Labs has made you an offer for Site Reliability Engineer.', 20, true],
    ['Application update', 'Nimbus Pay has decided not to move forward with your application for Data Engineer.', 22, true],
    ['No response from employer', 'Swasth Cloud did not respond to your Full Stack Developer application within 14 days.', 5, true],
  ],
  employer: [
    ['New application', 'Karthik Subramanian applied to Senior Backend Engineer (Java).', 0.1, false],
    ['New application', 'Priya Sharma applied to Senior Backend Engineer (Java).', 2, false],
    ['Response deadline approaching', 'Priya Sharma has been waiting 11 days for a response. 3 days remain.', 0.5, false],
    ['Application withdrawn', 'A candidate withdrew their application for DevOps Engineer.', 6, true],
    ['New application', 'Aditi Deshpande applied to QA Automation Engineer.', 9, true],
  ],
};
const notifications = (role) => NOTIFICATIONS[role].map(([title, message, daysAgo, isRead], i) => ({
  id: 500 + i, title, message, isRead, createdAt: at(daysAgo),
  type: title.startsWith('New application') ? 'APPLICATION_RECEIVED' : 'APPLICATION_STATUS_CHANGED',
  actionUrl: role === 'employer' ? '/manage-applications' : '/my-applications',
}));

const DASHBOARD = {
  totalJobs: MY_JOBS.length, totalApplications: 46, totalViews: MY_JOBS.reduce((n, j) => n + j.viewCount, 0),
  applicationsByStatus: { PENDING: 14, REVIEWED: 11, INTERVIEW: 7, OFFERED: 2, ACCEPTED: 3, REJECTED: 6, WITHDRAWN: 2, NO_RESPONSE: 1 },
};

const paged = (items, q) => {
  const page = Number(q.get('page') || 0), size = Number(q.get('size') || 10);
  return {
    content: items.slice(page * size, (page + 1) * size), totalElements: items.length,
    totalPages: Math.ceil(items.length / size), number: page, size,
    first: page === 0, last: (page + 1) * size >= items.length, empty: items.length === 0,
  };
};
const search = (q) => {
  const has = (hay, key) => !q.get(key) || String(hay).toLowerCase().includes(q.get(key).toLowerCase());
  return JOBS.filter((j) => has(`${j.postProfile} ${j.postDesc}`, 'keyword')
    && has(j.isRemote ? `${j.location} remote` : j.location, 'location')
    && (!q.get('jobType') || j.jobType === q.get('jobType'))
    && (!q.get('minExp') || j.reqExperience >= Number(q.get('minExp')))
    && (!q.get('maxExp') || j.reqExperience <= Number(q.get('maxExp'))));
};

/* [METHOD, path regex (after /api), handler({ m, q, role, body }) -> json | [status, json]]
   First match wins, so literal paths sit above the /jobs/:id catch. */
const ok = () => ({ message: 'ok' });
const ROUTES = [
  ['GET', /^\/jobs$/, () => JOBS],
  ['GET', /^\/jobs\/paginated$/, ({ q }) => paged(JOBS, q)],
  ['GET', /^\/jobs\/search$/, ({ q }) => paged(search(q), q)],
  ['GET', /^\/jobs\/featured$/, () => JOBS.filter((j) => j.isFeatured)],
  ['GET', /^\/jobs\/keyword\/(.+)$/, ({ m }) => JOBS.filter((j) => j.postProfile.toLowerCase().includes(decodeURIComponent(m[1]).toLowerCase()))],
  ['GET', /^\/jobs\/my$/, () => MY_JOBS],
  ['GET', /^\/jobs\/saved$/, () => SAVED],
  ['GET', /^\/jobs\/(\d+)\/is-saved$/, ({ m }) => ({ saved: SAVED.some((s) => s.jobPost.postId === Number(m[1])) })],
  ['GET', /^\/jobs\/(\d+)$/, ({ m }) => jobById(m[1]) || [404, { message: 'Job not found' }]],
  ['POST', /^\/jobs$/, ({ body }) => ({ ...JOBS[0], ...body, postId: 13 })],
  ['PUT', /^\/jobs\/(\d+)$/, ({ m, body }) => ({ ...jobById(m[1]), ...body })],
  ['DELETE', /^\/jobs\/(\d+)$/, ok],
  ['POST', /^\/jobs\/(\d+)\/save$/, ({ m }) => ({ id: 399, jobPost: jobById(m[1]), savedAt: at(0) })],
  ['DELETE', /^\/jobs\/(\d+)\/save$/, ok],

  ['GET', /^\/applications\/my$/, () => MY_APPLICATIONS],
  ['GET', /^\/applications\/job\/(\d+)$/, ({ m }) => applicationsForJob(m[1])],
  ['POST', /^\/applications\/job\/(\d+)$/, ({ m }) => application(199, m[1], me, 'PENDING', 0, null)],
  ['PATCH', /^\/applications\/(\d+)\/status$/, ({ body }) => ({ ...applicationsForJob(1)[0], status: body?.status, nextStatuses: NEXT[body?.status] || [] })],
  ['POST', /^\/applications\/(\d+)\/withdraw$/, () => ({ ...MY_APPLICATIONS[0], status: 'WITHDRAWN', nextStatuses: [] })],
  ['GET', /^\/applications\/(\d+)\/timeline$/, ({ m }) => timeline(m[1])],
  ['GET', /^\/applications\/employer\/(\d+)\/responsiveness$/, ({ m }) => (Number(m[1]) === 6
    ? { sampleSize: 3, responseRatePercent: null, medianDays: null } // new employer state
    : { sampleSize: 58, responseRatePercent: 86, medianDays: 3.5 })],

  ['GET', /^\/ai\/match-score\/(\d+)$/, ({ m }) => RECOMMENDED.find((r) => r.jobPost.postId === Number(m[1])) || { ...RECOMMENDED[3], jobPost: jobById(m[1]) }],
  ['GET', /^\/ai\/salary-estimate\/(\d+)$/, () => SALARY_ESTIMATE],
  ['GET', /^\/ai\/recommended-jobs$/, ({ q }) => RECOMMENDED.filter((r) => r.score >= Number(q.get('threshold') || 50))],
  ['POST', /^\/ai\/auto-apply$/, () => ({ matchesFound: 3, applicationsSubmitted: 2 })],

  ['GET', /^\/notifications$/, ({ role }) => notifications(role)],
  ['GET', /^\/notifications\/unread$/, ({ role }) => notifications(role).filter((n) => !n.isRead)],
  ['GET', /^\/notifications\/unread-count$/, ({ role }) => ({ count: notifications(role).filter((n) => !n.isRead).length })],
  ['PATCH', /^\/notifications\/(\d+)\/read$/, ok],
  ['POST', /^\/notifications\/mark-all-read$/, ok],
  ['DELETE', /^\/notifications\/(\d+)$/, ok],

  ['GET', /^\/users\/me$/, ({ role }) => USERS[role]],
  ['PUT', /^\/users\/me$/, ({ role, body }) => ({ ...USERS[role], ...body })],
  ['PATCH', /^\/users\/me\/visibility$/, ({ role, body }) => ({ ...USERS[role], isProfilePublic: body?.isPublic })],
  ['POST', /^\/users\/me\/(photo|resume)$/, ({ role }) => USERS[role]],
  ['GET', /^\/users\/(\d+)$/, ({ m }) => Object.values(USERS).find((u) => u.id === Number(m[1])) || [404, { message: 'User not found' }]],

  ['GET', /^\/dashboard\/employer$/, () => DASHBOARD],

  ['GET', /^\/companies$/, () => COMPANIES],
  ['GET', /^\/companies\/my$/, () => [COMPANIES[0]]],
  ['GET', /^\/companies\/(\d+)$/, ({ m }) => COMPANIES.find((c) => c.id === Number(m[1])) || [404, { message: 'Company not found' }]],

  ['POST', /^\/auth\/(login|register)$/, ({ body }) => authUser(body?.role === 'EMPLOYER' || /kaveri/.test(body?.email || '') ? 'employer' : 'seeker')],
  ['POST', /^\/auth\/refresh-token$/, ({ role }) => ({ token: `mock.jwt.${role}.refreshed` })],
  ['POST', /^\/auth\/(forgot-password|reset-password|verify-email)$/, ok],
];

/**
 * Answers every /api/ call in the browser. `role` is 'anon' | 'seeker' | 'employer'; for a
 * logged-in role it also pre-seeds localStorage the way authService.login does.
 * Returns the list that unmocked calls ("METHOD /path") are pushed to.
 */
export async function mockApi(page, role = 'anon') {
  const unmocked = [];
  if (role !== 'anon') {
    await page.addInitScript((auth) => {
      localStorage.setItem('token', auth.token);
      localStorage.setItem('refreshToken', auth.refreshToken);
      localStorage.setItem('user', JSON.stringify(auth));
    }, authUser(role));
  }

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return route.fallback(); // e.g. a module path containing /api/
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    const path = url.pathname.slice(4);
    const hit = ROUTES.find(([method, re]) => method === req.method() && re.test(path));
    if (!hit) {
      unmocked.push(`${req.method()} ${path}${url.search}`);
      return route.fulfill({ status: 404, headers, json: { message: `No mock for ${req.method()} ${path}` } });
    }
    let body = null;
    try { body = req.postDataJSON(); } catch { /* multipart upload */ }
    const result = hit[2]({ m: path.match(hit[1]), q: url.searchParams, role: role === 'anon' ? 'seeker' : role, body });
    const [status, json] = Array.isArray(result) && typeof result[0] === 'number' && result.length === 2 && !Array.isArray(result[1]) && typeof result[1] === 'object'
      ? result : [200, result];
    return route.fulfill({ status, headers, json });
  });
  return unmocked;
}

/* ------------------------------------------------------------------ admin
   Added for the employer/admin redesign. Only appends: new users, a pending queue, an audit
   log, and route overrides (unshift so they win over the generic routes above). */
USERS.admin = {
  ...USERS.employer, id: 9, fullName: 'Meera Joshi', email: 'meera.joshi@jobportal.in', role: 'ADMIN',
  profilePhotoPath: null, bio: '', currentJobTitle: 'Trust and safety',
};
// An employer who has just signed up: no postings, no record (id 6 answers the "new employer" responsiveness).
USERS.newemployer = {
  ...USERS.employer, id: 6, fullName: 'Farah Sheikh', email: 'farah@swasthcloud.in', currentJobTitle: 'People Operations Lead',
};
NOTIFICATIONS.admin = [];
NOTIFICATIONS.newemployer = [];

/* The employer's own postings, with the moderation states the dashboard has to show. */
const EMPLOYER_POSTINGS = MY_JOBS.map((j) => ({
  ...j,
  status: { 9: 'PENDING_REVIEW', 12: 'REJECTED' }[j.postId] || 'PUBLISHED',
  moderationReason: j.postId === 12 ? 'The pay range is missing. Every listing must show a salary band; add one and resubmit.' : null,
}));

export const PENDING_JOBS = [
  job(21, 3, 'Backend Engineer, Cold-chain Tracking', 1800000, 2800000, 'Hyderabad', 3, ['Java', 'Spring Boot', 'PostgreSQL', 'MQTT'], 4, { status: 'PENDING_REVIEW' }),
  job(22, 4, 'Earn 50,000 a week from home, no experience', null, null, '', 0, ['Data entry'], 3, {
    status: 'PENDING_REVIEW', isRemote: true, jobType: 'PART_TIME',
    postDesc: 'Work from home and earn up to 50,000 per week! No interview, no experience needed. Pay a one-time registration fee of 1,999 to receive your starter kit and begin immediately. Limited seats, apply today on WhatsApp.',
  }),
  job(23, 1, 'Senior iOS Engineer', 3200000, 4600000, 'Mumbai', 6, ['Swift', 'SwiftUI', 'Combine', 'Core Data', 'XCTest'], 1, { status: 'PENDING_REVIEW' }),
  job(24, 2, 'Technical Writer, Developer Docs', 1200000, 1800000, 'Pune', 2, ['Markdown', 'OpenAPI', 'Kubernetes'], 0, { status: 'PENDING_REVIEW', isRemote: true }),
].map((j) => ({ ...j, viewCount: 0 }));

const ADMIN_ACTIONS = [
  [1, 'JOB_PUBLISHED', 'JOB', 8, null, 0.1],
  [2, 'JOB_FEATURED', 'JOB', 1, null, 0.2],
  [3, 'JOB_REJECTED', 'JOB', 12, 'The pay range is missing. Every listing must show a salary band; add one and resubmit.', 0.4],
  [4, 'USER_BANNED', 'USER', 31, 'Posted the same fee-for-work scheme under three company names.', 1.5],
  [5, 'JOB_SUSPENDED', 'JOB', 17, 'Several applicants report the interview asked for a deposit.', 2],
  [6, 'JOB_PUBLISHED', 'JOB', 7, null, 3],
  [7, 'JOB_UNFEATURED', 'JOB', 3, null, 5],
  [8, 'USER_UNBANNED', 'USER', 28, 'Identity confirmed by phone; the duplicate account was a mistake.', 6],
].map(([id, action, targetType, targetId, reason, daysAgo]) => ({
  id: 700 + id, adminEmail: id % 3 ? USERS.admin.email : 'devraj.pillai@jobportal.in', action, targetType, targetId, reason, createdAt: at(daysAgo),
})).reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const pendingById = (id) => PENDING_JOBS.find((j) => j.postId === Number(id)) || jobById(id);

ROUTES.unshift(
  ['GET', /^\/jobs\/my$/, ({ role }) => (role === 'newemployer' ? [] : EMPLOYER_POSTINGS)],
  // Only the employer sees their postings' moderation state; other roles keep the generic job.
  ['GET', /^\/jobs\/(\d+)$/, ({ m, role }) => (role === 'employer' && EMPLOYER_POSTINGS.find((j) => j.postId === Number(m[1])))
    || jobById(m[1]) || [404, { message: 'Job not found' }]],
  ['GET', /^\/dashboard\/employer$/, ({ role }) => (role === 'newemployer'
    ? { totalJobs: 0, totalApplications: 0, totalViews: 0, applicationsByStatus: {} } : DASHBOARD)],
  ['GET', /^\/companies\/my$/, ({ role }) => (role === 'newemployer' ? [] : [COMPANIES[0]])],
);
ROUTES.push(
  ['GET', /^\/admin\/stats$/, () => ({ pendingReview: PENDING_JOBS.length })],
  ['GET', /^\/admin\/jobs\/pending$/, ({ q }) => paged([...PENDING_JOBS].sort((a, b) => a.postedDate.localeCompare(b.postedDate)), q)],
  ['POST', /^\/admin\/jobs\/(\d+)\/decision$/, ({ m, body }) => ({ ...pendingById(m[1]), status: body?.status, moderationReason: body?.status === 'PUBLISHED' ? null : body?.reason })],
  ['PATCH', /^\/admin\/jobs\/(\d+)\/featured$/, ({ m, body }) => ({ ...pendingById(m[1]), status: 'PUBLISHED', isFeatured: Boolean(body?.featured) })],
  ['PATCH', /^\/admin\/users\/(\d+)\/banned$/, ({ body }) => ({ message: body?.banned ? 'Account banned' : 'Account reinstated' })],
  ['GET', /^\/admin\/actions$/, ({ q }) => paged(ADMIN_ACTIONS, q)],
);
