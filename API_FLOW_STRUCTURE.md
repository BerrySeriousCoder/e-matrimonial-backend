# Ultra-Detailed E-Matrimonial API Flow & Backend Architecture Blueprint

This document is the **definitive architectural and data-flow blueprint** for the E-Matrimonial backend application. It is specifically designed to be parsed by an AI diagramming or flowchart agent to produce a 100% accurate, granular system flowchart spanning routing, middleware validation, security walls, database schemas, and asynchronous side-effects.

---

## 1. Core Component Layering & Request Lifecycle
Every incoming HTTP request traverses the following sequential layers.

### Layer 1: Global Security & Environment (Express Entry - `index.ts`)
1. **Trust Proxy Integration**: `app.set('trust proxy', 1)` — Resolves original client IPs from the Render.com load balancers (required for precise Rate Limiting).
2. **Helmet Security**: `helmetConfig` — Injects Strict Content Security Policies (CSP) enforcing `defaultSrc: 'self'` and `imgSrc: 'self', data:, https:`. Applies HSTS preloading with a 1-year max age.
3. **Request Logger**: `requestLogger` — Intercepts and logs standard output (Method, URL, Status Code, Latency in ms).
4. **Size Limiter**: `requestSizeLimiter` — Drops any incoming payload entirely if `Content-Length > 15MB`.
5. **CORS Parsing**: Evaluates Cross-Origin Resource Sharing.
6. **Body Parsers**: `express.json` & `express.urlencoded` (Explicitly limited to `10mb` per request to prevent parsing buffer overflows).

### Layer 2: Route-Specific Security (Rate Limiters)
Limits tracked by IP over a `15-minute` rolling window (unless specified):
- **General Limiter (GL)**: 300 requests/15m.
- **Auth Limiter (AL)**: 20 requests/15m. (Prevents brute-force on `/login` and `/register`).
- **OTP Limiter (OL)**: 10 requests/15m. (Prevents OTP SMS/Email spam).
- **Post Limiter (PL)**: 5 requests/1hr. (Strict limit to prevent Ad Database flooding).
- **Admin Auth Limiter**: 50 requests/15m.
- **Admin Ops Limiter**: 200 requests/15m.
- **SuperAdmin Limiter**: 500 requests/15m.

### Layer 3: Payload Validation & Sanitization Layer (`validation.ts`)
Every data-mutating request passes through two parallel systems:
1. **`sanitizeInput`**: Recursively traverses the JSON Body. Strips executable HTML/JS `<>` tags (except explicitly on `content` and `message` fields, which use `sanitizeHtml` library to allow safe rich text formatting).
2. **`validate(schema)` / `validateQuery(schema)`**: Uses `Joi` strict schemas to reject malformed data before hitting the Database. (Details per endpoint below).

---

## 2. Exhaustive Database Schema Map (Drizzle ORM via PostgreSQL)
The AI agent must map these precise columns and foreign keys when drawing the Database Cylinder/Cluster.

*   **`users`**: `id` (PK, Serial), `email` (Varchar 255, Unique), `password` (Varchar 255, Bcrypt Hash), `created_at` (Timestamp UTC).
*   **`admins`**: `id` (PK, Serial), `email` (Varchar 255, Unique), `password` (Varchar 255, Bcrypt Hash), `role` (Enum: `'superadmin', 'admin', 'data_entry'`), `created_at`.
*   **`posts` (The Ads)**: `id` (PK, Serial), `email` (Varchar 255), `content` (Text, 10-5000 chars), `userId` (FK -> users.id, Nullable), `lookingFor` (Enum: `'bride', 'groom'`), `duration` (Integer: 14|21|28), `expiresAt` (Timestamp UTC), `fontSize` (Enum: `'default', 'large'`), `bgColor` (Varchar 50, Hex code), `icon` (Varchar 50), `status` (Enum: `'pending', 'published', 'payment_pending', 'archived', 'deleted', 'expired', 'edited'`), `createdByAdminId` (FK -> admins.id, Nullable), `paymentTransactionId` (FK -> payment_transactions.id, Nullable), `baseAmount` (Integer), `finalAmount` (Integer), `couponCode` (Varchar 50).
*   **`otps`**: `id` (PK, Serial), `email` (Varchar 255), `otp` (Varchar 6), `expiresAt` (Timestamp UTC).
*   **`payment_transactions`**: `id` (PK, Serial), `postId` (FK -> posts.id), `razorpayPaymentLinkId` (Varchar 255), `razorpayPaymentId` (Varchar 255), `amount` (Integer subtotal), `finalAmount` (Integer charged), `status` (Varchar 50), `discountAmount` (Integer).
*   **`payment_configs`**: `basePriceFirst200`, `additionalPricePer20Chars`, `largeFontMultiplier`, `visibilityTimeMultipliers`, `iconPrice`. (Global Pricing Rules).
*   **`search_filter_sections` & `search_filter_options`**: Dynamic UI search tags linked 1-to-many. Uses sequential `order` INTs normalized continuously.
*   **`search_synonym_groups` & `search_synonym_words`**: Word expansion dictionaries linked 1-to-many.
*   **`admin_logs`**: Auditing trail. `adminId` (FK), `action`, `entityType`, `entityId`, `oldData` (JSONB), `newData` (JSONB).
*   **`admin_analytics` / `data_entry_stats`**: High-volume historical logging tables.

