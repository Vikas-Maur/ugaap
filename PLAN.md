# PLAN.md — Universal Grievance and Accountability Platform

## 1. Summary and Product Contract

UGAAP is an independent hackathon prototype that replaces CPGRAMS’s form-discovery burden with one accessible citizen journey:

1. Describe a grievance by text or voice.
2. AI identifies the authority, category path, and required form.
3. AI asks only for missing information and fills the draft.
4. Citizen reviews every final field.
5. Citizen submits manually or gives an explicit voice/chat submission command.
6. Citizen tracks updates, answers clarification requests, rates the resolution, and appeals a poor result.
7. Public users compare authorities and browse consented, redacted grievance summaries.

The current CPGRAMS concepts retained are registration IDs, status tracking, feedback, and appeal after poor resolution, while the interaction model is redesigned. [CPGRAMS](https://pgportal.gov.in/)

The prototype must comply with the hackathon constraints: a working end-to-end citizen journey, synthetic data, no live government integrations, an independent-prototype disclaimer, and meaningful Codex involvement. The deadline is August 28, 2026 at 8:00 PM IST. [Builder brief](https://buildwhatmovesindia.com/brief), [FAQ](https://buildwhatmovesindia.com/faq)

Execution must begin by saving this approved plan verbatim as `PLAN.md`.

### Included in the hackathon build

- Citizen-facing experience only.
- Manual, text-agent, and voice-agent navigation.
- English and Hindi interaction.
- Incremental catalogue support for all present and future captures.
- One-click synthetic demo access plus normal email/password authentication.
- AI-assisted grievance filing with mandatory final review.
- Tracking, clarification reply, feedback, and appeal.
- Opt-in redacted public grievances.
- Transparent ministry/state accountability leaderboard.
- Deterministic simulated department lifecycle.
- Vercel, Neon, and private Vercel Blob deployment.
- RBAC foundations, although only the citizen role receives UI.

### Explicitly excluded

- Ministry/admin dashboards.
- Real government API access, scraping, or submission.
- Working webhook receivers or department connectors.
- Real OTP, Aadhaar, PAN, payment, SMS, or email workflows.
- Automatic publication without citizen approval.
- Government branding or any suggestion of official endorsement.
- Unsupported visible features; unfinished features remain behind disabled feature flags.

---

## 2. Architecture and Public Contracts

### Technology decisions

- Keep TanStack Start, React 19, TanStack Router, Drizzle, Neon PostgreSQL, Better Auth, Tailwind, and Biome.
- Use TanStack AI’s `chat()`, `toServerSentEventsResponse()`, `useChat()`, `toolDefinition()`, and structured outputs. Do not introduce Vercel AI SDK patterns.
- Default text, classification, and structured tool work to `gemini-3.5-flash-lite` through `geminiText()`.
- Use Gemini Live as the primary voice experience through TanStack AI’s `geminiRealtime()`, with short-lived server-minted tokens from `geminiRealtimeToken()`; browser-native speech is fallback-only.
- Implement an environment-selected provider registry for Gemini, OpenAI, and OpenRouter; provider changes must not affect UI or agent tools.
- Pin all currently declared `latest` TanStack dependencies to compatible exact versions before feature work to prevent deadline-time drift.
- Consolidate the duplicate database clients into one request-safe Drizzle connection using Neon’s pooled URL.
- Use a private Vercel Blob store for attachments. Vercel currently includes Blob on Hobby with 1 GB-month storage, 2,000 advanced operations, and 10 GB transfer; if its token is absent in local development, use a metadata-only adapter rather than storing file bytes in PostgreSQL. [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)

### Routes and application shell

Public routes:

- `/` — task hub with the universal assistant already present.
- `/menu` — all citizen actions in plain language.
- `/leaderboard` — separate State/UT and Central Government comparisons.
- `/public-grievances` and `/public-grievances/$publicId`.
- `/about`, `/methodology`, `/privacy`, `/help`.
- `/login` and `/register`.

Authenticated citizen routes:

- `/file` — AI/manual grievance workflow.
- `/cases` and `/cases/$grievanceId`.
- `/cases/$grievanceId/appeal`.
- `/profile`.

The shell has no conventional navbar:

- Collapsible icon rail on desktop.
- Compact bottom task control on mobile.
- Persistent text/voice composer on every route; the user never opens a separate chatbot page.
- The assistant expands conversation context above the composer when used.
- A small permanent “Independent hackathon prototype — synthetic data only” label appears without using government logos.
- Home combines the ambient assistant with cards for File, Track, Public Cases, and Leaderboard.
- All primary controls meet WCAG 2.2 AA, keyboard navigation, visible focus, reduced-motion, and 44 px touch-target requirements.

### Anonymous and authenticated agent behavior

The anonymous assistant may:

- Navigate every public route.
- Explain the prototype and grievance process.
- Search public grievances.
- Open and compare leaderboard entries.
- Answer catalogue-level questions without exposing private data.

When an anonymous user asks to file, track a private case, appeal, or view personal cases:

1. Preserve the user’s pending intent and finalized text transcript in session storage; do not persist raw microphone audio.
2. Return an `auth_required` result.
3. Navigate to `/login`.
4. Do not ask for, read, or fill credentials.
5. After the user manually authenticates, restore the pending intent and ask whether to continue.
6. Resume the workflow without making the user repeat the grievance.

One-click demo access creates an isolated synthetic citizen session rather than sharing one mutable account between reviewers. Email/password registration remains available through Better Auth.

### Canonical domain types

Implement shared Zod schemas and inferred TypeScript types before routes or AI prompts:

```ts
type OrganizationType =
  | "union_ministry"
  | "central_department"
  | "state"
  | "state_department"
  | "subordinate_office";

type FieldKind = "text" | "number" | "select" | "textarea" | "file";

interface CanonicalField {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
  maxLength?: number;
  pattern?: string;
  options?: Array<{ value: string; label: string }>;
  sourceFieldId?: string;
}

interface CanonicalForm {
  id: string;
  organizationId: string;
  categoryNodeId: string;
  categoryPath: string[];
  fields: CanonicalField[];
  version: number;
  sourcePath: string;
  checksum: string;
}

type GrievanceStatus =
  | "draft"
  | "submitted"
  | "acknowledged"
  | "routed"
  | "in_review"
  | "needs_information"
  | "action_taken"
  | "resolved"
  | "appealed"
  | "appeal_resolved"
  | "withdrawn";
```

The grievance draft must contain the selected form/version, structured answers, remarks, attachment metadata, language, AI confidence, review hash, and public-consent state. Submitted records retain the exact form version so later catalogue imports cannot change historical cases.

### Database model

Phase 0 owns the schema and migration for:

- `organization` — hierarchy, type, jurisdiction, source label, active state.
- `category_node` — organization-scoped parent/child taxonomy.
- `form_definition` — versioned JSONB field schema, source path, checksum.
- `grievance_draft` — resumable authenticated drafts.
- `grievance` — private case record and current status.
- `attachment` — private Blob pathname, MIME type, size, checksum, owner.
- `grievance_event` — append-only timeline, messages, status changes, actor type.
- `feedback` and `appeal`.
- `public_grievance` — approved redacted summary; never attachment URLs or private identifiers.
- `performance_snapshot` — time window, raw metrics, composite score, grade, sample size.
- `agent_thread` — citizen-owned transcript metadata; provider/tool telemetry excludes raw sensitive content.
- `role`, `permission`, `user_role`, and `role_permission`.

Seed only the `citizen` role into the active UI, with permissions such as `grievance:create`, `grievance:read:self`, `grievance:reply:self`, `appeal:create`, `publication:manage:self`, and `analytics:read:public`. Future officer/admin/service roles remain schema-only.

### Server and agent interfaces

Public read operations:

- `getCatalogueManifest()`
- `searchCatalogue(query, organizationId?)`
- `getLeaderboard(group, window)`
- `listPublicGrievances(filters, cursor)`
- `getPublicGrievance(publicId)`

Authenticated operations:

- `saveDraft()`
- `createAttachmentUploadToken()`
- `submitGrievance(input, idempotencyKey, reviewHash)`
- `getMyCases()` / `getMyCase(id)`
- `replyToClarification()`
- `rateResolution()`
- `fileAppeal()`
- `setPublicationConsent()`
- `withdrawPublicCopy()`
- `advanceDemoCase()` only when `DEMO_MODE=true` and the caller owns the case.

Assistant tools:

- `navigate`
- `search_catalogue`
- `begin_grievance`
- `select_form`
- `update_draft_fields`
- `show_review`
- `submit_grievance`
- `find_my_case`
- `reply_to_clarification`
- `file_appeal`
- `search_public_grievances`
- `compare_organizations`

Navigation/form-state tools are client tools; database mutations are authenticated server tools. Every private server function enforces session ownership independently of route guards.

`submit_grievance` requires:

- A valid review hash for the currently displayed final fields.
- No edits since review.
- An unambiguous current-turn instruction such as “submit this grievance.”
- The same server validation and idempotency handling as the manual Submit button.

Ambiguous speech, inferred intent, or an earlier approval must never submit.

### Configuration

Document and validate:

```env
DATABASE_URL=
DATABASE_URL_POOLER=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GEMINI_API_KEY=
AI_PROVIDER=gemini
AI_TEXT_MODEL=gemini-3.5-flash-lite
VOICE_PROVIDER=gemini-live
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
BROWSER_VOICE_FALLBACK=true
OPENAI_API_KEY=
OPENROUTER_API_KEY=
BLOB_READ_WRITE_TOKEN=
PUBLIC_DATA_REVALIDATE_SECONDS=21600
DEMO_MODE=true
```

Only the selected provider key is required at runtime. Secrets remain server-only, are never logged, and `.env.example` contains placeholders only.

---

## 3. Phased Implementation Plan

### Phase 0 — Catalogue, schemas, migrations, and seed data

This phase is a hard dependency for all feature work.

#### P0.1 Catalogue compiler

Create an idempotent import command that recursively discovers every `captures/**/form.json`; never hard-code the current six authority folders.

For each snapshot:

- Validate its source shape with Zod and report the exact invalid path.
- Derive the authority from `snapshot.authority` when present; otherwise use a maintained slug-to-display-name alias map, falling back to title-casing the top folder.
- Build category nodes from `categoryPath` and folder ancestry.
- Ignore anonymous `kind: "search"` DOM-helper entries.
- Convert category `<select>` controls into taxonomy relationships rather than repeating them as terminal grievance fields.
- Preserve custom text, number, select, textarea, and file fields, including required flags, options, limits, and patterns.
- Treat a node as form-capable when it is a leaf or exposes non-navigation fields.
- For a terminal capture without remarks/file fields, append:
  - Required `remarks` textarea with a 2,000-character maximum.
  - Optional single `attachment` field.
- Generate stable IDs from authority/category slugs, not database sequence values.
- Hash normalized content; unchanged imports perform no updates, changed forms create a new version, and removed captures become inactive rather than being deleted.
- Emit a manifest containing source count, organization count, category count, form count, synthesized-field warnings, invalid records, and checksums.
- Generate per-authority static catalogue chunks and a compact search index.

Acceptance gate:

- All current 694 captures parse.
- Re-running the importer produces zero database or generated-artifact changes.
- Adding another authority folder requires no code changes unless its display-name alias is exceptional.
- The 214 currently incomplete snapshots do not produce broken forms.

#### P0.2 Database and RBAC

- Replace the starter-only schema with the domain tables above while retaining Better Auth tables.
- Add indexes for organization hierarchy, category ancestry, form checksum, citizen case lists, public-case pagination, event timelines, and leaderboard window lookup.
- Add unique constraints for form version/checksum, public IDs, attachment ownership, and submit idempotency keys.
- Create server-side auth middleware and permission helpers.
- Ensure private responses use `Cache-Control: no-store`; never rely on UI route guards for authorization.

#### P0.3 Synthetic seed pack

Seed deterministically:

- Organizations/forms from every available capture.
- Several clearly labeled synthetic state and central organizations for accountability coverage.
- One isolated demo citizen template.
- Cases in every lifecycle state.
- A resolved case rated poor and eligible for appeal.
- A case waiting for citizen clarification.
- Redacted public-case examples.
- Current and previous 90-day performance snapshots.

Use a fixed random seed so screenshots, tests, and the two-minute demo are reproducible.

### Phase 1 — Fast app shell, authentication, and manual navigation

#### P1.1 Shell and design system

- Replace starter content and remove production devtools.
- Use a calm civic palette, plain-language copy, system/self-hosted fonts, minimal animation, and no remote font request on first load.
- Create a distinct UGAAP logo and implement the collapsible icon rail, mobile task control, universal assistant composer, loading skeletons, empty states, and error states.
- Write all citizen-facing copy in English and Hindi, and provide a persistent language control that updates the website language.
- Build reusable accessible controls for dynamic fields, timelines, grades, metric explanations, transcript messages, microphone status, and review cards.
- Ensure every agent action has a visible/manual equivalent.

#### P1.2 Authentication and intent continuation

- Add login, registration, one-click isolated demo access, sign-out, sanitized redirect-back, and authenticated layout routes.
- Keep the assistant partially functional before login.
- Save anonymous pending intents and thread state in session storage.
- After manual login, restore the intent and continue only after the user confirms.
- Never send credentials, auth form contents, or session tokens to the AI endpoint.
- Persist authenticated grievance drafts server-side; use browser persistence only for anonymous assistant state and immediate draft recovery.

#### P1.3 Manual catalogue flow

- Allow browsing by authority, category tree, and searchable plain-language labels.
- Lazy-load only the selected authority’s catalogue chunk.
- Render forms entirely from `CanonicalForm`.
- Show breadcrumbs, required fields, validation, attachment state, save/resume, and final review.
- Make manual filing fully functional even when Gemini is unavailable.

### Phase 2 — Ambient AI and Hindi/English voice experience

#### P2.1 Provider registry and AI endpoint

- Implement an allowlisted provider registry for Gemini, OpenAI, and OpenRouter.
- Default to `gemini-3.5-flash-lite` with low-temperature structured extraction.
- Stream typed assistant responses over SSE.
- Use the installed TanStack Gemini realtime adapter for voice: mint a single-use, short-lived token on the server with `realtimeToken({ adapter: geminiRealtimeToken(...) })`, then connect the browser with `geminiRealtime()` over WebSocket. Anonymous sessions receive a tightly rate-limited token and public tools only; authenticated sessions receive the citizen tool set. Never expose `GEMINI_API_KEY` to the client.
- Keep one shared, schema-validated tool registry for typed chat and Gemini Live so navigation, draft mutations, review, and submission follow identical authorization and validation rules.
- Add middleware for latency, provider/model, token usage, tool name, success/error, and request ID; do not store raw grievance content in telemetry.
- Add per-user and per-IP rate limits, abort support, retryable error messages, and a circuit-breaker-style manual fallback.

#### P2.2 Hybrid classification

Before calling the model:

1. Normalize English/Hindi text and transliterated terms.
2. Search the generated catalogue index using weighted matches over authority name, category path, field labels, and option labels.
3. Pass only the top 12 valid form candidates to Gemini.
4. Require structured output containing:
   - `formId`
   - `confidence`
   - `extractedFields`
   - `missingRequiredFields`
   - `followUpQuestion`
   - `plainLanguageReason`
5. Reject any form ID outside the supplied candidates.
6. At confidence below `0.75`, or when the top two candidates differ by less than `0.10`, ask one focused clarification question.
7. After three unsuccessful clarifications, show the best candidates and continue manually.
8. Never invent authority names, field options, reference numbers, or citizen facts.

#### P2.3 Agent navigation and form filling

- Register allowlisted route destinations and draft mutation tools.
- Keep the agent aware of the current route, selected case, form schema, and validation state.
- Permit it to navigate, select categories, fill fields, explain why information is needed, and open review.
- Display every tool action in the conversation and immediately reflect it in the manual UI.
- Undo remains available for field/navigation mutations.
- Submission, appeal, clarification reply, and public-consent changes require explicit citizen intent.

#### P2.4 Voice behavior

- Make Gemini Live the primary voice path for streamed microphone input, input/output transcription, spoken responses, interruption handling, and conversational turn-taking.
- Use `gemini-3.1-flash-live-preview` by default, but keep the model ID environment-configurable so it can be upgraded without changing the UI or tool contracts.
- Obtain microphone permission only after the citizen taps the microphone control; show connecting, listening, thinking, speaking, interrupted, reconnecting, and error states.
- Configure English or Hindi output through the session language and allow the citizen to override automatic language selection.
- Forward Gemini Live tool calls into the same allowlisted client/server tool dispatcher used by typed chat. The realtime model may request an action, but all arguments, permissions, ownership, review hashes, and explicit-submit requirements are revalidated outside the model.
- Support barge-in: when the citizen speaks while Gemini is responding, stop playback, preserve the completed transcript, and continue from the new utterance.
- Keep the text transcript synchronized with the visible conversation and grievance draft. Do not persist raw microphone or generated audio by default.
- If the user begins by voice, continue with Gemini-generated spoken replies by default.
- If the user types or uses manual controls, remain silent unless Play is pressed.
- Provide Stop and “continue silently” controls.
- If Gemini Live cannot connect or the browser cannot support realtime audio, fall back to recorded audio sent as multimodal input to the standard Gemini text agent, then use browser `speechSynthesis` for spoken output.
- If the fallback recording or browser speech APIs are also unavailable, retain the complete text/manual experience without blocking.

### Phase 3 — Submission, attachments, tracking, feedback, and appeal

#### P3.1 Review and submission

The review screen must show:

- Authority and complete category path.
- Every required/custom field.
- Final grievance remarks.
- Attachment metadata.
- Language.
- Public-sharing choice and redacted-preview status.
- AI confidence and a “change route” action.

Submission runs one server transaction:

- Revalidate the exact stored form version and every answer.
- Verify attachment ownership.
- Verify review hash and idempotency key.
- Create an immutable grievance record and first timeline event.
- Generate a human-readable synthetic registration ID.
- Return a receipt and tracking link.

#### P3.2 Attachments

- Use one private Vercel Blob attachment per grievance, maximum 5 MB.
- Accept PDF, JPEG, and PNG only.
- Validate extension, declared MIME type, detected signature, size, checksum, and ownership.
- Upload directly using a short-lived authenticated token.
- Serve through an authenticated server response or signed access path.
- Never include attachment URLs in public grievance data.
- Label malware scanning as a production dependency; the prototype accepts synthetic files only.

#### P3.3 Deterministic lifecycle simulator

New demo cases progress through:

`submitted → acknowledged → routed → in_review → needs_information → action_taken → resolved`

- A clearly labeled demo control advances one deterministic step at a time.
- The clarification state creates a synthetic department question.
- Citizen replies append an event and allow progression.
- The control exists only in demo mode and only for the case owner.
- Production architecture treats these as external status events, but no webhook/API integration is implemented now.

#### P3.4 Feedback and appeal

- Accept a 1–5 satisfaction score and optional comment after resolution.
- Scores 1 or 2 expose the appeal action.
- AI may help draft the appeal, but the citizen reviews and explicitly submits it.
- Appeal events appear in the same timeline with a distinct appeal status.
- Include one pre-seeded resolved case so the full loop is immediately demoable.

### Phase 4 — Public accountability

#### P4.1 Public grievance publication

- Sharing is opt-in and disabled by default.
- Generate a concise public summary from the private case.
- Apply deterministic redaction for phone numbers, emails, account-like identifiers, addresses, and known submitted private fields, followed by AI redaction.
- Show the exact redacted preview to the citizen before approval.
- Publish only summary, category, organization, broad location if approved, status, dates, and public timeline updates.
- Attachments, contact data, custom identifiers, internal metadata, and private remarks remain private.
- Citizens can withdraw the public copy without deleting the official grievance record.
- Seeded and reviewer-created cases are visibly marked as synthetic demo data.

#### P4.2 Transparent leaderboard

Create separate rankings for Central Government bodies and States/UTs using a rolling 90-day window:

- 30% timely resolution rate.
- 25% citizen satisfaction, with Bayesian shrinkage toward the overall mean to reduce small-sample distortion.
- 20% backlog health based on overdue open cases.
- 15% appeal quality based on the rate of original resolutions upheld.
- 10% communication transparency based on meaningful update coverage.

Rules:

- Rank only organizations with at least 20 closed cases and 10 ratings.
- Show “Insufficient data” instead of a rank below the threshold.
- Grades: A ≥ 80, B = 65–79.99, C = 50–64.99, D < 50.
- Show score, grade, raw metrics, sample size, previous-period trend, and formula explanation.
- Poor ratings, reopened cases, ageing backlog, and upheld appeals must reduce performance so rapid low-quality closure cannot game the rank.
- Let users compare up to three bodies.
- Label all initial metrics as synthetic methodology-demo data.

### Phase 5 — Performance, caching, resilience, and security

- Prerender `/`, `/menu`, `/leaderboard`, `/public-grievances`, `/about`, `/methodology`, `/privacy`, and `/help`.
- Generate immutable per-authority catalogue assets at build/import time.
- Default public-data caching to:
  - `s-maxage=21600`
  - `stale-while-revalidate=86400`
- Keep the revalidation duration configurable through `PUBLIC_DATA_REVALIDATE_SECONDS`.
- Use request-driven CDN revalidation; do not require a Vercel Cron job.
- Cache only public, identity-independent data.
- Use `no-store` for sessions, drafts, personal cases, attachments, AI responses, and mutations.
- Lazy-load conversation history, authority chunks, charts, and voice code.
- Keep the initial public-route JavaScript budget below 250 KB compressed where practical.
- Preserve drafts across refresh and recover cleanly from AI/network failure.
- Add CSRF protection, ownership checks, input-size limits, upload limits, rate limits, secure cookies, sanitized redirects, and generic authentication errors.
- Treat catalogue text, public grievance text, and model output as untrusted data.
- Restrict model tools to allowlisted arguments and revalidate all tool inputs server-side.
- Persist synthetic demo submissions until operator purge; do not implement automatic case deletion.
- Document that a production deployment requires an approved records-retention policy, malware scanning, encryption/key-management review, grievance data classification, and audited integration credentials.

### Phase 6 — QA, deployment, and submission package

- Run Biome/type checking after each implementation lane.
- Run targeted unit tests at phase gates.
- Run the full build and browser suite after the major integrated change, consistent with repository instructions.
- Deploy to Vercel with a stable Neon database rather than an expiring claimable database.
- Verify all public routes open without access requests.
- Verify one-click demo access works in a clean browser.
- Remove development tools, debug output, unused starter code, and secret-like placeholders.
- Add documentation covering architecture, catalogue import, synthetic-data policy, score methodology, mocked dependencies, provider switching, deployment, and how Codex contributed.
- Prepare a repeatable 60-second citizen demo:
  1. Voice grievance in Hindi or English.
  2. AI routing and field completion.
  3. Final review and voice/manual submission.
  4. Tracking and clarification response.
  5. Resolution, poor rating, and appeal.
  6. Public redacted case and leaderboard.
- Prepare a second 60-second technical explanation and a project summary below 250 words.

### Phase 7 — Post-hackathon extensions

Do not implement these before the working citizen journey is complete:

- Signed outbound department webhooks and inbound status callbacks.
- Retry queues, idempotent connector delivery, and per-organization adapters.
- Ministry/officer/admin dashboards.
- Additional Indic languages.
- Real notification providers.
- Production malware scanning and records-retention automation.
- Official catalogue synchronization under an approved public API or data-sharing agreement.

---

## 4. Testing and Acceptance Criteria

### Catalogue tests

- All 694 current captures import successfully.
- New authority folders import without source changes.
- Null search helpers are ignored.
- Missing terminal remarks/file controls are synthesized correctly.
- Intermediate categories do not become broken forms.
- Stable IDs and checksums remain unchanged across repeated imports.
- Modified captures create a new form version without altering submitted cases.
- Invalid options, duplicate field keys, or malformed JSON fail with actionable reports.

### Authentication and authorization tests

- Anonymous users can operate all public assistant tools.
- Filing intent redirects to login and resumes after manual authentication.
- Credentials never appear in AI requests or stored transcripts.
- A citizen cannot access another citizen’s draft, grievance, event, attachment, or appeal.
- Direct calls to private server functions fail without a valid session.
- Demo users are isolated from one another.

### AI and voice tests

- Representative English, Hindi, and Hinglish grievances select expected candidate forms.
- Low-confidence inputs ask clarification or show manual candidates.
- Model failure preserves the draft and exposes manual filing.
- Invalid/hallucinated form IDs are rejected.
- Gemini Live connects with a server-minted token without exposing the API key, streams user/assistant transcripts, and invokes only the tools allowed for the current anonymous or authenticated session.
- Hindi and English realtime sessions produce the selected spoken language and keep the visible transcript synchronized.
- Barge-in stops current audio and continues the session without duplicating messages or tool calls.
- Typed interaction stays silent.
- Voice-started interaction uses Gemini audio until stopped or changed to silent mode.
- Live connection failure activates the multimodal-recording and browser-speech fallback; unsupported microphone/TTS environments retain a complete text workflow.
- Navigation tools cannot open arbitrary URLs.
- Submission cannot occur from ambiguous language or an outdated review hash.

### Grievance lifecycle tests

- Manual and AI-filled drafts use identical validation.
- Duplicate submit requests produce one grievance.
- Registration IDs are unique and receipts are reproducible.
- Demo lifecycle transitions only follow the allowed state machine.
- Clarification replies and status changes appear in chronological order.
- Appeal is available only after eligible poor feedback.
- Attachment type, signature, size, ownership, and authorization checks work.

### Accountability tests

- Public publication requires approved redacted preview and consent.
- Private identifiers and attachments never enter public responses.
- Withdrawal removes the public copy but preserves the private case.
- Leaderboard weights total 100%.
- Scores, grades, eligibility thresholds, trend values, and tie ordering are deterministic.
- Central and State/UT rankings never mix.
- Small samples show “Insufficient data.”
- Raw metrics reconcile with the displayed composite score.

### UX and performance tests

- Complete the main journey at 360 px mobile width and desktop width.
- All primary flows work with keyboard only.
- No critical/serious automated accessibility violations.
- Lighthouse mobile targets: LCP below 2.5 seconds, CLS below 0.1, and accessible first interaction on a throttled connection.
- Public pages remain usable while AI, database, or voice services are unavailable.
- No visible feature in the recorded demo is static or non-functional.

---

## 5. Parallel Execution and Assumptions

### Parallel work structure

After the lead implementer completes shared schemas, route contracts, and migration interfaces in Phase 0, work may proceed in four non-overlapping lanes:

- Lane A — catalogue compiler, database, seed data, server authorization.
- Lane B — shell, authentication UI, manual forms, responsive accessibility.
- Lane C — provider registry, agent tools, structured classification, voice.
- Lane D — lifecycle UI, public grievances, leaderboard, methodology.

Coordination rules:

- One lead owns shared dependency files, database schema, root shell, generated route tree, and final migrations.
- Lanes consume shared Zod types and must not redefine domain types.
- Every lane reports changed interfaces, migrations, environment keys, and its check result.
- Merge order is A → B → C/D → integrated QA.
- C and D may work in parallel after Phase 0; lifecycle mutations from D must use Lane A’s server contracts.
- Incomplete features remain feature-flagged and absent from the demo.
- Each phase ends with a working, reviewable product state.

### Locked assumptions

- The capture catalogue is research input only; the app never accesses CPGRAMS at runtime.
- Current coverage is 694 captures across six authority folders, but no authority count is hard-coded.
- More captures may be added before submission and are incorporated by rerunning the same importer.
- All prototype users, grievances, attachments, public cases, replies, and metrics must be synthetic.
- Prototype cases persist until operator purge.
- Vercel Blob is the production attachment store; metadata-only storage is the local fallback.
- Gemini 3.5 Flash Lite is the initial text/structured model, Gemini 3.1 Flash Live Preview is the initial realtime voice model, and both model IDs are selected through server environment variables.
- Gemini Live is the only API-based voice provider in the hackathon build; browser-native recording and speech synthesis are fallback-only.
- The assistant is ambient on every page and partially usable without login.
- Login remains a manual citizen action; the agent never handles credentials.
- The user may submit through the button or an explicit agent command only after seeing the final review.
- Admin dashboards and real integrations are intentionally deferred.
- Public accountability data is clearly labeled synthetic and methodology-focused.
- The application is presented only as an independent prototype, never as an official government service.
