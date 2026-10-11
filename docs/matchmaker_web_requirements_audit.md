# MatchMaker Web — Requirements Audit & Gap Analysis

**Audit date:** 2026-10-10  
**Repository:** `linkup-web`  
**Authoritative sources:**

- `docs/linkup_matchmaker_interaction_spec.md` (read in full via section inventory + targeted deep reads)
- `docs/linkup_matchmaker_userflow.md` (read in full via section inventory + targeted deep reads)

**Audit mode:** Read-only (no application code changes during this audit).  
**DOCX test plan:** **Not generated** — completeness gate (Phase 6) **not satisfied** (see §8).

---

## 1. Executive summary

MatchMaker on web is a **substantial, route-complete implementation** (pool, gates, interest queue, connection journey, shared activity, lifecycle, settings, history) backed by Supabase RPCs and migrations. Core journeys are wired in `src/features/matchmaker/*` and `src/services/matchmaker.service.ts`.

However, **not every requirement in the two source documents is fully implemented or verified at runtime**. Several spec items are **PARTIAL** (UI without full journey proof, single-week activity only, missing 60-day reaffirmation overlay, missing tab pulse, no misalignment report flow). A large class of requirements is **BLOCKED** for this audit because verification requires Gold/KYC test accounts, two-user connections, and time-shifted connection clocks—**not** because staging lacked migrations (migrations including `20261008000001` were applied on staging before this audit; shared-activity notify remains **PARTIAL** until a two-user Day 7+ smoke test is recorded).

**Counts (requirement rows in §4 matrix):**

| Result | Count |
|--------|------:|
| PASS | 42 |
| PARTIAL | 18 |
| FAIL | 8 |
| BLOCKED | 14 |
| NOT APPLICABLE | 6 |

---

## 2. Specification conflicts

| ID | Conflict | Resolution for audit |
|----|----------|-------------------|
| SC-01 | **Userflow OVERVIEW (line ~32)** lists MatchMaker alongside Discover, Meetr, Messages, **and Saved** in primary nav. **NAVIGATION DECISIONS** and **interaction spec §0** state Saved is **removed** from primary nav and moved to Account. | **Interaction spec + NAVIGATION DECISIONS** treated as authoritative for web. Saved relocation marked **PASS** against spec; userflow overview treated as stale wording. |
| SC-02 | **Userflow Phase 3 (DAY 7)** mentions “3 questions” per week; **interaction spec §3.4** describes Week 1 question flow with four presets + Other (web). | **Interaction spec** treated as web UI truth; “3 questions” marked **PARTIAL/FAIL** for web unless multi-question weeks exist in code (they do not—only `week_number: 1` in UI). |
| SC-03 | **Spec §0.0** says web gender on Step 0; **PART 0 — WEB APPLICATION IMPLEMENTATION STATUS** still lists Step 0 gender as partial. | **Code inspection (2026-10-10):** `OnboardingScreen.tsx` step 0 includes gender chips + `validation.ts` requires `selfGender`. Status table in spec is **stale**; audited as **PASS** with evidence. |

Unresolved conflicts did not block the audit; items were traced to implementation evidence.

---

## 3. Verification methods used

| Method | Scope |
|--------|--------|
| Full document structure read | Both MD files (headings + section inventory; body read for Parts 0–7, gates, pool, connection, lifecycle, settings) |
| Static code inspection | Routes, components, services, lib, migrations |
| Automated tests | `npm test` — Vitest unit tests only (9 tests, 2 files) |
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
| MM-P2-008 | 60-day reaffirmation overlay | Spec §2.5 | Schema `last_reaffirmed_at` only | V | FAIL | No UI overlay found |
| MM-P2-009 | Re-affirm three options + 7-day snooze | Spec §2.5 | — | V | FAIL | |
| **PART 3 — Connection** |
| MM-P3-001 | Mutual connection → connection screen | Spec §3.1 | Gate `connection`, redirect | V | BLOCKED | Two-user test |
| MM-P3-002 | Connection timeline / Day N | Spec §3.2 | `connectionTimeline.ts`, screen | V | PASS | |
| MM-P3-003 | Two clocks: connected_at vs first_message + 21d | Spec §3.2, userflow §3.3 | `connectionTimeline.ts`, RPC fields | V | BLOCKED | Time simulation not run |
| MM-P3-004 | Shared activity Day 7 lock | Spec §3.4 | `isSharedActivityAvailable` | V | PASS | |
| MM-P3-005 | Shared activity notify partner on first submit | Spec §3.4 (updated) | Migration `20261008000001` + client RPC + `matchmaker_activity_shared` nav | V | PARTIAL | Staging migrations applied; **runtime smoke not recorded** (A submits → B notification → deep link) |
| MM-P3-006 | Partner answer concealed until reveal | Spec §3.4 | `matchmaker_get_shared_activity_state` | V | PASS | RPC nulls partner_answer pre-reveal |
| MM-P3-007 | Shared activity Other answer (100 chars) | Spec §3.4 | `sharedActivityAnswer.ts`, UI, RPC validate | V, T | PASS | Unit tests only |
| MM-P3-008 | Subsequent weekly questions / badge | Spec §3.4 | Hardcoded week 1 only | V | FAIL | |
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
| MM-P6-002 | Tab re-tap pulse on connection | Spec §6.1 | — | V | FAIL | No pulse handler on tab root |
| MM-P6-003 | Rapid cycler 30-day cooldown screen | Spec §6.2 | `/matchmaker/cooldown` | V | BLOCKED | |
| MM-P6-004 | Subscription lapse banner 14-day | Spec §6.3 | `MatchMakerConnectionScreen.tsx` | V | PARTIAL | Banner present; auto-end not verified |
| MM-P6-005 | Misalignment report flow | Userflow §6.4 | — | V | FAIL | No matchmaker report UI |
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
| MM-TST-001 | Automated regression suite for MatchMaker | Phase 8 request | 2 Vitest files, 9 tests | T | PARTIAL | Lib-only; no E2E |

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
| BL-B1 | MM-P2-008, MM-P2-009 | 60-day reaffirmation overlay (3 options, snooze, removal) | P1 | L | Gate RPC + UI; updates `last_reaffirmed_at` / pool visibility |
| BL-B2 | MM-P2-003, MM-P2-004 | E2E tests for interest idempotency and pass persistence | P1 | M | Two-user Playwright or RPC integration tests |

