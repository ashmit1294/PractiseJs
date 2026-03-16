/**
 * QUESTION SET: Dynamic Programming (DP)
 *
 * DP = Recursion + Memoization (top-down)
 *   OR Iteration + Tabulation (bottom-up)
 *
 * Apply DP when:
 *   1. Problem has overlapping subproblems
 *   2. Problem has optimal substructure
 *
 * PATTERNS:
 *   - 1D DP: fibonacci, climbing stairs, house robber
 *   - 2D DP: grid paths, edit distance, longest common subsequence
 *   - Knapsack variants: 0/1 knapsack, unbounded, coin change
 *   - String DP: palindrome, word break
 */

// ─────────────────────────────────────────────
// Q1. Climbing Stairs
// WHAT: Count ways to climb n stairs (1 or 2 steps)? THEORY: Fibonacci pattern. At step n, get there from n-1 or n-2. dp[i] = dp[i-1] + dp[i-2]. O(n) time, O(1) space.
// ─────────────────────────────────────────────
function climbStairs(n) {
  if (n <= 2) return n;
  let prev1 = 1, prev2 = 2;
  for (let i = 3; i <= n; i++) {
    [prev1, prev2] = [prev2, prev1 + prev2];
  }
  return prev2;
}

// ─────────────────────────────────────────────
// Q2. House Robber — max sum of non-adjacent elements
// WHAT: Rob houses with max value (can't rob adjacent)? THEORY: DP decision: rob or skip. dp[i] = max(skip, rob+prev2). O(n) time, O(1) space with rolling variables.
// ─────────────────────────────────────────────
function rob(nums) {
  let prev2 = 0, prev1 = 0;
  for (const num of nums) {
    const curr = Math.max(prev1, prev2 + num);
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

// ─────────────────────────────────────────────
// Q3. Coin Change — fewest coins to make amount
// WHAT: Find minimum coins to make target amount? THEORY: DP: dp[i] = min(dp[i], 1 + dp[i-coin]) for each coin ≤ i. O(amount * coins) time/space.
// ─────────────────────────────────────────────
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i) {
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

// Q3b. Coin Change 2 — number of ways to make amount
function coinChangeWays(coins, amount) {
  const dp = new Array(amount + 1).fill(0);
  dp[0] = 1; // 1 way to make 0

  for (const coin of coins) {
    for (let i = coin; i <= amount; i++) {
      dp[i] += dp[i - coin];
    }
  }
  return dp[amount];
}

// ─────────────────────────────────────────────
// Q4. 0/1 Knapsack
// WHAT: Max value of items within capacity (each used ≤1 time)? THEORY: 2D DP: dp[i][w] = max(skip, take). For each item and weight, decide optimally. O(n*W) time/space.
// ─────────────────────────────────────────────
function knapsack01(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(
          dp[i - 1][w],                                    // skip item
          values[i - 1] + dp[i - 1][w - weights[i - 1]]   // take item
        );
      } else {
        dp[i][w] = dp[i - 1][w]; // can't take item
      }
    }
  }
  return dp[n][capacity];
}

// ─────────────────────────────────────────────
// Q5. Longest Common Subsequence (LCS)
// Input: "abcde", "ace" → Output: 3 ("ace")
// WHAT: Find longest common subsequence of two strings? THEORY: 2D DP: if chars match, dp[i][j] = 1 + dp[i-1][j-1]. Else max(dp[i-1][j], dp[i][j-1]). O(m*n).────
function lcs(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// Q6. Longest Increasing Subsequence (LIS)
// Input: [10,9,2,5,3,7,101,18] → Output: 4 ([2,3,7,101])
// WHAT: Find longest strictly increasing subsequence? THEORY: DP: dp[i] = max length ending at i. For each j < i, if nums[j] < nums[i], update dp[i]. O(n²) time.
function lengthOfLIS(nums) {
  const dp = new Array(nums.length).fill(1);
  let max = 1;

  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) {
        dp[i] = Math.max(dp[i], dp[j] + 1);
      }
    }
    max = Math.max(max, dp[i]);
  }
  return max;
}

