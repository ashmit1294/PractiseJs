# Security Monitoring

## ELI5
Security monitoring is like having security cameras at every door and motion sensors throughout a building — but smarter. Instead of just recording, the system correlates events: "Someone badged in at the front door, then tried 47 office doors in 3 minutes" → alert security.

## Analogy
A bank fraud detection system doesn't just log every transaction — it correlates them: a card used in New York at 2pm, then in London at 2:30pm = impossible. Pattern matching across events = security monitoring.

---

## Core Concept
**Security monitoring** detects security incidents in real-time by collecting security-relevant events, correlating them across services, and alerting on patterns that indicate attacks, breaches, or unauthorized access.

---

## What to Log (Never Sample)

```
ALWAYS LOG 100% of these events (unlike performance — never sample security):

Authentication:
  ✓ Successful logins (user, IP, device, location)
  ✓ Failed login attempts (user, IP, error reason)
  ✓ Password resets, MFA events, OAuth flows
  ✓ Session creation and destruction

Authorization:
  ✓ Permission checks (especially DENIED results)
  ✓ Privilege escalations (user gained admin role)
  ✓ RBAC changes (role granted/revoked)

Data Access:
  ✓ Access to sensitive data (PII, financial, health)
  ✓ Bulk data exports (>1,000 records accessed)
  ✓ Cross-tenant data access attempts

System Events:
  ✓ Configuration changes (firewall rules, IAM policies)
  ✓ Service account activity
  ✓ Infrastructure changes (new EC2 instance, new DB user)
```

---

## Detection Latency Impact

```
Detection latency math:
  Data Loss = Exfiltration Rate × Detection Latency

Scenario: Attacker exfiltrating at 1 GB/minute

  30-minute detection latency:  1 GB/min × 30 min = 30 GB lost
  30-second detection latency:  1 GB/min × 0.5 min = 0.5 GB lost

  Improvement: 60× reduction in data loss from faster detection

This is why real-time stream processing (Kafka + Flink)
beats batch processing (nightly log analysis) for security.
```

---

## Alert Fatigue Problem

```
Alert fatigue formula:
  Wasted Time = FP_Rate × Daily_Alerts × Investigation_Time

Scenario (typical poor setup):
  False positive rate: 95%
  Daily alerts: 100
  Investigation time: 15 minutes each

  Wasted Time = 0.95 × 100 × 15min = 1,425 min/day = 23.75 hours/day

This is unsustainable — analysts start ignoring all alerts.

Target thresholds:
  Critical alerts:  < 10% false positive rate
  Medium alerts:    < 20% false positive rate

Tools to improve:
  - Machine learning baselines (Uber, Stripe use this)
  - Composite rules ("failed login" AND "from new country" AND "during off-hours")
  - Context enrichment (is this IP on known attacker list?)
  - Tuning period: 2-4 weeks before going live with an alert
```

---

## Multi-Stage Attack Detection

```
Pattern: Account Takeover via Credential Stuffing

Stage 1 — Initial Access         (Auth service log)
  User "alice" failed login from IP 185.199.X.X (new country)
  Correlation ID: attack_session_abc123
  user_id: alice | ip: 185.199.X.X | result: FAIL

Stage 2 — Privilege Escalation    (RBAC service log)
  User "alice" granted admin role by "alice" (self-grant!)
  user_id: alice | actor: alice | target_role: admin

Stage 3 — Data Exfiltration       (DB service log)
  User "alice" queried 50,000 user records
  user_id: alice | query: SELECT * FROM users | rows: 50,000

CORRELATION ENGINE:
  Search for events with same user_id within 10-minute window
  Pattern: new_location + privilege_escalation + bulk_query
  → CRITICAL ALERT: Likely account takeover + data exfiltration
```

---

## Security Monitoring Architecture

```
Services (Auth, API, DB, Config)
    │
    │ structured security events (JSON + correlation_id)
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Topic:                             │
│                 "security-events"                           │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
              ▼                               ▼
  ┌───────────────────────┐      ┌──────────────────────────┐
  │   Flink / Spark       │      │  Cold Storage (S3/HDFS)  │
  │   Real-time analysis  │      │  7+ year retention       │
  │   • Pattern matching  │      │  for compliance audits   │
  │   • Correlation       │      │  (SOC2, PCI-DSS, HIPAA)  │
  │   • Anomaly detection │      └──────────────────────────┘
  └────────────┬──────────┘
               │ critical alerts (< 30 seconds)
               ▼
  PagerDuty / Slack / SIEM (Splunk, Datadog Security)
```

---

## Security Monitoring Types

```
1. AUTHENTICATION MONITORING
   Track: failed attempts, new device/location, off-hours logins
   Alert on: >10 failures in 5 min (brute force), new country login

2. AUTHORIZATION / RBAC MONITORING
   Track: all permission checks, especially DENIED
   Alert on: privilege escalation, accessing others' resources

3. DATA ACCESS PATTERNS
   Track: row counts, export events, cross-tenant queries
   Alert on: >1,000 records, unusual time-of-day, new access pattern

4. NETWORK TRAFFIC ANALYSIS
   Tools: Zeek, Suricata, VPC Flow Logs
   Alert on: unexpected outbound connections, port scans, large transfers

5. API / RATE LIMIT ABUSE
   Track: requests per IP, requests per token, unusual endpoints
   Alert on: enumeration attacks, credential stuffing via API

6. CONFIGURATION CHANGE MONITORING
   Track: IAM changes, firewall rule changes, new admin accounts
   Alert on: any production change without change ticket

7. THREAT INTELLIGENCE
   Enrich events with: known malicious IPs, domains, file hashes
   Block before detecting: reputation-based blocking
```

