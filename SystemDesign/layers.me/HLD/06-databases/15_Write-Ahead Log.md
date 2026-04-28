# T15 — Write-Ahead Log (WAL)

---

## 1. ELI5

Imagine you're an accountant. Before changing any number on the spreadsheet, you first write in a separate notebook: "I am about to change cell B4 from 500 to 750." THEN you change the spreadsheet.

If the power cuts out mid-change:
- Your spreadsheet might be half-updated (corrupted)
- But your notebook has the full intended change
- When power comes back, you check the notebook: "Oh, I was in the middle of changing B4 → finish it"

That notebook is the **Write-Ahead Log**. The rule: **always write to the log BEFORE touching the actual data**.

The "write-ahead" in Write-Ahead Log means: the log is written AHEAD (before) of the actual data modification.

---

## 2. Analogy

**An airplane's black box + captain's log:**

Every action taken in the cockpit is recorded in the black box (WAL) BEFORE or AS the action occurs. If the plane crashes (system failure), investigators use the black box to reconstruct exactly what happened and what state the plane was in.

The plane's actual systems (flight computer RAM) might be corrupted in a crash, but the black box survives. Similarly, a database's in-memory data pages might be lost on crash, but the WAL on disk survives. Recovery = replay the WAL from the last known good checkpoint.

---

## 3. Core Concept

### Why WAL is Necessary

```
Without WAL — the durability problem:

  COMMIT transaction: "Transfer $100 from Alice to Bob"
  
  Step 1: Read Alice's page into RAM buffer
  Step 2: Deduct $100 from Alice in RAM
  Step 3: Read Bob's page into RAM buffer
  Step 4: Add $100 to Bob in RAM
  Step 5: Write Alice's page to disk ← CRASH HERE
  
  Result after crash:
    Disk: Alice lost $100
    Disk: Bob never received $100
    Money disappeared → DATA CORRUPTION
    
With WAL:
  BEFORE touching data pages, write to WAL:
  WAL record: {LSN: 9001, txn_id: 42, op: DEBIT,  account: Alice, delta: -100}
  WAL record: {LSN: 9002, txn_id: 42, op: CREDIT, account: Bob,   delta: +100}
  WAL record: {LSN: 9003, txn_id: 42, op: COMMIT}
  fsync WAL → now it's durable ← ACK to client
  
  Then (async): write data pages to disk
  
  If crash between WAL fsync and data page write:
    Recovery reads WAL → sees COMMIT at LSN 9003 → redo ops 9001+9002 → data pages updated
    Money safe.
```

### WAL Record Structure

```
WAL record (PostgreSQL format):
┌─────────────────────────────────────────────────────────────────┐
│ xl_lsn:       Log Sequence Number (8 bytes, monotonic)         │
│ xl_xid:       Transaction ID (4 bytes)                         │
│ xl_prev:      Pointer to previous WAL record (navigation)      │
│ xl_info:      Operation type (INSERT/UPDATE/DELETE/COMMIT/ABORT)│
│ xl_rmid:      Resource manager ID (heap, btree, xlog, etc.)    │
│ xl_crc:       CRC32 checksum (detect partial writes/corruption) │
│ data:         The actual change (before/after values)          │
└─────────────────────────────────────────────────────────────────┘

LSN (Log Sequence Number):
  Monotonically increasing 64-bit integer
  Uniquely identifies every WAL record
  Used for: replica sync (send WAL from LSN X), PITR, recovery point
```

---

## 4. Write Path in Detail

```
Transaction flow (PostgreSQL):

  ┌──────────────────────────────────────────────────────────────────────┐
  │ Application calls COMMIT                                             │
  │                                                                      │
  │ Step 1: WAL writer generates WAL records for all changes in txn      │
  │         Appends to WAL buffer (in shared memory, circular buffer)   │
  │                                                                      │
  │ Step 2: Modifies in-memory buffer pool (dirty pages in RAM)          │
  │         Data pages NOT yet on disk                                  │
  │                                                                      │
  │ Step 3: On COMMIT: flushes WAL buffer to WAL files                  │
  │         Calls fsync() on WAL file segment                           │
  │         ← this is the ONLY required disk write for durability       │
  │                                                                      │
  │ Step 4: Returns SUCCESS to application                               │
  │                                                                      │
  │ Step 5 (async, background):                                          │
  │         Checkpoint process writes dirty data pages to disk           │
  │         These writes are non-blocking to transactions                │
  └──────────────────────────────────────────────────────────────────────┘

Key insight: only 1 sequential disk write (WAL) needed per commit
             sequential I/O is 10-100× faster than random I/O (data pages)
             
WAL file: sequential append-only → excellent for disk I/O patterns
Data pages: random I/O → deferred to checkpoint → amortized
```

