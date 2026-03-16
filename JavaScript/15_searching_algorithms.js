/**
 * QUESTION SET: Searching Algorithms
 *
 * Linear Search  → O(n)
 * Binary Search  → O(log n) — requires sorted array
 * Jump Search    → O(√n)
 * Interpolation  → O(log log n) avg — for uniformly distributed data
 * Exponential    → O(log n) — useful for unbounded/infinite arrays
 */

// ─────────────────────────────────────────────
// Q1. Linear Search
// Find the index of target in array (unsorted allowed)
// Time: O(n)  Space: O(1)
// ─────────────────────────────────────────────
function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q2. Binary Search (Iterative)
// Array MUST be sorted.
// Time: O(log n)  Space: O(1)
// ─────────────────────────────────────────────
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2); // avoids integer overflow
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q3. Binary Search (Recursive)
// ─────────────────────────────────────────────
function binarySearchRecursive(arr, target, left = 0, right = arr.length - 1) {
  if (left > right) return -1;
  const mid = left + Math.floor((right - left) / 2);
  if (arr[mid] === target) return mid;
  if (arr[mid] < target) return binarySearchRecursive(arr, target, mid + 1, right);
  return binarySearchRecursive(arr, target, left, mid - 1);
}

// ─────────────────────────────────────────────
// Q4. Find First and Last Position of Target (Binary Search variant)
// Input: sorted array with duplicates, e.g. [5,7,7,8,8,10], target=8
// Output: [3, 4]
// ─────────────────────────────────────────────
function searchRange(arr, target) {
  function findBound(isFirst) {
    let left = 0, right = arr.length - 1, bound = -1;
    while (left <= right) {
      const mid = left + Math.floor((right - left) / 2);
      if (arr[mid] === target) {
        bound = mid;
        if (isFirst) right = mid - 1; // keep searching left
        else left = mid + 1;          // keep searching right
      } else if (arr[mid] < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return bound;
  }
  return [findBound(true), findBound(false)];
}

// ─────────────────────────────────────────────
// Q5. Search in Rotated Sorted Array
// Array was sorted then rotated at some pivot.
// Input: [4,5,6,7,0,1,2], target=0 → Output: 4
// ─────────────────────────────────────────────
function searchRotated(arr, target) {
  let left = 0, right = arr.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) return mid;

    // Left half is sorted
    if (arr[left] <= arr[mid]) {
      if (target >= arr[left] && target < arr[mid]) right = mid - 1;
      else left = mid + 1;
    } else {
      // Right half is sorted
      if (target > arr[mid] && target <= arr[right]) left = mid + 1;
      else right = mid - 1;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q6. Find Minimum in Rotated Sorted Array
// ─────────────────────────────────────────────
function findMinRotated(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] > arr[right]) left = mid + 1; // min is in right half
    else right = mid;                           // min is in left half (including mid)
  }
  return arr[left];
}

