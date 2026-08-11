# Poornima's Care — Audit Log

This file tracks every finding across the 3-part audit so nothing is lost between sessions.

**Legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low/Info · ✅ Verified fixed · 🔵 Checked, no issue found

---

## PART 1 — Backend / Routes / APIs / MongoDB / Auth / Authz / Security / Middleware / Uploads / Deployment

**Status: COMPLETE.** Every route file (19), every model (26), the single middleware file, and server.js have been read in full at least once. Rescanned after every fix. Zero regressions found on any rescan.

### Findings

| # | Severity | File / Line | Issue | Root Cause | Fix | Verified |
|---|----|------|-------|------------|-----|----|
| 1 | 🔴 Critical | `backend/server.js` (static serving) | `.env`, `server.js`, every route/model source file were publicly downloadable at `/backend/*` on the live site | `express.static(path.join(__dirname, '../'))` served the entire project root, not just the frontend folder | Replaced with explicit allowlist: only `/css`, `/js`, `/pages`, and specific root files (`index.html`, `register.html`, `manifest.json`, `sw.js`, icons) are served | ✅ Tested live — `/backend/.env` now returns the login page, not file contents |
| 2 | 🟠 High | `routes/materials.js` POST `/` | Any logged-in **student** (not just admins) could store a `<script>`/`<img onerror>` payload in a material's title/description, or a `javascript:` URI in `fileUrl` — executed for every other student who viewed Study Materials | Zero sanitization on any field; frontend rendered via `innerHTML` with zero escaping, and `fileUrl` was injected raw into an `href` attribute | Added `sanitizeString()` on title/subject/description/tags; added `safeUrl()` requiring http(s) scheme on fileUrl/externalUrl; added `escHtml()` client-side escaping as defense-in-depth; added `rel="noopener noreferrer"` to the `target="_blank"` link | ✅ Syntax verified, full regression clean |
| 3 | 🟠 High | `routes/canteen.js`, `clubs.js`, `events.js`, `store.js`, `bus.js` (update routes) | Admin-tier accounts (canteen_admin, club_captain, vice_captain, store_admin, academic_admin) could inject unsanitized HTML that would execute for any student/staff viewing that content — with the JWT in localStorage, this chains to full account takeover | Raw `req.body` passed directly into `findByIdAndUpdate` with zero sanitization | Routed all 5 through the existing `sanitizeBody()` recursive sanitizer | ✅ Full regression clean |
| 4 | 🟡 Medium | `routes/auth.js`, `models/User.js` | No way for a student to recover a forgotten password | Feature never existed | Built `/forgot-password` + `/reset-password` using existing OTP/SMS infra, no schema changes. Doesn't reveal whether a userId exists (anti-enumeration). Added UI on login page. | ✅ Routes verified reachable and correctly structured (DB unreachable in this sandbox, same as every other route tested) |
| 5 | 🟡 Medium | `routes/store.js` | `stock` field on products was purely cosmetic — never checked or decremented on order, so orders could be placed past zero stock; concurrent orders for the last item could both succeed | No stock logic wired to order creation | Atomic conditional decrement (`findOneAndUpdate` with `stock: {$gte: qty}`) — the correct race-safe MongoDB pattern. Stock restored on order cancellation. | ✅ Syntax + logic verified |
| 6 | 🟢 Low | `routes/materials.js` PATCH `/:id/download` | Download-counter endpoint had no auth at all — anyone, logged in or not, could spam-inflate counts | Missing `protect` middleware | Added `protect` | ✅ Verified |
| 7 | 🔵 Checked | IDOR / ownership across all routes | — | — | Audited every route accepting a client-supplied `:id` across `complaints.js`, `lostfound.js`, `chat.js`, `materials.js`, `polls.js`, `suggestions.js`, `opportunities.js`, `medical.js`, `appointments.js`, `events.js`, `laundry.js` | No issues — every mutating route enforces role gating or explicit ownership checks |
| 8 | 🔵 Checked | OTP brute-force | `routes/auth.js` | — | 6-digit OTP, but capped at 20 attempts/15min per IP (existing `authLimiter`) against a 10-minute expiry | Not practically brute-forceable — no fix needed |
| 9 | 🔵 Checked | Account lockout | `routes/auth.js`, `models/User.js` | — | Already implemented: 5 failed attempts → 15-minute lock, via `isLocked` virtual | No fix needed |
| 10 | 🔵 Checked | CORS | `server.js` | — | Origin allowlist properly enforced, not wide open | No fix needed |
| 11 | 🔵 Checked | `.env` distribution | `.gitignore` | — | `.env` correctly excluded from git | No fix needed (separate from Finding #1, which was a runtime serving issue, not a git issue) |
| 12 | 🔵 Checked | Mass assignment on `clubs.js`/`events.js` | — | — | Role-gated *and* has explicit ownership checks (captain can only touch their own club/events) | No fix needed |
| 13 | 🟢 Info | `exam-calendar.js`, `timetable.js` | — | — | Already destructure specific fields, never touch raw `req.body` | No fix needed |
| 14 | 🟢 Info | `middleware/auth.js` | — | — | Full read — `protect` and `requireRole` both correctly implemented, safe failure modes (invalid/missing JWT_SECRET fails closed) | No fix needed |
| 15 | 🟢 Info | Client-side "flash of content" before auth redirect | `js/api.js`, per-page `requireAuth()` calls | — | Checked the mechanism (`pc-ready` opacity timing vs. synchronous redirect). Likely a non-issue in real browsers (JS redirect happens before paint) but couldn't be verified visually — no headless browser available in this environment | Not claimed as fixed or broken — flagged as unverified, low severity even in worst case (no data exposed, only UI chrome) |
| 16 | 🟢 Info | `vercel.json` | Project root | — | Contains route rewrites for a Vercel deployment that isn't used (project runs on Render) | Harmless dead config — flagged, not removed (zero risk either way, user's call) |
| 17 | 🟢 Info | API response envelope (`data`/`meta`/`requestId` wrapper) | All routes | — | Explicitly declined to implement wholesale — would require touching every route file and every page's corresponding fetch-handling JS (20+ files each) for no functional benefit today | Documented decision, not a missed finding |