### The WAL Invariant

```
Rule: A data page must NEVER be written to disk before its WAL records are flushed.

If violated:
  Data page on disk shows: Bob has $600 (post-credit)
  WAL not yet flushed: WAL buffer in RAM
  Crash: WAL lost → recovery has no record of this change → can't undo corrupt state
  
PostgreSQL enforces this with:
  BufferPage.lsn: each data page header stores the LSN of the last WAL record that modified it
  Checkpoint code: when writing a page, checks page.lsn <= flushed_WAL_lsn
  If not: flushes WAL first, then writes page
```

---

## 5. Crash Recovery — ARIES Algorithm

```
ARIES (Algorithm for Recovery and Isolation Exploiting Semantics):
Standard recovery algorithm used in PostgreSQL, MySQL InnoDB, SQL Server

Three phases:

Phase 1 — ANALYSIS (start from last checkpoint → end of WAL):
  Reconstruct the transaction table (which txns were active at crash)
  Identify: committed txns that need redo; in-progress txns that need undo
  
Phase 2 — REDO (replay committed operations forward):
  Start from earliest LSN of any dirty page in checkpoint
  Replay ALL WAL records (even already-on-disk pages — idempotent)
  Result: database as it was at crash moment + all committed work
  "Repeat history" principle: redo even non-needed records for simplicity
  
Phase 3 — UNDO (rollback uncommitted transactions):
  For every transaction that was in-progress at crash time:
  Apply compensating log records (CLRs) in reverse WAL order
  Ensures atomicity: partial transactions become fully aborted
  
Recovery time: depends on WAL size between last checkpoint and crash
  PostgreSQL checkpoint_completion_target, checkpoint_timeout control this
  Default: checkpoint every 5 minutes → recovery < 5 min of WAL replay
```

---

## 6. Checkpointing

```
Problem: WAL grows forever; data pages are only in RAM until checkpoint

Checkpoint = flush all dirty pages from buffer pool to disk + note WAL position

┌─────────────────────────────────────────────────────────┐
│    WAL file timeline:                                    │
│                                                         │
│  [===old WAL===][===checkpoint===][===new WAL===]       │
│       ↑              ↑                                  │
│  can truncate    checkpoint LSN                         │
│  (data already                                          │
│   on disk)                                              │
│                                                         │
│  During recovery: start from checkpoint, not WAL start  │
│  → faster recovery (less to replay)                     │
└─────────────────────────────────────────────────────────┘

PostgreSQL checkpoint triggers:
  Time-based:  checkpoint_timeout = 5 minutes (default)
  WAL-size:    max_wal_size = 1GB; if WAL grows beyond → force checkpoint
  
Checkpoint I/O cost:
  Writing all dirty pages = lots of random I/O
  checkpoint_completion_target = 0.9 → spread writes over 90% of interval
  → avoids I/O spike that would impact transactions
```

---

## 7. Group Commit

```
Problem: each COMMIT requires fsync = 2-10ms disk flush → limits to 100-500 commits/sec

Group commit optimization:
  First transaction to request fsync = group leader
  Database waits a few microseconds for other concurrent transactions to also finish
  All waiting transactions are committed in a SINGLE fsync
  
  Timeline:
    Txn A: COMMIT ─────────────────────────────▶ 
    Txn B: COMMIT   ───────────────────────────▶  
    Txn C: COMMIT      ────────────────────────▶  
    Txn D: COMMIT         ─────────────────────▶  
                                                │── single fsync ──► ACK all
    
  Result: 1 fsync for N transactions
  Throughput: 50,000-100,000 commits/sec (vs ~500 without group commit)
  
PostgreSQL: commit_delay / commit_siblings parameters control wait window
MySQL InnoDB: binlog_group_commit_sync_delay controls grouping window
```

---

## 8. WAL for Replication & PITR

