/**
 * QUESTION SET: WeakMap, WeakSet, Symbol, Proxy, Reflect
 *
 * These are advanced JS features that appear in senior interviews.
 */

// ─────────────────────────────────────────────
// WEAKMAP
// Keys MUST be objects. Not enumerable. GC-friendly.
// Use: private data per instance, DOM node metadata, caching
// ─────────────────────────────────────────────

// Q1. Private class fields using WeakMap
const _private = new WeakMap();

class BankAccount {
  constructor(owner, balance) {
    _private.set(this, { balance, owner }); // private per instance
  }

  deposit(amount) {
    _private.get(this).balance += amount;
    return this;
  }

  withdraw(amount) {
    const data = _private.get(this);
    if (amount > data.balance) throw new Error("Insufficient funds");
    data.balance -= amount;
    return this;
  }

  getBalance() {
    return _private.get(this).balance;
  }

  getOwner() {
    return _private.get(this).owner;
  }
}

// Q2. Memoization using WeakMap (object keys)
function memoizeObject(fn) {
  const cache = new WeakMap();
  return function (obj) {
    if (cache.has(obj)) return cache.get(obj);
    const result = fn(obj);
    cache.set(obj, result);
    return result;
  };
}

// ─────────────────────────────────────────────
// WEAKSET
// Stores objects only. No iteration. GC-friendly.
// Use: tracking visited nodes, marking processed objects
// ─────────────────────────────────────────────

// Q3. Detect circular references using WeakSet
function hasCircularReference(obj) {
  const seen = new WeakSet();

  function detect(value) {
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return true;
      seen.add(value);
      for (const key of Object.keys(value)) {
        if (detect(value[key])) return true;
      }
      seen.delete(value); // backtrack — only circular if exact cycle
    }
    return false;
  }
  return detect(obj);
}

// Q4. Track which objects have been processed
function processItems(items) {
  const processed = new WeakSet();

  return {
    process(item) {
      if (processed.has(item)) return "already processed";
      processed.add(item);
      return "processed: " + item.name;
    },
  };
}

// ─────────────────────────────────────────────
// SYMBOL
// Unique, immutable primitive. Used for unique keys,
// well-known symbols (Symbol.iterator, Symbol.toPrimitive, etc.)
// ─────────────────────────────────────────────

// Q5. Create unique property keys with Symbol
const ID = Symbol("id");
const ROLE = Symbol("role");

const user = {
  name: "Alice",
  [ID]: 12345,     // hidden from JSON.stringify and for..in
  [ROLE]: "admin",
};

// Symbol keys are NOT enumerable — they won't show in:
// Object.keys(), JSON.stringify(), for...in loops
// But appear in: Object.getOwnPropertySymbols()

// Q6. Implement Symbol.iterator — make object iterable
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        return current <= end
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  }
}

// Q7. Custom Symbol.toPrimitive — control type coercion
class Temperature {
  constructor(celsius) {
    this.celsius = celsius;
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.celsius;
    if (hint === "string") return `${this.celsius}°C`;
    return this.celsius; // default
  }
}

// ─────────────────────────────────────────────
// PROXY
// Intercepts object operations: get, set, has, deleteProperty, apply
// Use: validation, logging, reactive systems (Vue 3's reactivity)
// ─────────────────────────────────────────────

// Q8. Validation Proxy
function createValidatedObject(target, validators) {
  return new Proxy(target, {
    set(obj, prop, value) {
      if (validators[prop] && !validators[prop](value)) {
        throw new TypeError(`Invalid value for ${prop}: ${value}`);
      }
      obj[prop] = value;
      return true;
    },
  });
}

// Q9. Read-only Proxy (freeze but recursive)
function readOnly(obj) {
  return new Proxy(obj, {
    set() { throw new TypeError("Object is read-only"); },
    deleteProperty() { throw new TypeError("Cannot delete from read-only object"); },
    get(target, prop) {
      const val = target[prop];
      return typeof val === "object" && val !== null ? readOnly(val) : val;
    },
  });
}

// Q10. Logging/Observing Proxy
function observable(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      onChange(prop, oldValue, value);
      return true;
    },
  });
}

// Q11. Proxy with default value for missing keys
function withDefaults(target, defaultValue) {
  return new Proxy(target, {
    get(obj, prop) {
      return prop in obj ? obj[prop] : defaultValue;
    },
  });
}

// ─────────────────────────────────────────────
// REFLECT
// Mirror of Proxy traps — same operations, but as functions.
// Used inside Proxy handlers to perform the default behavior.
// ─────────────────────────────────────────────

// Q12. Proxy + Reflect (correct pattern)
function createLoggingProxy(target) {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      console.log(`GET: ${String(prop)}`);
      return Reflect.get(obj, prop, receiver); // delegate properly
    },
    set(obj, prop, value, receiver) {
      console.log(`SET: ${String(prop)} = ${value}`);
      return Reflect.set(obj, prop, value, receiver);
    },
  });
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== WeakMap — BankAccount ===");
const acc = new BankAccount("Alice", 1000);
acc.deposit(500).withdraw(200);
console.log(acc.getBalance()); // 1300
console.log(acc.getOwner());   // Alice

console.log("\n=== WeakSet — Circular Reference ===");
const safe = { a: 1, b: { c: 2 } };
const circular = { a: 1 };
circular.self = circular;
console.log(hasCircularReference(safe));     // false
console.log(hasCircularReference(circular)); // true

console.log("\n=== Symbol keys ===");
console.log(user.name);     // Alice
console.log(user[ID]);      // 12345
console.log(user[ROLE]);    // admin
console.log(Object.keys(user)); // ['name'] — symbols hidden

console.log("\n=== Symbol.iterator — Range ===");
const range = new Range(1, 5);
console.log([...range]);    // [1, 2, 3, 4, 5]
for (const n of range) process.stdout.write(n + " ");
console.log();

console.log("\n=== Symbol.toPrimitive ===");
const temp = new Temperature(100);
console.log(+temp);         // 100 (number hint)
console.log(`${temp}`);     // 100°C (string hint)
console.log(temp + 0);      // 100 (default hint)

console.log("\n=== Validation Proxy ===");
const person = createValidatedObject({}, {
  age: (v) => typeof v === "number" && v >= 0 && v <= 150,
  name: (v) => typeof v === "string" && v.length > 0,
});
person.name = "Bob";
person.age = 25;
console.log(person); // { name: 'Bob', age: 25 }
try {
  person.age = -5;
} catch (e) {
  console.log(e.message); // Invalid value for age: -5
}

console.log("\n=== Observable Proxy ===");
const state = observable({ count: 0 }, (prop, oldVal, newVal) => {
  console.log(`${prop}: ${oldVal} → ${newVal}`);
});
state.count = 1; // count: 0 → 1
state.count = 2; // count: 1 → 2

console.log("\n=== Default Values Proxy ===");
const obj = withDefaults({ a: 1 }, 0);
console.log(obj.a);    // 1
console.log(obj.z);    // 0 (default)
