/**
 * QUESTION SET: Set — all common interview questions
 *
 * Set stores UNIQUE values of any type.
 * No duplicate keys, values, or entries.
 * Insertion order is maintained.
 * Lookup is O(1) average.
 */

// ─────────────────────────────────────────────
// Q1. Implement a Set from scratch
// WHAT: How to implement Set with add/has/delete/clear and iteration?
// THEORY: Use array to store values. indexOf checks membership. add() appends if not exists. delete() removes and decrements size.
//         Chainable add(). Provide forEach, values(), keys(), entries(), Symbol.iterator.
// ─────────────────────────────────────────────
class MySet {
  constructor(iterable = []) {
    this._data = [];
    this.size = 0;
    for (const val of iterable) this.add(val);
  }

  add(value) {
    if (!this.has(value)) {
      this._data.push(value);
      this.size++;
    }
    return this; // chainable
  }

  has(value) {
    return this._data.indexOf(value) !== -1;
  }

  delete(value) {
    const idx = this._data.indexOf(value);
    if (idx === -1) return false;
    this._data.splice(idx, 1);
    this.size--;
    return true;
  }

  clear() {
    this._data = [];
    this.size = 0;
  }

  forEach(callback) {
    for (const val of this._data) callback(val, val, this);
  }

  values() { return this._data[Symbol.iterator](); }
  keys() { return this.values(); } // Same as values() in Set spec

  *entries() {
    for (const val of this._data) yield [val, val];
  }

  [Symbol.iterator]() { return this.values(); }
}

// ─────────────────────────────────────────────
// Q2. Remove duplicates from an array
// WHAT: How to remove duplicates from an array?
// THEORY: Spread Set into array [...new Set(arr)]. Set automatically deduplicates. Preserves first occurrence order.
//         Filter alternative: filter((val, idx, self) => self.indexOf(val) === idx) is O(n²).
// ─────────────────────────────────────────────
function removeDuplicates(arr) {
  return [...new Set(arr)];
}

// Without Set:
function removeDuplicatesManual(arr) {
  return arr.filter((val, idx, self) => self.indexOf(val) === idx);
}

// ─────────────────────────────────────────────
// Q3. Find unique elements (elements appearing exactly once)
// WHAT: How to filter elements that appear exactly once?
// THEORY: Track seen elements. If seen again → add to duplicates Set. Return elements not in duplicates.
//         Two passes: build duplicates Set, filter to exclude.
// ─────────────────────────────────────────────
function uniqueOnly(arr) {
  const seen = new Set();
  const duplicates = new Set();
  for (const val of arr) {
    if (seen.has(val)) duplicates.add(val);
    else seen.add(val);
  }
  return arr.filter((v) => !duplicates.has(v));
}

// ─────────────────────────────────────────────
// Q4. Set operations — Union, Intersection, Difference
// ─────────────────────────────────────────────

// Union: all elements from both sets
function union(setA, setB) {
  return new Set([...setA, ...setB]);
}

// Intersection: elements present in BOTH sets
function intersection(setA, setB) {
  return new Set([...setA].filter((x) => setB.has(x)));
}

// Difference: elements in A but NOT in B
function difference(setA, setB) {
  return new Set([...setA].filter((x) => !setB.has(x)));
}

// Symmetric difference: elements in either A or B but NOT both
function symmetricDifference(setA, setB) {
  const onlyA = difference(setA, setB);
  const onlyB = difference(setB, setA);
  return union(onlyA, onlyB);
}

// isSubset: check if A is a subset of B
function isSubset(setA, setB) {
  return [...setA].every((x) => setB.has(x));
}

// ─────────────────────────────────────────────
// Q5. Find duplicates in an array using Set
// WHAT: How to find which elements appear more than once?
// THEORY: Track seen + duplicates Sets. For each value: if already seen → add to duplicates, else → add to seen.
//         Return duplicates as array. One pass through array.
// ─────────────────────────────────────────────
function findDuplicates(arr) {
  const seen = new Set();
  const dupes = new Set();
  for (const val of arr) {
    if (seen.has(val)) dupes.add(val);
    else seen.add(val);
  }
  return [...dupes];
}

// ─────────────────────────────────────────────
// Q6. Check if two arrays have common element
// WHAT: How to quickly check if two arrays share any element?
// THEORY: Convert arr1 to Set. For arr2, use some() to check if any element in Set.
//         Short-circuits on first match. O(n+m) time.
// ─────────────────────────────────────────────
function hasCommon(arr1, arr2) {
  const set1 = new Set(arr1);
  return arr2.some((x) => set1.has(x));
}