---

## 3. High-Definition Endpoint Flows

### A. The Registration & OTP Authentication Flow
*   **1. `POST /api/otp/request`**
    *   **Input**: `{ email: string }`
    *   **Logic**: Generates Math.random() 6-digit code. Maps `expiresAt` to `now + 10 mins`.
    *   **DB**: `INSERT INTO otps`.
    *   **Async Trigger**: `sendEmail({ tmplOtp })` via Resend API.
*   **2. `POST /api/user/register`**
    *   **Input**: `{ email: string, password: string (min 8), otp: string (6 digits) }`
    *   **Logic**: 
        1. Select all `otps` where `email = inputEmail`.
        2. Filters array evaluating `parseDbTimestampAsUtc(expiresAt) > now()` and `row.otp === inputOtp`.
        3. If matching: `DELETE FROM otps WHERE email = inputEmail`.
        4. Hash string payload `bcrypt.hash(password, 10)`.
    *   **DB**: `INSERT INTO users (email, password)`.
*   **3. `POST /api/user/login`**
    *   **Input**: `{ email, password }`
    *   **Logic**: `bcrypt.compare(input, hash)`. On success, generates string `jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' })`. 返回 Token.

### B. The Advertisement (Post) Creation & Retrieval Flow
*   **1. `GET /api/posts` (Search & Feed)**
    *   **Input**: URL Query values: `page`, `limit`, `lookingFor`, `search` (text), `filters` (array stringified).
    *   **Drizzle ORM Logic Pipeline**:
        1. Extract `search` array `[term1, term2]`.
        2. Trigger Dictionary Map: Select mapped words from `searchSynonymWords` where word matches term array. Compile an `expandedTerms` array encompassing all synonyms.
        3. Build SQL: `status = 'published' AND expiresAt > NOW() AND lookingFor = input`.
        4. Expand SQL: `AND (content ILIKE '%synonym1%' OR email ILIKE '%synonym1%')`.
        5. Map `filters` array to `search_filter_options` to aggregate tag-based AND/OR clusters.
    *   **Response**: Paginated Posts Array.
*   **2. `POST /api/posts` (Anonymous Submit)**
    *   **Input Payload schema**: `email` (valid email), `content` (10-5000 chars of HTML), `otp` (6 digits), `lookingFor` ('bride'/'groom'), `duration` (14/21/28), `fontSize` (default/large), `bgColor` (Only 5 specific hex codes allowed), `icon` (Only 6 specific strings allowed).
    *   **Logic**: 
        1. Queries and validates OTP matching. Deletes OTP. 
        2. `INSERT` post with state `status = 'pending'`. *Note: expiresAt remains NULL until authorized.*
        3. Trigger `trackAnalytics('ad_submission')`.
        4. Trigger `sendEmail({ tmplClientSubmitted })`.
*   **3. `POST /api/email/send` (P2P Messaging on a Post)**
    *   **Middleware Wrapper**: `multer` memory storage intercepts `multipart/form-data`. Limits files to `15MB`. Restricts mimetypes to Images (JPEG, PNG, WEBP).
    *   **Logic**:
        1. Base64 encodes uploaded images into buffers.
        2. Pings external Image Moderation API (`moderateImage`). Rejects if Adult/Violence detected.
        3. Validates Sender Auth (`sessionToken` or `otp`).
        4. Validates Frequency (Prevents user A from spamming user B).
        5. Queries `posts` by ID to retrieve destination email.
        6. Calls `sendEmail({ tmplNewMessageToPoster })` packaging the Base64 Buffers as attachments to Resend API.
        7. `INSERT INTO post_emails (sender, postId)`. Update counts.

