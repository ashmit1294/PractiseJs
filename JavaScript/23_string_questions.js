/**
 * QUESTION SET: String Manipulation
 *
 * Very frequent in interviews — be comfortable with:
 * - String reversal, palindromes, anagrams
 * - Parsing, pattern matching, encoding/decoding
 * - Sliding window on strings
 */

// ─────────────────────────────────────────────
// Q1. Reverse a string (4 ways)
// WHAT: How to reverse a string using different approaches?
// THEORY: split+reverse+join, reduceRight, loop backward, recursion.
// Time: O(n) all approaches  Space: O(n) new string
// ─────────────────────────────────────────────
const reverseStr = (s) => s.split("").reverse().join("");
const reverseStr2 = (s) => [...s].reduceRight((acc, ch) => acc + ch, "");
function reverseStr3(s) {
  let result = "";
  for (let i = s.length - 1; i >= 0; i--) result += s[i];
  return result;
}

// ─────────────────────────────────────────────
// Q2. Check if anagram
// WHAT: Do two strings contain same characters (just rearranged)?
// THEORY: Same length required. Count chars in first, decrement with second.
// Input: "listen", "silent" → true
// Time: O(n)  Space: O(k) where k=charset size
// ─────────────────────────────────────────────
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of t) {
    if (!count[ch]) return false;
    count[ch]--;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q3. Reverse words in a sentence
// WHAT: How to reverse word order while keeping words intact?
// THEORY: Trim, split by space, reverse array, join.
// Input: "  hello world  " → "world hello"
// Time: O(n)  Space: O(n)
// ─────────────────────────────────────────────
function reverseWords(s) {
  return s.trim().split(/\s+/).reverse().join(" ");
}

// ─────────────────────────────────────────────
// Q4. Valid palindrome (ignore non-alphanumeric, case-insensitive)
// Input: "A man, a plan, a canal: Panama" → true
// ─────────────────────────────────────────────
function isPalindromeStr(s) {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0, right = cleaned.length - 1;
  while (left < right) {
    if (cleaned[left++] !== cleaned[right--]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q5. Count and Say sequence
// "1" → "11" → "21" → "1211" → "111221"
// ─────────────────────────────────────────────
function countAndSay(n) {
  let result = "1";
  for (let i = 1; i < n; i++) {
    let next = "";
    let count = 1;
    for (let j = 1; j <= result.length; j++) {
      if (result[j] === result[j - 1]) {
        count++;
      } else {
        next += count + result[j - 1];
        count = 1;
      }
    }
    result = next;
  }
  return result;
}

// ─────────────────────────────────────────────
// Q6. Longest Common Prefix
// Input: ["flower","flow","flight"] → "fl"
// ─────────────────────────────────────────────
function longestCommonPrefix(strs) {
  if (!strs.length) return "";
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1); // shrink
      if (!prefix) return "";
    }
  }
  return prefix;
}

// ─────────────────────────────────────────────
// Q7. String compression
// "aabcccdddd" → "a2b1c3d4"
// If compressed is not smaller, return original
// ─────────────────────────────────────────────
function compressString(s) {
  let result = "";
  let count = 1;
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === s[i - 1]) {
      count++;
    } else {
      result += s[i - 1] + count;
      count = 1;
    }
  }
  return result.length < s.length ? result : s;
}

// ─────────────────────────────────────────────
// Q8. Run-Length Encoding / Decoding
// Encode: "aaabbbcc" → "3a3b2c"
// Decode: "3a3b2c" → "aaabbbcc"
// ─────────────────────────────────────────────
function encode(s) {
  return s.replace(/(.)\1*/g, (match, ch) => match.length + ch);
}

function decode(s) {
  return s.replace(/(\d+)(.)/g, (_, count, ch) => ch.repeat(Number(count)));
}

// ─────────────────────────────────────────────
// Q9. Roman to Integer
// ─────────────────────────────────────────────
function romanToInt(s) {
  const map = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const val = map[s[i]];
    const next = map[s[i + 1]];
    result += (next && val < next) ? -val : val;
  }
  return result;
}

// Q9b. Integer to Roman
function intToRoman(num) {
  const vals  = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms  = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q10. Valid Parentheses (all bracket types)
// ─────────────────────────────────────────────
function isValidBrackets(s) {
  const stack = [];
  const map = { ")": "(", "}": "{", "]": "[" };
  for (const ch of s) {
    if ("({[".includes(ch)) stack.push(ch);
    else if (stack.pop() !== map[ch]) return false;
  }
  return stack.length === 0;
}

// ─────────────────────────────────────────────
// Q11. Zigzag string
// "PAYPALISHIRING" with numRows=3 →
//   P   A   H   N
//   A P L S I I G
//   Y   I   R
// → "PAHNAPLSIIGYIR"
// ─────────────────────────────────────────────
function zigzagConvert(s, numRows) {
  if (numRows === 1 || numRows >= s.length) return s;
  const rows = Array.from({ length: numRows }, () => "");
  let row = 0, goingDown = false;

  for (const ch of s) {
    rows[row] += ch;
    if (row === 0 || row === numRows - 1) goingDown = !goingDown;
    row += goingDown ? 1 : -1;
  }
  return rows.join("");
}

// ─────────────────────────────────────────────
// Q12. Word Break — can string be segmented using dictionary words?
// Input: "leetcode", ["leet","code"] → true
// ─────────────────────────────────────────────
function wordBreak(s, wordDict) {
  const wordSet = new Set(wordDict);
  const dp = new Array(s.length + 1).fill(false);
  dp[0] = true;

  for (let i = 1; i <= s.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] && wordSet.has(s.slice(j, i))) {
        dp[i] = true;
        break;
      }
    }
  }
  return dp[s.length];
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Reverse String ===");
console.log(reverseStr("hello"));    // olleh
console.log(reverseStr3("world"));   // dlrow

console.log("\n=== Anagram ===");
console.log(isAnagram("listen", "silent")); // true
console.log(isAnagram("rat", "car"));       // false

console.log("\n=== Reverse Words ===");
console.log(reverseWords("  hello world  ")); // "world hello"

console.log("\n=== Valid Palindrome ===");
console.log(isPalindromeStr("A man, a plan, a canal: Panama")); // true
console.log(isPalindromeStr("race a car")); // false

console.log("\n=== Count and Say ===");
console.log(countAndSay(5)); // "111221"

console.log("\n=== Longest Common Prefix ===");
console.log(longestCommonPrefix(["flower","flow","flight"])); // "fl"
console.log(longestCommonPrefix(["dog","racecar","car"]));    // ""

console.log("\n=== Compress String ===");
console.log(compressString("aabcccdddd")); // "a2b1c3d4"
console.log(compressString("abc"));        // "abc" (no compression benefit)

console.log("\n=== Run-Length Encoding ===");
console.log(encode("aaabbbcc")); // "3a3b2c"
console.log(decode("3a3b2c"));   // "aaabbbcc"

console.log("\n=== Roman Numerals ===");
console.log(romanToInt("MCMXCIV")); // 1994
console.log(intToRoman(1994));      // MCMXCIV

console.log("\n=== Zigzag ===");
console.log(zigzagConvert("PAYPALISHIRING", 3)); // PAHNAPLSIIGYIR

console.log("\n=== Word Break ===");
console.log(wordBreak("leetcode", ["leet", "code"])); // true
console.log(wordBreak("catsandog", ["cats","dog","sand","and","cat"])); // false
