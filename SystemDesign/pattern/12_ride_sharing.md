# Pattern 12 — Ride-Sharing System (like Uber / Lyft)

---

## ELI5 — What Is This?

> You need a ride. You open the app, pin your location.
> Somewhere nearby, a driver is waiting.
> The app plays matchmaker using a map:
> it finds the nearest available driver,
> the driver accepts, your phone shows a little car moving toward you in real time.
> Behind that simple experience is a complex puzzle of location tracking,
> matching algorithms, live maps, and fraud prevention.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Geohash** | A system that converts a GPS coordinate (latitude, longitude) into a short string (like "9q8y"). All locations in the same neighbourhood share the same prefix. This makes it easy to find all drivers within a specific area by searching for a prefix. |
| **Proximity Search** | Finding all points (drivers) within a certain radius of another point (rider). Done efficiently with a spatial index. |
| **Spatial Index** | A special database index that understands geography. Instead of "find rows where name = X", it can do "find rows where location is within 2km of this point". PostgreSQL's PostGIS extension provides this. |
| **WebSocket** | A two-way, persistent connection between a phone/browser and a server. Unlike HTTP (which is one question → one answer), WebSocket stays open so the server can push updates (driver location) to the client at any time. |
| **Driver Location Update** | Every 3-4 seconds, the driver's app sends GPS coordinates to the server. The server broadcasts these to the matched rider so they see the car moving. |
| **Matching Algorithm** | The logic that decides which driver to assign to a rider. Considers: distance, driver rating, car type requested, estimated arrival time (ETA). |
| **ETA (Estimated Time of Arrival)** | How long until the driver arrives. Calculated using road routing (not straight-line distance). Heavy traffic on a road increases ETA even if the driver is physically close. |
| **Surge Pricing** | When demand (riders) outpaces supply (drivers) in an area, the price multiplier increases. This entices more drivers to the area and reduces demand — economic balancing. |
| **Trip State Machine** | A trip goes through defined states: REQUESTED → ACCEPTED → DRIVER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED (or CANCELLED). Only valid transitions are allowed. |
| **OSRM / Google Maps Routing** | A routing engine that calculates actual road-based paths and travel times, respecting one-way streets, turn restrictions, and real-time traffic. |
| **Idempotency** | Making the same request twice has the same effect as making it once. Critical for payment: clicking "pay" twice should NOT charge twice. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENT["Apps"]
        RIDER_APP["Rider App — iOS and Android"]
        DRIVER_APP["Driver App — iOS and Android"]
    end

    subgraph GATEWAY["Entry Layer"]
        LB["Load Balancer"]
        API_GW["API Gateway — auth, rate limiting, routing"]
    end

    subgraph LOCATION["Location Services"]
        LOC_SVC["Location Service — ingests driver GPS updates every 4 seconds"]
        LOC_REDIS["Redis — driver positions stored as geo sorted set"]
        LOC_KAFKA["Kafka — driver_location_update topic — for analytics and matching consumer"]
    end

    subgraph MATCH["Matching"]
        MATCH_SVC["Matching Service — finds best driver when rider requests trip"]
        ROUTE_SVC["Routing Service — calculates ETA using OSRM or Google Maps"]
    end

    subgraph TRIP["Trip Management"]
        TRIP_SVC["Trip Service — manages trip state machine"]
        TRIP_DB["PostgreSQL — trips, users, ratings tables"]
    end

    subgraph REALTIME["Real-time Location Push"]
        WS_SVC["WebSocket Service — pushes driver location to rider every 4 seconds"]
    end

    subgraph PRICING["Pricing"]
        PRICING_SVC["Pricing Service — computes fare and surge multiplier"]
        DEMAND_REDIS["Redis — demand counters per geohash cell"]
    end

    subgraph PAY["Payment"]
        PAY_SVC["Payment Service — charges rider after trip, pays driver"]
    end

    DRIVER_APP --> API_GW --> LOC_SVC --> LOC_REDIS
    LOC_SVC --> LOC_KAFKA
    RIDER_APP --> API_GW --> MATCH_SVC
    MATCH_SVC --> LOC_REDIS
    MATCH_SVC --> ROUTE_SVC
    MATCH_SVC --> TRIP_SVC --> TRIP_DB
    TRIP_SVC --> WS_SVC --> RIDER_APP & DRIVER_APP
    LOC_KAFKA --> WS_SVC
    TRIP_SVC --> PRICING_SVC --> DEMAND_REDIS
    TRIP_SVC --> PAY_SVC
