/**
 * QUESTION: Flatten a nested array without using .flat() or .flatMap()
 *
 * Examples:
 *   flatten([1, [2, 3], [4, [5, 6]]]) => [1, 2, 3, 4, 5, 6]
 *   flatten([1, [2, [3, [4, [5]]]]]) => [1, 2, 3, 4, 5]
 *   flattenToDepth([1, [2, [3, [4]]]], 2) => [1, 2, 3, [4]]
 */

// ─────────────────────────────────────────────
// APPROACH 1: Recursion
// Time: O(n)  Space: O(n)
// ─────────────────────────────────────────────
function flattenRecursive(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      result = result.concat(flattenRecursive(arr[i]));
    } else {
      result.push(arr[i]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// APPROACH 2: Using reduce + recursion (elegant)
// ─────────────────────────────────────────────
function flattenReduce(arr) {
  return arr.reduce((acc, val) => {
    return Array.isArray(val)
      ? acc.concat(flattenReduce(val))
      : acc.concat(val);
  }, []);
}

// ─────────────────────────────────────────────
// APPROACH 3: Iterative with a stack (no recursion)
// ─────────────────────────────────────────────
function flattenIterative(arr) {
  const stack = [...arr];
  const result = [];

  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      stack.push(...item); // push children back onto stack
    } else {
      result.unshift(item); // maintain order by prepending
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// APPROACH 4: Flatten up to a specific depth
// ─────────────────────────────────────────────
function flattenToDepth(arr, depth = 1) {
  if (depth === 0) return arr.slice();
  return arr.reduce((acc, val) => {
    if (Array.isArray(val) && depth > 0) {
      acc.push(...flattenToDepth(val, depth - 1));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const input1 = [1, [2, 3], [4, [5, 6]]];
const input2 = [1, [2, [3, [4, [5]]]]];

console.log("Recursive:  ", flattenRecursive(input1)); // [1,2,3,4,5,6]
console.log("Reduce:     ", flattenReduce(input2));    // [1,2,3,4,5]
console.log("Iterative:  ", flattenIterative(input1)); // [1,2,3,4,5,6]
console.log("Depth 2:    ", flattenToDepth([1, [2, [3, [4]]]], 2)); // [1,2,3,[4]]
console.log("Depth 1:    ", flattenToDepth([1, [2, [3]]], 1)); // [1,2,[3]]