// ─────────────────────────────────────────────
// Q7. Longest consecutive sequence (O(n) using Set)
// WHAT: How to find longest consecutive number sequence in O(n)?
// THEORY: Add all nums to Set. For each num, only start if num-1 doesn't exist (skip duplicates).
//         Extend sequence while next+1 exists. Track max length. Avoids nested iteration.
// ─────────────────────────────────────────────
function longestConsecutive(nums) {
  const numSet = new Set(nums);
  let longest = 0;

  for (const num of numSet) {
    // Only start counting from the beginning of a sequence
    if (!numSet.has(num - 1)) {
      let current = num;
      let length = 1;
      while (numSet.has(current + 1)) {
        current++;
        length++;
      }
      longest = Math.max(longest, length);
    }
  }
  return longest;
}

// ─────────────────────────────────────────────
// Q8. Contains duplicate (O(n) using Set)
// WHAT: How to check for duplicates in linear time?
// THEORY: Iterate array with seen Set. If element in Set → return true (found duplicate). Else → add to seen.
//         Return false if complete iteration (no duplicates). Short-circuits early.
// ─────────────────────────────────────────────
function containsDuplicate(nums) {
  const seen = new Set();
  for (const num of nums) {
    if (seen.has(num)) return true;
    seen.add(num);
  }
  return false;
}

// ─────────────────────────────────────────────
// Q9. Intersection of two arrays (no using Set ops)
// WHAT: How to find common elements in two arrays?
// THEORY: Convert arr1 to Set. Iterate arr2, keep if in Set, add to result Set (avoid duplicates).
//         Return result as array. O(n+m) time, handles duplicates correctly.
// ─────────────────────────────────────────────
function arrayIntersection(arr1, arr2) {
  const set1 = new Set(arr1);
  const result = new Set();
  for (const num of arr2) {
    if (set1.has(num)) result.add(num);
  }
  return [...result];
}

// ─────────────────────────────────────────────
// Q10. Convert Set to/from Array and Object
// WHAT: How to convert between Set and Array representations?
// THEORY: Spread syntax [...set] or Array.from(set). Array to Set: new Set(array).
//         Useful for deduplication or combining Set operations with array methods.
// ─────────────────────────────────────────────
const s = new Set([1, 2, 3, 2, 1]);

const arr = [...s];                    // [1, 2, 3]
const arr2 = Array.from(s);           // [1, 2, 3]
const backToSet = new Set(arr);       // Set {1, 2, 3}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Custom Set ===");
const ms = new MySet([1, 2, 3, 2, 1]);
console.log(ms.size);       // 3
ms.add(4);
console.log(ms.has(4));     // true
ms.delete(2);
console.log(ms.size);       // 3
console.log([...ms]);       // [1, 3, 4]

console.log("\n=== Remove Duplicates ===");
console.log(removeDuplicates([1, 2, 2, 3, 3, 4]));          // [1,2,3,4]
console.log(removeDuplicatesManual([1, 2, 2, 3, 3, 4]));    // [1,2,3,4]

console.log("\n=== Unique Only ===");
console.log(uniqueOnly([1, 2, 2, 3, 4, 4, 5])); // [1, 3, 5]

console.log("\n=== Set Operations ===");
const A = new Set([1, 2, 3, 4]);
const B = new Set([3, 4, 5, 6]);
console.log([...union(A, B)]);              // [1,2,3,4,5,6]
console.log([...intersection(A, B)]);       // [3,4]
console.log([...difference(A, B)]);         // [1,2]
console.log([...symmetricDifference(A, B)]); // [1,2,5,6]
console.log(isSubset(new Set([3, 4]), A));  // true
console.log(isSubset(new Set([3, 5]), A));  // false

console.log("\n=== Find Duplicates ===");
console.log(findDuplicates([1, 2, 3, 2, 4, 3])); // [2, 3]

console.log("\n=== Longest Consecutive ===");
console.log(longestConsecutive([100, 4, 200, 1, 3, 2])); // 4
console.log(longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1])); // 9

console.log("\n=== Contains Duplicate ===");
console.log(containsDuplicate([1, 2, 3, 1])); // true
console.log(containsDuplicate([1, 2, 3, 4])); // false

console.log("\n=== Array Intersection ===");
console.log(arrayIntersection([1, 2, 2, 1], [2, 2])); // [2]
