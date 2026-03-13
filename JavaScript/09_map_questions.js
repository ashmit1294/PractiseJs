/**
 * QUESTION SET: Map — all common interview questions
 *
 * Map stores key-value pairs where keys can be ANY type
 * (objects, functions, primitives) — unlike plain objects.
 *
 * Map maintains insertion order.
 * Map.size vs Object.keys(obj).length
 */

// ─────────────────────────────────────────────
// Q1. Implement a Map from scratch using an array/hash
// ─────────────────────────────────────────────
class MyMap {
  constructor() {
    this._keys = [];
    this._values = [];
    this.size = 0;
  }

  set(key, value) {
    const idx = this._keys.indexOf(key);
    if (idx !== -1) {
      this._values[idx] = value; // update existing
    } else {
      this._keys.push(key);
      this._values.push(value);
      this.size++;
    }
    return this; // chainable
  }

  get(key) {
    const idx = this._keys.indexOf(key);
    return idx !== -1 ? this._values[idx] : undefined;
  }

  has(key) {
    return this._keys.indexOf(key) !== -1;
  }

  delete(key) {
    const idx = this._keys.indexOf(key);
    if (idx === -1) return false;
    this._keys.splice(idx, 1);
    this._values.splice(idx, 1);
    this.size--;
    return true;
  }

  clear() {
    this._keys = [];
    this._values = [];
    this.size = 0;
  }

  forEach(callback) {
    for (let i = 0; i < this._keys.length; i++) {
      callback(this._values[i], this._keys[i], this);
    }
  }

  keys() { return this._keys[Symbol.iterator](); }
  values() { return this._values[Symbol.iterator](); }

  *entries() {
    for (let i = 0; i < this._keys.length; i++) {
      yield [this._keys[i], this._values[i]];
    }
  }

  [Symbol.iterator]() { return this.entries(); }
}

// ─────────────────────────────────────────────
// Q2. Count frequency of characters in a string using Map
// ─────────────────────────────────────────────
function charFrequency(str) {
  const map = new Map();
  for (const ch of str) {
    map.set(ch, (map.get(ch) || 0) + 1);
  }
  return map;
}

// Q2b. Most frequent character
function mostFreqChar(str) {
  const freq = charFrequency(str);
  let maxChar = "";
  let maxCount = 0;
  for (const [char, count] of freq) {
    if (count > maxCount) { maxCount = count; maxChar = char; }
  }
  return { char: maxChar, count: maxCount };
}

// ─────────────────────────────────────────────
// Q3. Two Sum using Map (O(n) solution)
// Return indices of two numbers that add up to target
// ─────────────────────────────────────────────
function twoSum(nums, target) {
  const seen = new Map(); // value → index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}

// ─────────────────────────────────────────────
// Q4. Group anagrams together using Map
// Input: ["eat","tea","tan","ate","nat","bat"]
// Output: [["bat"],["nat","tan"],["ate","eat","tea"]]
// ─────────────────────────────────────────────
function groupAnagrams(words) {
  const map = new Map();
  for (const word of words) {
    const key = word.split("").sort().join(""); // sort letters as key
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(word);
  }
  return [...map.values()];
}

// ─────────────────────────────────────────────
// Q5. LRU Cache using Map (Map preserves insertion order)
// get: O(1)  set: O(1)
// ─────────────────────────────────────────────
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map preserves insertion order → LRU is first entry
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key); // refresh position
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      // Delete the FIRST (least recently used) entry
      this.cache.delete(this.cache.keys().next().value);
    }
  }
}

// ─────────────────────────────────────────────
// Q6. Convert Map to/from Object and Array
// ─────────────────────────────────────────────
function mapFromObject(obj) {
  return new Map(Object.entries(obj));
}

function objectFromMap(map) {
  return Object.fromEntries(map);
}

function mapFromArray(pairs) {
  return new Map(pairs); // pairs: [[key, val], ...]
}

// ─────────────────────────────────────────────
// Q7. Find first non-repeating character using Map
// ─────────────────────────────────────────────
function firstNonRepeating(str) {
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  for (const ch of str) {
    if (freq.get(ch) === 1) return ch;
  }
  return null;
}

// ─────────────────────────────────────────────
// Q8. Subarray sum equals K using Map (prefix sum)
// Count subarrays whose sum equals k
// ─────────────────────────────────────────────
function subarraySum(nums, k) {
  const prefixMap = new Map([[0, 1]]); // prefixSum → count
  let count = 0;
  let sum = 0;
  for (const num of nums) {
    sum += num;
    if (prefixMap.has(sum - k)) count += prefixMap.get(sum - k);
    prefixMap.set(sum, (prefixMap.get(sum) || 0) + 1);
  }
  return count;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Custom Map ===");
const m = new MyMap();
const objKey = { id: 1 };
m.set("name", "Alice").set(objKey, "object-value").set(42, "number-key");
console.log(m.get("name"));    // Alice
console.log(m.get(objKey));    // object-value
console.log(m.size);           // 3
m.delete("name");
console.log(m.size);           // 2

console.log("\n=== Char Frequency ===");
console.log([...charFrequency("hello")]); // [['h',1],['e',1],['l',2],['o',1]]
console.log(mostFreqChar("aabbccddddee")); // { char: 'd', count: 4 }

console.log("\n=== Two Sum ===");
console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));      // [1, 2]

console.log("\n=== Group Anagrams ===");
console.log(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));

console.log("\n=== LRU Cache ===");
const lru = new LRUCache(3);
lru.put(1, "one");
lru.put(2, "two");
lru.put(3, "three");
lru.get(1);            // access 1 → it becomes most recent
lru.put(4, "four");    // evicts 2 (LRU)
console.log(lru.get(2)); // -1 (evicted)
console.log(lru.get(1)); // "one"

console.log("\n=== First Non-Repeating ===");
console.log(firstNonRepeating("aabbcdd")); // c
console.log(firstNonRepeating("aabb"));    // null

console.log("\n=== Subarray Sum ===");
console.log(subarraySum([1, 1, 1], 2)); // 2
console.log(subarraySum([1, 2, 3], 3)); // 2
