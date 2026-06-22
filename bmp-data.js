// FIU SigEp Balanced Man Program — challenge requirements.
// Sourced directly from the Sigma, Phi, and Epsilon Challenge documents.
// `kind` is one of: 'meeting' | 'activity' | 'checklist'
// Activities/checklist items carry a `category`. Meetings carry a `week`/order.

export const TIERS = {
  sigma: {
    key: 'sigma',
    name: 'Sigma Challenge',
    blurb: 'The first step of the Balanced Man Program (6–8 weeks). Learn the chapter, the Cardinal Principles, and bond with your cohort.',
    duration: '6–8 weeks',
    // Sigma is a checklist program: complete every meeting + every checklist item.
    rules: { meetingsRequired: 8, meetingsTotal: 8, activitiesMode: 'all', minPerCategory: 0, activitiesRequired: null },
    color: '#7b1d2b',
  },
  phi: {
    key: 'phi',
    name: 'Phi Challenge',
    blurb: 'Continue growing as a balanced man, leader, and student (24–52 weeks). Attend the meetings and complete 20 activities.',
    duration: '24–52 weeks',
    rules: { meetingsRequired: 5, meetingsTotal: 6, activitiesMode: 'choose', minPerCategory: 3, activitiesRequired: 20 },
    color: '#7b1d2b',
  },
  epsilon: {
    key: 'epsilon',
    name: 'Epsilon Challenge',
    blurb: 'The upperclassman phase (12–18 months). Mentor younger members and prepare for life after college.',
    duration: '12–18 months',
    rules: { meetingsRequired: 5, meetingsTotal: 7, activitiesMode: 'choose', minPerCategory: 3, activitiesRequired: 20 },
    color: '#7b1d2b',
  },
};

// ---------------------------------------------------------------------------
// SIGMA
// ---------------------------------------------------------------------------
const sigmaMeetings = [
  ['Week 1 — Welcome & Expectations', 'Intro to exec board & advisors, principles & philosophy (VDBL/SM/SB), dues, GPA expectations, risk management, block off mandatory dates.'],
  ['Week 2 — Campus Life & Greek Life', 'Mentor assignments, getting involved at FIU, key organizations, meet the FIU/FSL team, understanding councils.'],
  ['Week 3 — Cardinal Principles & Philanthropy', 'Cardinal Principles, BMP overview, symbols of SigEp, committee structure, philanthropy vs. service.'],
  ['Week 4 — Ritual Prep & SMART Goals', 'Ritual preparation, time management, setting S.M.A.R.T. goals, member agreement signatures.'],
  ['Week 5 — Public Speaking & Etiquette', 'Reflect on initiation, the Oath of Obligation, public speaking, dress for success, etiquette.'],
  ['Week 6 — Healthy Relationships & Sound Body', 'Healthy Relationships 101, the personal thank-you note, Sound Body open discussion.'],
  ['Week 7 — Career Coaching & Big Brothers', 'Career coaching, resumé basics, LinkedIn / Handshake, Big Brother introduction, submit Top 5 list.'],
  ['Week 8 — Challenge Reflection', 'Write & present a 1-page reflection, confirm all challenge items complete, meet your Big Brothers.'],
];

const sigmaChecklist = [
  ['SigEp Development', 'Attend at least 3 committee meetings for 3 different VPs'],
  ['SigEp Development', 'Join a committee for one VP'],
  ['SigEp Development', 'Participate in SigEp Ritual'],
  ['SigEp Development', 'Read LROB — Foundation of Brotherhood (Preface, pages ii–vi)'],
  ['SigEp Development', 'Read LROB Ch. 1 — The American College Fraternity (page 3)'],
  ['SigEp Development', 'Read LROB Ch. 2 — The History of Sigma Phi Epsilon (page 9)'],
  ['SigEp Development', 'Read LROB Ch. 3 — Your National Fraternity (page 27)'],
  ['SigEp Development', 'Learn SigEp Local History'],
  ['SigEp Development', 'Cardinal Principles discussion'],
  ['SigEp Development', 'Learn the SigEp anthem'],
  ['SigEp Development', 'Learn the SigEp toast'],
  ['Leadership', 'Participate in a group community service project with your cohort'],
  ['Leadership', 'Learn about 2 on-campus organizations & present on them'],
  ['Leadership', 'Introduce yourself to the FIU/FSL staff and understand their role'],
  ['Leadership', 'Participate in a leadership workshop on campus'],
  ['Sound Mind', 'Read LROB Ch. 10 — Sound Mind (pages 99–112)'],
  ['Sound Mind', 'Read LROB Ch. 19 — Etiquette (pages 167–175)'],
  ['Sound Mind', 'Meet with the VPSLC and create a four-year Academic Plan'],
  ['Sound Mind', 'Write a personal thank-you note to each of your professors this semester'],
  ['Sound Mind', 'Achieve a minimum 3.0 GPA for the term'],
  ['Sound Mind', 'Meet your Faculty Fellow and discuss academic & career aspirations'],
  ['Sound Body', 'Open discussion: what is a Sound Body?'],
  ['Sound Body', 'Read LROB Ch. 11 — Sound Body (pages 113–124)'],
  ['Sound Body', 'Read LROB Ch. 13 — Becoming a Balanced Man (pages 125–132)'],
  ['Sound Body', 'Participate in one intramural team or attend a SigEp game / practice'],
  ['Personal/Career Development', 'Complete your S.M.A.R.T. goals'],
  ['Personal/Career Development', 'Build a resume'],
  ['Personal/Career Development', 'Build a LinkedIn and Handshake account'],
  ['Personal/Career Development', 'Participate in the relationship seminar'],
  ['Personal/Career Development', 'Write reflections on lessons learned'],
];

