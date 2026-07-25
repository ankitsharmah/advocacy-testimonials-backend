# TrustVoice — Backend

Node.js / Express REST API for the TrustVoice testimonial platform. Stores data in MongoDB Atlas, runs AI analysis via Groq (LLaMA 3.3 70B), and exposes a public widget endpoint.

---

## Quick Start

```bash
npm install
npm run dev      # nodemon hot-reload
# or
node src/server.js
```

Runs on `http://localhost:9090`.

---

## Environment Variables

Create `.env` in this folder:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/trustvoice
GROQ_API_KEY=gsk_...
PORT=9090
```

| Variable       | Required | Description                      |
| -------------- | -------- | -------------------------------- |
| `MONGO_URI`    | ✅       | MongoDB connection string        |
| `GROQ_API_KEY` | ✅       | Groq API key for LLaMA inference |
| `PORT`         | ❌       | Defaults to `9090`               |

---

## API Reference

### Public Endpoints

#### `POST /api/testimonials`

Submit a new testimonial.

**Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "company": "Acme Inc",
  "text": "Fantastic product, changed how we work.",
  "rating": 5
}
```

**Responses:**

- `201` — submitted, pending review
- `400` — validation errors
- `409` — duplicate fingerprint (same email + similar text)

---

#### `GET /api/testimonials/approved`

Paginated approved testimonials for the public wall.

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 12 | Per page |
| `sortBy` | `createdAt` | `createdAt` or `rating` |
| `sortOrder` | `desc` | `asc` or `desc` |

Email, fingerprint, reviewNote, sentimentScore are excluded from response.

---

### Dashboard Endpoints

#### `GET /api/testimonials`

All testimonials with optional status filter and pagination.

**Query params:** `page`, `limit`, `status` (`pending` | `approved` | `rejected`)

---

#### `GET /api/testimonials/stats`

Aggregate counts + average rating.

```json
{
  "total": 42,
  "pending": 5,
  "approved": 35,
  "rejected": 2,
  "averageRating": 4.6
}
```

---

#### `PATCH /api/testimonials/:id/status`

Update status of a testimonial.

**Body:**

```json
{ "status": "approved", "reviewNote": "Great testimonial" }
```

Accepts: `approved` | `rejected` | `pending` (pending = undo).

---

#### `DELETE /api/testimonials/:id`

Permanently delete a testimonial.

---

#### `GET /api/widget`

Embeddable widget endpoint — returns approved testimonials formatted for the public JS widget (`/public/widget.js`).

---

## Data Model — `Testimonial`

```js
{
  name:          String,   // required
  email:         String,   // required, stored lowercase
  company:       String,   // optional
  text:          String,   // required, 10–1000 chars
  rating:        Number,   // 1–5
  status:        String,   // 'pending' | 'approved' | 'rejected' (default: pending)
  sentiment:     String,   // 'positive' | 'neutral' | 'negative' — from AI
  sentimentScore: Number,  // -1 to 1 — from AI
  aiTags:        [String], // from AI
  aiSummary:     String,   // ≤20 words — from AI
  fingerprint:   String,   // SHA-256 hash of email+text for duplicate detection
  reviewNote:    String,   // admin note on approve/reject
  reviewedAt:    Date,
  createdAt:     Date,
  updatedAt:     Date
}
```

---

## AI Analysis Pipeline

Every submitted testimonial is analyzed synchronously before saving:

1. **Groq API** called with `llama-3.3-70b-versatile` (free tier)
2. Prompt requests JSON: `sentiment`, `sentimentScore`, `tags[]`, `summary`
3. Response stripped of markdown fences (` ```json ``` `) before `JSON.parse`
4. **Fallback** — if Groq fails or parse errors, `analyzeSentiment` (local keyword-based) runs instead → no crash, no undefined destructure

---

## Duplicate Detection

`createFingerprint(email, text)` → SHA-256 of `email.toLowerCase() + text.trim().toLowerCase()`.

Stored on the document. On submit, `findOne({ fingerprint })` runs first. If found → `409` conflict. Prevents same person submitting identical reviews.

---

## Project Structure

```
src/
├── controllers/
│   ├── testimonialController.js   ← all business logic
│   └── widgetController.js
├── models/
│   └── Testimonial.js             ← Mongoose schema
├── routes/
│   ├── testimonials.js
│   └── widget.js
├── utils/
│   ├── geminiAnalysis.js          ← Groq/LLaMA AI analysis + fallback
│   ├── sentiment.js               ← local keyword sentiment fallback
│   ├── fingerprint.js             ← SHA-256 duplicate detection
│   └── db.js                      ← MongoDB connection
└── server.js
```

---

## Key Design Decisions

**Groq over Gemini** — Originally named `geminiAnalysis.js` but switched to Groq (OpenAI-compatible API) with `llama-3.3-70b-versatile`. Free tier, fast, reliable JSON output. Kept the filename to avoid breaking imports.

**Synchronous AI analysis on submit** — AI runs before the DB write. Simpler flow, no job queue needed at this scale. Trade-off: submit latency ~1–2s. Acceptable for a testimonial form (not a hot path).

**Local sentiment fallback** — If Groq is down or returns malformed JSON, `analyzeSentiment()` runs locally. Testimonial always saves. No user-facing error from AI failures.

**Markdown fence stripping** — Groq (and most LLMs) wrap JSON in ` ```json ``` `. Added `.replace(/```(?:json)?\n?/gi, '')` before `JSON.parse`. Fixed a silent crash.

**`pending` allowed in PATCH** — Undo button on dashboard sets status back to `pending`. Initially blocked by the validator (`approved | rejected` only). Fixed to allow all three valid statuses.

---

## What's Not Done

- Authentication / API key middleware on dashboard routes
- Rate limiting on `POST /api/testimonials`
- Async AI analysis with job queue (Bull/BullMQ)
- Email notifications on approve/reject
- Webhook support for status changes
- Full test suite (unit + integration)
