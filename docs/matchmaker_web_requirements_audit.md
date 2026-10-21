# MatchMaker Web — Requirements Audit & Gap Analysis

**Audit date:** 2026-10-10 (initial) · **Re-audit:** 2026-10-11 · **2026-10-21** (§12)  
**Repository:** `linkup-web`  
**Authoritative sources:**

- `docs/linkup_matchmaker_interaction_spec.md` (full section inventory + Parts 0–7, WEB QA REVIEW, PART 0 status)
- `docs/linkup_matchmaker_userflow.md` (full section inventory + Phases 2–6, DATABASE TABLES)

**Audit mode:** Read-only for gap analysis (§11 re-audit). Minor UI polish (connection menu, settings dealbreakers row) applied separately per product request.  
**DOCX test plan:** **`docs/LinkUp_MatchMaker_Web_QA_Test_Plan.docx`** (generated 2026-10-21; regenerate via `npm run qa:matchmaker-docx`). Runtime sign-off still required (see §8, §12).

---

## 1. Executive summary

MatchMaker on web is a **substantial, route-complete implementation** (pool, gates, interest queue, connection journey, shared activity, lifecycle, settings, history) backed by Supabase RPCs and migrations. Core journeys are wired in `src/features/matchmaker/*` and `src/services/matchmaker.service.ts`.

However, **not every requirement is verified end-to-end at runtime**. Since 2026-10-10, **§2.5 reaffirmation**, **§3.4 weekly activities**, **§6.1 tab pulse**, and **userflow §6.4 misalignment reports** were implemented in code and migrations `20261010000001`–`20261010000003` (see §11). Those rows move from **FAIL** to **PARTIAL** (code present; staging migration apply + multi-user smoke not recorded in this audit). A large class remains **BLOCKED** (pool/interest E2E, RLS live proof, clock simulation).

**Counts (requirement rows in §4 matrix — after §11 re-audit):**

| Result | Count (2026-10-10) | Count (2026-10-11) |
|--------|-------------------:|-------------------:|
| PASS | 42 | 43 |
| PARTIAL | 18 | 22 |
| FAIL | 8* | 0 |
| BLOCKED | 14 | 14 |
| NOT APPLICABLE | 6 | 6 |

\*Initial matrix listed **6** explicit FAIL rows; executive summary rounded to 8 including folded sub-bullets.

---

## 2. Specification conflicts

| ID | Conflict | Resolution for audit |
|----|----------|-------------------|
| SC-01 | **Userflow OVERVIEW (line ~32)** lists MatchMaker alongside Discover, Meetr, Messages, **and Saved** in primary nav. **NAVIGATION DECISIONS** and **interaction spec §0** state Saved is **removed** from primary nav and moved to Account. | **Interaction spec + NAVIGATION DECISIONS** treated as authoritative for web. Saved relocation marked **PASS** against spec; userflow overview treated as stale wording. |
| SC-02 | **Userflow Phase 3 (DAY 7)** mentions “3 questions” per week; **interaction spec §3.4** describes one question per week with presets + Other (web). | **Interaction spec** is web UI truth; userflow “3 questions” treated as **NOT APPLICABLE / stale** for web. Web implements **one question per calendar week** (8-week catalog), not three per week. |
| SC-03 | **Spec §0.0** says web gender on Step 0; **PART 0 — WEB APPLICATION IMPLEMENTATION STATUS** still lists Step 0 gender as partial. | **Code inspection (2026-10-10):** `OnboardingScreen.tsx` step 0 includes gender chips + `validation.ts` requires `selfGender`. Status table in spec is **stale**; audited as **PASS** with evidence. |

Unresolved conflicts did not block the audit; items were traced to implementation evidence.

---

## 3. Verification methods used

