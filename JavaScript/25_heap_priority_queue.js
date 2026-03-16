/**
 * QUESTION SET: Heap / Priority Queue
 *
 * A Heap is a complete binary tree satisfying:
 *   Min-Heap: parent ≤ children (root = minimum)
 *   Max-Heap: parent ≥ children (root = maximum)
 *
 * Stored as array: for node at index i:
 *   parent:       Math.floor((i - 1) / 2)
 *   left child:   2 * i + 1
 *   right child:  2 * i + 2
 *
 * Operations:
 *   insert:    O(log n)
 *   extractMin/Max: O(log n)
 *   peek:      O(1)
 *   heapify:   O(n)
 */

// ─────────────────────────────────────────────
// Q1. Min-Heap Implementation
// ─────────────────────────────────────────────
class MinHeap {
  constructor() {
    this.heap = [];
  }

  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  // Insert — add to end, bubble up
  insert(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  // Extract minimum (root) — replace with last, sift down
  extractMin() {
    if (!this.size) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return min;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent] <= this.heap[idx]) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left] < this.heap[smallest]) smallest = left;
      if (right < n && this.heap[right] < this.heap[smallest]) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// ─────────────────────────────────────────────
// Q2. Max-Heap Implementation
// ─────────────────────────────────────────────
class MaxHeap {
  constructor() { this.heap = []; }
  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  insert(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  extractMax() {
    if (!this.size) return null;
    const max = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) { this.heap[0] = last; this._siftDown(0); }
    return max;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent] >= this.heap[idx]) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let largest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left] > this.heap[largest]) largest = left;
      if (right < n && this.heap[right] > this.heap[largest]) largest = right;
      if (largest === idx) break;
      [this.heap[idx], this.heap[largest]] = [this.heap[largest], this.heap[idx]];
      idx = largest;
    }
  }
}

// ─────────────────────────────────────────────
// Q3. Priority Queue (generic comparator)
// ─────────────────────────────────────────────
class PriorityQueue {
  constructor(comparator = (a, b) => a - b) {
    this.heap = [];
    this.comparator = comparator; // negative = a has higher priority
  }

  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  enqueue(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) { this.heap[0] = last; this._siftDown(0); }
    return top;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.comparator(this.heap[parent], this.heap[idx]) <= 0) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let best = idx;
      const l = 2 * idx + 1, r = 2 * idx + 2;
      if (l < n && this.comparator(this.heap[l], this.heap[best]) < 0) best = l;
      if (r < n && this.comparator(this.heap[r], this.heap[best]) < 0) best = r;
      if (best === idx) break;
      [this.heap[idx], this.heap[best]] = [this.heap[best], this.heap[idx]];
      idx = best;
    }
  }
}

// ─────────────────────────────────────────────
// Q4. Kth Largest Element in Array
// Input: [3,2,1,5,6,4], k=2 → Output: 5
// Use Min-Heap of size k: O(n log k)
// ─────────────────────────────────────────────
function findKthLargest(nums, k) {
  const minHeap = new MinHeap();
  for (const num of nums) {
    minHeap.insert(num);
    if (minHeap.size > k) minHeap.extractMin(); // keep only k largest
  }
  return minHeap.peek(); // root is kth largest
}

// ─────────────────────────────────────────────
// Q5. Top K Frequent Elements
// Input: [1,1,1,2,2,3], k=2 → Output: [1,2]
// ─────────────────────────────────────────────
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);

  // Min-heap by frequency
  const pq = new PriorityQueue((a, b) => a[1] - b[1]);
  for (const [num, count] of freq) {
    pq.enqueue([num, count]);
    if (pq.size > k) pq.dequeue(); // remove least frequent
  }

  const result = [];
  while (pq.size) result.push(pq.dequeue()[0]);
  return result.reverse(); // most frequent first
}

// ─────────────────────────────────────────────
// Q6. Merge K Sorted Arrays using Min-Heap
// ─────────────────────────────────────────────
function mergeKSortedArrays(arrays) {
  const pq = new PriorityQueue((a, b) => a[0] - b[0]); // [value, arrayIdx, elementIdx]
  const result = [];

  // Initialize with first element of each array
  for (let i = 0; i < arrays.length; i++) {
    if (arrays[i].length > 0) {
      pq.enqueue([arrays[i][0], i, 0]);
    }
  }

  while (pq.size) {
    const [val, arrIdx, elemIdx] = pq.dequeue();
    result.push(val);
    if (elemIdx + 1 < arrays[arrIdx].length) {
      pq.enqueue([arrays[arrIdx][elemIdx + 1], arrIdx, elemIdx + 1]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q7. Find Median from Data Stream
// Use two heaps: max-heap for lower half, min-heap for upper half
// ─────────────────────────────────────────────
class MedianFinder {
  constructor() {
    this.lower = new MaxHeap(); // lower half numbers
    this.upper = new MinHeap(); // upper half numbers
  }

  addNum(num) {
    this.lower.insert(num);

    // Balance: ensure all lower values ≤ all upper values
    if (this.upper.size > 0 && this.lower.peek() > this.upper.peek()) {
      this.upper.insert(this.lower.extractMax());
    }

    // Balance sizes: lower can be at most 1 more than upper
    if (this.lower.size > this.upper.size + 1) {
      this.upper.insert(this.lower.extractMax());
    } else if (this.upper.size > this.lower.size) {
      this.lower.insert(this.upper.extractMin());
    }
  }

  findMedian() {
    if (this.lower.size > this.upper.size) return this.lower.peek();
    return (this.lower.peek() + this.upper.peek()) / 2;
  }
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Min-Heap ===");
const minH = new MinHeap();
[5, 3, 8, 1, 4, 7].forEach((n) => minH.insert(n));
console.log(minH.peek());        // 1
console.log(minH.extractMin());  // 1
console.log(minH.extractMin());  // 3
console.log(minH.extractMin());  // 4

console.log("\n=== Max-Heap ===");
const maxH = new MaxHeap();
[5, 3, 8, 1, 4, 7].forEach((n) => maxH.insert(n));
console.log(maxH.peek());        // 8
console.log(maxH.extractMax());  // 8
console.log(maxH.extractMax());  // 7

console.log("\n=== Kth Largest ===");
console.log(findKthLargest([3, 2, 1, 5, 6, 4], 2)); // 5
console.log(findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)); // 4

console.log("\n=== Top K Frequent ===");
console.log(topKFrequent([1, 1, 1, 2, 2, 3], 2)); // [1, 2]
console.log(topKFrequent([1], 1)); // [1]

console.log("\n=== Merge K Sorted Arrays ===");
console.log(mergeKSortedArrays([[1,4,7],[2,5,8],[3,6,9]])); // [1,2,3,4,5,6,7,8,9]

console.log("\n=== Median Finder ===");
const mf = new MedianFinder();
mf.addNum(1); mf.addNum(2);
console.log(mf.findMedian()); // 1.5
mf.addNum(3);
console.log(mf.findMedian()); // 2
mf.addNum(4);
console.log(mf.findMedian()); // 2.5