```

---

## Ride Request Flow

```mermaid
sequenceDiagram
    participant R as Rider App
    participant API as API Gateway
    participant MATCH as Matching Service
    participant REDIS as Location Redis
    participant ROUTE as Routing Service
    participant TRIP as Trip Service
    participant WS as WebSocket Service
    participant D as Driver App

    R->>API: POST /trips/request  riderLocation=40.7128,-74.0060  carType=standard
    API->>MATCH: find best driver near 40.7128,-74.0060
    MATCH->>REDIS: GEORADIUS driver_locations 40.7128 -74.0060 5000m  ASC  WITHCOORD
    REDIS-->>MATCH: 12 online drivers within 5km, sorted by distance
    MATCH->>ROUTE: estimate ETA for top 5 candidates
    ROUTE-->>MATCH: ETAs  D1=4min  D2=6min  D3=7min  D4=8min  D5=9min
    MATCH-->>MATCH: Select D1  combining rating=4.8 and ETA=4min score
    MATCH->>TRIP: createTrip  riderId=R1  driverId=D1  pickupLoc
    TRIP-->>R: tripId=T99  driverName=Carlos  ETA=4min  via WebSocket push
    TRIP->>D: push trip offer  riderName=Alex  pickup location
    D-->>TRIP: ACCEPT  driverId=D1  tripId=T99
    TRIP-->>R: driver accepted — tracking begins

    loop every 4 seconds
        D->>API: PUT /drivers/location  lat=40.7150  lng=-74.0055
        API->>REDIS: GEOADD driver_locations 40.7150 -74.0055 D1
        REDIS->>WS: pub-sub  driver D1 location updated
        WS-->>R: push location update  driverLat=40.7150  driverLng=-74.0055
    end

    D->>API: PATCH /trips/T99  status=ARRIVED
    TRIP-->>R: WebSocket push  driver has arrived
    D->>API: PATCH /trips/T99  status=IN_PROGRESS
    D->>API: PATCH /trips/T99  status=COMPLETED  endLocation=40.7200,-74.0030
    TRIP->>PRICING_SVC: compute fare  distanceKm=3.2  durationMin=12  surgeMultiplier=1.2
    PRICING_SVC-->>TRIP: fare=USD 14.40
    TRIP->>PAY_SVC: charge riderId=R1  amount=14.40
    TRIP-->>R: Trip complete  fare=USD14.40  please rate your driver
