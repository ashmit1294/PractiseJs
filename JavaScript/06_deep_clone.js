/**
 * QUESTION: Deep clone an object without JSON.parse/JSON.stringify
 *
 * JSON methods fail for:
 *   - undefined values
 *   - functions
 *   - Date objects (becomes string)
 *   - RegExp (becomes {})
 *   - Circular references (throws error)
 *   - Map, Set, Symbol
 *
 * Write a proper deep clone that handles all of these.
 */

// ─────────────────────────────────────────────
// APPROACH 1: Basic recursive deep clone
// Handles: arrays, objects, primitives
// ─────────────────────────────────────────────
function deepCloneBasic(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepCloneBasic);

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepCloneBasic(obj[key]);
    }
  }
  return cloned;
}

// ─────────────────────────────────────────────
// APPROACH 2: Full deep clone
// Handles: Date, RegExp, Map, Set, circular refs, Symbol keys
// ─────────────────────────────────────────────
function deepClone(obj, visited = new WeakMap()) {
  // Primitives & null
  if (obj === null || typeof obj !== "object") return obj;

  // Handle special built-in types
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);

  // Handle circular references
  if (visited.has(obj)) return visited.get(obj);

  // Handle Array
  if (Array.isArray(obj)) {
    const clonedArr = [];
    visited.set(obj, clonedArr);
    obj.forEach((item, i) => {
      clonedArr[i] = deepClone(item, visited);
    });
    return clonedArr;
  }

  // Handle Map
  if (obj instanceof Map) {
    const clonedMap = new Map();
    visited.set(obj, clonedMap);
    obj.forEach((val, key) => {
      clonedMap.set(deepClone(key, visited), deepClone(val, visited));
    });
    return clonedMap;
  }

  // Handle Set
  if (obj instanceof Set) {
    const clonedSet = new Set();
    visited.set(obj, clonedSet);
    obj.forEach((val) => {
      clonedSet.add(deepClone(val, visited));
    });
    return clonedSet;
  }

  // Handle plain object
  const cloned = Object.create(Object.getPrototypeOf(obj));
  visited.set(obj, cloned);

  // Copy own enumerable string keys
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key], visited);
  }

  // Copy Symbol keys
  for (const sym of Object.getOwnPropertySymbols(obj)) {
    cloned[sym] = deepClone(obj[sym], visited);
  }

  return cloned;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const original = {
  name: "Alice",
  age: 30,
  address: { city: "NYC", zip: "10001" },
  hobbies: ["coding", "reading"],
  dob: new Date("1994-01-01"),
  pattern: /hello/gi,
  scores: new Map([["math", 95], ["eng", 88]]),
  tags: new Set(["js", "ts"]),
  greet: function () { return `Hi, I'm ${this.name}`; },
};

// Circular reference test
original.self = original;

const clone = deepClone(original);

clone.address.city = "LA";
clone.hobbies.push("gaming");

console.log("Original city:", original.address.city); // NYC (not mutated)
console.log("Clone city:   ", clone.address.city);    // LA

console.log("Original hobbies:", original.hobbies);   // ['coding','reading']
console.log("Clone hobbies:   ", clone.hobbies);      // ['coding','reading','gaming']

console.log("Date cloned:   ", clone.dob instanceof Date);     // true
console.log("RegExp cloned: ", clone.pattern instanceof RegExp); // true
console.log("Map cloned:    ", clone.scores instanceof Map);   // true
console.log("Set cloned:    ", clone.tags instanceof Set);      // true
console.log("Circular ref:  ", clone.self === clone);           // true (circular preserved)
