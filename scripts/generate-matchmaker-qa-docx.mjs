/**
 * Generates LinkUp MatchMaker Web QA Test Plan (DOCX).
 * Run: node scripts/generate-matchmaker-qa-docx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'LinkUp_MatchMaker_Web_QA_Test_Plan.docx');

const DOC_VERSION = '1.0';
const DOC_DATE = '21 October 2026';

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function tableHeader(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(
      (text) =>
        new TableCell({
          shading: { fill: 'E8E4F5', type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
        })
    ),
  });
}

function tableRow(cells) {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20 })] })],
        })
    ),
  });
}

/** @type {Array<{id:string, area:string, title:string, priority:string, pre:string, steps:string, expected:string, spec:string}>} */
const TEST_CASES = [
  {
    id: 'MM-QA-001',
    area: 'Environment',
    title: 'Staging Supabase migrations applied',
    priority: 'P0',
    pre: 'Access to staging Supabase project linked to deployed web app.',
    steps:
      '1. Confirm all migrations matching `*matchmaker*` through `20261010000003` are applied.\n2. Confirm web deploy uses same project URL/anon key as staging.',
    expected: 'RPCs such as `matchmaker_get_gate_state`, `matchmaker_get_pool`, and weekly activity RPCs exist without 404/schema errors.',
    spec: 'Audit §9; migrations list',
  },
  {
    id: 'MM-QA-002',
    area: 'Navigation',
    title: 'MatchMaker tab active/inactive icons',
    priority: 'P1',
    pre: 'Logged in; desktop width (sidebar visible).',
    steps:
      '1. Open `/discover`. Observe MatchMaker nav icon.\n2. Navigate to `/matchmaker`. Observe icon.\n3. Open `/matchmaker/settings`. Observe icon.\n4. Use browser Back/Forward.',
    expected:
      'Inactive: `matchmaker-inactive.png` with fill `#6B7280`. Active on any `/matchmaker/*` route: `matchmaker-active.png`. No hydration flicker; other tabs unchanged.',
    spec: 'Interaction spec — Tab icon',
  },
  {
    id: 'MM-QA-003',
    area: 'Onboarding',
    title: 'Step 0 gender required',
    priority: 'P0',
    pre: 'New account or reset onboarding test user.',
    steps: '1. Start onboarding Step 0.\n2. Fill name/photos without gender.\n3. Attempt Continue.\n4. Select gender and continue.',
    expected: 'Continue disabled until gender chip selected; value persisted to profile.',
    spec: 'Spec §0.0',
  },
  {
    id: 'MM-QA-004',
    area: 'Onboarding',
    title: 'Communication style optional on Step 4',
    priority: 'P1',
    pre: 'Onboarding Step 4 reachable.',
    steps: '1. Complete interests without selecting communication style.\n2. Finish onboarding.\n3. Open MatchMaker Gate 4.',
    expected: 'Profile `communication_style` null; Gate 4 Step 1 requires communication selector.',
    spec: 'Spec §0.1–0.3',
  },
  {
    id: 'MM-QA-005',
    area: 'Gate 4',
    title: 'Pace Preference Step 3 copy and persistence',
    priority: 'P0',
    pre: 'User on `/matchmaker/values` Step 3.',
    steps:
      '1. Verify title "Pace Preference", question, privacy label, four chip labels (exact copy).\n2. Select each option; confirm single-select.\n3. Save values; reload Step 3.\n4. Open Settings pace row.',
    expected:
      'DB keys: `asap_7_days`, `one_two_weeks`, `two_three_weeks`, `one_month_or_more`. Selection restores; legacy month values show in Settings until re-selected.',
    spec: 'Spec Step 3 Pace Preference',
  },
  {
    id: 'MM-QA-006',
    area: 'Gates',
    title: 'Subscription gate (non-Gold)',
    priority: 'P0',
    pre: 'User without Gold/Platinum `host_tier`.',
    steps: '1. Tap MatchMaker tab.\n2. Read modal copy.\n3. Attempt pool access.',
    expected: 'Upgrade/subscription gate shown first; pool not usable until tier satisfied.',
    spec: 'Spec §1.1',
  },
  {
    id: 'MM-QA-007',
    area: 'Gates',
    title: 'KYC gate (unverified)',
    priority: 'P0',
    pre: 'Gold user with verification not verified.',
    steps: '1. Open MatchMaker.\n2. Follow CTA to KYC.',
    expected: 'KYC gate blocks pool; blurred preview may show under modal per spec.',
    spec: 'Spec §1.1',
  },
  {
    id: 'MM-QA-008',
    area: 'Gates',
    title: 'Intent declaration',
    priority: 'P0',
    pre: 'Gold + verified; no intent on file.',
    steps: '1. Complete `/matchmaker/declare`.\n2. Return to pool.',
    expected: 'Intent stored; user can proceed to values or pool per gate order.',
    spec: 'Spec §1.2',
  },
  {
    id: 'MM-QA-009',
    area: 'Gates',
    title: 'Gender not set gate',
    priority: 'P1',
    pre: 'Profile gender NULL.',
    steps: '1. Open MatchMaker.\n2. Use modal CTA.',
    expected: 'Routes to edit profile; pool blocked until gender set.',
    spec: 'Spec §0.0',
  },
  {
    id: 'MM-QA-010',
    area: 'Pool',
    title: 'Pool list and filters',
    priority: 'P0',
    pre: 'Two eligible pool members; User A meets all gates.',
    steps: '1. Open pool.\n2. Apply sort/filter.\n3. Open full profile.',
    expected: 'Cards load; filters affect RPC results; profile route works.',
    spec: 'Spec §2.1–2.3',
  },
  {
    id: 'MM-QA-011',
    area: 'Pool',
    title: 'Express interest happy path',
    priority: 'P0',
    pre: 'User A and B in pool; no prior interest.',
    steps: '1. A expresses interest in B.\n2. B opens interest queue.\n3. B accepts.',
    expected: 'Mutual match creates connection; both routed to connection experience.',
    spec: 'Spec §2.2; userflow Phase 1',
  },
  {
    id: 'MM-QA-012',
    area: 'Pool',
    title: 'Duplicate express interest rejected',
    priority: 'P1',
    pre: 'A already expressed to B.',
    steps: '1. Repeat express via UI or API.',
    expected: 'Idempotent rejection; no duplicate rows; user-friendly message.',
    spec: 'Spec §2.2',
  },
  {
    id: 'MM-QA-013',
    area: 'Pool',
    title: 'Pass excludes profile',
    priority: 'P1',
    pre: 'Eligible pool.',
    steps: '1. Pass profile X.\n2. Refresh pool.',
    expected: 'X does not reappear for that user.',
    spec: 'Spec §2.2',
  },
  {
    id: 'MM-QA-014',
    area: 'Pool',
    title: '60-day reaffirmation overlay',
    priority: 'P1',
    pre: 'User due for reaffirmation (seed `last_reaffirmed_at`).',
    steps: '1. Open pool.\n2. Choose Yes / Snooze 7d / Leave pool.',
    expected: 'RPC `matchmaker_reaffirmation_respond` updates state; snooze suppresses 7 days.',
    spec: 'Spec §2.5',
  },
  {
    id: 'MM-QA-015',
    area: 'Privacy',
    title: 'No private values on pool profile',
    priority: 'P0',
    pre: 'Network tab open.',
    steps: '1. View pool card and `/matchmaker/profile/:id`.\n2. Inspect API/RPC payloads.',
    expected: 'No faith, dealbreakers, pace, or communication frequency exposed to viewer.',
    spec: 'Spec §2.3; checklist #6',
  },
  {
    id: 'MM-QA-016',
    area: 'Connection',
    title: 'Active connection tab entry',
    priority: 'P0',
    pre: 'User in active connection.',
    steps: '1. Tap MatchMaker from another tab.\n2. Tap MatchMaker again on connection screen.',
    expected: 'Opens connection screen; second tap triggers subtle pulse (no navigation loop).',
    spec: 'Spec §6.1',
  },
  {
    id: 'MM-QA-017',
    area: 'Connection',
    title: 'Timeline two-clock behaviour',
    priority: 'P0',
    pre: 'Connection with known `connected_at` and first message timestamp.',
    steps: '1. Before first message, check plan/shared activity locks.\n2. Send first message.\n3. Advance date fixtures or wait for Day 7/21 boundaries.',
    expected: 'Shared activity unlocks from `connected_at` Day 7; plan window from first message + 21 days per timeline helpers.',
    spec: 'Spec §3.2–3.7; userflow §3.3',
  },
  {
    id: 'MM-QA-018',
    area: 'Connection',
    title: 'Shared activity week 1 submit and partner concealment',
    priority: 'P0',
    pre: 'Day 7+ connection.',
    steps: '1. User A submits answer.\n2. User B opens activity before submitting.',
    expected: "B cannot see A's answer until B submits; overview shows waiting state.",
    spec: 'Spec §3.4',
  },
  {
    id: 'MM-QA-019',
    area: 'Connection',
    title: 'Shared activity partner notification',
    priority: 'P1',
    pre: 'Notifications enabled for B.',
    steps: '1. A submits first on week 1.\n2. B receives notification.\n3. Tap notification.',
    expected: 'Type `matchmaker_activity_shared`; deep link to `/matchmaker/connection/{id}/activity`.',
    spec: 'Spec §3.4',
  },
  {
    id: 'MM-QA-020',
    area: 'Connection',
    title: 'Weekly activity week 2+ unlock',
    priority: 'P1',
    pre: 'Connection past Day 14; week 1 complete.',
    steps: '1. Open shared activity.\n2. Verify week number and badge on connection screen.',
    expected: 'Catalog week 2 available; badge clears after visit.',
    spec: 'Spec §3.4',
  },
  {
    id: 'MM-QA-021',
    area: 'Connection',
    title: 'Ready to meet signal',
    priority: 'P1',
    pre: 'Timeline allows ready signal.',
    steps: '1. Tap "I feel ready to meet".\n2. Confirm.\n3. Partner view.',
    expected: 'RPC `matchmaker_send_ready_signal`; partner sees signal per spec.',
    spec: 'Spec §3.6',
  },
  {
    id: 'MM-QA-022',
    area: 'Connection',
    title: 'Create plan from Day 21 window',
    priority: 'P0',
    pre: 'Plan window open; connection id known.',
    steps: '1. Tap Create Plan.\n2. Publish plan.\n3. Query `plans` row.',
    expected: '`matchmaker_connection_id` set on plan; publish_plan wrapper migration applied.',
    spec: 'Spec §3.7; DATABASE NOTE',
  },
  {
    id: 'MM-QA-023',
    area: 'Connection',
    title: 'Day 10 check-in card',
    priority: 'P2',
    pre: 'Connection at Day 10.',
    steps: '1. Open connection screen.\n2. Interact with check-in card.',
    expected: 'Card visible with conversation starters; behaviour matches product (in-app vs push).',
    spec: 'Spec §3.5',
  },
  {
    id: 'MM-QA-024',
    area: 'Connection',
    title: 'Post-meetup reflection prompt',
    priority: 'P1',
    pre: 'Plan completed / meetup recorded per RPC rules.',
    steps: '1. Open connection after meetup trigger.\n2. Complete or dismiss flow.',
    expected: '`matchmaker_should_show_post_meetup` governs display; save RPC persists choice.',
    spec: 'Spec §3.8',
  },
  {
    id: 'MM-QA-025',
    area: 'End connection',
    title: 'End connection reasons and Other validation',
    priority: 'P0',
    pre: 'Active connection.',
    steps: '1. Open end sheet.\n2. Select Other with <40 chars (fail) and valid text (pass).\n3. Confirm end.',
    expected: 'End disabled until valid; `other:` payload private; lifecycle moves to reflection.',
    spec: 'Spec §4.1',
  },
  {
    id: 'MM-QA-026',
    area: 'Lifecycle',
    title: 'Reflection and healing screens',
    priority: 'P1',
    pre: 'User in reflection/healing gate state.',
    steps: '1. Complete `/matchmaker/reflect`.\n2. Complete `/matchmaker/heal`.\n3. Reach re-entry.',
    expected: 'Answers saved via RPC; redirects match gate state.',
    spec: 'Spec §5.1–5.3',
  },
  {
    id: 'MM-QA-027',
    area: 'Guardrails',
    title: 'Rapid cycler cooldown screen',
    priority: 'P1',
    pre: 'User seeded with cooldown gate.',
    steps: '1. Open MatchMaker.\n2. Visit `/matchmaker/cooldown`.',
    expected: 'Cooldown copy and days remaining; other LinkUp features still accessible.',
    spec: 'Spec §6.2',
  },
  {
    id: 'MM-QA-028',
    area: 'Guardrails',
    title: 'Contact-sharing suspension',
    priority: 'P1',
    pre: 'User with contact_sharing suspension gate.',
    steps: '1. Open MatchMaker tab.',
    expected: 'Suspension screen/modal; 7-day messaging per userflow.',
    spec: 'Userflow §6.3',
  },
  {
    id: 'MM-QA-029',
    area: 'Guardrails',
    title: 'Misalignment report from connection',
    priority: 'P1',
    pre: 'Active connection.',
    steps: '1. Open connection menu → report.\n2. Submit valid report.\n3. Admin reviews queue.',
    expected: 'RPC stores report; admin panel lists after threshold; no reporter identity leaked to reported user.',
    spec: 'Userflow §6.4',
  },
  {
    id: 'MM-QA-030',
    area: 'Guardrails',
    title: 'Subscription lapse banner',
    priority: 'P1',
    pre: 'Connection active; subscriber lapses.',
    steps: '1. Open connection.\n2. Observe 14-day messaging.',
    expected: 'Banner warns; auto-end after 14 days if spec server job enabled (verify with backend).',
    spec: 'Spec §6.3',
  },
  {
    id: 'MM-QA-031',
    area: 'Settings',
    title: 'Settings edit links to values form',
    priority: 'P0',
    pre: 'Complete values on file.',
    steps: '1. Open `/matchmaker/settings`.\n2. Edit pace via icon.\n3. Save with `from=settings`.',
    expected: 'Returns to settings; only edited fields change; legacy pace preserved if not re-selected.',
    spec: 'Spec §7.1',
  },
  {
    id: 'MM-QA-032',
    area: 'Settings',
    title: 'Pool visibility toggle cross-user',
    priority: 'P0',
    pre: 'Users A and B both in pool.',
    steps: '1. A turns visibility off.\n2. B refreshes pool.',
    expected: 'A absent from B\'s pool RPC results.',
    spec: 'Checklist #5',
  },
  {
    id: 'MM-QA-033',
    area: 'History',
    title: 'Connection history privacy',
    priority: 'P0',
    pre: 'User with past connections.',
    steps: '1. Open `/matchmaker/history`.\n2. Inspect network payloads.',
    expected: 'No end_reason, private values, or dealbreakers shown.',
    spec: 'Spec §7.2',
  },
  {
    id: 'MM-QA-034',
    area: 'Settings',
    title: 'Delete MatchMaker profile',
    priority: 'P2',
    pre: 'User with MatchMaker data.',
    steps: '1. Delete from settings.\n2. Re-open MatchMaker.',
    expected: 'Intent/pool deactivated per RPC; confirm legal copy matches actual data retention.',
    spec: 'Spec §7.1',
  },
  {
    id: 'MM-QA-035',
    area: 'Regression',
    title: 'Desktop smoke (15 min)',
    priority: 'P0',
    pre: 'Gold verified user with complete values.',
    steps:
      'Discover → MatchMaker tab icons → pool → profile → interests → connection chat → settings edit → history → back to Discover.',
    expected: 'No console errors; no broken routes; nav states correct.',
    spec: 'Release gate',
  },
  {
    id: 'MM-QA-036',
    area: 'Regression',
    title: 'Mobile width smoke',
    priority: 'P1',
    pre: 'Viewport 390px.',
    steps: 'Repeat core flows using bottom nav and overflow sheet.',
    expected: 'MatchMaker icons and chips wrap; no horizontal scroll on values Step 3.',
    spec: 'Responsive QA',
  },
];

