# Pattern 05 — News Feed / Social Timeline (like Twitter / Instagram)

---

## ELI5 — What Is This?

> You follow 200 friends. Every time someone posts, you need to see it on your personal
> board sorted by newest first.
> The system can either give you a fresh copy every time you look (slow — pulls from everyone),
> or it can keep your personal board already filled in (fast — but costs more to update).
> Choosing between these two strategies is the central challenge of a news feed.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Fan-out on Write (Push model)** | When someone posts, immediately push a copy of that post to every follower's personal feed. Like stamping a letter and mailing it to every subscriber right away. Fast to read, expensive to write. |
| **Fan-out on Read (Pull model)** | Do nothing on post. When a user loads their feed, go collect posts from every person they follow and merge them. Like picking up all letters yourself. Cheap to write, slow to read. |
| **Hybrid model** | Use fan-out on write for normal users. Use fan-out on read for celebrities (too many followers to write to instantly). Best of both worlds. |
| **Celebrity threshold** | A configurable follower count (e.g. 10,000) above which a user is treated as a celebrity and their posts use the pull model. |
| **Keyset pagination (cursor)** | Instead of asking for "page 3", you ask for "posts older than post ID X". This way inserting new posts at the top never shifts the position of what you already saw. |
| **Denormalise** | Store extra copies of data in different places to make reads faster, at the cost of more storage and update work. |
| **Kafka** | A reliable conveyor belt for events — post created events land here, fan-out workers pick them up at their own pace. |
| **Cassandra** | A database that handles enormous write volumes and stores data partitioned by user ID. Used to store pre-computed feed lists. |
| **Redis Sorted Set** | A Redis data structure that keeps items sorted by score. Used to store each user's feed as a list of post IDs sorted by timestamp. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENT["Clients"]
        WEB["Web or Mobile App"]
    end

    subgraph API["API Services"]
        LB["Load Balancer"]
        POST_SVC["Post Service — create, edit, delete posts"]
        FEED_SVC["Feed Service — read a user's timeline"]
        USER_SVC["User Service — follow, unfollow, profile"]
    end

    subgraph FANOUT["Fan-out Engine — runs after every new post"]
        KAFKA["Kafka — receives post-created event"]
        FANOUT_SVC["Fan-out Coordinator — decides push vs pull strategy"]
        WORKERS["Fan-out Workers — push postId to each follower's Redis feed"]
    end

    subgraph CACHE["Cache Layer"]
        FEED_CACHE["Redis — feed per user stored as sorted list of post IDs, max 1000 entries"]
        POST_CACHE["Redis — post detail objects cached for 1 hour"]
    end

    subgraph STORAGE["Storage"]
        PG["PostgreSQL — posts, users, follow relationships"]
        CASS["Cassandra — fan-out feed_timeline rows for durable feed storage"]
        S3["S3 — images and videos attached to posts"]
    end

    WEB --> LB
    LB --> POST_SVC & FEED_SVC & USER_SVC
    POST_SVC --> KAFKA --> FANOUT_SVC --> WORKERS
    WORKERS --> FEED_CACHE & CASS
    FEED_SVC --> FEED_CACHE
    FEED_CACHE -- cache miss --> CASS
    FEED_SVC --> POST_CACHE
    POST_CACHE -- miss --> PG
```

---

## Fan-out Strategy Decision

```mermaid
flowchart TD
    A["New post created"] --> B{"Author has more than 10000 followers?"}
    B -- No normal user --> C["Fan-out on Write — push postId to each follower's Redis feed instantly"]
    B -- Yes celebrity --> D["Skip fan-out — only save post to author's own timeline"]
    C --> E["Feed read is O(1) — feed already pre-populated"]
    D --> F["Feed read must merge: fetch from all followed celebrities at read time and merge into feed"]
    E & F --> G["Return merged, sorted feed to user"]
```

---

## Feed Read Flow

```mermaid
sequenceDiagram
    actor User
    participant FEED as Feed Service
    participant Redis as Redis Feed Cache
    participant CASS as Cassandra
    participant POST_SVC as Post Service

    User->>FEED: GET /feed  cursor=null  limit=20

    FEED->>Redis: ZREVRANGE feed:userId 0 19  by score descending
    alt Redis cache populated
        Redis-->>FEED: list of 20 post IDs
        FEED->>Redis: MGET post:id1 post:id2 ...  bulk fetch details
        Redis-->>FEED: post objects, some may be missing
        FEED->>POST_SVC: fetch only the missing post details from DB
        FEED-->>User: 20 posts sorted newest first
    else Redis cache empty
        Redis-->>FEED: empty
        FEED->>CASS: SELECT postIds FROM feed_timeline WHERE userId=X ORDER BY ts DESC LIMIT 100
        CASS-->>FEED: list of post IDs
        FEED->>Redis: populate feed cache from Cassandra
        FEED->>POST_SVC: bulk fetch post details
        FEED-->>User: 20 posts sorted newest first
    end
