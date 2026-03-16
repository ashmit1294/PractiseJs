/**
 * QUESTION SET: Sliding Window & Two Pointer Patterns
 *
 * These are the most commonly asked array/string patterns in interviews.
 *
 * SLIDING WINDOW:
 *   - Fixed size window: sum/avg of every k elements
 *   - Variable size window: longest/shortest subarray meeting condition
 *   Time: O(n) instead of O(n²) brute force
 *
 * TWO POINTERS:
 *   - Opposite ends: sorted array problems, two sum, palindrome
 *   - Same direction (fast/slow): remove duplicates, cycle detection
 */

// ─────────────────────────────────────────────
// SLIDING WINDOW
// ─────────────────────────────────────────────

// Q1. Maximum Sum Subarray of Size K (Fixed Window)
// WHAT: What's maximum sum of any contiguous subarray of size k?
// THEORY: Maintain window of k elements. Slide by removing left, adding right. O(n) not O(n*k)!
// Input: [2,1,5,1,3,2], k=3 → Output: 9 (5+1+3)
// Time: O(n)  Space: O(1)
function maxSumSubarrayK(arr, k) {
  let windowSum = 0;
  let maxSum = 0;

  for (let i = 0; i < k; i++) windowSum += arr[i]; // initial window
  maxSum = windowSum;

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // slide: add new, remove old
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

// Q2. Average of all subarrays of size K
// WHAT: What's average of every k-length subarray?
// THEORY: Same sliding window. Divide by k to get average.
// Time: O(n)  Space: O(k) output
function avgSubarraysK(arr, k) {
  const result = [];
  let windowSum = 0;

  for (let i = 0; i < k; i++) windowSum += arr[i];
  result.push(windowSum / k);

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    result.push(windowSum / k);
  }
  return result;
}

// Q3. Longest Substring Without Repeating Characters (Variable Window)
// WHAT: What's longest substring with all unique characters?
// THEORY: Expand right, track seen chars. When duplicate found, shrink left.
// Input: "abcabcbb" → Output: 3 ("abc")
// Time: O(n)  Space: O(min(n, charset size))
function lengthOfLongestSubstring(s) {
  const seen = new Map(); // char → last seen index
  let maxLen = 0;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    if (seen.has(s[right]) && seen.get(s[right]) >= left) {
      left = seen.get(s[right]) + 1; // shrink window
    }
    seen.set(s[right], right);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

// Q4. Longest Substring with At Most K Distinct Characters
// WHAT: What's longest substring with at most k unique characters?
// THEORY: Expand right, track frequency. When >k distinct, shrink left.
// Time: O(n)  Space: O(min(n, k))
function lengthWithKDistinct(s, k) {
  const freq = new Map();
  let left = 0, maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    freq.set(s[right], (freq.get(s[right]) || 0) + 1);

    while (freq.size > k) {
      const ch = s[left++];
      freq.set(ch, freq.get(ch) - 1);
      if (freq.get(ch) === 0) freq.delete(ch);
    }
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

// Q5. Minimum Window Substring containing all chars of t
// Input: s="ADOBECODEBANC", t="ABC" → Output: "BANC"
function minWindow(s, t) {
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  let left = 0, formed = 0, required = need.size;
  let minLen = Infinity, minStart = 0;
  const window = new Map();

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    window.set(ch, (window.get(ch) || 0) + 1);

    if (need.has(ch) && window.get(ch) === need.get(ch)) formed++;

    while (formed === required) {
      if (right - left + 1 < minLen) {
        minLen = right - left + 1;
        minStart = left;
      }
      const leftCh = s[left++];
      window.set(leftCh, window.get(leftCh) - 1);
      if (need.has(leftCh) && window.get(leftCh) < need.get(leftCh)) formed--;
    }
  }
  return minLen === Infinity ? "" : s.slice(minStart, minStart + minLen);
}

// Q6. Permutation in String
// Check if any permutation of p exists as substring in s
function checkInclusion(s1, s2) {
  if (s1.length > s2.length) return false;
  const count = new Array(26).fill(0);
  const a = "a".charCodeAt(0);

  for (let i = 0; i < s1.length; i++) {
    count[s1.charCodeAt(i) - a]++;
    count[s2.charCodeAt(i) - a]--;
  }
  if (count.every((c) => c === 0)) return true;

  for (let i = s1.length; i < s2.length; i++) {
    count[s2.charCodeAt(i) - a]--;
    count[s2.charCodeAt(i - s1.length) - a]++;
    if (count.every((c) => c === 0)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// TWO POINTERS
// ─────────────────────────────────────────────

// Q7. Two Sum II — sorted array, return 1-indexed pair
function twoSumSorted(numbers, target) {
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++;
    else right--;
  }
  return [];
}

// Q8. Three Sum — all unique triplets that sum to 0
// Input: [-1,0,1,2,-1,-4] → [[-1,-1,2],[-1,0,1]]
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // skip duplicates
    let left = i + 1, right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++; right--;
      } else if (sum < 0) {
        left++;
      } else {
        right--;
      }
    }
  }
  return result;
}

