/**
 * QUESTION SET: Stack and Queue
 *
 * Stack: LIFO — Last In, First Out
 * Queue: FIFO — First In, First Out
 *
 * Common interview topics:
 * - Implement stack using array / linked list
 * - Implement queue using two stacks
 * - Valid parentheses using stack
 * - Sliding window maximum using deque
 */

// ─────────────────────────────────────────────
// Q1. Implement Stack from scratch
// WHAT: How to implement LIFO (Last In, First Out) data structure?
// THEORY: Use array. push() adds to end. pop() removes from end. O(1) both operations.
// Time: O(1) push/pop/peek  Space: O(n)
// ─────────────────────────────────────────────
class Stack {
  constructor() {
    this._data = [];
    this.size = 0;
  }

  push(val) {
    this._data.push(val);
    this.size++;
  }

  pop() {
    if (this.isEmpty()) throw new Error("Stack underflow");
    this.size--;
    return this._data.pop();
  }

  peek() {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this._data[this._data.length - 1];
  }

  isEmpty() { return this.size === 0; }
  toString() { return this._data.join(" → "); }
}

// ─────────────────────────────────────────────
// Q2. Implement Queue from scratch
// WHAT: How to implement FIFO (First In, First Out) data structure?
// THEORY: Use array. push() to back for enqueue. shift() from front for dequeue.
// Time: O(1) enqueue, O(n) dequeue worst  Space: O(n)
// ─────────────────────────────────────────────
class Queue {
  constructor() {
    this._data = [];
    this.size = 0;
  }

  enqueue(val) {
    this._data.push(val);
    this.size++;
  }

  dequeue() {
    if (this.isEmpty()) throw new Error("Queue underflow");
    this.size--;
    return this._data.shift();
  }

  front() { return this._data[0]; }
  back() { return this._data[this._data.length - 1]; }
  isEmpty() { return this.size === 0; }
}

// ─────────────────────────────────────────────
// Q3. Implement Queue using Two Stacks
// WHAT: How to implement queue with optimal dequeue using two stacks?
// THEORY: inbox for enqueue (O(1)). On dequeue, flip inbox to outbox. Amortized O(1).
// Time: O(1) amortized  Space: O(n)
// ─────────────────────────────────────────────
class QueueUsingTwoStacks {
  constructor() {
    this.inbox = [];  // for enqueue
    this.outbox = []; // for dequeue
  }

  enqueue(val) {
    this.inbox.push(val);
  }

  dequeue() {
    if (this.outbox.length === 0) {
      while (this.inbox.length) {
        this.outbox.push(this.inbox.pop()); // transfer all
      }
    }
    if (this.outbox.length === 0) throw new Error("Queue is empty");
    return this.outbox.pop();
  }

  front() {
    if (this.outbox.length === 0) {
      while (this.inbox.length) this.outbox.push(this.inbox.pop());
    }
    return this.outbox[this.outbox.length - 1];
  }

  isEmpty() { return this.inbox.length === 0 && this.outbox.length === 0; }
}

// ─────────────────────────────────────────────
// Q4. Valid Parentheses — using Stack
// Given s = "({[]})", return true if balanced
// ─────────────────────────────────────────────
function isValidParentheses(s) {
  const stack = [];
  const pairs = { ")": "(", "}": "{", "]": "[" };

  for (const ch of s) {
    if ("([{".includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

// ─────────────────────────────────────────────
// Q5. Min Stack — get minimum element in O(1)
// ─────────────────────────────────────────────
class MinStack {
  constructor() {
    this.stack = [];
    this.minStack = []; // tracks current min at every state
  }

  push(val) {
    this.stack.push(val);
    const currentMin = this.minStack.length === 0
      ? val
      : Math.min(val, this.minStack[this.minStack.length - 1]);
    this.minStack.push(currentMin);
  }

  pop() {
    this.minStack.pop();
    return this.stack.pop();
  }

  top() { return this.stack[this.stack.length - 1]; }
  getMin() { return this.minStack[this.minStack.length - 1]; }
}

// ─────────────────────────────────────────────
// Q6. Decode String using Stack
// Input: "3[a2[c]]" → Output: "accaccacc"
// ─────────────────────────────────────────────
function decodeString(s) {
  const numStack = [];
  const strStack = [];
  let currentStr = "";
  let currentNum = 0;

  for (const ch of s) {
    if (!isNaN(ch)) {
      currentNum = currentNum * 10 + parseInt(ch); // handle multi-digit
    } else if (ch === "[") {
      numStack.push(currentNum);
      strStack.push(currentStr);
      currentStr = "";
      currentNum = 0;
    } else if (ch === "]") {
      const repeat = numStack.pop();
      currentStr = strStack.pop() + currentStr.repeat(repeat);
    } else {
      currentStr += ch;
    }
  }
  return currentStr;
}

// ─────────────────────────────────────────────
// Q7. Next Greater Element using Stack (monotonic stack)
// For each element, find the next greater element to its right.
// Input: [4, 5, 2, 10]  Output: [5, 10, 10, -1]
// ─────────────────────────────────────────────
function nextGreaterElement(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = []; // stores indices

  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[i] > nums[stack[stack.length - 1]]) {
      result[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q8. Circular Queue (Ring Buffer)
// ─────────────────────────────────────────────
class CircularQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.queue = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  enqueue(val) {
    if (this.isFull()) return false;
    this.queue[this.tail] = val;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  dequeue() {
    if (this.isEmpty()) return false;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return true;
  }

  front() { return this.isEmpty() ? -1 : this.queue[this.head]; }
  rear() { return this.isEmpty() ? -1 : this.queue[(this.tail - 1 + this.capacity) % this.capacity]; }
  isEmpty() { return this.size === 0; }
  isFull() { return this.size === this.capacity; }
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Stack ===");
const st = new Stack();
st.push(1); st.push(2); st.push(3);
console.log(st.peek()); // 3
console.log(st.pop());  // 3
console.log(st.size);   // 2

console.log("\n=== Queue Using Two Stacks ===");
const q2s = new QueueUsingTwoStacks();
q2s.enqueue(1); q2s.enqueue(2); q2s.enqueue(3);
console.log(q2s.dequeue()); // 1 (FIFO)
console.log(q2s.dequeue()); // 2
console.log(q2s.front());   // 3

console.log("\n=== Valid Parentheses ===");
console.log(isValidParentheses("({[]})"));  // true
console.log(isValidParentheses("({[})"));   // false
console.log(isValidParentheses("()[]{}"));  // true

console.log("\n=== Min Stack ===");
const ms = new MinStack();
ms.push(5); ms.push(3); ms.push(7); ms.push(1);
console.log(ms.getMin()); // 1
ms.pop();
console.log(ms.getMin()); // 3

console.log("\n=== Decode String ===");
console.log(decodeString("3[a]2[bc]"));  // aaabcbc
console.log(decodeString("3[a2[c]]"));   // accaccacc

console.log("\n=== Next Greater Element ===");
console.log(nextGreaterElement([4, 5, 2, 10])); // [5, 10, 10, -1]
console.log(nextGreaterElement([3, 1, 2]));      // [-1, 2, -1]

console.log("\n=== Circular Queue ===");
const cq = new CircularQueue(3);
cq.enqueue(1); cq.enqueue(2); cq.enqueue(3);
console.log(cq.isFull());   // true
cq.dequeue();
cq.enqueue(4);
console.log(cq.front());    // 2
console.log(cq.rear());     // 4