// ─────────────────────────────────────────────
// Q7. Jump Search
// Best for sorted arrays on media where backtracking is costly.
// Time: O(√n)  Space: O(1)
// ─────────────────────────────────────────────
function jumpSearch(arr, target) {
  const n = arr.length;
  let step = Math.floor(Math.sqrt(n));
  let prev = 0;

  while (step < n && arr[step] < target) {
    prev = step;
    step += Math.floor(Math.sqrt(n));
    if (prev >= n) return -1;
  }

  for (let i = prev; i <= Math.min(step, n - 1); i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q8. Interpolation Search
// Like binary search but estimates position based on value.
// Best for uniformly distributed sorted arrays.
// Time: O(log log n) avg, O(n) worst
// ─────────────────────────────────────────────
function interpolationSearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high && target >= arr[low] && target <= arr[high]) {
    if (low === high) return arr[low] === target ? low : -1;

    // Estimate position by interpolation formula
    const pos = low + Math.floor(
      ((target - arr[low]) / (arr[high] - arr[low])) * (high - low)
    );

    if (arr[pos] === target) return pos;
    if (arr[pos] < target) low = pos + 1;
    else high = pos - 1;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q9. Exponential Search
// Useful for unbounded/infinite sorted arrays.
// Find range first, then binary search within.
// Time: O(log n)  Space: O(log n) recursive
// ─────────────────────────────────────────────
function exponentialSearch(arr, target) {
  if (arr[0] === target) return 0;

  let i = 1;
  while (i < arr.length && arr[i] <= target) i *= 2; // double each time

  // Binary search in range [i/2, min(i, n-1)]
  return binarySearch(arr.slice(Math.floor(i / 2), Math.min(i + 1, arr.length)), target) + Math.floor(i / 2);
}

// ─────────────────────────────────────────────
// Q10. Find Peak Element (Binary Search variant)
// A peak is any element greater than its neighbors.
// Input: [1,2,3,1] → Output: 2 (index of element 3)
// ─────────────────────────────────────────────
function findPeakElement(nums) {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] > nums[mid + 1]) right = mid; // peak is on left side
    else left = mid + 1;                        // peak is on right side
  }
  return left; // index of peak
}

// ─────────────────────────────────────────────
// Q11. Count occurrences of target in sorted array
// ─────────────────────────────────────────────
function countOccurrences(arr, target) {
  const range = searchRange(arr, target);
  if (range[0] === -1) return 0;
  return range[1] - range[0] + 1;
}

// ─────────────────────────────────────────────
// Q12. Sqrt(x) — integer square root using binary search
// Input: 8 → Output: 2 (floor of √8 = 2.82...)
// ─────────────────────────────────────────────
function mySqrt(x) {
  if (x < 2) return x;
  let left = 1, right = Math.floor(x / 2);
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (mid * mid === x) return mid;
    if (mid * mid < x) left = mid + 1;
    else right = mid - 1;
  }
  return right; // floor value
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const sorted = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

console.log("=== Linear Search ===");
console.log(linearSearch(sorted, 7));   // 3
console.log(linearSearch(sorted, 10));  // -1

console.log("\n=== Binary Search (Iterative) ===");
console.log(binarySearch(sorted, 7));   // 3
console.log(binarySearch(sorted, 19));  // 9
console.log(binarySearch(sorted, 10));  // -1

console.log("\n=== Binary Search (Recursive) ===");
console.log(binarySearchRecursive(sorted, 13)); // 6

console.log("\n=== Search Range (First & Last) ===");
console.log(searchRange([5, 7, 7, 8, 8, 10], 8));  // [3, 4]
console.log(searchRange([5, 7, 7, 8, 8, 10], 6));  // [-1, -1]

console.log("\n=== Search in Rotated Array ===");
console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 0)); // 4
console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 3)); // -1
console.log(searchRotated([1], 0));                    // -1

console.log("\n=== Find Min in Rotated Array ===");
console.log(findMinRotated([3, 4, 5, 1, 2])); // 1
console.log(findMinRotated([4, 5, 6, 7, 0, 1, 2])); // 0

console.log("\n=== Jump Search ===");
console.log(jumpSearch(sorted, 11)); // 5

console.log("\n=== Interpolation Search ===");
console.log(interpolationSearch(sorted, 7));  // 3
console.log(interpolationSearch(sorted, 10)); // -1

console.log("\n=== Find Peak Element ===");
console.log(findPeakElement([1, 2, 3, 1]));    // 2
console.log(findPeakElement([1, 2, 1, 3, 5, 6, 4])); // 5

console.log("\n=== Count Occurrences ===");
console.log(countOccurrences([1, 2, 2, 2, 3, 4], 2)); // 3

console.log("\n=== Integer Sqrt ===");
console.log(mySqrt(4));  // 2
console.log(mySqrt(8));  // 2
console.log(mySqrt(9));  // 3