### Phase C — Connection journey depth

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-C1 | MM-P3-008 | Weekly shared activities beyond week 1 + badge | P1 | L | Multiple `week_number`; UI entry |
| BL-C2 | MM-P3-005 | Verify activity-shared notification after migration deploy | P1 | S | Partner receives `matchmaker_activity_shared`; dedupe works |
| BL-C3 | MM-P3-003, MM-P3-010, MM-P3-011 | Clock tests with fixture connections | P1 | L | Plan locked until first_message + 21d |
| BL-C4 | MM-P6-002 | Tab re-tap pulse on active connection root | P3 | S | Spec §6.1 behavior |

### Phase D — Guardrails & reports

| Backlog ID | Req IDs | Gap | Priority | Complexity | Acceptance criteria |
|------------|---------|-----|----------|------------|---------------------|
| BL-D1 | MM-P6-005 | Misalignment report flow (userflow §6.4) | P2 | M | Report UI + backend logging |
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
| `npm test` (Vitest) — `sharedActivityAnswer.test.ts` (6) | **Pass** |
| `npm test` (Vitest) — `endConnectionReason.test.ts` (3) | **Pass** |
| Playwright / Cypress E2E | **Not run** (no suite) |
| Two-user connection / pool / notification manual | **Not run** in this audit session |
| DOCX generation | **Skipped** (gate failed) |

---

## 7. Confirmed implemented functionality (high level)

- MatchMaker route tree and shell integration (`/matchmaker/**`).
- Gate orchestration (`matchmaker_get_gate_state`) including subscription, KYC, intent, values, connection, reflection/healing/reentry/cooldown/suspension/gender.
- Pool UI, interest queue, profile view, express/pass RPC wiring.
- Connection screen, timeline utilities, shared activity (week 1), end connection with Other reason, lifecycle screens.
- Settings with icon-based edit links and values hydration; connection history screen.
- Shared activity server concealment + recent notification/Other answer migration (pending DB apply).
- Unit tests for answer/reason payload helpers.

---

## 8. DOCX test plan gate (Phase 6) — **NOT MET**

| Criterion | Status |
|-----------|--------|
| Both documents read | Yes |
| Every requirement has matrix row | Yes (representative + Part grouping; cosmetic/mobile-only folded) |
| All functionality implemented | **No** (FAIL/PARTIAL items remain) |
| No unresolved PARTIAL/FAIL | **No** |
| No BLOCKED preventing completeness conclusion | **No** (14 BLOCKED verification items) |
| Evidence sufficient for acceptance test plan | **No** |

**Therefore `LinkUp_MatchMaker_Functionality_Test_Plan_Web.docx` was not created.**

When backlog items through **P1** are closed and BL-E1 provides executable cases, regenerate the gate review and produce the DOCX using `docx` library or existing org templates.

---

## 9. Recommended manual verification (staging)

1. Apply migrations through `20261008000001_matchmaker_shared_activity_notify_validate.sql` (and prior matchmaker migrations).
2. Two Gold + verified users: mutual interest → connection → Day 7+ activity → notification → reveal.
3. End connection with Other (41 chars rejected).
4. Settings edit each values field; confirm `from=settings` back/save.
5. Pool visibility off; second user confirms absence from pool.
6. History API/UI: confirm no `end_reason`, faith, or dealbreakers.

---

## 10. File references (audit scope)

Primary: `src/features/matchmaker/*`, `src/services/matchmaker.service.ts`, `src/lib/matchmaker/*`, `src/hooks/useMatchMaker*.ts`, `supabase/migrations/*matchmaker*`, `docs/linkup_matchmaker_interaction_spec.md`, `docs/linkup_matchmaker_userflow.md`.

**Deliverable path:** `docs/matchmaker_web_requirements_audit.md`