// ---------------------------------------------------------------------------
// PHI
// ---------------------------------------------------------------------------
const phiMeetings = [
  ['Meeting 1 — Financial Literacy', 'Finances in college, budgeting, and money management.'],
  ['Meeting 2 — Exercise and Nutrition', 'Physical health, fitness, and nutrition fundamentals.'],
  ['Meeting 3 — Stoicism', 'Stoic philosophy and its application to daily life.'],
  ['Meeting 4 — Time Management / Networking / Business Etiquette', 'Managing your time, professional networking, and business etiquette.'],
  ['Meeting 5 — DISC / Personality Tests', 'Self-assessment and understanding personality types.'],
  ['Meeting 6 — Mindfulness / Meditation', 'Mindfulness and meditation practices (attend 5 of 6).'],
];

const phiActivities = [
  ['SigEp Development', 'Attend brotherhood retreat'],
  ['SigEp Development', 'Join a committee and chair / run one of the semester events for that committee'],
  ['SigEp Development', 'Participate in SigEp Ritual Education'],
  ['SigEp Development', 'Participate in a SigEp Recruitment Training / Workshop'],
  ['SigEp Development', 'Recruit 3 new members during the Phi Challenge to join SigEp'],
  ['SigEp Development', 'Read LROB Ch. 6–9 — Understanding Your Chapter & Your Responsibility (pages 49–96) + reflection'],
  ['SigEp / Campus / Community Leadership', 'Participate in 10 total community service hours with a service organization', { mandatory: true }],
  ['SigEp / Campus / Community Leadership', 'Apply for the Ruck Leadership Institute or Tragos Quest to Greece'],
  ['SigEp / Campus / Community Leadership', 'Attend a leadership seminar and discuss your learnings at a Phi meeting'],
  ['SigEp / Campus / Community Leadership', 'Volunteer for an organization helping a disadvantaged group of our community'],
  ['SigEp / Campus / Community Leadership', 'Join another on-campus organization (peer advisors, SGA, club, RA, etc.)'],
  ['SigEp / Campus / Community Leadership', 'Read LROB Ch. 24–26 (pages 191–214) + reflection'],
  ['Sound Mind', 'Achieve a minimum 3.0 GPA during one semester in the Phi Challenge'],
  ['Sound Mind', 'Learn a life skill of your choice approved by the coordinator'],
  ['Sound Mind', 'Attend a meditation / mindfulness seminar or workshop at FIU'],
  ['Sound Mind', 'Complete a personality self-assessment on campus'],
  ['Sound Mind', 'Create a weekly or daily gratitude journal (10 things weekly or 3 things daily)'],
  ['Sound Mind', 'Read LROB Ch. 21 — Spirituality and Religion (pages 181–182) + reflection'],
  ['Sound Body', 'Participate in intramural sports'],
  ['Sound Body', 'Participate in a 5K run/walk fundraiser benefiting an FIU charity'],
  ['Sound Body', 'Create a food diary and evaluate your nutrition'],
  ['Sound Body', 'Attend a time management seminar or give a 10-minute presentation on time management / minimizing procrastination'],
  ['Sound Body', 'Take three yoga classes with at least one other member of the Phi Challenge'],
  ['Professional Development', 'Submit resume to the Career & Talent Development office for review'],
  ['Professional Development', 'Create & monitor five new S.M.A.R.T. goals for completion by the end of Phi'],
  ['Professional Development', 'Do a skills inventory at the Career Center'],
  ['Professional Development', 'Identify internship opportunities and develop an action plan to apply'],
  ['Professional Development', 'Read LROB Ch. 13 — Knowing Yourself & Your Road to Success (pages 133–136) + reflection'],
  ['Professional Development', 'Read LROB Ch. 23 — Career Achievement (pages 187–190) + reflection'],
];

// ---------------------------------------------------------------------------
// EPSILON
// ---------------------------------------------------------------------------
const epsilonMeetings = [
  ['Meeting 1 — Thinking About Graduate School', 'Is grad school right for you? Applications, funding, and timelines.'],
  ['Meeting 2 — Leasing vs. Purchasing (Cars & Homes)', 'Pros and cons of leasing vs. buying major assets.'],
  ['Meeting 3 — Personal Branding', 'Building and managing your personal and professional brand.'],
  ['Meeting 4 — Interviewing for the Job / Alcohol at Work', 'Interview skills and navigating alcohol in professional settings.'],
  ['Meeting 5 — Stop / Continue / Start Facilitation', 'A SigEp reflection on your journey through the chapter.'],
  ['Meeting 6 — Elective Topic', 'Coordinator-selected professional development topic (attend 5 of 7).'],
  ['Meeting 7 — Elective Topic', 'Coordinator-selected professional development topic (attend 5 of 7).'],
];

