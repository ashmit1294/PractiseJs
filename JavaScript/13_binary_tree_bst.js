/**
 * QUESTION SET: Binary Tree & Binary Search Tree (BST)
 *
 * Tree interview questions appear frequently.
 * Master traversals first — then everything else follows.
 */

// ─────────────────────────────────────────────
// TreeNode definition
// ─────────────────────────────────────────────
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

// Helper: build tree from level-order array (null = missing node)
function buildTree(arr) {
  if (!arr.length || arr[0] == null) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < arr.length) {
    const node = queue.shift();
    if (arr[i] != null) { node.left = new TreeNode(arr[i]); queue.push(node.left); }
    i++;
    if (i < arr.length && arr[i] != null) { node.right = new TreeNode(arr[i]); queue.push(node.right); }
    i++;
  }
  return root;
}

// ─────────────────────────────────────────────
// Q1. Tree Traversals (Inorder, Preorder, Postorder)
// WHAT: Traverse tree in different orders? THEORY: Inorder (left-root-right): BST gives sorted order. Preorder (root-first): useful for cloning. Postorder (children-first): useful for deletion.
// ─────────────────────────────────────────────

// Recursive
function inorder(root) {
  if (!root) return [];
  return [...inorder(root.left), root.val, ...inorder(root.right)];
}

function preorder(root) {
  if (!root) return [];
  return [root.val, ...preorder(root.left), ...preorder(root.right)];
}

function postorder(root) {
  if (!root) return [];
  return [...postorder(root.left), ...postorder(root.right), root.val];
}

// Iterative Inorder (interview prefers this)
function inorderIterative(root) {
  const result = [], stack = [];
  let curr = root;
  while (curr || stack.length) {
    while (curr) { stack.push(curr); curr = curr.left; }
    curr = stack.pop();
    result.push(curr.val);
    curr = curr.right;
  }
  return result;
}

// ─────────────────────────────────────────────
// Q2. Level Order Traversal (BFS)
// WHAT: Traverse tree level by level? THEORY: Use queue to process nodes. Track level size to group nodes by depth. Each iteration processes one level.
// ─────────────────────────────────────────────
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length) {
    const levelSize = queue.length;
    const level = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q3. Max Depth / Height of Binary Tree
// WHAT: Find maximum depth of tree? THEORY: Recursively compute max depth of left and right subtrees. Return 1 + max of both. O(n) time.
// ─────────────────────────────────────────────
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// ─────────────────────────────────────────────
// WHAT: Check if tree is height-balanced? THEORY: At each node, height difference ≤ 1. Return -1 if unbalanced. O(n) time, bottom-up approach.
// A tree is balanced if height difference of left/right ≤ 1
// ─────────────────────────────────────────────
function isBalanced(root) {
  function height(node) {
    if (!node) return 0;
    const left = height(node.left);
    if (left === -1) return -1;
    const right = height(node.right);
    if (right === -1) return -1;
    if (Math.abs(left - right) > 1) return -1;
    return 1 + Math.max(left, right);
  }
  return height(root) !== -1;
}

// ─────────────────────────────────────────────
// WHAT: Find longest path between any two nodes? THEORY: Track max diameter: left_depth + right_depth. Update max at each node. O(n) single pass.
// Longest path between any two nodes
// ─────────────────────────────────────────────
function diameterOfBinaryTree(root) {
  let maxDiam = 0;

  function depth(node) {
    if (!node) return 0;
    const left = depth(node.left);
    const right = depth(node.right);
    maxDiam = Math.max(maxDiam, left + right);
    return 1 + Math.max(left, right);
  }

  depth(root);
  return maxDiam;
}

// ─────────────────────────────────────────────
// WHAT: Find lowest common ancestor of two nodes? THEORY: If found both on opposite sides, node is LCA. Recurse left/right. Return non-null result.
// Q6. Lowest Common Ancestor (LCA)
// ─────────────────────────────────────────────
function lowestCommonAncestor(root, p, q) {
  if (!root || root === p || root === q) return root;
  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);
  if (left && right) return root; // p and q on opposite sides
  return left || right;
}