// Q9. Container With Most Water
// Find two lines that form a container holding the most water
function maxWaterContainer(height) {
  let left = 0, right = height.length - 1;
  let maxArea = 0;

  while (left < right) {
    const area = Math.min(height[left], height[right]) * (right - left);
    maxArea = Math.max(maxArea, area);
    if (height[left] < height[right]) left++;
    else right--;
  }
  return maxArea;
}

// Q10. Trapping Rain Water
// Input: [0,1,0,2,1,0,1,3,2,1,2,1] → Output: 6
function trap(height) {
  let left = 0, right = height.length - 1;
  let leftMax = 0, rightMax = 0;
  let water = 0;

  while (left < right) {
    if (height[left] < height[right]) {
      if (height[left] >= leftMax) leftMax = height[left];
      else water += leftMax - height[left];
      left++;
    } else {
      if (height[right] >= rightMax) rightMax = height[right];
      else water += rightMax - height[right];
      right--;
    }
  }
  return water;
}

// Q11. Remove Duplicates from Sorted Array (in-place)
// Return length of array with unique elements
function removeDuplicatesSorted(nums) {
  if (!nums.length) return 0;
  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      slow++;
      nums[slow] = nums[fast];
    }
  }
  return slow + 1;
}

// Q12. Move Zeros to End (in-place, maintain order)
function moveZeroes(nums) {
  let slow = 0;
  for (let fast = 0; fast < nums.length; fast++) {
    if (nums[fast] !== 0) {
      nums[slow++] = nums[fast];
    }
  }
  while (slow < nums.length) nums[slow++] = 0;
  return nums;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Max Sum Subarray K ===");
console.log(maxSumSubarrayK([2, 1, 5, 1, 3, 2], 3)); // 9

console.log("\n=== Longest Substring No Repeat ===");
console.log(lengthOfLongestSubstring("abcabcbb")); // 3
console.log(lengthOfLongestSubstring("pwwkew"));   // 3
console.log(lengthOfLongestSubstring("bbbbb"));    // 1

console.log("\n=== K Distinct Characters ===");
console.log(lengthWithKDistinct("araaci", 2)); // 4 ("araa")

console.log("\n=== Minimum Window Substring ===");
console.log(minWindow("ADOBECODEBANC", "ABC")); // BANC
console.log(minWindow("a", "a"));               // a

console.log("\n=== Permutation in String ===");
console.log(checkInclusion("ab", "eidbaooo")); // true
console.log(checkInclusion("ab", "eidboaoo")); // false

console.log("\n=== Two Sum Sorted ===");
console.log(twoSumSorted([2, 7, 11, 15], 9)); // [1, 2]

console.log("\n=== Three Sum ===");
console.log(threeSum([-1, 0, 1, 2, -1, -4])); // [[-1,-1,2],[-1,0,1]]

console.log("\n=== Container With Most Water ===");
console.log(maxWaterContainer([1, 8, 6, 2, 5, 4, 8, 3, 7])); // 49

console.log("\n=== Trapping Rain Water ===");
console.log(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1])); // 6

console.log("\n=== Remove Duplicates (Sorted) ===");
const arr = [1, 1, 2, 3, 3, 4];
const len = removeDuplicatesSorted(arr);
console.log(arr.slice(0, len)); // [1, 2, 3, 4]

console.log("\n=== Move Zeros ===");
console.log(moveZeroes([0, 1, 0, 3, 12])); // [1, 3, 12, 0, 0]