### C. The Admin Moderation & Financial Flow
*   **1. `POST /api/admin/login`**
    *   Issues a JWT containing explicit `{ role: 'admin' | 'superadmin' | 'data_entry' }`. This role dictates middleware gateway access.
*   **2. `PUT /api/admin/posts/:id/status` (The Central Hub)**
    *   **Input**: `{ status: 'published' | 'payment_pending' | 'archived' | 'deleted', reason: string, freeAd: boolean }`
    *   **Role Gateway**: Requires `admin` or above.
    *   **Branch 1 -> Approved directly (`published` limit with `freeAd=true`)**:
        - Compute `expiresAt` = `now() + duration`.
        - `UPDATE posts SET status = 'published', expiresAt = computed, baseAmount = 0`.
    *   **Branch 2 -> Approved for Payment (`payment_pending`)**:
        1. Trigger Pricing mathematical engine (`calculatePaymentAmount()`). Checks letter count arrays against `paymentConfigs` global variables. Evaluates `couponCodes` percentage discounts.
        2. Output yields `finalAmount`.
        3. Trigger side-effect HTTP POST to **Razorpay Payment Gateway API** -> Generates live URL link (`paymentLink.short_url`).
        4. `UPDATE posts SET status = 'payment_pending', baseAmount = raw, finalAmount = net`.
        5. Email user: `tmplPaymentRequired({ paymentLink })`.
    *   **Branch 3 -> Rejection (`archived` | `deleted`)**:
        - `UPDATE posts SET status = inputStatus`.
        - Email user: `tmplPostArchived({ reason })`.
    *   **Audit Step**: In all branches, serializes the old row data and new row data -> `INSERT INTO admin_logs`.

### D. The Razorpay Webhook Callback Pipeline (`/api/webhook/razorpay`)
*   **Middleware**: Bypasses `express.json` entirely. Uses `express.raw` to securely capture exact Buffer bytes.
*   **Verification Sandbox**:
    1. Extracts HTTP Header `x-razorpay-signature`.
    2. Hashes incoming Buffer byte block via `crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).digest('hex')`.
    3. Rejects unconditionally 401 if Match !== True.
*   **Data Unpacking & Execution**:
    1. Reads JSON parameter `event` (e.g. `payment_link.paid`).
    2. Identifies nested Entity `payment_link.reference_id` which acts as the explicit pointer to `posts.id` (Format: `post_121`).
    3. Computes `amountInRupees = payment.amount / 100` (Razorpay sends paise).
    4. Database Mutations (Transaction Block via code sequence):
       - `INSERT INTO payment_transactions` -> maps Razerpay IDs.
       - `UPDATE posts SET status = 'published', paymentTransactionId = ^, expiresAt = now + duration`.
       - `UPDATE couponCodes SET usedCount = usedCount + 1`.
    5. Side-Effect Deployment:
       - Calls Google/Admin Analytics `trackEvent('payment_success')`.
       - Dispatches Success Email to customer (`tmplPublished`).

---

## 4. Draw Instructions For Visual AI Diagrammers
To render this document perfectly:

1. **Partitioning**: Divide your canvas into heavily delimited swimlanes: **Client Web Application**, **Express Gateway (Middlewares)**, **Express Router Contollers**, **Drizzle Database Operations**, and **External API Boundaries (Resend/Razorpay/Moderation)**.
2. **Gateway**: Show all traffic narrowing into a single funnel labeled `index.ts Pipeline` showing `Helmet -> Size Limit -> Cors -> JSON Parser`.
3. **Forks (The Logic Routers)**: Draw distinct routing graphs for `Public Auth (/api/otp)`, `Post Fetching (/api/posts)`, `Payment Execution (/api/payment, /api/webhook)`.
4. **The Webhook Verification**: Ensure you explicitly draw the HMAC Crypto logic block inside the webhook flow checking against `.env` variables before allowing Db access.
5. **Database Interconnectivity**: Rather than drawing a single Database box, draw multiple distinct tables to showcase relations. For example, when Admin logs in, point specifically to `SELECT admins`. When they edit, point specifically to `UPDATE posts` and concurrently `INSERT admin_logs`.
6. **Side Effects Queue**: Depict `sendEmail()` and `trackAnalytics()` as distinct parallel asynchronous actions occurring outside the main sequential synchronous flow returning HTTP JSON to the user.