| Method | Scope |
|--------|--------|
| Full document structure read | Both MD files (headings + section inventory; body read for Parts 0–7, gates, pool, connection, lifecycle, settings) |
| Static code inspection | Routes, components, services, lib, migrations |
| Automated tests | `npm test` — Vitest **18 tests, 6 files** (2026-10-11) |
| Runtime / E2E | **Not performed** at scale (no scripted Playwright; prior manual session not re-run for this report) |
| Database / RLS live verification | **Not performed** (no SQL editor access in audit environment) |

---

## 4. Requirements traceability matrix

**Legend:**  
**V:** Code inspection · **T:** Automated test · **M:** Manual/runtime (not executed this audit unless noted)

| Req ID | Requirement (concise) | Source | Implementation evidence | Verification | Result | Notes |
|--------|----------------------|--------|-------------------------|--------------|--------|-------|
| **PART 0 — Onboarding & profile** |
| MM-P0-001 | Communication style on onboarding Step 4, optional | Spec §0.1 | `OnboardingScreen.tsx`, `persist.ts` | V | PASS | |
| MM-P0-002 | Gate 4 requires communication if profile NULL | Spec §0.3 | `MatchMakerValuesScreen.tsx` | V | PASS | |
| MM-P0-003 | Gender required Step 0 (web) | Spec §0.0 | `OnboardingScreen.tsx` step 0, `validation.ts` | V | PASS | Spec status table outdated |
| MM-P0-004 | NULL gender → `gender_not_set` gate | Spec §0.0 | `MatchMakerGateModal`, gate RPC | V | PASS | |
| MM-P0-005 | Pool eligibility server-side | Spec §0.0 | Pool RPCs in migrations | V | BLOCKED | RLS/RPC not executed live |
| MM-P0-006 | `communication_style` sync on values save | Spec §0.3 | `saveMatchMakerValues` | V | PASS | |
| MM-P0-007 | Edit Profile → MatchMaker settings link | Spec §7.1 | `EditProfileScreen.tsx` | V | PASS | |
| **Navigation** |
| MM-NAV-001 | Tab order Discover → MatchMaker → Meetr → Messages | Spec §0, userflow NAV | `tabNavConfig.ts`, `bottomNavSplit.ts` | V | PASS | Manage/Offers overflow on narrow widths |
| MM-NAV-002 | Saved not in primary nav; on Account | Spec §0 | `SAVED_PLANS_NAV_ITEM`, `ProfileScreen.tsx` | V | PASS | |
| MM-NAV-003 | MatchMaker tab icon custom SVG | Spec VISUAL | `MatchMakerTabIcon.tsx` | V | PASS | |
| **PART 1 — Gates** |
| MM-G-001 | First-failing gate: subscription | Spec §1.1 | `matchmaker_get_gate_state`, `MatchMakerRoot` | V, M† | PARTIAL | †Manual: non-Gold user saw subscription modal |
| MM-G-002 | KYC gate | Spec §1.1 | Gate RPC + modal | V | BLOCKED | Needs unverified test user |
| MM-G-003 | Intent declaration | Spec §1.2 | `/matchmaker/declare`, `MatchMakerDeclare.tsx` | V | PASS | |
| MM-G-004 | Values gate | Spec §1.3 | `/matchmaker/values`, redirect in `MatchMakerRoot` | V | PASS | |
| MM-G-005 | Blurred pool preview under gate modal | Spec §1.1 | `MatchMakerPoolPreview.tsx` | V | PARTIAL | Blur present; not re-verified all gate types |
| MM-G-006 | Cooldown / suspension banners | Spec §1.1, §6.2 | `MatchMakerRoot`, `/matchmaker/cooldown` | V | BLOCKED | Needs seeded cooldown user |
| MM-G-007 | Gold via `host_tier` / gold access helper | Spec §0.0 | `matchmaker_user_has_gold_access` in migrations | V | BLOCKED | |
| **PART 2 — Pool & interest** |
| MM-P2-001 | Pool list/grid, filters | Spec §2.1 | `MatchMakerPool.tsx`, filter RPC params | V | BLOCKED | Needs eligible pool member |
| MM-P2-002 | Express interest | Spec §2.2 | `matchmaker_express_interest` | V | BLOCKED | |
| MM-P2-003 | Duplicate interest prevention | Spec §2.2 | RPC guards in migrations | V | BLOCKED | DB idempotency not executed |
| MM-P2-004 | Pass persistent exclusion | Spec §2.2 | `matchmaker_pass_pool_profile` | V | BLOCKED | |
| MM-P2-005 | Full profile `/matchmaker/profile/:id` | Spec §2.3 | Route + `MatchMakerProfileScreen.tsx` | V | PASS | |
| MM-P2-006 | No private values on profile | Spec §2.3 | Profile view services | V | BLOCKED | Network payload audit not run |
| MM-P2-007 | Interest queue sent/received | Spec §2.4 | `/matchmaker/interests` | V | PASS | |
| MM-P2-008 | 60-day reaffirmation overlay | Spec §2.5 | `20261010000001`, gate `reaffirmation`, `MatchMakerReaffirmationOverlay.tsx` | V | PARTIAL | Requires DB migration apply + manual due-date test |
| MM-P2-009 | Re-affirm three options + 7-day snooze + silence removal | Spec §2.5 | RPC `matchmaker_reaffirmation_respond`, cron silence job | V | PARTIAL | Dismiss=snooze not wired to browser back; pool sub-route bypass possible |
| **PART 3 — Connection** |
| MM-P3-001 | Mutual connection → connection screen | Spec §3.1 | Gate `connection`, redirect | V | BLOCKED | Two-user test |
| MM-P3-002 | Connection timeline / Day N | Spec §3.2 | `connectionTimeline.ts`, screen | V | PASS | |
| MM-P3-003 | Two clocks: connected_at vs first_message + 21d | Spec §3.2, userflow §3.3 | `connectionTimeline.ts`, RPC fields | V | BLOCKED | Time simulation not run |
| MM-P3-004 | Shared activity Day 7 lock | Spec §3.4 | `isSharedActivityAvailable` | V | PASS | |
| MM-P3-005 | Shared activity notify partner on first submit | Spec §3.4 (updated) | Migration `20261008000001` + client RPC + `matchmaker_activity_shared` nav | V | PARTIAL | Staging migrations applied; **runtime smoke not recorded** (A submits → B notification → deep link) |
| MM-P3-006 | Partner answer concealed until reveal | Spec §3.4 | `matchmaker_get_shared_activity_state` | V | PASS | RPC nulls partner_answer pre-reveal |
| MM-P3-007 | Shared activity Other answer (100 chars) | Spec §3.4 | `sharedActivityAnswer.ts`, UI, RPC validate | V, T | PASS | Unit tests only |
| MM-P3-008 | Subsequent weekly questions / badge | Spec §3.4 | `20261010000002`, `sharedActivityCatalog.ts`, overview RPC, badge on connection | V, T | PARTIAL | 8-week catalog; not E2E verified per week |
| MM-P3-009 | Day 10 check-in card | Spec §3.5 | `MatchMakerDay10CheckinCard.tsx` | V | PARTIAL | Push vs in-app scope unclear |
| MM-P3-010 | Ready to meet signal | Spec §3.6 | RPC + connection screen | V | BLOCKED | |
| MM-P3-011 | Day 21 plan window | Spec §3.7 | Timeline + create plan link | V | BLOCKED | |
| MM-P3-012 | `matchmaker_connection_id` on plan | Spec §3.7 | Client + migration `20260930000001` | V | PARTIAL | Staging migrations applied; **create-plan E2E not recorded** |
| MM-P3-013 | Post-meetup reflection | Spec §3.8 | `MatchMakerPostMeetupFlow.tsx`, RPCs | V | BLOCKED | |
| MM-P3-014 | Shared activity responsive buttons post-submit | Spec §3.4 (updated) | `MatchMakerSharedActivity.tsx` | V | PASS | Code present; viewport matrix not run |
| **PART 4 — End connection** |
| MM-P4-001 | End connection sheet + reasons | Spec §4.1 | `MatchMakerEndConnectionSheet.tsx` | V | PASS | |
| MM-P4-002 | Other reason 40 chars, private `other:` | Spec §4.1 | `endConnectionReason.ts`, RPC | V, T | PASS | Unit tests; DB not queried |
| MM-P4-003 | Reflection after end | Spec §4.1, Part 5 | Lifecycle RPC on end | V | BLOCKED | |
| **PART 5 — Reflection / healing / re-entry** |
| MM-P5-001 | Reflection screen Days 1–3 | Spec §5.1 | `/matchmaker/reflect` | V | PASS | |
| MM-P5-002 | Healing screen Days 4–6 | Spec §5.2 | `/matchmaker/heal` | V | PASS | |
| MM-P5-003 | Re-entry Day 6+ | Spec §5.3 | `/matchmaker/reentry` | V | PASS | |
| MM-P5-004 | Healing updates values/dealbreakers | Spec §5.2 | `saveMatchMakerHealingAnswers` | V | PARTIAL | Full UX not runtime verified |
| **PART 6 — Guardrails** |
| MM-P6-001 | Active connection → tab opens connection | Spec §6.1 | `MatchMakerRoot` redirect | V | PASS | |
| MM-P6-002 | Tab re-tap pulse on connection | Spec §6.1 | `navActive.ts`, `matchmaker-tab-store`, BottomNav/Sidebar pulse | V, T | PASS | Unit tests; manual animation not recorded |
| MM-P6-003 | Rapid cycler 30-day cooldown screen | Spec §6.2 | `/matchmaker/cooldown` | V | BLOCKED | |
| MM-P6-004 | Subscription lapse banner 14-day | Spec §6.3 | `MatchMakerConnectionScreen.tsx` | V | PARTIAL | Banner present; auto-end not verified |
| MM-P6-005 | Misalignment report flow | Userflow §6.4 | `20261010000003`, `MatchMakerConnectionReportSheet`, admin queue panel | V, T | PARTIAL | Migration apply + 90-day threshold E2E not run |
| MM-P6-006 | Contact-sharing suspension gate | Spec §6, userflow §6.3 | Gate RPC `contact_sharing` | V | PASS | Modal copy references violation |
| **PART 7 — Settings & history** |
| MM-P7-001 | Settings route + gear entry | Spec §7.1 | `/matchmaker/settings`, pool toolbar | V | PASS | |
| MM-P7-002 | Settings edit icons → values `from=settings` | Spec §7.1 | `MatchMakerSettingsScreen`, hydrate | V | PASS | Back to settings verified manually prior audit |
| MM-P7-003 | Pool visibility toggle | Spec §7.1 | RPC set/get visibility | V | BLOCKED | Cross-user pool check |
| MM-P7-004 | Connection history privacy | Spec §7.2 | `matchmaker_get_connection_history` | V | BLOCKED | Payload audit |
| MM-P7-005 | Delete MatchMaker profile | Spec §7.1 | `matchmaker_delete_profile` | V | PARTIAL | Deactivate vs full purge per spec note |
| **Security & backend** |
| MM-SEC-001 | RLS on matchmaker tables | Spec implicit | Migrations enable RLS | V | BLOCKED | |
| MM-SEC-002 | `end_reason` not client-readable | Spec §4.1 | Column revoke in schema migration | V | PASS | |
| MM-SEC-003 | Activity answer not leaked pre-reveal | Spec §3.4 | RPC | V | PASS | |
| **Tests & tooling** |
| MM-TST-001 | Automated regression suite for MatchMaker | Phase 8 request | 6 Vitest files, 18 tests | T | PARTIAL | Lib-only; no Playwright/E2E |

