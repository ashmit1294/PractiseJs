/**
 * QUESTION SET: Node.js EventEmitter & Custom Events
 *
 * 1. EventEmitter basics — on / emit / once / off
 * 2. Custom EventEmitter class
 * 3. Event-driven architecture patterns
 * 4. Domain events pattern
 * 5. Memory leak prevention (maxListeners)
 * 6. AsyncEventEmitter (async listeners)
 */

const EventEmitter = require("events");

// ─────────────────────────────────────────────
// Q1. EventEmitter basics
// ─────────────────────────────────────────────

class OrderService extends EventEmitter {
  async placeOrder(order) {
    await saveOrderToDb(order);                  // save first
    this.emit("order:placed", order);            // then broadcast
  }

  async cancelOrder(orderId) {
    const order = await cancelInDb(orderId);
    this.emit("order:cancelled", { orderId, order });
  }
}

const orderService = new OrderService();

// Subscribe — executes every time
orderService.on("order:placed", (order) => {
  console.log("[EMAIL] Order confirmation to", order.email);
});

// Subscribe — executes only once
orderService.once("order:placed", () => {
  console.log("[ANALYTICS] First order in session");
});

// Prepend listener — runs before others
orderService.prependListener("order:placed", (order) => {
  console.log("[AUDIT] Order placed:", order.id);
});

// Remove a specific listener
function inventoryListener(order) {
  console.log("[INVENTORY] Reserve items for", order.id);
}
orderService.on("order:placed", inventoryListener);
orderService.off("order:placed", inventoryListener); // later removal

// Remove all listeners for an event
orderService.removeAllListeners("order:placed");

// ─────────────────────────────────────────────
// Q2. Custom lightweight EventEmitter (from scratch)
// ─────────────────────────────────────────────

class MyEventEmitter {
  #listeners = new Map(); // event → Set of listeners

  on(event, listener) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(listener);
    return this; // allow chaining
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    wrapper._original = listener; // For removal by original reference
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const set = this.#listeners.get(event);
    if (!set) return this;
    // Support removing by original reference (for once-wrapped listeners)
    for (const fn of set) {
      if (fn === listener || fn._original === listener) {
        set.delete(fn);
        break;
      }
    }
    return this;
  }

  emit(event, ...args) {
    const set = this.#listeners.get(event);
    if (!set) return false;
    for (const listener of set) {
      listener(...args);
    }
    return true;
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(event) {
    if (event) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
    return this;
  }
}

