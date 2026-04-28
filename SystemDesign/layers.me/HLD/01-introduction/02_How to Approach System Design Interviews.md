# How to Approach System Design Interviews

> **Source:** https://layrs.me/course/hld/01-introduction/how-to-approach-system-design
> **Level:** Beginner | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Step | Time | What You Do |
|---|---|---|
| **1. Requirements** | 5–8 min | Ask clarifying questions — functional + non-functional |
| **2. Capacity Estimation** | 3–5 min | Calculate QPS, storage, bandwidth |
| **3. API Design** | 3–5 min | Define REST/RPC endpoints |
| **4. High-Level Design** | 10–15 min | Draw the big boxes (LB, servers, DB, cache) |
| **5. Deep Dive** | 15–20 min | Interviewer picks a component to explore |
| **6. Bottlenecks** | 5–8 min | Identify failure points, discuss trade-offs |

> **Key Insight:** The *approach* matters more than the final design. Interviewers want to see **how you think**, not what you've memorized.

---

## The Analogy — Dinner Party Planning

- You can't start cooking without asking: How many guests? Dietary restrictions? Formal or casual? Budget?
- Once you know requirements → sketch a menu (high-level design) → estimate groceries (capacity) → dive into the hard dish
- **Goal isn't a perfect meal plan — it's showing you know how to ask the right questions and adapt**

---

## Flowchart 1 — The 6-Step Framework

```
Interview Begins
      ↓
Step 1: Requirements (5–8 min)
  → Clarify functional & non-functional requirements
  → What the system does vs. how well it performs
      ↓
Step 2: Capacity Estimation (3–5 min)
  → Calculate QPS, storage, bandwidth
  → "100M DAU × 10 req/day = ~12K QPS avg, ~50K QPS peak"
      ↓
Step 3: API Design (3–5 min)
  → Define REST/RPC endpoints
  → What's the contract between components?
      ↓
Step 4: High-Level Design (10–15 min)
  → Draw: Client → LB → App Servers → DB + Cache
  → Each box maps to a requirement
      ↓
Step 5: Deep Dive (15–20 min)
  → Interviewer-driven: DB schema? Caching strategy? Consistency model?
  → Ask them: "Which component would you like me to go deeper on?"
      ↓
Step 6: Bottlenecks & Trade-offs (5–8 min)
  → Identify failure points
  → Discuss how to address them
      ↓
Interview Ends
```

---

## Flowchart 2 — Requirements Gathering (URL Shortener Example)

```
Problem: "Design a URL Shortener"
      ↓
Clarifying Questions →
      ↓
┌─────────────────────────────────┬──────────────────────────────────────┐
│ Functional (what it does)       │ Non-Functional (how well it performs) │
├─────────────────────────────────┼──────────────────────────────────────┤
│ ✅ Generate short URLs          │ Scale: 100M daily active users        │
│ ✅ Redirect to original URL     │ Availability: 99.9% uptime            │
│ ✅ Custom aliases (optional)    │ Latency: <100ms redirect              │
│ ✅ Analytics tracking           │ Read:Write ratio = 100:1              │
│ ❌ URL editing (out of scope)   │ Data retention: 5 years               │
└─────────────────────────────────┴──────────────────────────────────────┘
      ↓
These drive ALL architecture decisions
```

---

## Flowchart 3 — Interview Conversation Flow

```
Candidate                          Interviewer
────────                           ───────────
"What's the expected scale?"   ←→  "100M DAU, 10 req/user"
"Read-heavy or write-heavy?"   ←→  "100:1 read/write"
"Any latency requirements?"    ←→  "<100ms for reads"

"Here's my high-level design..."
    [draws architecture diagram]   ←→  "How would you handle cache invalidation?"

"We could use TTL or event-driven
  invalidation..."                 ←→  "Why Cassandra over PostgreSQL?"

"Given read-heavy + horizontal
  scaling needs..."                ←→  "What about strong consistency for billing?"

"Hybrid: Cassandra for timelines,
  PostgreSQL for transactions"     ←→  ✅ Strong signal
```

---

## Flowchart 4 — Common Pitfalls & Recoveries

```
START: Interview Begins
      ↓
Did you ask clarifying questions?
  → NO  → ❌ PITFALL: Jumping to solutions
           🔧 RECOVERY: "Let me step back and clarify requirements first"
  → YES ↓
Did you quantify scale with numbers?
  → NO  → ❌ PITFALL: Vague hand-waving
           🔧 RECOVERY: "With 100M users at 10 req/sec = 12K QPS..."
  → YES ↓
Is your design overly complex?
  → YES → ❌ PITFALL: Over-engineering
           🔧 RECOVERY: "Let me start simpler and add complexity as needed"
  → NO  ↓
Are you discussing trade-offs?
  → NO  → ❌ PITFALL: No trade-off discussion
           🔧 RECOVERY: "SQL gives ACID but NoSQL scales better. Given our needs..."
  → YES ↓
Are you checking with interviewer?
  → NO  → ❌ PITFALL: Ignoring the interviewer
           🔧 RECOVERY: "Does this approach make sense? Should I explore alternatives?"
  → YES ↓
✅ Strong Interview Performance
```

