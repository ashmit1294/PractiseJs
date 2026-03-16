/**
 * QUESTION SET: Array Manipulation — Chunk, Unique, Intersection,
 * Rotate, Shuffle, Zip, Matrix operations, Kadane's, and more.
 */

// ─────────────────────────────────────────────
// Q1. Chunk Array into groups of size n
// WHAT: Split array into subarrays of size n? THEORY: Iterate by size steps, slice chunks. Last chunk may be smaller. O(n).
// chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
// ─────────────────────────────────────────────
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─────────────────────────────────────────────
// Q2. Get unique values (deduplicate)
// WHAT: Remove duplicates from array? THEORY: Use Set (dedup) or filter with seen Set (for objects). O(n).
// ─────────────────────────────────────────────
function unique(arr) {
  return [...new Set(arr)];
}

// Unique by key (for objects)
function uniqueBy(arr, fn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = fn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// WHAT: Find common elements across multiple arrays? THEORY: convert each to Set, filter by membership. O(n*m).
// Q3. Intersection of multiple arrays
// intersection([1,2,3], [2,3,4], [2,5]) → [2]
// ─────────────────────────────────────────────
function intersection(...arrays) {
  return arrays.reduce((acc, arr) => {
    const set = new Set(arr);
    return acc.filter((item) => set.has(item));
  });
}

// ─────────────────────────────────────────────
// WHAT: Rotate array right by k positions in-place? THEORY: Reverse entire array, then reverse [0..k-1], then [k..n-1]. O(n), O(1) space.
// Q4. Rotate Array by k positions (in-place)
// Input: [1,2,3,4,5,6,7], k=3 → [5,6,7,1,2,3,4]
// ─────────────────────────────────────────────
function rotateArray(nums, k) {
  const n = nums.length;
  k = k % n; // handle k > n

  function reverse(arr, start, end) {
    while (start < end) {
      [arr[start], arr[end]] = [arr[end], arr[start]];
      start++; end--;
    }
  }

  reverse(nums, 0, n - 1);     // reverse all
  reverse(nums, 0, k - 1);     // reverse first k
  reverse(nums, k, n - 1);     // reverse rest
  return nums;
}

// WHAT: Unbiased random shuffle? THEORY: Fisher-Yates: iterate backward, swap i with random j∈[0..i]. O(n) unbiased.
// ─────────────────────────────────────────────
// Q5. Shuffle Array — Fisher-Yates Algorithm
// Unbiased O(n) shuffle
// ─────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// WHAT: Spiral matrix traversal (right→down→left→up)? THEORY: Track boundaries (top/bottom/left/right). Shrink after each edge. O(m*n).
// ─────────────────────────────────────────────
// Q6. Matrix — Spiral Order traversal
// Input: [[1,2,3],[4,5,6],[7,8,9]] → [1,2,3,6,9,8,7,4,5]
// ─────────────────────────────────────────────
function spiralOrder(matrix) {
  const result = [];
  let top = 0, bottom = matrix.length - 1;
  let left = 0, right = matrix[0].length - 1;

  while (top <= bottom && left <= right) {
    for (let i = left; i <= right; i++) result.push(matrix[top][i]);
    top++;
    for (let i = top; i <= bottom; i++) result.push(matrix[i][right]);
    right--;
    if (top <= bottom) {
      for (let i = right; i >= left; i--) result.push(matrix[bottom][i]);
      bottom--;
    }
    if (left <= right) {
      for (let i = bottom; i >= top; i--) result.push(matrix[i][left]);
      left++;
    }
  }
  return result;
}
WHAT: Rotate NxN matrix 90° clockwise in-place? THEORY: Transpose (swap [i][j]↔[j][i]), then reverse each row. O(n²) time, O(1) space.
// 
// ─────────────────────────────────────────────
// Q7. Rotate Matrix 90° clockwise (in-place)
// ─────────────────────────────────────────────
function rotateMatrix(matrix) {
  const n = matrix.length;

  // Step 1: Transpose (flip over main diagonal)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
    }
  }

  // Step 2: Reverse each row
  for (let i = 0; i < n; i++) {
    matrix[i].reverse();
  }
  return matrix;
}
WHAT: Set entire row/column to 0 if element is 0? THEORY: Track zero rows/cols in Sets, second pass sets values. O(m*n) time, O(m+n) space.
// 
// ─────────────────────────────────────────────
// Q8. Set Matrix Zeroes
// If element is 0, set its entire row and column to 0
// ─────────────────────────────────────────────
function setZeroes(matrix) {
  const m = matrix.length, n = matrix[0].length;
  const rows = new Set(), cols = new Set();

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i][j] === 0) { rows.add(i); cols.add(j); }
    }
  }
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (rows.has(i) || cols.has(j)) matrix[i][j] = 0;
    }
  }
  return matrix;
}WHAT: Product of all elements except self (no division)? THEORY: Left pass stores prefix products, right pass multiplies suffix products. O(n), O(n).
// 

