/**
 * QUESTION SET: Sorting Algorithms
 *
 * ┌──────────────────┬──────────┬──────────┬────────┬─────────┐
 * │ Algorithm        │ Best     │ Average  │ Worst  │ Space   │
 * ├──────────────────┼──────────┼──────────┼────────┼─────────┤
 * │ Bubble Sort      │ O(n)     │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Selection Sort   │ O(n²)    │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Insertion Sort   │ O(n)     │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Merge Sort       │ O(nlogn) │ O(nlogn) │O(nlogn)│ O(n)    │
 * │ Quick Sort       │ O(nlogn) │ O(nlogn) │ O(n²)  │ O(logn) │
 * │ Heap Sort        │ O(nlogn) │ O(nlogn) │O(nlogn)│ O(1)    │
 * │ Counting Sort    │ O(n+k)   │ O(n+k)   │ O(n+k) │ O(k)    │
 * │ Radix Sort       │ O(nk)    │ O(nk)    │ O(nk)  │ O(n+k)  │
 * └──────────────────┴──────────┴──────────┴────────┴─────────┘
 */

// ─────────────────────────────────────────────
// Q1. Bubble Sort
// WHAT: Sort by repeatedly comparing adjacent pairs? THEORY: Stable in-place sort. Swap if out of order. Early exit if no swaps (already sorted). O(n²) worst case, O(n) best.
// ─────────────────────────────────────────────
function bubbleSort(arr) {
  const a = [...arr]; // don't mutate original
  for (let i = 0; i < a.length; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]]; // ES6 swap
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted — O(n) best case
  }
  return a;
}

// ─────────────────────────────────────────────
// Q2. Selection Sort
// WHAT: Sort by finding minimum each iteration? THEORY: Not stable in-place sort. Find min in unsorted portion, swap to front. O(n²) always.
// ─────────────────────────────────────────────
function selectionSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++) {
    let minIdx = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) [a[i], a[minIdx]] = [a[minIdx], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────
// Q3. Insertion Sort
// Build sorted portion by inserting each element in place.
// WHAT: Build sorted portion by inserting elements? THEORY: Stable in-place sort. Shift elements right, insert at correct position. Good for nearly sorted data. O(n) best, O(n²) worst.
function insertionSort(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j]; // shift right
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

// ─────────────────────────────────────────────
// Q4. Merge Sort
// Divide and conquer — split, sort, merge.
// WHAT: Divide-and-conquer sort by merging? THEORY: Stable sort, not in-place. Divide array in half, recursively sort, merge sorted halves. O(n log n) guaranteed.
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  // Append remaining elements
  return result.concat(left.slice(i)).concat(right.slice(j));
}

// ─────────────────────────────────────────────
// Q5. Quick Sort
// Pick pivot, partition, recurse on subarrays.
// Not stable | In-place (here functional version)
// WHAT: Divide-and-conquer using pivot partition? THEORY: Not stable in-place sort. Choose pivot, partition left/right, recurse. O(n log n) avg, O(n²) worst (bad pivot).
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)]; // middle element as pivot
  const left = arr.filter((x) => x < pivot);
  const middle = arr.filter((x) => x === pivot);
  const right = arr.filter((x) => x > pivot);

  return [...quickSort(left), ...middle, ...quickSort(right)];
}

// In-place Quick Sort (Lomuto partition scheme)
function quickSortInPlace(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIdx = partition(arr, low, high);
    quickSortInPlace(arr, low, pivotIdx - 1);
    quickSortInPlace(arr, pivotIdx + 1, high);
  }
  return arr;
}

function partition(arr, low, high) {
  const pivot = arr[high]; // last element as pivot
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}

// ─────────────────────────────────────────────
// Q6. Heap Sort
// Build max-heap, extract maximum repeatedly.
// Not stable | In-place | O(n log n) guaranteed
// ─────────────────────────────────────────────
funWHAT: Sort using heap data structure? THEORY: Not stable in-place sort. Build max-heap, extract maximum repeatedly. O(n log n) guaranteed.
  const n = a.length;

  // Build max-heap (heapify from bottom up)
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(a, n, i);
  }

  // Extract elements from heap one by one
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]]; // move current root (max) to end
    heapify(a, i, 0);             // restore heap for reduced size
  }
  return a;
}

function heapify(arr, n, root) {
  let largest = root;
  const left = 2 * root + 1;
  const right = 2 * root + 2;

  if (left < n && arr[left] > arr[largest]) largest = left;
  if (right < n && arr[right] > arr[largest]) largest = right;

  if (largest !== root) {
    [arr[root], arr[largest]] = [arr[largest], arr[root]];
    heapify(arr, n, largest);
  }
}