```
WAL is also the mechanism for replication:

  Primary:
    WAL stream → Replica 1 (WAL receiver process)
              → Replica 2
    Replica replays WAL records = exact copy of primary
    
  Streaming replication = continuous WAL shipping
  Log shipping = periodic WAL file copy (older, batch approach)

Point-in-Time Recovery (PITR):
  Archive all WAL segments to S3 (every 60 seconds or on segment fill)
  
  Restore process:
    1. Restore base backup (last full pg_basebackup)
    2. Apply archived WAL segments up to target timestamp
    3. Stop at: "STOP BEFORE 2024-03-15 14:23:45" (just before the accidental DROP TABLE)
    
  RTO: depends on number of WAL segments to replay
       Large DB: hours; can use standby + WAL to reduce to minutes
  
  WAL segment size: 16MB default in PostgreSQL (pg_wal/ directory)
  Segment naming: 000000010000000000000042 (timeline + segment number)
```

---

## 9. MySQL InnoDB: redo log vs undo log

```
InnoDB has two log types that together implement WAL:

Redo log (WAL equivalent):
  - Write-ahead log for crash recovery and durability
  - Physical changes: "page X, offset Y, old value A → new value B"
  - innodb_flush_log_at_trx_commit setting:
      1 = fsync on every commit (default, fully durable, slowest)
      2 = write to OS cache on commit; fsync every second (OS crash → 1s data loss)
      0 = write to InnoDB buffer on commit; flush every second (crash → 1s data loss)
  
  Performance impact of commit_flush setting:
    Setting 1:  ~500 commits/sec on single disk; ~50K with SSD + group commit
    Setting 2:  ~10K commits/sec
    Setting 0:  ~50K commits/sec (but risky)

Undo log (rollback + MVCC):
  - Stores OLD values for uncommitted changes
  - Enables ROLLBACK: apply undo records in reverse
  - Enables MVCC read consistency: old readers see old values via undo chain
  - Different from redo log; stored in rollback segment (tablespace, not WAL file)
```

---

## 10. MERN Dev Notes

### Observing WAL in PostgreSQL

```javascript
// In a Node.js server health check or admin endpoint:
// Query WAL stats to monitor write activity and replication lag

const { rows } = await pool.query(`
  SELECT
    pg_current_wal_lsn() AS current_lsn,
    pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file,
    pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') AS bytes_written
`);
// Monitor WAL generation rate → spikes → heavy write load

// Check replay lag on replica:
const { rows: replication } = await pool.query(`
  SELECT
    application_name,
    write_lag,
    flush_lag, 
    replay_lag
  FROM pg_stat_replication
`);

// WAL-based PITR in production Node.js service:
// Ensure transactional operations use explicit transactions
// so WAL records form atomic units:
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(
    'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
    [100, aliceId]
  );
  await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
    [100, bobId]
  );
  await client.query('COMMIT');
  // WAL: single atomic unit for both UPDATEs + COMMIT
  // Recovery: either both applied or neither
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

---

## 11. Real-World Case Studies

### PostgreSQL — Group Commit + WAL Tuning

```
Standard PostgreSQL on NVMe SSD:
  Default (no tuning): ~2,000-5,000 commits/sec
  
  Tuning for high throughput:
    commit_delay = 100-200 microseconds (wait for group commit window)
    commit_siblings = 5 (only group-commit if ≥5 concurrent transactions)
    synchronous_commit = on (never turn off for financial data)
    wal_buffers = 64MB (default 4MB → increase for write-heavy workloads)
    checkpoint_completion_target = 0.9 (smooth I/O over checkpoint interval)
    
  Result: 50,000-100,000 commits/sec on same hardware
  
WAL segment management:
  wal_keep_size = 512MB (keep recent WAL for replica catch-up)
  archive_mode = on (archive all WAL to S3 for PITR)
  archive_command = 'aws s3 cp %p s3://my-bucket/wal/%f'
```

### Netflix — Distributed WAL for Event Streaming

```
Netflix's distributed systems use a WAL-like pattern at scale:

  Kafka as distributed WAL:
    Each Kafka partition is a WAL (append-only, sequential, indexed by offset)
    Consumers replay from any offset → same as WAL replay for recovery
    Replication: Kafka leader replicates to followers via WAL stream
    
  Netflix's Delta service (CDC — Change Data Capture):
    PostgreSQL WAL → Debezium (WAL reader) → Kafka topic
    Every DB change becomes an event in Kafka
    Downstream services (Elasticsearch, cache, analytics) subscribe
    → Eventually consistent view of DB in all downstream systems
    
  WAL retention policy:
    PostgreSQL WAL archived to S3 every 60 seconds
    30-day PITR window maintained on S3
    Used for: compliance audit, incident investigation, accidental schema migration rollback
    
  Recovery drill: quarterly PITR test (restore to target timestamp in staging)