### Also fixed in earlier rounds (same conversation, before this formal AUDIT.md was created)
- Campus Chat / ORION AI function-name and element-ID collision (`sendChat`/`chatInput` defined twice) — Campus Chat messages were silently being routed to a broken ORION handler
- Broken, insecure client-side call to `https://api.anthropic.com/v1/messages` with no API key — removed entirely, replaced with the already-built local-data ORION assistant (fixed 2 stale field-name bugs and a dead container-detection selector so it actually renders)
- Security headers (Permissions-Policy added alongside existing X-Frame-Options/X-Content-Type-Options/X-XSS-Protection/Referrer-Policy)
- `/health` + `/api/health` endpoints reporting live DB connection status
- Process-level `unhandledRejection`/`uncaughtException` safety net
- File upload validation (`profilePhoto`, Lost & Found `photo`) — real MIME allowlist + 2MB size cap replacing a weak `startsWith('data:image')` check; Lost & Found photos now route through Cloudinary instead of storing raw base64 in MongoDB

### Rescan confirmation (after all Part 1 fixes)
- All 26 backend files require/load with zero errors
- `server.js` boots cleanly
- All 50 inline `<script>` blocks across all 22 frontend pages pass `node --check`
- All navigation links and asset references (10 unique targets) resolve to 200 against a live server boot
- Critical static-exposure fix re-verified holding after every subsequent change

---

## PART 2 — Portals (Student, Faculty, Guard, Visitor, Laundry, Mess, Canteen, Store, Hostel, Academic Admin, Campus Admin, Student Council, Clubs, Events, Complaints, Appointments, Transport) + navigation/UI/UX/mobile/workflows

**Status: IN PROGRESS.**

### Findings so far

| # | Severity | File / Line | Issue | Root Cause | Fix | Verified |
|---|----|------|-------|------------|-----|----|
| 1 | 🟢 Low | `pages/store-admin.html` | `showView()` function defined twice | Leftover duplicate from an earlier edit — both copies were byte-for-byte identical, so no functional bug (2nd silently overwrote the 1st with the same code), but dead/redundant code | Removed the duplicate, kept one copy | ✅ Verified — 0 duplicate functions/IDs across all 22 pages now, `switchType()` body (accidentally clipped during the first fix attempt) restored and confirmed intact, brace/div counts balanced |
| 2 | 🔵 Checked | All 22 pages | Duplicate function names / element IDs (the same bug class as the earlier Campus Chat/ORION collision) | — | Scanned every page programmatically — only the store-admin.html case above found | No other duplicates anywhere |
| 3 | 🔵 Checked | Every `apiFetch()` call across all 22 pages vs. every backend route file | Endpoint path mismatches (the same bug class as the earlier `data.laundry` vs `data.record` field bug) | — | Cross-referenced every API call prefix against every registered backend route group programmatically | 0 mismatches — every endpoint called from the frontend exists on the backend |
| 4 | 🔵 Checked | Guard Portal — visitor registration + OTP verify workflow | — | — | Traced `registerVisitor()`/`verifyOtp()` against `visitors.js` field-by-field | Correctly wired, client-side validation present, no bug |
| 5 | 🔵 Checked | Faculty Portal — profile + appointment request workflow | — | — | Traced against `appointments.js` | Correctly wired, no bug |
| 6 | 🔵 Checked | Mess Admin — menu + token verification workflow | — | — | Traced against `mess.js` | Correctly wired, no bug |

### Still to check
Student, Hostel, Academic Admin, Campus Admin, Student Council, Clubs, Events, Complaints workflows in depth; Laundry/Canteen/Store admin workflows in depth; mobile responsiveness spot-check across portals; UI/UX consistency pass.

---

## PART 3 — Cross-portal integration, notifications, activity timeline, analytics, ORION, automation, performance, testing, monitoring, deployment, production readiness, future features

**Status: NOT STARTED.**