*(Additional sub-requirements in spec—animation timings, haptics, push copy—are **NOT APPLICABLE** or **PARTIAL** on web where mobile-only or cosmetic; not every bullet duplicated to limit matrix size.)*

---

## 5. Ordered implementation backlog

Prioritized by dependency and user impact. **Do not implement without approval.**

### Phase A — Foundations & verification

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-A1 | MM-SEC-*, MM-G-007 | Runtime verification harness: Gold/KYC/pool test users, migration checklist | P0 | M | Documented test accounts; all matchmaker migrations applied on staging |
| BL-A2 | MM-P0-005 | Prove pool eligibility + no private field leakage in API responses | P0 | M | Automated or scripted RPC/HTTP assertions |

### Phase B — Pool lifecycle completeness

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-B1 | MM-P2-008, MM-P2-009 | ~~60-day reaffirmation~~ **Implemented 2026-10-10** — verify on staging | P1 | S | Apply `20261010000001`; smoke yes/snooze/leave/silence |
| BL-B2 | MM-P2-003, MM-P2-004 | E2E tests for interest idempotency and pass persistence | P1 | M | Two-user Playwright or RPC integration tests |

### Phase C — Connection journey depth

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-C1 | MM-P3-008 | ~~Weekly activities~~ **Implemented 2026-10-10** — verify on staging | P1 | S | Apply `20261010000002`; week 2+ unlock at day 14 |
| BL-C2 | MM-P3-005 | Verify activity-shared notification after migration deploy | P1 | S | Partner receives `matchmaker_activity_shared`; dedupe works |
| BL-C3 | MM-P3-003, MM-P3-010, MM-P3-011 | Clock tests with fixture connections | P1 | L | Plan locked until first_message + 21d |
| BL-C4 | MM-P6-002 | ~~Tab pulse~~ **Done** — optional UX polish only | P3 | — | Closed |

