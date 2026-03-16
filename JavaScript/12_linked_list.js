/**
 * QUESTION SET: Linked List — all common interview questions
 *
 * A linked list is a linear data structure where each element (node)
 * points to the next. No random access — traversal is O(n).
 *
 * Singly Linked List: node → node → node → null
 * Doubly Linked List: null ← node ↔ node ↔ node → null
 */

// ─────────────────────────────────────────────
// Node & LinkedList implementation
// ─────────────────────────────────────────────
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  append(val) {
    const node = new ListNode(val);
    if (!this.head) { this.head = node; }
    else {
      let curr = this.head;
      while (curr.next) curr = curr.next;
      curr.next = node;
    }
    this.size++;
  }

  prepend(val) {
    this.head = new ListNode(val, this.head);
    this.size++;
  }

  toArray() {
    const arr = [];
    let curr = this.head;
    while (curr) { arr.push(curr.val); curr = curr.next; }
    return arr;
  }

  // Build from array (helper)
  static fromArray(arr) {
    const list = new LinkedList();
    arr.forEach((v) => list.append(v));
    return list;
  }
}

// ─────────────────────────────────────────────
// Q1. Reverse a Linked List (iterative + recursive)
// WHAT: How to reverse a linked list in-place with O(1) space?
// THEORY: Iterative: maintain prev/curr/next. Swap pointers. Recursive: after reaching end, relocate.
// Time: O(n)  Space: O(1) iterative, O(n) recursive (call stack)
// ─────────────────────────────────────────────
function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev; // new head
}

function reverseListRecursive(head) {
  if (!head || !head.next) return head;
  const newHead = reverseListRecursive(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}

// ─────────────────────────────────────────────
// Q2. Detect Cycle — Floyd's Tortoise & Hare
// WHAT: How to detect if linked list has a cycle?
// THEORY: Two pointers: slow moves 1 step, fast moves 2 steps. If meet → cycle exists. O(1) space!
// Time: O(n)  Space: O(1)
// Returns true if there's a cycle
// ─────────────────────────────────────────────
function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// Find the node where the cycle begins
function detectCycleStart(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      slow = head; // restart slow from head
      while (slow !== fast) { slow = slow.next; fast = fast.next; }
      return slow; // cycle start
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Q3. Find Middle of Linked List
// ─────────────────────────────────────────────
function findMiddle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow; // middle node
}

// ─────────────────────────────────────────────
// Q4. Merge Two Sorted Linked Lists
// ─────────────────────────────────────────────
function mergeSortedLists(l1, l2) {
  const dummy = new ListNode(0);
  let curr = dummy;

  while (l1 && l2) {
    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }
    else { curr.next = l2; l2 = l2.next; }
    curr = curr.next;
  }
  curr.next = l1 || l2; // attach remainder
  return dummy.next;
}

// ─────────────────────────────────────────────
// Q5. Remove Nth Node from End of List
// Use two-pointer technique: gap = n
// ─────────────────────────────────────────────
function removeNthFromEnd(head, n) {
  const dummy = new ListNode(0, head);
  let fast = dummy;
  let slow = dummy;

  for (let i = 0; i <= n; i++) fast = fast.next; // advance fast by n+1

  while (fast) {
    slow = slow.next;
    fast = fast.next;
  }
  slow.next = slow.next.next; // skip the nth node
  return dummy.next;
}

// ─────────────────────────────────────────────
// Q6. Check if Linked List is a Palindrome
// ─────────────────────────────────────────────
function isPalindrome(head) {
  let slow = head, fast = head;

  // Find middle
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }

  // Reverse second half
  let prev = null, curr = slow;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }

  // Compare both halves
  let left = head, right = prev;
  while (right) {
    if (left.val !== right.val) return false;
    left = left.next;
    right = right.next;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q7. Intersection of Two Linked Lists
// Return node at which the two lists intersect, or null
// ─────────────────────────────────────────────
function getIntersectionNode(headA, headB) {
  if (!headA || !headB) return null;
  let a = headA, b = headB;

  // When a reaches end, redirect to headB and vice versa
  // They'll meet at intersection after same total steps
  while (a !== b) {
    a = a ? a.next : headB;
    b = b ? b.next : headA;
  }
  return a; // null if no intersection
}

// ─────────────────────────────────────────────
// Q8. Flatten a Multilevel Doubly Linked List
// ─────────────────────────────────────────────
class DoublyNode {
  constructor(val) {
    this.val = val;
    this.prev = null;
    this.next = null;
    this.child = null;
  }
}

function flattenDoublyList(head) {
  if (!head) return null;
  const stack = [];
  let curr = head;

  while (curr) {
    if (curr.child) {
      if (curr.next) stack.push(curr.next);
      curr.next = curr.child;
      curr.child.prev = curr;
      curr.child = null;
    }
    if (!curr.next && stack.length) {
      const next = stack.pop();
      curr.next = next;
      next.prev = curr;
    }
    curr = curr.next;
  }
  return head;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
function listToArr(head) {
  const arr = [];
  while (head) { arr.push(head.val); head = head.next; }
  return arr;
}

function arrToList(arr) {
  return LinkedList.fromArray(arr).head;
}

console.log("=== Reverse List ===");
const l1 = arrToList([1, 2, 3, 4, 5]);
console.log(listToArr(reverseList(l1)));           // [5,4,3,2,1]
const l2 = arrToList([1, 2, 3, 4, 5]);
console.log(listToArr(reverseListRecursive(l2)));  // [5,4,3,2,1]

console.log("\n=== Detect Cycle ===");
const cycleList = arrToList([1, 2, 3, 4]);
cycleList.next.next.next.next = cycleList.next; // create cycle at node 2
console.log(hasCycle(cycleList)); // true
console.log(hasCycle(arrToList([1, 2, 3]))); // false

console.log("\n=== Find Middle ===");
console.log(findMiddle(arrToList([1, 2, 3, 4, 5])).val); // 3
console.log(findMiddle(arrToList([1, 2, 3, 4])).val);    // 3 (second middle)

console.log("\n=== Merge Sorted Lists ===");
const a = arrToList([1, 3, 5]);
const b = arrToList([2, 4, 6]);
console.log(listToArr(mergeSortedLists(a, b))); // [1,2,3,4,5,6]

console.log("\n=== Remove Nth from End ===");
console.log(listToArr(removeNthFromEnd(arrToList([1, 2, 3, 4, 5]), 2))); // [1,2,3,5]

console.log("\n=== Is Palindrome ===");
console.log(isPalindrome(arrToList([1, 2, 2, 1]))); // true
console.log(isPalindrome(arrToList([1, 2, 1])));    // true
console.log(isPalindrome(arrToList([1, 2, 3])));    // false