```

---

## Surge Pricing Logic

```mermaid
flowchart TD
    A["Every 30 seconds: Surge Calculation Job runs"] --> B["For each geohash cell in the city"]
    B --> C["Count active ride requests in last 5 minutes"]
    B --> D["Count available drivers in same geohash cell"]
    C & D --> E{"Demand to Supply Ratio?"}
    E -- "Ratio < 1.2" --> F["Surge multiplier = 1.0x  Normal pricing"]
    E -- "1.2 to 1.5" --> G["Surge = 1.2x  Mild surge"]
    E -- "1.5 to 2.0" --> H["Surge = 1.5x  Moderate surge — shown in app"]
    E -- "> 2.0" --> I["Surge = 2x  High surge — popup warning required"]
    F & G & H & I --> J["Write surge multiplier to Redis with 30s TTL"]
    J --> K["Pricing Service reads Redis multiplier when calculating fares"]
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Driver location Redis under city-wide event** | 100,000 drivers updating location every 4 seconds = 25,000 writes/second to a single Redis sorted set. A concert ending floods this. | Geohash-based sharding: partition drivers into 64 geohash cells. Each cell is a separate Redis key on a separate Redis shard. Writes are spread evenly. |
| 2 | **Matching quality vs latency tradeoff** | Computing ETA for all 1000 nearby drivers using real road routing takes 200ms each = very slow. | Two-stage matching: Stage 1 — fast straight-line distance to filter top 10 candidates (1ms). Stage 2 — real routing ETA only for those 10 (50ms). |
| 3 | **WebSocket server holding millions of connections** | A city with 500,000 active trips means 1 million WebSocket connections (rider + driver per trip). WebSocket connections consume memory (~50KB each). 1M connections = 50 GB RAM on WebSocket servers. | Horizontal scaling: 100 WebSocket servers each hold 10,000 connections. Each server subscribes to driver location updates from Redis Pub/Sub only for drivers whose riders it is serving. |
| 4 | **Stale driver location on matching** | Driver moves 200m in the time between their last update and the matching decision. ETA estimated for wrong location. | Accept up to 8 seconds of location staleness for matching (GPS updates every 4 seconds = at most 4 seconds old). Routing service adds 30 seconds of buffer to all ETAs. |
| 5 | **Same driver offered to multiple simultaneous riders** | Two riders request at the same time. Matching service finds the same nearest driver for both. Both send offers. Driver accepts both. | Pessimistic locking on driver status: before sending an offer, acquire a Redis lock for driverId with 30-second TTL. Only one matchen holds the lock at a time. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Location Service Redis Crashes — All Driver Positions Lost"]
    F2["Matching Service Crashes — Riders Cannot Get Drivers"]
    F3["WebSocket Server Crashes — Live Tracking Disconnected"]
    F4["Payment Service Down — Trip Cannot Be Charged"]
    F5["Driver Goes Offline Mid-Trip — GPS Tracking Stops"]

    F1 --> R1["Driver positions are held only in Redis.
    Redis crash means all position data is lost.
    Recovery is fast: drivers' apps re-send their GPS coordinates every 4 seconds.
    Within 4-8 seconds of Redis restarting, all online drivers have re-broadcast their location.
    New matches can resume quickly.
    Trips already in progress do not need location matching — they only need location tracking.
    Even if tracking WebSocket push stops for 4-8 seconds, riders see a small loading spinner,
    then the driver dot resumes moving. Not a critical failure."]

    F2 --> R2["Matching Service is stateless — it reads from Redis and writes to Trip DB.
    Kubernetes will restart crashed pods in under 10 seconds.
    During that window: rider sees 'Looking for driver...' spinner.
    Retry logic: Rider app polls /trips/T99/status every 5 seconds.
    Load balancer health check detects crashed pods and stops routing to them.
    Multiple replicas of Matching Service run simultaneously.
    Crash of one pod does not affect others.
    New trip requests are routed to healthy pods while the crashed pod restarts."]

    F3 --> R3["WebSocket connection drops — rider and driver both see the map freeze.
    Both apps detect the WebSocket disconnection event.
    SDK auto-reconnect: waits 2 seconds then reconnects to WebSocket service.
    WebSocket service is load balanced with sticky sessions by default.
    If the specific WS server that crashed was handling the connection:
    LB sticky session routes reconnect to a different live server.
    New server fetches driver's current location from Redis and resumes push.
    Total disruption to the user: 2-5 seconds of frozen map."]

    F4 --> R4["Payment Service failure at trip end.
    Trip is already complete — driver dropped off rider.
    The failed charge must not be silently dropped.
    Trip Service writes the completed trip with status=PAYMENT_PENDING to the DB.
    A retry worker checks PAYMENT_PENDING rows every 60 seconds.
    It retries the charge with an idempotency key equal to tripId.
    Even if the worker runs the charge twice due to its own failure, the idempotency key
    ensures the payment provider only charges once.
    Rider receives receipt email when payment finally succeeds.
    If payment fails after 3 days due to insufficient funds, rider is banned from future rides."]

    F5 --> R5["Driver's phone loses signal (tunnel, underground garage).
    WebSocket disconnects from driver side.
    Rider sees driver dot freeze on map.
    Trip Service detects driver WebSocket has been silent for 15 seconds.
    It sends a push notification (FCM) to driver's phone asking for check-in.
    If no response in 30 seconds: Trip UI shows rider a message 'driver may have lost signal'.
    The trip itself continues — state machine is still IN_PROGRESS.
    When driver regains signal, app reconnects and resumes updating.
    Trip timing and distance are not affected — the meter still runs.
    Edge case: if driver app crashes entirely, operations team can manually complete or cancel the
    trip from an admin console, triggering the payment flow."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Driver location update interval | 4 seconds |
| Nearby driver search radius | 5 km default |
| Location data freshness for matching | Max 8 seconds old |
| WebSocket memory per connection | ~50 KB |
| Redis GEORADIUS latency | Under 5 ms |
| Matching service p99 latency | Under 500 ms |
| Surge pricing recalculation interval | Every 30 seconds |
| Trip state transitions | 7 states |
