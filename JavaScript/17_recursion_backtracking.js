/**
 * QUESTION SET: Recursion Patterns
 *
 * Recursion = a function that calls itself.
 * Every recursive solution needs:
 *   1. Base case  — stop condition
 *   2. Recursive case — problem reduced toward base case
 *
 * PATTERNS:
 *   - Linear recursion       (factorial, fibonacci)
 *   - Binary recursion       (merge sort, tree traversal)
 *   - Tail recursion         (optimized — TCO)
 *   - Mutual recursion       (isEven/isOdd)
 *   - Backtracking           (permutations, subsets, maze)
 *   - Divide & Conquer       (binary search, quick sort)
 *   - Tree recursion         (DFS, path sum)
 */

// ─────────────────────────────────────────────
// Q1. Factorial — n! = n * (n-1)!
// WHAT: How to calculate n! (product of all positive integers up to n)?
// THEORY: Base case: n≤1 → 1. Recursive: n * factorial(n-1). Tail version uses accumulator.
// Time: O(n)  Space: O(n) call stack
// ─────────────────────────────────────────────
function factorial(n) {
  if (n <= 1) return 1;                          // base case
  return n * factorial(n - 1);                   // recursive case
}

// Tail-recursive version (can be optimised by JS engine)
function factorialTail(n, acc = 1) {
  if (n <= 1) return acc;
  return factorialTail(n - 1, n * acc);          // accumulator carries result
}

// ─────────────────────────────────────────────
// Q2. Fibonacci — fib(n) = fib(n-1) + fib(n-2)
// WHAT: How to compute nth Fibonacci number efficiently?
// THEORY: Naive: O(2^n) exponential. Memoization: O(n) linear. DP bottom-up: O(n).
// Time: O(2^n) naive, O(n) memo/DP  Space: O(n) memo/stack
// ─────────────────────────────────────────────

// Naive: O(2^n)
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// With memoization: O(n)
function fibMemo(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n];
}

// Bottom-up DP: O(n) time, O(1) space
function fibDP(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

// ─────────────────────────────────────────────
// Q3. Power — x^n (fast exponentiation)
// Simple: O(n)  |  Fast power: O(log n)
// ─────────────────────────────────────────────
function power(x, n) {
  if (n === 0) return 1;
  if (n < 0) return 1 / power(x, -n);      // handle negatives
  if (n % 2 === 0) {
    const half = power(x, n / 2);
    return half * half;                      // x^n = (x^n/2)^2
  }
  return x * power(x, n - 1);
}

// ─────────────────────────────────────────────
// Q4. Sum of digits   1234 → 10
// ─────────────────────────────────────────────
function sumDigits(n) {
  n = Math.abs(n);
  if (n < 10) return n;
  return (n % 10) + sumDigits(Math.floor(n / 10));
}

// ─────────────────────────────────────────────
// Q5. Reverse a string recursively
// ─────────────────────────────────────────────
function reverseString(str) {
  if (str.length <= 1) return str;
  return reverseString(str.slice(1)) + str[0];
}

// ─────────────────────────────────────────────
// Q6. Check palindrome recursively
// ─────────────────────────────────────────────
function isPalindrome(str) {
  if (str.length <= 1) return true;
  if (str[0] !== str[str.length - 1]) return false;
  return isPalindrome(str.slice(1, -1));
}

// ─────────────────────────────────────────────
// Q7. Flatten nested array recursively (no .flat)
// ─────────────────────────────────────────────
function flatten(arr) {
  return arr.reduce((acc, val) =>
    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
}

// ─────────────────────────────────────────────
// Q8. All Permutations of a string/array
// Input: "abc" → ["abc","acb","bac","bca","cab","cba"]
// ─────────────────────────────────────────────
function permutations(str) {
  if (str.length <= 1) return [str];
  const result = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    for (const perm of permutations(remaining)) {
      result.push(char + perm);
    }
  }
  return result;
}

// Array permutations (backtracking)
function permuteArray(nums) {
  const result = [];

  function backtrack(start) {
    if (start === nums.length) { result.push([...nums]); return; }
    for (let i = start; i < nums.length; i++) {
      [nums[start], nums[i]] = [nums[i], nums[start]]; // swap
      backtrack(start + 1);
      [nums[start], nums[i]] = [nums[i], nums[start]]; // swap back
    }
  }

  backtrack(0);
  return result;
}

// ─────────────────────────────────────────────
// Q9. All Subsets (Power Set)
// Input: [1,2,3] → [[], [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3]]
// 2^n subsets total
// ─────────────────────────────────────────────
function subsets(nums) {
  const result = [];

  function backtrack(start, current) {
    result.push([...current]);
    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop(); // backtrack
    }
  }

  backtrack(0, []);
  return result;
}