// ─────────────────────────────────────────────
// Q7. Counting Sort
// Only for non-negative integers within a known range.
// Time: O(n + k)  Space: O(k) where k = max value
// ─────────────────────────────────────────────
funWHAT: Sort non-negative integers using counts? THEORY: Iterate array storing frequency. Rebuild from counts. O(n+k) where k=max value. Not comparison-based.
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);

  for (const num of arr) count[num]++;

  const result = [];
  for (let i = 0; i <= max; i++) {
    while (count[i]-- > 0) result.push(i);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q8. Radix Sort (LSD — Least Significant Digit)
// Sort by each digit position, most performant for integers.
// Time: O(nk) where k = number of digits
// ─────────────────────────────────────────────
function radixSort(arr) {
  cWHAT: Sort integers digit by digit? THEORY: Counting sort each digit position, from LSD to MSD. O(nk) where k=digits. Non-comparison-based.

  const a = [...arr];
  while (Math.floor(max / exp) > 0) {
    countingSortByDigit(a, exp);
    exp *= 10;
  }
  return a;
}

function countingSortByDigit(arr, exp) {
  const output = new Array(arr.length).fill(0);
  const count = new Array(10).fill(0);

  for (const num of arr) count[Math.floor(num / exp) % 10]++;
  for (let i = 1; i < 10; i++) count[i] += count[i - 1]; // cumulative

  for (let i = arr.length - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i];
    count[digit]--;
  }
  for (let i = 0; i < arr.length; i++) arr[i] = output[i];
}

// ─────────────────────────────────────────────
// Q9. Sort 0s, 1s, 2s — Dutch National Flag Problem
// Sort array containing only 0, 1, 2 in O(n) one pass
// ─────────────────────────────────────────────
function sortColors(arr) {
  cWHAT: Sort array containing only 0, 1, 2 in one pass? THEORY: Three pointers: low, mid, high. Move mid, swap with low/high as needed. O(n) one-pass in-place.
  let low = 0, mid = 0, high = a.length - 1;

  while (mid <= high) {
    if (a[mid] === 0) {
      [a[low], a[mid]] = [a[mid], a[low]];
      low++; mid++;
    } else if (a[mid] === 1) {
      mid++;
    } else {
      [a[mid], a[high]] = [a[high], a[mid]];
      high--;
    }
  }
  return a;
}

// ─────────────────────────────────────────────
// Q10. Sort an array of objects by a key
// ─────────────────────────────────────────────
function sortByKey(arr, key, direction = "asc") {
  return [...arr].sort((a, b) => {
   WHAT: Sort objects by property value? THEORY: Use sort() with custom comparator. Compare properties by key, support asc/desc direction. O(n log n) time.
//  if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
    if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const arr = [64, 25, 12, 22, 11, 90, 3, 45];
const expected = [3, 11, 12, 22, 25, 45, 64, 90];

console.log("Bubble Sort:    ", bubbleSort(arr));
console.log("Selection Sort: ", selectionSort(arr));
console.log("Insertion Sort: ", insertionSort(arr));
console.log("Merge Sort:     ", mergeSort(arr));
console.log("Quick Sort:     ", quickSort(arr));
console.log("Quick Sort IP:  ", quickSortInPlace([...arr]));
console.log("Heap Sort:      ", heapSort(arr));
console.log("Counting Sort:  ", countingSort(arr));
console.log("Radix Sort:     ", radixSort(arr));

console.log("\n=== Dutch National Flag ===");
console.log(sortColors([2, 0, 2, 1, 1, 0])); // [0, 0, 1, 1, 2, 2]

console.log("\n=== Sort Objects by Key ===");
const people = [
  { name: "Charlie", age: 30 },
  { name: "Alice", age: 25 },
  { name: "Bob", age: 35 },
];
console.log(sortByKey(people, "age").map((p) => p.name)); // Alice, Charlie, Bob
console.log(sortByKey(people, "name").map((p) => p.name)); // Alice, Bob, Charlie

// Verify all sorts give same result
const allSame = [bubbleSort, selectionSort, insertionSort, mergeSort, quickSort, heapSort]
  .map((fn) => JSON.stringify(fn(arr)))
  .every((result) => result === JSON.stringify(expected));
console.log("\nAll sorts produce correct result:", allSame); // true