---

## Core Principles

| Principle | ELI5 | Bad Example | Good Example |
|---|---|---|---|
| **Clarify Before Designing** | Never cook without knowing how many guests | "It's probably read-heavy" (assumed) | "Should we optimize for read or write performance?" |
| **Think in Numbers** | "Lots of traffic" means nothing — give a number | "We need caching for performance" | "50K QPS will overwhelm a single DB, so we need caching" |
| **Design Top-Down, Explain Bottom-Up** | Start with the map, zoom in when asked | Leading with DB schema at minute 2 | Show client→LB→App→DB first; go deep only when asked |
| **Trade-offs Over Perfection** | There's no perfect solution, only context-dependent choices | "We'll use microservices" (no reason) | "SQL gives ACID but NoSQL gives horizontal scale; given our needs, I'd choose Cassandra" |
| **Drive the Conversation** | Treat it as a design session with a colleague | Monologue for 45 minutes | "Does this make sense so far? Which component should I explore?" |

---

## Deep Dive — Interview Format Variants

| Format | Time | What to Expect |
|---|---|---|
| **Startup / Mid-size** | 45 min | Aggressive time mgmt — max 5 min requirements, 3 min capacity, one deep dive |
| **FAANG Standard** | 60 min | More exploration, multiple deep dives, more trade-off time |
| **Amazon Bar Raiser** | Behavioral hybrid | Mix design + leadership principles, tie decisions to past experiences |
| **Domain-specific** (ML at Netflix, Payments at Stripe) | 60 min | Expect specialized knowledge beyond general patterns |

**Level expectations:**
- **Mid-level (E4/L4):** Follow framework with guidance, reasonable HLD, go deep on 1–2 components
- **Senior (E5/L5):** Drive independently, identify bottlenecks proactively, cover failure modes
- **Staff+ (E6+):** Architectural vision, long-term trade-offs, org impact, build vs buy, cost at scale

---

## Common Pitfalls Reference

| Pitfall | Why It Happens | How to Avoid |
|---|---|---|
| **Jumping to solutions** | Pressure to look smart immediately | Spend first 5–8 min on questions only |
| **Over-engineering** | Want to show off advanced knowledge | Start simplest design that meets requirements; justify every complexity |
| **Ignoring the interviewer** | Treating it as a solo presentation | Pause every 2–3 min: "Does this make sense?" |
| **Vague hand-waving** | Don't know the details | Be honest + show thinking: "I'd partition by user ID to distribute load..." |
| **No trade-off discussion** | Memorized solutions, not understood | For every decision: "We could use X for A, but Y gives us B because..." |

---

## Real-World Examples

### Facebook News Feed
- **Scale estimate:** 2B users × 100 posts/session × 10 sessions/day = 2 trillion reads/day (~23M QPS)
- **Design decision:** Push (fanout-on-write) for active users for fast reads; Pull (fanout-on-read) for inactive users and celebrities to save storage
- **Deep dive topic:** Hot key problem (celebrity accounts), push/pull hybrid trade-off

### Uber Ride Matching
- **Constraint:** Sub-second matching; 10M riders + 1M drivers; 250K location updates/sec
- **Design decision:** Geohashing or Quadtree to partition world into regions
  - Geohash: simpler, but boundary issues
  - Quadtree: adapts to density, more complex
- **Consistency note:** Eventual consistency OK for location; NOT OK for ride assignments

### Twitter Timeline
- **Read:Write = 100:1** → fanout-on-write makes sense for most users
- **Celebrity problem:** 100M followers = can't write 100M timelines synchronously
- **Solution:** Fanout-on-write for regular users + fanout-on-read for celebrities (hybrid)
- **Tech used:** Redis for timeline storage, Kafka for event streaming

---

## Interview Cheat Sheet

**Common Questions:**
- "Walk me through how you'd approach designing X"
- "How would you handle Y failure scenario?"
- "What happens when component Z goes down?"
- "How would you scale this to 10x the traffic?"
- "Why did you choose A over B?"
- "What are the bottlenecks in your design?"
- "How would you monitor and debug this in production?"

**Red Flags to Avoid:**
- Starting to design without any clarifying questions
- "We'll use caching" — without explaining *how* or *why*
- Unable to estimate scale or capacity
- Ignoring interviewer hints / questions
- Proposing overly complex solutions for simple problems
- Not discussing trade-offs or alternatives
- Claiming expertise in tech you don't actually understand
- Spending 30 min on requirements and never drawing architecture
- Being defensive when your design is challenged

---

## Key Takeaways

- **6 steps, always:** Requirements → Capacity → API → HLD → Deep Dive → Bottlenecks
- **Clarify first** — the questions you ask reveal as much as the design you produce
- **Use numbers** — "100M DAU × 10 req = 12K QPS" turns feelings into defensible decisions
- **State trade-offs explicitly** — "We could use X, but Y fits because of our constraints"
- **Collaborate** — pause, check in, invite guidance; treat it as a design session not a performance