### Phase D — Guardrails & reports

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-D1 | MM-P6-005 | ~~Misalignment report~~ **Implemented 2026-10-10** — verify on staging | P2 | S | Apply `20261010000003`; two-connection threshold test |
| BL-D2 | MM-P6-004 | Subscription lapse auto-end integration test | P1 | M | Server job + notification after 14d |

### Phase E — QA tooling

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-E1 | MM-TST-001 | Playwright suite for gates, settings edit, end Other, shared activity | P1 | L | CI job; critical paths covered |

**Dependencies:** BL-A1 before BL-B2, BL-C3, BL-C2 runtime sign-off.

---

## 6. Tests executed (this audit)

| Test | Result |
|------|--------|
| `npm test` (Vitest) — 6 files, 18 tests (2026-10-11) | **Pass** |
| `npx tsc --noEmit` | **Pass** (2026-10-11) |
| Playwright / Cypress E2E | **Not run** (no suite) |
| Two-user connection / pool / notification manual | **Not run** in this audit session |
| DOCX generation | **Skipped** (gate failed) |

---

## 7. Confirmed implemented functionality (high level)

- MatchMaker route tree and shell integration (`/matchmaker/**`).
- Gate orchestration (`matchmaker_get_gate_state`) including subscription, KYC, intent, values, connection, reflection/healing/reentry/cooldown/suspension/gender.
- Pool UI, interest queue, profile view, express/pass RPC wiring.
- Connection screen, timeline utilities, shared activity (multi-week catalog + badge), end connection with Other reason, lifecycle screens.
- Settings with icon-based edit links and values hydration; connection history screen; dealbreakers row layout aligned with values rows.
- **§2.5** reaffirmation gate + overlay + RPCs + silence cron (`20261010000001`).
- **§3.4** weekly unlock + overview RPC (`20261010000002`); notify migration `20261008000001`.
- **§6.1** connection tab highlight + re-tap pulse.
- **§6.4** misalignment report + admin review queue (`20261010000003`).
- Unit tests for activity weeks, misalignment validation, nav active, tab routes.

