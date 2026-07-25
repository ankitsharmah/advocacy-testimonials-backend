# JOURNAL.md — Backend Decision Journal

> Honest notes written as work progressed. See root JOURNAL.md for full project context.

---

## 1. Prioritization

### Built in this order:
1. MongoDB connection + Testimonial model — nothing works without the data layer
2. POST /api/testimonials — submit endpoint with validation and fingerprint
3. GET /api/testimonials + GET /api/testimonials/approved — dashboard and wall reads
4. PATCH /api/testimonials/:id/status — approve/reject
5. DELETE /api/testimonials/:id — delete
6. GET /api/testimonials/stats — aggregate counts for dashboard
7. Groq/LLaMA AI integration — sentiment, tags, summary on submit
8. Sort support on approved endpoint — `sortBy` + `sortOrder` query params
9. Bug fixes — comma operator, JSON fence stripping, pending status in PATCH

### Cut deliberately:
- Auth middleware on dashboard routes — brief didn't require it
- Rate limiting — known gap, documented
- Async job queue for AI — synchronous is fine at this scale
- Email notifications — out of scope
- Webhook support — out of scope
- Full test suite — time trade-off

---

## 2. Key Backend Decisions

**Groq over Gemini/OpenAI**
- Chose `llama-3.3-70b-versatile` via Groq API
- Options: OpenAI GPT-4o (costs money), Gemini (more auth setup), local models (too slow)
- Why: Free tier, OpenAI-SDK compatible (swap `baseURL` only), fast, produces reliable JSON
- File still named `geminiAnalysis.js` — renamed would break imports, not worth the churn

**Synchronous AI on submit**
- AI runs inline in POST handler before DB write
- Options: Bull job queue (async), fire-and-forget (save first, analyze later)
- Why: Simpler code, no worker process. 1–2s latency acceptable for a testimonial form.
- Risk: If Groq is slow, user waits. Mitigated by local fallback.

**Local sentiment fallback**
- `analyzeSentiment()` (keyword-based) runs if Groq fails or JSON parse errors
- Options: Return 500, save without AI fields, retry with backoff
- Why: Testimonial always saves. User never sees an AI failure. Data is always consistent.

**SHA-256 fingerprint for duplicate detection**
- `fingerprint = SHA256(email.toLowerCase() + text.trim().toLowerCase())`
- Stored on document, indexed. `findOne({ fingerprint })` before every insert.
- Options: Fuzzy matching (Levenshtein), email-only dedup, no dedup
- Why: Deterministic, fast, zero false positives. Fuzzy adds complexity with marginal benefit.

**`pending` allowed in PATCH /status**
- Originally blocked — validator only allowed `approved | rejected`
- Undo button on dashboard sends `pending` → was returning 400
- Fixed: allowlist expanded to `['approved', 'rejected', 'pending']`
- Caught via manual testing, not code review

**sortBy/sortOrder on approved endpoint**
- Added `sortBy` (createdAt | rating) and `sortOrder` (asc | desc) query params
- Validated against allowlist to prevent NoSQL injection via sort key
- Options: Client-side sort only
- Why: Client sort only works for current page. Backend sort is correct across pages.

---

## 3. Working with AI Agents

### Agent used
Antigravity (Google DeepMind Advanced Agentic Coding assistant) — primary pair programmer.

### How I used it
- Gave it specific files and specific bugs — never vague "fix my backend"
- Always read the generated code before accepting
- Caught logic errors the agent missed (comma operator, fence stripping need)
- Used it heavily for mechanical transformations (adding sort params, updating validators)

### Most effective prompts

**Bug: AI not being called:**
> "it is not making groq call"

Pasted both controller and geminiAnalysis files. Agent found two bugs: comma operator and wrong model ID. Terse prompt worked because full file context was provided.

**Bug: JSON parse crash:**
> "Unexpected token '`', ```\n{\n\"s\"... is not valid JSON — fix this"

Exact error → agent immediately identified markdown fence wrapping and added `.replace()` strip.

**Undo bug:**
> "in the dashboard undo button is not working"

Agent traced from frontend action (`pending`) → PATCH endpoint → validator → found the blocked status. One-line fix.

### When AI was wrong

**The comma operator bug:**
```js
// What was in the controller:
const { sentiment, sentimentScore, tags, summary } = await (text, parseInt(rating));
```
This is a JavaScript comma operator — returns `parseInt(rating)` (a number). `await 5` is valid but pointless. Destructuring a number gives all `undefined`.

**How I caught it:** Submitted a testimonial, checked the MongoDB document — `sentiment: undefined`, `aiTags: []`, `aiSummary: undefined`. Read the controller line by line and spotted it.

**Fix:** `await analyzeWithGemini(text, parseInt(rating))`

**Why the agent missed it:** The comma operator is syntactically valid JavaScript. No linter catches it in this context. The bug is semantic, not syntactic.

### Output I rejected
First version of `analyzeWithAI` used model `deepseek/deepseek-chat-v3-0324:free` — an OpenRouter format model ID, not a Groq model ID. Groq silently failed. I replaced it with `llama-3.3-70b-versatile` which is a valid Groq model.

---

## 4. Verification

**Submit endpoint:**
- POST with valid body → 201, document in MongoDB with all fields ✅
- POST missing name → 400 with validation error array ✅
- POST bad email → 400 ✅
- POST text < 10 chars → 400 ✅
- POST duplicate (same email + text) → 409 ✅
- POST with Groq key broken → 201, saved with local sentiment fallback ✅

**AI analysis:**
- Checked MongoDB docs directly after submit — `sentiment`, `aiTags`, `aiSummary` populated ✅
- Verified fence stripping: Groq returned ```json{...}``` → parsed correctly after fix ✅

**Dashboard endpoints:**
- GET /api/testimonials?status=pending → only pending returned ✅
- GET /api/testimonials/stats → correct counts match DB ✅
- PATCH status=approved → document updated, `reviewedAt` set ✅
- PATCH status=pending (undo) → works after validator fix ✅
- DELETE → document removed from DB ✅

**Sort on approved:**
- GET /api/testimonials/approved?sortBy=rating&sortOrder=desc → highest ratings first ✅
- GET /api/testimonials/approved?sortBy=createdAt&sortOrder=asc → oldest first ✅

**Pagination:**
- Correct `total`, `totalPages`, `hasNext`, `hasPrev` in all paginated responses ✅

### Still fragile
- No rate limiting on POST /api/testimonials — can be spammed
- No auth on dashboard routes — anyone can PATCH/DELETE
- AI latency uncontrolled — no timeout beyond Axios default (19090ms — suspiciously specific)
- `sentimentScore` excluded from approved response but still stored — minor inconsistency

---

## 5. If I Had 5 More Hours

1. **Auth middleware** — JWT verify on all dashboard routes. Most critical security gap.
2. **Rate limiting** — `express-rate-limit` on POST /api/testimonials. 5 req/hour/IP.
3. **MongoDB full-text search** — `$text` index on `text`, `aiTags`, `aiSummary`. Add GET /api/testimonials/search endpoint.
4. **Request timeout on AI** — Wrap Groq call in `Promise.race` with a 5s timeout. Fall back to local sentiment immediately rather than waiting 19s.
5. **Test suite** — Jest unit tests for controller functions with mocked Mongoose. At minimum: submit happy path, duplicate detection, status update, stats aggregation.