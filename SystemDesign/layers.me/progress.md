# HLD Course Progress — layrs.me

> **Course**: https://layrs.me/course/hld  
> **Total**: 149 topics across 12 modules  
> **Last updated**: auto-updated on each commit

---

## Progress Summary

| Module | Topics | Status |
|---|---|---|
| M1 — Introduction to System Design | 3 | ✅ Complete |
| M2 — Core Concepts & Trade-offs | 17 | ✅ Complete |
| M3 — Networking & DNS | 4 | 🔄 In Progress |
| M4 — Load Balancing & Scaling | 7 | ⏳ Pending |
| M5 — Application Architecture | 9 | ⏳ Pending |
| M6 — Databases | 16 | ⏳ Pending |
| M7 — Caching | 13 | ⏳ Pending |
| M8 — Asynchronous Processing | 6 | ⏳ Pending |
| M9 — Communication Protocols | 9 | ⏳ Pending |
| M10 — Performance & Monitoring | 19 | ⏳ Pending |
| M11 — Cloud Design Patterns | ? | ⏳ Pending |
| M12 — (remaining) | ? | ⏳ Pending |

**Completed**: 22 / 149 topics

---

## Module 1 — Introduction to System Design ✅

> Folder: `01-introduction/`

| # | Topic | File | Status |
|---|---|---|---|
| T01 | Introduction to System Design | `01_…` | ✅ |
| T02 | — | — | ✅ |
| T03 | — | — | ✅ |

---

## Module 2 — Core Concepts & Trade-offs ✅

> Folder: `02-core-concepts/`

| # | Topic | File | Status |
|---|---|---|---|
| T01 | Performance vs Scalability | `01_Performance vs Scalability.md` | ✅ |
| T02 | Latency vs Throughput | `02_Latency vs Throughput.md` | ✅ |
| T03 | Availability vs Consistency | `03_Availability vs Consistency in Distributed Systems.md` | ✅ |
| T04 | CAP Theorem | `04_CAP Theorem.md` | ✅ |
| T05 | Consistency Patterns | `05_Consistency Patterns.md` | ✅ |
| T06 | Weak Consistency | `06_Weak Consistency.md` | ✅ |
| T07 | Eventual Consistency | `07_Eventual Consistency.md` | ✅ |
| T08 | Strong Consistency | `08_Strong Consistency.md` | ✅ |
| T09 | Availability Patterns | `09_Availability Patterns.md` | ✅ |
| T10 | Failover | `10_Failover.md` | ✅ |
| T11 | Replication | `11_Replication.md` | ✅ |
| T12 | Availability in Numbers | `12_Availability in Numbers.md` | ✅ |
| T13 | Bloom Filters | `13_Bloom Filters.md` | ✅ |
| T14 | Consistent Hashing | `14_Consistent Hashing.md` | ✅ |
| T15 | Merkle Trees | `15_Merkle Trees.md` | ✅ |
| T16 | PACELC Theorem | `16_PACELC Theorem.md` | ✅ |
| T17 | Quorum | `17_Quorum.md` | ✅ |

---

## Module 3 — Networking & DNS 🔄

> Folder: `03-networking-dns/`  
> Source: https://layrs.me/course/hld/03-networking-dns

| # | Topic | File | Status |
|---|---|---|---|
| T01 | DNS Fundamentals | `01_DNS Fundamentals.md` | ✅ |
| T02 | CDN Overview | `02_CDN Overview.md` | ✅ |
| T03 | Push CDNs | `03_Push CDNs.md` | ⏳ |
| T04 | Pull CDNs | `04_Pull CDNs.md` | ⏳ |

---

## Module 4 — Load Balancing & Scaling ⏳

> Folder: `04-load-balancing-scaling/`  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling

| # | Topic | File | Status |
|---|---|---|---|
| T01–T07 | (to be fetched) | — | ⏳ |

---

## Module 5 — Application Architecture ⏳

> Folder: `05-application-architecture/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T09 | (to be fetched) | — | ⏳ |

---

## Module 6 — Databases ⏳

> Folder: `06-databases/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T16 | (to be fetched) | — | ⏳ |

---

## Module 7 — Caching ⏳

> Folder: `07-caching/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T13 | (to be fetched) | — | ⏳ |

---

## Module 8 — Asynchronous Processing ⏳

> Folder: `08-asynchronous-processing/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T06 | (to be fetched) | — | ⏳ |

---

## Module 9 — Communication Protocols ⏳

> Folder: `09-communication-protocols/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T09 | (to be fetched) | — | ⏳ |

---

## Module 10 — Performance & Monitoring ⏳

> Folder: `10-performance-monitoring/`

| # | Topic | File | Status |
|---|---|---|---|
| T01–T19 | (to be fetched) | — | ⏳ |

---

## Standing Notes

- **Format per file**: ELI5 → Analogy → Core Concept → ASCII diagrams → Math (if applicable) → MERN dev notes → Real-world examples → Interview cheat sheet → Keywords/Glossary
- **Cassandra mentions** → add `> **MERN dev note — why Cassandra over MongoDB?**` callout
- **MongoDB sharding** = range-based (chunk migration) ≠ consistent hash rings (Cassandra/DynamoDB)
- **All abbreviations** must have full forms either inline or in glossary
- **Commit format** (new file): `feat(layrs.me): Add M3-T## - [Topic Name]`
- **Commit format** (cross-file update): `docs(layrs.me): [description]`
- **Shell**: Windows PowerShell — use `;` not `&&`