// ─────────────────────────────────────────────
// Q10. Generate All Valid Parentheses
// Input: n=2 → ["(())", "()()"]
// ─────────────────────────────────────────────
function generateParentheses(n) {
  const result = [];

  function backtrack(current, open, close) {
    if (current.length === 2 * n) { result.push(current); return; }
    if (open < n) backtrack(current + "(", open + 1, close);
    if (close < open) backtrack(current + ")", open, close + 1);
  }

  backtrack("", 0, 0);
  return result;
}

// ─────────────────────────────────────────────
// Q11. Tower of Hanoi
// Move n disks from source to target using auxiliary
// Time: O(2^n)
// ─────────────────────────────────────────────
function hanoi(n, from = "A", to = "C", aux = "B") {
  if (n === 0) return;
  hanoi(n - 1, from, aux, to); // move n-1 disks out of the way
  console.log(`Move disk ${n}: ${from} → ${to}`);
  hanoi(n - 1, aux, to, from); // move n-1 disks to target
}

// ─────────────────────────────────────────────
// Q12. Combination Sum
// Find all combinations that sum to target (can reuse elements)
// Input: candidates=[2,3,6,7], target=7 → [[2,2,3],[7]]
// ─────────────────────────────────────────────
function combinationSum(candidates, target) {
  const result = [];

  function backtrack(start, remaining, path) {
    if (remaining === 0) { result.push([...path]); return; }
    if (remaining < 0) return;

    for (let i = start; i < candidates.length; i++) {
      path.push(candidates[i]);
      backtrack(i, remaining - candidates[i], path); // allow reuse: pass i not i+1
      path.pop();
    }
  }

  backtrack(0, target, []);
  return result;
}

// ─────────────────────────────────────────────
// Q13. Word Search in Grid (recursive DFS + backtracking)
// ─────────────────────────────────────────────
function exist(board, word) {
  const rows = board.length;
  const cols = board[0].length;

  function dfs(r, c, idx) {
    if (idx === word.length) return true;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (board[r][c] !== word[idx]) return false;

    const temp = board[r][c];
    board[r][c] = "#"; // mark as visited

    const found =
      dfs(r + 1, c, idx + 1) ||
      dfs(r - 1, c, idx + 1) ||
      dfs(r, c + 1, idx + 1) ||
      dfs(r, c - 1, idx + 1);

    board[r][c] = temp; // restore
    return found;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dfs(r, c, 0)) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// Q14. N-Queens Problem
// Place N queens on NxN board so no two attack each other
// ─────────────────────────────────────────────
function solveNQueens(n) {
  const result = [];
  const board = Array.from({ length: n }, () => ".".repeat(n).split(""));

  function isSafe(row, col) {
    for (let i = 0; i < row; i++) {
      if (board[i][col] === "Q") return false;
      if (col - (row - i) >= 0 && board[i][col - (row - i)] === "Q") return false;
      if (col + (row - i) < n && board[i][col + (row - i)] === "Q") return false;
    }
    return true;
  }

  function backtrack(row) {
    if (row === n) {
      result.push(board.map((r) => r.join("")));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (isSafe(row, col)) {
        board[row][col] = "Q";
        backtrack(row + 1);
        board[row][col] = "."; // backtrack
      }
    }
  }

  backtrack(0);
  return result;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Factorial ===");
console.log(factorial(5));      // 120
console.log(factorialTail(5));  // 120

console.log("\n=== Fibonacci ===");
console.log(fibNaive(10));  // 55
console.log(fibMemo(50));   // 12586269025
console.log(fibDP(50));     // 12586269025

console.log("\n=== Power ===");
console.log(power(2, 10));   // 1024
console.log(power(2, -2));   // 0.25
console.log(power(3, 0));    // 1

console.log("\n=== Sum Digits ===");
console.log(sumDigits(1234)); // 10

console.log("\n=== Reverse String ===");
console.log(reverseString("hello")); // olleh

console.log("\n=== Is Palindrome ===");
console.log(isPalindrome("racecar")); // true
console.log(isPalindrome("hello"));   // false

console.log("\n=== Flatten ===");
console.log(flatten([1, [2, [3, [4]]]])); // [1,2,3,4]

console.log("\n=== Permutations ===");
console.log(permutations("abc")); // 6 permutations

console.log("\n=== Subsets ===");
console.log(subsets([1, 2, 3])); // 8 subsets

console.log("\n=== Generate Parentheses ===");
console.log(generateParentheses(3)); // ["((()))","(()())","(())()","()(())","()()()"]

console.log("\n=== Tower of Hanoi (n=3) ===");
hanoi(3); // 7 moves

console.log("\n=== Combination Sum ===");
console.log(combinationSum([2, 3, 6, 7], 7)); // [[2,2,3],[7]]

console.log("\n=== Word Search ===");
const grid = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]];
console.log(exist(grid, "ABCCED")); // true
console.log(exist(grid, "SEE"));    // true
console.log(exist(grid, "ABCB"));   // false

console.log("\n=== N-Queens (n=4) ===");
console.log(solveNQueens(4).length); // 2 solutions
solveNQueens(4).forEach((sol) => { console.log(sol); console.log("---"); });