```

---

## Post Creation + Fan-out Flow

```mermaid
sequenceDiagram
    actor Author
    participant POST as Post Service
    participant DB as PostgreSQL
    participant KAFKA as Kafka
    participant WORKER as Fan-out Worker
    participant REDIS as Follower Redis Feeds

    Author->>POST: POST /posts  body = text + image
    POST->>DB: INSERT post row
    DB-->>POST: saved
    POST-->>Author: post is live — response is instant

    Note over KAFKA,REDIS: Async fan-out runs in background, does not block the author
    POST->>KAFKA: publish post.created event
    KAFKA->>WORKER: hand off event
    WORKER->>DB: SELECT follower_ids WHERE followee = authorId
    Note over WORKER: Author has 500 followers — normal user — fan-out on write

    loop for each follower in batches of 100
        WORKER->>REDIS: ZADD feed:followerId  score=timestamp  member=postId
        WORKER->>REDIS: ZREMRANGEBYRANK feed:followerId 0 -1001  trim to 1000 items
    end
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Celebrity fan-out** | A user with 10 million followers posts once. Write service tries to update 10M Redis entries in seconds. Workers cannot keep up — follower feeds are stale for minutes. | Hybrid model: celebrities skip write fan-out. Their posts are fetched and merged at read time. |
| 2 | **Feed cache stale after delete** | A post gets deleted but it was already pushed to 10M followers' caches. Users still see it. | Use a soft-delete flag on the post. Feed service filters out deleted posts at read time. Deleted posts disappear from all feeds within seconds. |
| 3 | **Cassandra hot partition** | A very popular user generates enormous writes to the same partition key. | Composite key: `(userId, week_bucket)`. Each week a new partition is used, distributing load. |
| 4 | **Pagination drift** | User scrolls down, new posts arrive at top, next page offset shifts — duplicate or missing posts appear. | Cursor-based pagination: cursor = last seen postId. Next page = posts with timestamp less than that post's timestamp. Add new posts at top never affects your scroll position. |
| 5 | **Follow graph lookups** | Fetching all 500 follower IDs for a user requires a DB scan on every post. At high post rate this is millions of DB queries per second. | Store follower lists in Redis Sets. Lookup is O(1). Update on follow/unfollow in real time. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Fan-out Worker Crashes Mid Fan-out"]
    F2["Redis Feed Cache Is Wiped"]
    F3["Kafka Topic Partition Unavailable"]
    F4["Post Service Database Goes Down"]
    F5["Cassandra Cluster Partially Down"]

    F1 --> R1["Kafka consumer group tracks which events have been processed using offsets.
    Offsets are only committed after a batch of fan-outs is complete.
    If worker crashes, it restarts and replays from the last committed offset.
    Some followers may receive the post twice in their feed.
    Duplicate is handled: ZADD on a Redis sorted set with the same member is idempotent —
    it just updates the score, it does not create a duplicate entry."]

    F2 --> R2["Feed service falls back to reading from Cassandra.
    Cassandra reads are slower — about 5-10ms vs 1ms from Redis.
    All users see a performance degradation but the service stays up.
    Redis cache rebuilds lazily: as each user loads their feed, it is re-populated into Redis.
    No data is lost because Cassandra is the durable store."]

    F3 --> R3["Kafka producer buffers the post.created event locally and retries.
    The post is already saved to PostgreSQL and visible to the author.
    Fan-out is delayed until Kafka recovers — usually under 10 seconds.
    Followers see the new post a few seconds later than normal.
    With acks=all, no event is permanently lost."]

    F4 --> R4["New posts cannot be created — users get a 503 error.
    Existing feeds continue to work because they read from Redis and Cassandra.
    Circuit breaker opens — prevents all services from piling on to the DB.
    Read-only mode: show banner 'Posting is temporarily unavailable.'
    DB is restored from replica in the same region — typically under 5 minutes."]

    F5 --> R5["Cassandra replication factor 3 means each row exists on 3 machines.
    Quorum = 2 of 3 agree. One node down: quorum still met, zero user impact.
    Two nodes down: quorum fails. Reads return errors for affected partitions.
    Feed service falls back to Redis cache for affected users.
    Cassandra's built-in repair process re-syncs recovering nodes automatically."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Fan-out writes per second (Instagram scale) | ~4 million per second |
| Feed cache entries per user | 1000 post IDs max |
| Celebrity follower threshold | 10,000 followers |
| Feed load P99 latency | Under 100ms |
| Cassandra partition key | userId + weekly bucket |
| Follow graph storage | Redis Set per user |