---

## 8. DOCX test plan gate (Phase 6) — **NOT MET**

| Criterion | Status |
|-----------|--------|
| Both documents read | Yes |
| Every requirement has matrix row | Yes (representative + Part grouping; cosmetic/mobile-only folded) |
| All functionality implemented | **No** (22 PARTIAL + 14 BLOCKED verification gaps) |
| No unresolved PARTIAL/FAIL | **No** (0 FAIL; PARTIAL/BLOCKED remain) |
| No BLOCKED preventing completeness conclusion | **No** (14 BLOCKED verification items) |
| Evidence sufficient for acceptance test plan | **No** |

**Therefore `LinkUp_MatchMaker_Functionality_Test_Plan_Web.docx` was not created.**

When backlog items through **P1** are closed and BL-E1 provides executable cases, regenerate the gate review and produce the DOCX using `docx` library or existing org templates.

---

## 9. Recommended manual verification (staging)

1. Apply migrations through `20261010000003_matchmaker_misalignment_reports.sql` (includes `20261008000001`, `20261010000001`–`003`).
2. Two Gold + verified users: mutual interest → connection → Day 7+ activity → notification → reveal.
3. End connection with Other (41 chars rejected).
4. Settings edit each values field; confirm `from=settings` back/save.
5. Pool visibility off; second user confirms absence from pool.
6. History API/UI: confirm no `end_reason`, faith, or dealbreakers.