```

### Stripe — WAL Archive for 30-Day PITR

```
Stripe's payment database SLA:
  ● RPO: < 1 minute (WAL archive every 60 seconds to S3)
  ● RTO: < 4 hours for full restore (base backup + WAL replay)
  
  Why 60-second WAL archive:
    Base backup (pg_basebackup): full copy, taken daily = 50-200GB
    WAL archived every 60s to S3 (each segment ~16MB)
    PITR to any 60-second window within 30 days
    
  Incident playbook:
    "DBA ran UPDATE without WHERE accidentally at 14:23:45"
    PITR target: 14:23:44 (1 second before the mistake)
    Restore: base backup from yesterday + WAL segments up to 14:23:44
    Total data loss: 0 (the bad UPDATE is not applied at target time)
    RTO: ~3.5 hours (replay WAL from base backup to target)
    
  Cost: WAL archival to S3 ≈ 30 days × 16MB/segment × segments/day ≈ ~50GB/month
        Negligible vs cost of data loss
```

---

## 12. Interview Cheat Sheet

**Q: What is a Write-Ahead Log and why is it important?**
> WAL is an append-only file where all database changes are recorded BEFORE the actual data pages are modified. The guarantee: if the database crashes, WAL can be replayed to bring data pages to a consistent state. It enables: (1) Durability — only one sequential fsync per commit needed; (2) Atomicity — uncommitted transactions can be rolled back from undo log; (3) Replication — replicas stream and replay WAL; (4) PITR — archive WAL to S3, replay to any point in time.

**Q: What is the WAL invariant?**
> A data page must never be written to disk before its WAL records have been flushed. Violating this means: if the system crashes after the data page write but before the WAL write, recovery has no record of the change — the data is corrupted with no way to undo or redo. PostgreSQL enforces this by comparing each page's stored LSN against the current flushed WAL LSN before writing.

**Q: What is group commit and why does it matter?**
> Without group commit, each COMMIT requires an fsync (~2-10ms on spinning disk, ~0.1ms on NVMe) → throughput limited to 100-10,000 commits/sec. Group commit batches concurrent transaction commits into a single fsync. The first committer waits microseconds for concurrent transactions; all commit in one fsync. Typical result: 50,000-100,000 commits/sec. PostgreSQL uses commit_delay/commit_siblings; MySQL uses binlog_group_commit_sync_delay.

**Q: How does WAL enable Point-in-Time Recovery?**
> Archive all WAL segments (16MB files) to durable storage (S3) as they are written. For recovery: restore the latest base backup (full copy), then replay archived WAL segments up to the target timestamp. This lets you recover to any second in your retention window. Stripe, for example, maintains 30-day PITR with WAL archived every 60 seconds.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **WAL** | Write-Ahead Log — log written before data pages |
| **Write-Ahead** | Log must be persisted before the corresponding data page |
| **LSN** | Log Sequence Number — monotonic ID for each WAL record |
| **Dirty Page** | In-memory buffer pool page modified but not yet written to disk |
| **Checkpoint** | Flush all dirty pages to disk; record safe WAL restart point |
| **fsync** | OS call to force data to persistent storage (bypasses OS cache) |
| **Group Commit** | Batch multiple COMMITs into single fsync for throughput |
| **ARIES** | Standard crash recovery algorithm (analysis → redo → undo) |
| **PITR** | Point-In-Time Recovery — restore to any specific past timestamp |
| **WAL Shipping** | Copying WAL segments to replicas or S3 (batch, older method) |
| **Streaming Replication** | Continuous WAL stream to replica (real-time, modern) |
| **Redo Log** | MySQL InnoDB WAL for crash recovery |
| **Undo Log** | Stores old values for rollback and MVCC read consistency |
| **CLR** | Compensation Log Record — WAL record written during UNDO phase |
| **RPO** | Recovery Point Objective — max data loss window |
| **RTO** | Recovery Time Objective — max time to restore service |
| **CDC** | Change Data Capture — stream DB changes via WAL to downstream systems |
| **Debezium** | Open-source CDC tool that reads PostgreSQL/MySQL WAL |
| **WAL Segment** | Fixed-size WAL file (default 16MB in PostgreSQL) |