// ─────────────────────────────────────────────
// Q9. Product of Array Except Self
// Input: [1,2,3,4] → [24,12,8,6]  (no division allowed)
// ─────────────────────────────────────────────
function productExceptSelf(nums) {
  const n = nums.length;
  const result = new Array(n).fill(1);

  // Left pass: result[i] = product of all elements to the LEFT of i
  let leftProduct = 1;
  for (let i = 0; i < n; i++) {
    result[i] = leftProduct;
    leftProduct *= nums[i];
  }

  // Right pass: multiply by product of all elements to the RIGHT of i
  let rightProduct = 1;
  for (let i = n - 1; i >= 0; i--) {
    result[i] *= rightProduct;
    rightProduct *= nums[i];
  }
  return result;
}WHAT: Find single duplicate in [1..n] array (n+1 elements)? THEORY: Treat as linked list (nums[i]=next). Floyd's cycle detection. O(n), O(1).
// 

// ─────────────────────────────────────────────
// Q10. Find duplicate in array [1..n] using Floyd's Cycle
// Array contains n+1 integers from 1 to n — exactly one duplicate
// ─────────────────────────────────────────────
function findDuplicate(nums) {
  // Treat array as linked list: nums[i] = next node
  let slow = nums[0];
  let fast = nums[0];

  do {
    slow = nums[slow];
    fast = nums[nums[fast]];
  } while (slow !== fast);

  slow = nums[0];
  while (slow !== fast) {
    slow = nums[slow];
    fast = nums[fast];
  }
  rWHAT: Sort array with evens before odds (maintain order)? THEORY: Two-pointer opposing ends. If odd on left/even on right, swap. O(n), O(1).
// eturn slow;
}

// ─────────────────────────────────────────────
// Q11. Sort Array by Parity (evens before odds)
// ─────────────────────────────────────────────
function sortArrayByParity(nums) {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    if (nums[left] % 2 === 1 && nums[right] % 2 === 0) {
      [nums[left], nums[right]] = [nums[right], nums[left]];
    }
    if (nums[left] % 2 === 0) left++;
    if (nums[right] % 2 === 1) right--;
  }
  rWHAT: Merge overlapping intervals? THEORY: Sort by start, iterate through tracking last end. Extend or push new interval. O(n log n).
// eturn nums;
}

// ─────────────────────────────────────────────
// Q12. Merge Intervals
// Input: [[1,3],[2,6],[8,10],[15,18]] → [[1,6],[8,10],[15,18]]
// ─────────────────────────────────────────────
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]); // extend
    } else {
      merged.push(intervals[i]);
    }
  }
  return merged;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== chunk ===");
console.log(chunk([1, 2, 3, 4, 5], 2));      // [[1,2],[3,4],[5]]

console.log("\n=== unique ===");
console.log(unique([1, 2, 2, 3, 3, 4]));     // [1,2,3,4]
console.log(uniqueBy(
  [{ id: 1, v: "a" }, { id: 1, v: "b" }, { id: 2, v: "c" }],
  (x) => x.id
)); // [{id:1,v:'a'},{id:2,v:'c'}]

console.log("\n=== intersection ===");
console.log(intersection([1, 2, 3], [2, 3, 4], [2, 5])); // [2]

console.log("\n=== rotateArray ===");
console.log(rotateArray([1, 2, 3, 4, 5, 6, 7], 3)); // [5,6,7,1,2,3,4]

console.log("\n=== spiralOrder ===");
console.log(spiralOrder([[1,2,3],[4,5,6],[7,8,9]])); // [1,2,3,6,9,8,7,4,5]

console.log("\n=== rotateMatrix ===");
const m = [[1,2,3],[4,5,6],[7,8,9]];
console.log(rotateMatrix(m)); // [[7,4,1],[8,5,2],[9,6,3]]

console.log("\n=== productExceptSelf ===");
console.log(productExceptSelf([1, 2, 3, 4])); // [24, 12, 8, 6]

console.log("\n=== findDuplicate ===");
console.log(findDuplicate([1, 3, 4, 2, 2])); // 2
console.log(findDuplicate([3, 1, 3, 4, 2])); // 3

console.log("\n=== mergeIntervals ===");
console.log(mergeIntervals([[1,3],[2,6],[8,10],[15,18]])); // [[1,6],[8,10],[15,18]]
console.log(mergeIntervals([[1,4],[4,5]]));                 // [[1,5]]

console.log("\n=== sortByParity ===");
console.log(sortArrayByParity([3, 1, 2, 4])); // evens first: [2,4,1,3] or [4,2,3,1]