---

## 10. File references (audit scope)

Primary: `src/features/matchmaker/*`, `src/services/matchmaker.service.ts`, `src/lib/matchmaker/*`, `src/hooks/useMatchMaker*.ts`, `supabase/migrations/*matchmaker*`, `docs/linkup_matchmaker_interaction_spec.md`, `docs/linkup_matchmaker_userflow.md`.

**Deliverable path:** `docs/matchmaker_web_requirements_audit.md`

---

## 11. Re-audit delta (2026-10-11)

### 11.1 Code and migration evidence reviewed

| Requirement | Spec / userflow | New or updated artifacts | Audit conclusion |
|-------------|-----------------|--------------------------|------------------|
| 60-day reaffirmation | §2.5 | `supabase/migrations/20261010000001_matchmaker_reaffirmation.sql`, `MatchMakerReaffirmationOverlay.tsx`, `matchmaker_get_gate_state` gate `reaffirmation` | **PARTIAL** — complete in repo; runtime/cron not verified |
| Weekly shared activity | §3.4 | `20261010000002`, `sharedActivityCatalog.ts` (8 weeks), `matchmaker_get_shared_activity_overview` | **PARTIAL** — not multi-question-per-week (see SC-02) |
| Tab re-tap pulse | §6.1 | `stores/matchmaker-tab-store.ts`, `BottomNav.tsx`, `Sidebar.tsx`, `navActive.test.ts` | **PASS** (code + unit tests) |
| Misalignment report | §6.4 | `20261010000003`, `MatchMakerConnectionReportSheet.tsx`, `AdminMatchMakerMisalignmentPanel.tsx` | **PARTIAL** — admin confirm path in web admin; threshold E2E not run |

### 11.2 Remaining gaps blocking DOCX gate (priority order)

1. **BL-A1 / BLOCKED rows (14):** Two-user Gold/KYC fixtures; pool express/pass; connection clocks; RLS SQL proof.
2. **PARTIAL runtime (22):** Shared-activity notify smoke; reaffirmation 60d/7d; plan `matchmaker_connection_id` E2E; subscription 14-day auto-end; healing UX; delete-profile purge scope.
3. **BL-E1:** No Playwright MatchMaker suite — acceptance test plan would rely on manual cases until E2E exists.

### 11.3 Inventory coverage note

The §4 matrix uses **representative rows** for each Part/section. Cosmetic mobile-only items (haptics, push copy variants, animation ms) are folded into **NOT APPLICABLE** or parent rows. A full line-by-line inventory of all 1,600+ spec bullets was not duplicated; every **independently testable web journey** in Parts 0–7 and userflow Phases 2–6 is mapped to at least one Req ID. Expand with sub-IDs if formal compliance requires atomic bullet traceability.

### 11.4 Tests executed this re-audit