const epsilonActivities = [
  ['SigEp Development', 'Attend brotherhood retreat'],
  ['SigEp Development', 'Serve as a committee chairman or officer for your chapter'],
  ['SigEp Development', 'Lead or co-lead a SigEp Ritual Education session'],
  ['SigEp Development', 'Perform a S.W.O.T. analysis on the chapter & present to the E-Board'],
  ['SigEp Development', 'Become a mentor for a new member'],
  ['SigEp Development', 'Recruit 5 new members to join SigEp'],
  ['SigEp Development', 'Read LROB Ch. 14–18 (pages 139–166) + reflection'],
  ['Leadership', 'Perform 15 hours of community service with an FIU-recognized service organization', { mandatory: true }],
  ['Leadership', 'Serve as an officer of another organization'],
  ['Leadership', 'Attend Life After College (SigEp National) or an FIU professional development seminar'],
  ['Leadership', 'Attend Carlson Leadership Academy'],
  ['Leadership', 'Serve in a critical role for SigEp (BMS, Sigma, Phi, or Epsilon Coordinator, etc.) approved by Coordinator or VPMD'],
  ['Sound Mind', 'Achieve a minimum 3.0 GPA during two semesters of your Epsilon Challenge'],
  ['Sound Mind', 'Write 3 thank-you notes to the most influential people in your life'],
  ['Sound Mind', 'Complete a personality assessment through FIU'],
  ['Sound Mind', 'Attend a seminar on Healthy Masculinity'],
  ['Sound Mind', 'Attend a meditation session / seminar'],
  ['Sound Mind', 'Attend a Mental Health lecture'],
  ['Sound Body', 'Participate in or coach an intramural sport'],
  ['Sound Body', 'Participate in a fundraising 5K run/walk benefiting a charity approved by the coordinator'],
  ['Sound Body', 'Get tested for STDs'],
  ['Sound Body', 'Attend a testicular cancer educational session'],
  ['Sound Body', 'Get CPR certified (offered at FIU)'],
  ['Sound Body', 'Attend a nutritional food seminar through FIU'],
  ['Personal and Career Development', 'Submit resume to the Career & Talent Development office'],
  ['Personal and Career Development', 'Attend a Stocks and Cigars session with alumni'],
  ['Personal and Career Development', 'Meet with an alumnus or the career center to discuss interview skills'],
  ['Personal and Career Development', 'Participate in a mock interview'],
  ['Personal and Career Development', 'Participate in SigEp Career Coaching'],
  ['Personal and Career Development', 'Evaluate and update your S.M.A.R.T. goals'],
  ['Personal and Career Development', 'Read LROB Ch. 19–20 (pages 167–180) + reflection'],
];

function buildRequirements() {
  const rows = [];
  const push = (tier, kind, category, title, description, order, opts = {}) => {
    rows.push({
      tier, kind,
      category: category || null,
      title,
      description: description || null,
      sort_order: order,
      mandatory: opts.mandatory ? 1 : 0,
    });
  };

  // Sigma
  sigmaMeetings.forEach(([t, d], i) => push('sigma', 'meeting', 'Meetings', t, d, i));
  sigmaChecklist.forEach(([cat, t], i) => push('sigma', 'checklist', cat, t, null, i));
  // Phi
  phiMeetings.forEach(([t, d], i) => push('phi', 'meeting', 'Meetings', t, d, i));
  phiActivities.forEach(([cat, t, opts], i) => push('phi', 'activity', cat, t, null, i, opts || {}));
  // Epsilon
  epsilonMeetings.forEach(([t, d], i) => push('epsilon', 'meeting', 'Meetings', t, d, i));
  epsilonActivities.forEach(([cat, t, opts], i) => push('epsilon', 'activity', cat, t, null, i, opts || {}));

  return rows;
}

export const REQUIREMENTS = buildRequirements();

// Default accounts seeded on first run (taken from the challenge documents).
// Passwords are intentionally simple defaults — change them after first login.
export const SEED_USERS = [
  { name: 'Alejandro Mendez', email: 'vpmd@fiusigep.com', password: 'sigep123', role: 'admin', tier: null },
  { name: 'Jared Rivera', email: 'sigma.coordinator@fiusigep.com', password: 'sigep123', role: 'coordinator', tier: 'sigma' },
  { name: 'Noel Leon', email: 'phi.coordinator@fiusigep.com', password: 'sigep123', role: 'coordinator', tier: 'phi' },
  { name: "Anthony O'Reiley", email: 'epsilon.coordinator@fiusigep.com', password: 'sigep123', role: 'coordinator', tier: 'epsilon' },
  { name: 'Test Brother', email: 'brother@fiusigep.com', password: 'sigep123', role: 'member', tier: 'phi' },
];