---

## Compliance vs Security Monitoring

```
┌───────────────────────────────────────────────────────────────────┐
│   COMPLIANCE LOGGING        │   SECURITY MONITORING               │
├─────────────────────────────┼─────────────────────────────────────┤
│ Backward-looking             │ Forward-looking                    │
│ Who did what? (audit trail)  │ Who is doing what? (detection)     │
│ For auditors                 │ For security analysts              │
│ 7+ year retention required   │ 30-90 day hot storage              │
│ SOC 2, PCI-DSS, HIPAA        │ Real-time SIEM rules               │
│ Same events, different       │ Same events, different analysis    │
│   retention and indexing      │   and alerting rules              │
└───────────────────────────────────────────────────────────────────┘

Good news: Collect once, route to both.
Kafka fan-out: security stream → Flink (real-time) + cold storage (compliance)
```

---

## MERN Developer Notes

```javascript
// Structured security event logging in Node.js
const securityLogger = {
  logAuthEvent: (event) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: event.type,           // 'login_success' | 'login_failed'
      correlation_id: event.requestId,  // ← flows through all services
      user_id: event.userId,            // ← NOT username in logs (privacy)
      ip_address: event.ip,
      user_agent: event.userAgent,
      location: event.geoIp,
      result: event.result,
      // NEVER log: passwords, tokens, SSNs, credit cards
    };

    // Send to security stream (Kafka)
    kafkaProducer.send({
      topic: 'security-events',
      messages: [{ value: JSON.stringify(logEntry) }],
    });
  }
};

// Middleware: attach correlation ID to every request
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});
```

---

## Real-World Examples

| Company | Incident | Detection | Result |
|---|---|---|---|
| Uber | Systematic DB query attack (data exfiltration) | Real-time stream processing on query patterns | Detected and halted within minutes |
| GitHub | Account takeovers via reused passwords | Auto-prompt MFA on login from new location/device | 80% reduction in account takeover |
| Slack | Alert fatigue (too many false positives) | 3 months of threshold tuning + context enrichment | 80% FP reduction; signals became actionable |

---

## Interview Cheat Sheet

**Q: Why should security events never be sampled, unlike performance metrics?**

> A: Performance metrics are statistical — sampling 1% still gives accurate p99 latency estimates. Security events are forensic — you need complete, tamper-proof evidence of every authentication, authorization decision, and data access for two reasons: (1) Forensic reconstruction: if a breach happened 3 months ago, you need complete log evidence to determine what was accessed. (2) Pattern detection: a credential stuffing attack might show 1 failed login per 10 minutes across thousands of accounts — sampling would miss the pattern entirely.

**Q: How do you reduce alert fatigue in security monitoring?**

> A: Three approaches: (1) Composite rules — require multiple suspicious signals simultaneously ("failed login" AND "new country" AND "off-hours"), dramatically reducing false positives. (2) Context enrichment — enrich events with threat intelligence (known malicious IPs, leaked credential databases) before alerting. (3) Behavioral baselines — alert on deviation from the user's normal pattern, not absolute thresholds. Measure and target <10% FP rate for critical alerts; review/delete any alert that consistently fires without action.

**Q: What's the difference between security monitoring and compliance logging?**

> A: Compliance logging is backward-looking — creating an immutable audit trail (who did what, when) for regulatory auditors (SOC 2, PCI-DSS, HIPAA), requiring 7+ years of retention and read-only access. Security monitoring is forward-looking — real-time pattern matching to detect active attacks, requiring fast indexing and correlation rather than long-term storage. The key insight: you can collect the same events and route them to both systems via Kafka fan-out — long-term cold storage for compliance, real-time Flink/Spark for security.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **SIEM** | Security Information and Event Management — platform that aggregates, correlates, and alerts on security events |
| **Correlation ID** | Unique identifier attached to a request that flows through all services, enabling attack tracing |
| **Alert fatigue** | Security analyst exhaustion from too many false-positive alerts; leads to ignoring alerts |
| **False positive (FP)** | Alert that fires but is not an actual attack; target <10% for critical alerts |
| **Credential stuffing** | Using leaked username/password lists to try logins across services |
| **Privilege escalation** | Gaining higher permissions than originally granted — key attack indicator |
| **SOC 2** | Security audit framework requiring extensive logging of authentication and data access |
| **Threat intelligence** | External feeds of known malicious IPs, domains, file hashes used to enrich security events |
| **Behavioral baseline** | Normal activity pattern for a user/service; deviations trigger alerts |
| **Fan-out** | Sending same event stream to multiple consumers (e.g., Kafka → Flink + cold storage) |