function testCaseSection(tc) {
  return [
    h(`${tc.id}: ${tc.title}`, HeadingLevel.HEADING_3),
    p(`Area: ${tc.area}  |  Priority: ${tc.priority}  |  Spec: ${tc.spec}`),
    p('Preconditions:', { bold: true }),
    p(tc.pre),
    p('Test steps:', { bold: true }),
    ...tc.steps.split('\n').map((line) => bullet(line)),
    p('Expected result:', { bold: true }),
    p(tc.expected),
    p('Actual result / status: _________________________________________________', { italics: true }),
    p('Tester / date: ______________________', { italics: true }),
  ];
}

const doc = new Document({
  creator: 'LinkUp QA',
  title: 'MatchMaker Web QA Test Plan',
  description: 'Manual and functional QA procedures for LinkUp MatchMaker on web.',
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'LinkUp MatchMaker', bold: true, size: 36 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: 'Web Application — Quality Assurance Test Plan', size: 28 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Version ${DOC_VERSION}`, size: 22 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: DOC_DATE, size: 22 })],
        }),
        p(
          'This document is intended for manual and exploratory testers, release managers, and engineers performing staging sign-off. It translates the authoritative MatchMaker interaction specification and user-flow documents into repeatable procedures with clear expected results.'
        ),
        h('Document control', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['Version', 'Date', 'Author', 'Summary']),
            tableRow(['1.0', DOC_DATE, 'QA / Engineering', 'Initial web MatchMaker test plan']),
          ],
        }),
        h('References', HeadingLevel.HEADING_2),
        bullet('docs/linkup_matchmaker_interaction_spec.md'),
        bullet('docs/linkup_matchmaker_userflow.md'),
        bullet('docs/matchmaker_web_requirements_audit.md'),
        h('Scope', HeadingLevel.HEADING_2),
        p('In scope: LinkUp web MatchMaker routes under `/matchmaker/**`, related onboarding fields, navigation, Supabase RPC integration, notifications deep links, and admin misalignment queue.'),
        p('Out of scope: Mobile-only haptics, native push delivery guarantees, and prototype artifact screens listed at end of interaction spec.'),
        h('Quality objectives', HeadingLevel.HEADING_2),
        bullet('Verify end-user journeys work without functional defects on staging before production promotion.'),
        bullet('Confirm private MatchMaker fields never leak to other users in UI or API payloads.'),
        bullet('Confirm gate order and single-active-connection rules are enforced server-side.'),
        bullet('Provide traceable evidence (screenshots, HAR, SQL) for P0 cases.'),
        h('Entry criteria', HeadingLevel.HEADING_2),
        bullet('Staging database: all matchmaker migrations through 20261010000003 applied.'),
        bullet('Web build deployed to staging matches repository master used for this plan.'),
        bullet('Test accounts provisioned (see matrix below).'),
        bullet('Two browsers available (Chromium + Safari or Firefox) for spot checks.'),
        h('Exit criteria (release recommendation)', HeadingLevel.HEADING_2),
        bullet('All P0 test cases executed with Pass or approved waiver documented.'),
        bullet('No open Sev-1/Sev-2 defects on MatchMaker journeys.'),
        bullet('P1 cases: ≥90% Pass or deferred with product sign-off.'),
        bullet('Privacy cases MM-QA-015 and MM-QA-033 executed with payload evidence.'),
        h('Test environment', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['Item', 'Detail']),
            tableRow(['Application URL', 'Staging web URL (fill before cycle)']),
            tableRow(['Supabase', 'Staging project — same keys as web deploy']),
            tableRow(['Browsers', 'Chrome latest; one secondary browser']),
            tableRow(['Viewports', 'Desktop ≥1280px; mobile 390×844']),
            tableRow(['Tools', 'DevTools Network; optional Supabase SQL editor']),
          ],
        }),
        h('Test account matrix', HeadingLevel.HEADING_2),
        p('Create dedicated accounts; do not use production member data.'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['Persona', 'Purpose', 'Setup notes']),
            tableRow(['MM-GOLD-A', 'Primary happy path', 'Gold/Platinum, KYC verified, complete profile + values']),
            tableRow(['MM-GOLD-B', 'Mutual connection', 'Same as A; different gender/intent compatible']),
            tableRow(['MM-FREE', 'Subscription gate', 'No Gold tier']),
            tableRow(['MM-UNVERIFIED', 'KYC gate', 'Gold but not verified']),
            tableRow(['MM-NOGENDER', 'Gender gate', 'NULL gender']),
            tableRow(['MM-COOLDOWN', 'Cooldown UI', 'Seed rapid-cycler / cooldown gate via admin or SQL']),
            tableRow(['MM-ADMIN', 'Misalignment queue', 'User in public.admins']),
          ],
        }),
        h('Defect severity guide', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['Severity', 'Definition', 'Example']),
            tableRow(['Sev-1', 'Data leak, connection bypass, payment/security', 'Dealbreakers visible on pool profile']),
            tableRow(['Sev-2', 'Core journey blocked', 'Cannot express interest or save Gate 4 values']),
            tableRow(['Sev-3', 'Major UX defect with workaround', 'Wrong chip label; broken back navigation']),
            tableRow(['Sev-4', 'Cosmetic / copy', 'Minor spacing on healing screen']),
          ],
        }),
        h('Test case summary', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['ID', 'Area', 'Title', 'Priority']),
            ...TEST_CASES.map((tc) => tableRow([tc.id, tc.area, tc.title, tc.priority])),
          ],
        }),
        h('Detailed test procedures', HeadingLevel.HEADING_2),
        p(
          'Execute in priority order (P0 first). Record Actual result as Pass, Fail, Blocked, or N/A. Attach evidence for every Fail and for all P0 Pass results.'
        ),
        ...TEST_CASES.flatMap((tc) => testCaseSection(tc)),
        h('Automated checks (CI)', HeadingLevel.HEADING_2),
        bullet('Run `npm test` — Vitest unit tests for nav active state, pace preference, shared activity weeks, end-connection validation, misalignment report payloads, tab pulse store.'),
        bullet('Run `npm run build` before deploy — TypeScript must pass.'),
        p('Note: Automated suite does not replace two-user staging tests above.'),
        h('Sign-off', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeader(['Role', 'Name', 'Signature', 'Date']),
            tableRow(['QA Lead', '', '', '']),
            tableRow(['Product Owner', '', '', '']),
            tableRow(['Engineering Lead', '', '', '']),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log(`Wrote ${OUT} (${buffer.length} bytes)`);