// WHAT: View tree from right side—which nodes are visible? THEORY: Level-order traversal. At each level, capture rightmost node. O(n) time.
// ─────────────────────────────────────────────
// Q7. Binary Tree Right Side View
// ─────────────────────────────────────────────
function rightSideView(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];
  while (queue.length) {
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      const node = queue.shift();
      if (i === size - 1) result.push(node.val); // last node in level
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }
  return result;
}

// WHAT: Check if tree is valid BST? THEORY: Track valid range (min, max) for each node. Left subtree must be in (min, root), right in (root, max).
// Q8. Validate Binary Search Tree
// BST property: left < root < right (all subtrees)
// ─────────────────────────────────────────────
function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}

// WHAT: Find root-to-leaf path with target sum? THEORY: DFS from root, subtract node value. At leaf, check if sum equals value. Backtrack on return.
// ─────────────────────────────────────────────
// Q9. Path Sum — check if root-to-leaf path has given sum
// ─────────────────────────────────────────────
function hasPathSum(root, targetSum) {
  if (!root) return false;
  if (!root.left && !root.right) return root.val === targetSum;
  return hasPathSum(root.left, targetSum - root.val) ||
         hasPathSum(root.right, targetSum - root.val);
}

// Q9b. All root-to-leaf paths with given sum
function pathSumAll(root, target) {
  const results = [];

  function dfs(node, remaining, path) {
    if (!node) return;
    path.push(node.val);
    if (!node.left && !node.right && remaining === node.val) {
      results.push([...path]);
    }
    dfs(node.left, remaining - node.val, path);
    dfs(node.right, remaining - node.val, path);
    path.pop(); // backtrack
  }

  dfs(root, target, []);
  return results;
}
WHAT: Convert tree to string and back? THEORY: Preorder traversal with null markers. Use counter to track position. Rebuild recursively from serialized data.
// 
// ─────────────────────────────────────────────
// Q10. Serialize and Deserialize Binary Tree
// ─────────────────────────────────────────────
function serialize(root) {
  if (!root) return "null";
  return `${root.val},${serialize(root.left)},${serialize(root.right)}`;
}

function deserialize(data) {
  const nodes = data.split(",");
  let i = 0;

  function build() {
    if (nodes[i] === "null") { i++; return null; }
    const node = new TreeNode(parseInt(nodes[i++]));
    node.left = build();
    node.right = build();
    return node;
  }

  return build();
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
//        1
//       / \
//      2   3
//     / \   \
//    4   5   6
const root = buildTree([1, 2, 3, 4, 5, null, 6]);

console.log("Inorder:     ", inorder(root));           // [4,2,5,1,3,6]
console.log("Preorder:    ", preorder(root));          // [1,2,4,5,3,6]
console.log("Postorder:   ", postorder(root));         // [4,5,2,6,3,1]
console.log("Level order: ", levelOrder(root));        // [[1],[2,3],[4,5,6]]
console.log("Max depth:   ", maxDepth(root));          // 3
console.log("Is balanced: ", isBalanced(root));        // true
console.log("Diameter:    ", diameterOfBinaryTree(root)); // 4

const bst = buildTree([5, 3, 7, 2, 4, 6, 8]);
console.log("Valid BST:   ", isValidBST(bst));         // true

console.log("Right view:  ", rightSideView(root));     // [1,3,6]

console.log("Has path 8:  ", hasPathSum(root, 8));     // true (1→3→...no), let's check: 1+2+5=8 → true
console.log("Path sum all:", pathSumAll(root, 8));     // [[1,2,5]]

const serialized = serialize(root);
const deserialized = deserialize(serialized);
console.log("Serialized:  ", serialized);
console.log("Deserialized inorder:", inorder(deserialized)); // [4,2,5,1,3,6]