// ─────────────────────────────────────────────
// Q7. Edit Distance (Levenshtein Distance)
// Min operations (insert, delete, replace) to convert s1 → s2
// WHAT: Min operations (insert, delete, replace) to convert string? THEORY: 2D DP: if chars match skip, else 1 + min(delete, insert, replace). O(m*n) time/space.────────────
function editDistance(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // delete
          dp[i][j - 1],     // insert
          dp[i - 1][j - 1]  // replace
        );
      }
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// Q8. Unique Paths in Grid (m × n)
// Move only right or down, how many paths from top-left to bottom-right?
// WHAT: Count paths from top-left to bottom-right (right/down only)? THEORY: dp[i][j] = dp[i-1][j] + dp[i][j-1]. Path count = sum of paths from top and left. O(m*n) time.
function uniquePaths(m, n) {
  const dp = Array.from({ length: m }, () => new Array(n).fill(1));

  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}

// ─────────────────────────────────────────────
// Q9. Longest Palindromic Substring
// Input: "babad" → Output: "bab" or "aba"
// WHAT: Find longest palindrome substring? THEORY: Expand around each center (odd/even). Track max length and start position. O(n²) time, O(1) space.
// ─────────────────────────────────────────────}
  let start = 0, maxLen = 1;

  function expand(left, right) {
    while (left >= 0 && right < s.length && s[left] === s[right]) {
      if (right - left + 1 > maxLen) {
        maxLen = right - left + 1;
        start = left;
      }
      left--;
      right++;
    }
  }

  for (let i = 0; i < s.length; i++) {
    expand(i, i);     // odd length
    expand(i, i + 1); // even length
  }
  return s.slice(start, start + maxLen);
}

// ─────────────────────────────────────────────
// Q10. Maximum Subarray — Kadane's Algorithm
// Find contiguous subarray with the maximum sum
// WHAT: Find max sum contiguous subarray? THEORY: Track current sum vs max. At each element, decide: continue or restart. O(n) time, O(1) space.
function maxSubArray(nums) {
  let maxSum = nums[0];
  let currentSum = nums[0];

  for (let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  return maxSum;
}

// Q10b. Return the actual subarray with max sum
function maxSubArrayWithIndices(nums) {
  let maxSum = nums[0], currentSum = nums[0];
  let start = 0, end = 0, tempStart = 0;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > currentSum + nums[i]) {
      currentSum = nums[i];
      tempStart = i;
    } else {
      currentSum += nums[i];
    }
    if (currentSum > maxSum) {
      maxSum = currentSum;
      start = tempStart;
      end = i;
    }
  }
  return { maxSum, subarray: nums.slice(start, end + 1) };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Climbing Stairs ===");
console.log(climbStairs(5));  // 8
console.log(climbStairs(10)); // 89

console.log("\n=== House Robber ===");
console.log(rob([1, 2, 3, 1]));     // 4
console.log(rob([2, 7, 9, 3, 1])); // 12

console.log("\n=== Coin Change ===");
console.log(coinChange([1, 5, 10, 25], 36)); // 3 (25+10+1)
console.log(coinChange([2], 3));             // -1 (impossible)
console.log(coinChangeWays([1, 2, 5], 5));  // 4 ways

console.log("\n=== 0/1 Knapsack ===");
console.log(knapsack01([2, 3, 4, 5], [3, 4, 5, 6], 5)); // 7

console.log("\n=== LCS ===");
console.log(lcs("abcde", "ace")); // 3
console.log(lcs("abc", "abc"));   // 3
console.log(lcs("abc", "def"));   // 0

console.log("\n=== LIS ===");
console.log(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18])); // 4

console.log("\n=== Edit Distance ===");
console.log(editDistance("horse", "ros"));    // 3
console.log(editDistance("intention", "execution")); // 5

console.log("\n=== Unique Paths ===");
console.log(uniquePaths(3, 7)); // 28
console.log(uniquePaths(3, 2)); // 3

console.log("\n=== Longest Palindromic Substring ===");
console.log(longestPalindrome("babad")); // bab
console.log(longestPalindrome("cbbd")); // bb

console.log("\n=== Maximum Subarray ===");
console.log(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6
console.log(maxSubArrayWithIndices([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
// { maxSum: 6, subarray: [4, -1, 2, 1] }