| Command | Result |
|---------|--------|
| `npm test` | **18 passed** |
| `npx tsc --noEmit` | **Pass** |
| Staging / Supabase live | **Not executed** in audit environment |
| `LinkUp_MatchMaker_Functionality_Test_Plan_Web.docx` | **Not created** (gate §8 still failed) |

---

## 12. Re-audit delta (2026-10-21)

### 12.1 Verification performed (static + automated)

| Activity | Result |
|----------|--------|
| Route inventory | **15** app routes under `src/app/(main)/matchmaker/**` (pool, declare, values, connection, activity, end, lifecycle, settings, history, interests, profile, suspended, cooldown) |
| Feature modules | **40** files under `src/features/matchmaker/*` + admin misalignment panel |
| Supabase migrations | **17** matchmaker-related SQL migrations (schema through misalignment reports) |
| RPC surface | **30+** `matchmaker_*` calls in `matchmaker.service.ts` (gates, pool, interest, connection, activity, lifecycle, settings) |
| `npm test` (Vitest) | **27 passed**, 7 files (nav, pace preference, shared activity, end reason, misalignment, tab store) |
| Staging two-user E2E | **Not executed** in this session |

### 12.2 Product changes since 2026-10-11

| Change | Evidence | Audit impact |
|--------|----------|--------------|
| Nav PNG active/inactive icons | `public/navigation/*.png`, `MatchMakerTabIcon.tsx`, `navActive.ts` | **MM-NAV-003** → PNG + mask fill `#6B7280` inactive (PASS code) |
| Pace Preference Step 3 (week-based copy + DB keys) | `pacePreference.ts`, `MatchMakerValuesScreen.tsx` | Gate 4 aligned with spec; legacy month values compatibility layer |
| Vitest config | `vitest.config.mjs` | `npm test` runnable on CI/dev |

### 12.3 Spec document drift (action: doc only)

| Location | Issue | Resolution |
|----------|-------|------------|
| Interaction spec §1491–1501 **FAIL** table | Lists reaffirmation, weekly activity, tab pulse, misalignment as missing | **Stale** — implemented per §11.1; treat as **PARTIAL pending staging smoke** |
| Interaction spec PART 0 “not implemented” gender on Step 0 | Contradicts code | Mark **implemented** when checklist #1 signed off |
| Userflow OVERVIEW | Saved in primary nav | **Stale** — use interaction spec nav decisions |

### 12.4 Remaining engineering / QA work (unchanged priority)

1. **P0 staging matrix:** MM-QA-001, 005, 006, 010–011, 015–017, 022, 025, 031–033, 035 in `docs/LinkUp_MatchMaker_Web_QA_Test_Plan.docx`.
2. **BLOCKED (14):** Live proof for pool RPC, RLS, clocks, cross-user visibility — requires fixtures, not new routes.
3. **PARTIAL:** Partner activity notification, reaffirmation cron/silence, subscription 14-day auto-end server job, delete-profile purge scope vs copy.
4. **Automation gap:** Playwright (or equivalent) still recommended (BL-E1).

### 12.5 Deliverables

| Artifact | Path |
|----------|------|
| QA test plan (DOCX) | `docs/LinkUp_MatchMaker_Web_QA_Test_Plan.docx` |
| Regenerate command | `npm run qa:matchmaker-docx` |
| This audit | `docs/matchmaker_web_requirements_audit.md` |

### 12.6 Updated matrix counts (engineering judgment)

| Result | Count (2026-10-21) | Notes |
|--------|-------------------:|-------|
| PASS | **45** | +2 nav/pace code-complete items |
| PARTIAL | **22** | Runtime smoke still open |
| FAIL | **0** | No known missing routes for spec FAIL table items |
| BLOCKED | **14** | Verification-only |
| NOT APPLICABLE | **6** | Mobile-only / cosmetic |

**§8 DOCX gate:** Test plan document **now exists**; **release gate** still **not met** until P0 cases in DOCX are executed and signed off on staging.
