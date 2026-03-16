/**
 * QUESTION SET: Node.js Authentication & JWT
 *
 * 1. Password hashing with bcrypt
 * 2. JWT sign / verify
 * 3. Refresh token rotation
 * 4. Session storage with Redis
 * 5. Passport.js integration
 * 6. OAuth2 patterns
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ─────────────────────────────────────────────
// Q1. Password hashing
// WHAT: How do you securely hash passwords so they cannot be reversed even if DB is breached?
// THEORY: bcrypt with SALT_ROUNDS=12: hash=bcrypt(password+salt), compare via bcrypt.compare(). One-way function. Salting prevents rainbow tables. Slow by design
// Time: O(2^s) where s=SALT_ROUNDS  Space: O(1)
// ─────────────────────────────────────────────

const SALT_ROUNDS = 12; // higher = slower = more secure (12 is a solid default)

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

// ─────────────────────────────────────────────
// Q2. JWT access token
// WHAT: How do you create short-lived JWT tokens for stateless authentication?
// THEORY: jwt.sign(payload, secret, {expiresIn}). Verify with jwt.verify(token, secret). Short expiry (15m) reduces damage if token stolen. Payload unsigned by default.
// Time: O(1)  Space: O(1)
// ─────────────────────────────────────────────

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const ACCESS_EXPIRY = "15m"; // short-lived

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
    algorithm: "HS256",
  });
}

function verifyAccessToken(token) {
  // Throws JsonWebTokenError or TokenExpiredError
  return jwt.verify(token, ACCESS_SECRET);
}

// ─────────────────────────────────────────────
// Q3. Refresh token rotation
// WHAT: How does refresh token rotation prevent replay attacks from stolen tokens?
// THEORY: Long-lived refresh in DB with jti (unique ID). On use, revoke old + issue new. Detect reuse = revoke entire family. Prevents stolen token reuse after rotation
// Time: O(1) token ops  Space: O(n) for n revoked tokens
// ─────────────────────────────────────────────

const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const REFRESH_EXPIRY = "7d";

function signRefreshToken(userId) {
  const jti = crypto.randomBytes(32).toString("hex"); // unique token ID
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });
  return { token, jti };
}

// Express route: POST /auth/refresh
async function refreshTokenRoute(req, res) {
  const { refreshToken } = req.cookies; // stored in HTTP-only cookie
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Check token is in DB and not revoked
  const stored = await db.refreshToken.findUnique({ where: { jti: payload.jti } });
  if (!stored || stored.revoked) {
    // Possible token reuse — revoke entire family
    await db.refreshToken.updateMany({
      where: { userId: payload.sub },
      data: { revoked: true },
    });
    return res.status(401).json({ error: "Refresh token reuse detected" });
  }

  // Rotate: revoke old, issue new
  await db.refreshToken.update({ where: { jti: payload.jti }, data: { revoked: true } });

  const { token: newRefresh, jti: newJti } = signRefreshToken(payload.sub);
  await db.refreshToken.create({
    data: { jti: newJti, userId: payload.sub, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });

  const newAccess = signAccessToken({ sub: payload.sub });

  res.cookie("refreshToken", newRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ accessToken: newAccess });
}

// ─────────────────────────────────────────────
// Q4. Session-based auth with Redis
// WHAT: How do you store user sessions in Redis for distributed, scalable authentication?
// THEORY: express-session + RedisStore. Each login regenerates sessionId, stores userId in Redis. HTTP-only cookie for security. TTL auto-cleanup. Call req.session.regenerate on login
// Time: O(1) Redis ops  Space: O(s) for s sessions
// ─────────────────────────────────────────────

const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");

async function setupSession(app) {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      },
      name: "sid", // don't expose default 'connect.sid' name
    })
  );
}

// Login route
async function loginRoute(req, res) {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // Regenerate session ID after login to prevent session fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error" });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ message: "Logged in" });
  });
}

// Session auth middleware
function requireSession(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthenticated" });
  next();
}

// ─────────────────────────────────────────────
// Q5. JWT auth middleware (stateless)
// WHAT: How do you implement stateless authentication with JWT in middleware?
// THEORY: Extract Bearer token from Authorization header. Verify with jwt.verify(). Attach user to req. Catch TokenExpiredError/JsonWebTokenError. No DB lookup needed.
// Time: O(1)  Space: O(1)
// ─────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // { sub, role, iat, exp }
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: message });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Protected route example
// router.get('/admin', authenticate, authorize('ADMIN'), (req, res) => res.json({ ok: true }));

// ─────────────────────────────────────────────
// Q6. OAuth2 with Passport.js (Google)
// WHAT: How do you integrate OAuth2 social login (Google) using Passport.js?
// THEORY: Setup GoogleStrategy with clientID/secret. In callback, upsert user by googleId. Serialize userId to session. Deserialize on subsequent requests. Two-route pattern: /auth/google + /callback
// Time: O(1) serialize  Space: O(1) session
// ─────────────────────────────────────────────

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

function setupPassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Upsert user from Google profile
          const user = await db.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              avatar: profile.photos[0]?.value,
            },
            update: { name: profile.displayName },
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await db.user.findUnique({ where: { id } });
    done(null, user);
  });
}

// Routes
// app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// app.get('/auth/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login' }),
//   (req, res) => res.redirect('/dashboard')
// );

/*
  INTERVIEW QUESTIONS — THEORY

  Q: JWT vs Sessions — which is stateless?
  A: JWT is stateless (server doesn't store token state).
     Sessions are stateful (server stores session in DB/Redis).
     JWT advantage: horizontally scalable, no DB lookup per request.
     JWT disadvantage: can't revoke a token before it expires (unless using a blocklist/JTI store, which brings state back).

  Q: What attacks does httpOnly prevent?
  A: httpOnly cookies cannot be read via document.cookie, preventing XSS
     attacks from stealing tokens. Still vulnerable to CSRF — use sameSite + CSRF tokens.

  Q: What is PKCE in OAuth2?
  A: Proof Key for Code Exchange — prevents authorization code interception in public clients.
     Client generates code_verifier → SHA256 hash = code_challenge.
     Authorization server returns code, client redeems with code_verifier.
     Server verifies hash matches — proof that the same client initiated the flow.

  Q: How do you revoke a JWT?
  A: Three approaches:
     1. Short expiry (15m access tokens) — tokens naturally expire quickly
     2. JTI blocklist — store revoked JTIs in Redis; check on each request
     3. Use refresh token rotation — refresh tokens are stored/revoked in DB

  Q: What is session fixation?
  A: Attacker sets a known session ID before user logs in.
     After login, server must regenerate the session ID (req.session.regenerate).
     This is why you should always call regenerate() on successful login.

  Q: bcrypt vs Argon2 for password hashing?
  A: Both are slow hash functions designed for passwords.
     Argon2 (winner of Password Hashing Competition) is more configurable —
     can tune memory and parallelism in addition to time factor.
     Argon2id (hybrid) is the recommended modern choice.
     bcrypt is widely supported and battle-tested with cost factor >= 12.
*/

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  authenticate,
  authorize,
};