// ─────────────────────────────────────────────
// Q3. Event-driven architecture — pub/sub within a process
// ─────────────────────────────────────────────

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // prevent accidental memory leak warning
  }

  publish(event, payload) {
    this.emit(event, { event, payload, timestamp: new Date() });
  }

  subscribe(event, handler) {
    this.on(event, handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
}

const bus = new EventBus();

// Subscriber 1 — email service
const unsubEmail = bus.subscribe("user:registered", ({ payload }) => {
  sendWelcomeEmail(payload.email);
});

// Subscriber 2 — analytics
bus.subscribe("user:registered", ({ payload, timestamp }) => {
  recordSignup(payload.userId, timestamp);
});

// Publisher
async function registerUser(email, password) {
  const user = await createUser(email, password);
  bus.publish("user:registered", { userId: user.id, email });
  return user;
}

// Later — clean up subscriber
unsubEmail();

// ─────────────────────────────────────────────
// Q4. Domain event pattern (DDD-style)
// Collect events during a transaction, emit after commit
// ─────────────────────────────────────────────

class AggregateRoot {
  #domainEvents = [];

  addDomainEvent(event) {
    this.#domainEvents.push(event);
  }

  getDomainEvents() {
    return [...this.#domainEvents];
  }

  clearDomainEvents() {
    this.#domainEvents = [];
  }
}

class User extends AggregateRoot {
  constructor(id, email) {
    super();
    this.id = id;
    this.email = email;
  }

  static create(id, email) {
    const user = new User(id, email);
    user.addDomainEvent({ type: "UserCreated", payload: { userId: id, email } });
    return user;
  }

  changeEmail(newEmail) {
    const oldEmail = this.email;
    this.email = newEmail;
    this.addDomainEvent({ type: "UserEmailChanged", payload: { userId: this.id, oldEmail, newEmail } });
  }
}

async function saveUserWithEvents(user, eventBus) {
  await db.user.save(user); // persists aggregate
  // Only emit events AFTER successful commit
  for (const event of user.getDomainEvents()) {
    eventBus.publish(event.type, event.payload);
  }
  user.clearDomainEvents();
}

// ─────────────────────────────────────────────
// Q5. Memory leak prevention
// ─────────────────────────────────────────────

/*
  Node.js warns when > 10 listeners on one event (default maxListeners).
  Common causes:
    - Adding listeners in event handlers or loops without cleanup
    - Forgetting to call removeListener when component/service is destroyed

  Best practices:
    1. Always store reference to listener so you can remove it: emitter.off(event, fn)
    2. Use once() instead of on() when handler should fire only once
    3. Increase maxListeners if you legitimately need > 10: emitter.setMaxListeners(20)
    4. Use emitter.rawListeners(event) to inspect current listeners
    5. Use WeakRef for listeners if emitter outlives the subscribing object
*/

// Anti-pattern: listener added on every request
function badMiddleware(req, res, next) {
  process.on("uncaughtException", (err) => {
    // BUG: adds a new listener on every request → memory leak
    console.error(err);
  });
  next();
}

// Fix: add once at startup
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

// ─────────────────────────────────────────────
// Q6. Async event listeners with error handling
// ─────────────────────────────────────────────

class AsyncEventEmitter extends EventEmitter {
  emitAsync(event, ...args) {
    const listeners = this.rawListeners(event);
    return Promise.all(listeners.map((fn) => Promise.resolve(fn(...args))));
  }

  // Forward errors from async listeners to 'error' event
  onAsync(event, asyncListener) {
    this.on(event, (...args) => {
      Promise.resolve(asyncListener(...args)).catch((err) => {
        this.emit("error", err);
      });
    });
    return this;
  }
}

// Usage
const asyncEmitter = new AsyncEventEmitter();

asyncEmitter.onAsync("data:received", async (data) => {
  await processData(data);        // if this throws, 'error' event fires
  await saveToDatabase(data);
});

asyncEmitter.on("error", (err) => {
  console.error("EventEmitter error:", err);
});

asyncEmitter.emit("data:received", { id: 1 });

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between process.nextTick and EventEmitter callbacks?
  A: process.nextTick fires synchronously after the current operation, before any I/O.
     EventEmitter listeners fire synchronously during emit() by default.
     Use setImmediate or process.nextTick inside listeners to defer heavy work.

  Q: How does Node.js EventEmitter handle errors?
  A: All EventEmitter instances have special 'error' event handling.
     If 'error' is emitted and no listener is registered, Node.js throws it
     as an uncaught exception (potentially crashing the process).
     Always add: emitter.on('error', handler) before emitting errors.

  Q: What is the difference between EventEmitter and streams?
  A: Streams extend EventEmitter. Streams add: backpressure, piping, ordering
     guarantees (data flows in chunks). EventEmitter is the underlying pub/sub mechanism.

  Q: How do you implement request/response over EventEmitter?
  A: Use a unique ID (UUID) and register a one-time listener for that ID:
     const id = uuid();
     emitter.once(`response:${id}`, resolve);
     emitter.emit('request', { id, payload });
     This is the standard pattern for async RPC over an event bus.

  Q: Wildcard event names — does Node's EventEmitter support them?
  A: No. Standard EventEmitter requires exact event name matches.
     Use the 'eventemitter2' npm package for wildcard/glob support:
     emitter.on('user.*', handler)  // matches user.created, user.deleted
*/

// ─────────────────────────────────────────────
// Helpers (stubs for examples above)
// ─────────────────────────────────────────────
async function saveOrderToDb(order) {}
async function cancelInDb(orderId) {}
async function sendWelcomeEmail(email) {}
async function recordSignup(userId, timestamp) {}
async function createUser(email, password) { return { id: "1", email }; }
async function processData(data) {}
async function saveToDatabase(data) {}
const db = { user: { save: async () => {} } };

module.exports = { MyEventEmitter, EventBus, AsyncEventEmitter };
