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
// WHAT: How to implement a stack using an array? THEORY: LIFO order. Use push/pop for O(1) operations. Track size to detect empty state.
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
// WHAT: How to implement a queue using an array? THEORY: FIFO order. Use push/shift pair but O(n) shift. enqueue/dequeue track size.
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
// WHAT: How to implement queue efficiently using two stacks? THEORY: Inbox for enqueue (O(1)). Lazy transfer to outbox on dequeue—O(1) amortized. Eliminates O(n) shift.
// enqueue: O(1)  dequeue: O(n) amortized
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
// WHAT: Check if brackets are balanced using stack? THEORY: Push open brackets, pop on close—must match. Empty stack at end = valid. O(n) time.
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
// WHAT: How to find minimum in stack while maintaining order? THEORY: Parallel minStack tracks current min at each state. Push/pop both stacks. O(1) getMin.
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
// WHAT: Decode nested string patterns with numbers and brackets? THEORY: Separate numStack and strStack. On '[' push current state. On ']' pop and repeat pattern.
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
// WHAT: Find next greater element for each array element? THEORY: Monotonic decreasing stack of indices. Pop when finding greater element. O(n) single pass.
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
claWHAT: How to implement queue with fixed capacity (reusing space)? THEORY: Fixed array with head/tail pointers. Both pointers wrap using modulo. Distinguishes full vs empty.
// ss CircularQueue {
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
