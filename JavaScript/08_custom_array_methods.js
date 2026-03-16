/**
 * QUESTION: Implement Array.prototype.map, filter, reduce, forEach,
 *           find, findIndex, every, some, flat from scratch
 *
 * Core insight: understand the callback signature and return behavior
 * of each method.
 */

// ─────────────────────────────────────────────
// 1. myMap — transforms each element
// callback(currentValue, index, array)
// ─────────────────────────────────────────────
Array.prototype.myMap = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this) { // handle sparse arrays
      result[i] = callback.call(thisArg, this[i], i, this);
    }
  }
  return result;
};

// ─────────────────────────────────────────────
// 2. myFilter — keeps elements where callback returns true
// ─────────────────────────────────────────────
Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      result.push(this[i]);
    }
  }
  return result;
};

// ─────────────────────────────────────────────
// 3. myReduce — folds array into a single value
// callback(accumulator, currentValue, index, array)
// ─────────────────────────────────────────────
Array.prototype.myReduce = function (callback, initialValue) {
  let acc;
  let startIndex;

  if (arguments.length < 2) {
    if (this.length === 0) throw new TypeError("Reduce of empty array with no initial value");
    acc = this[0];
    startIndex = 1;
  } else {
    acc = initialValue;
    startIndex = 0;
  }

  for (let i = startIndex; i < this.length; i++) {
    if (i in this) {
      acc = callback(acc, this[i], i, this);
    }
  }
  return acc;
};

// ─────────────────────────────────────────────
// 4. myForEach — executes callback for each element (no return)
// ─────────────────────────────────────────────
Array.prototype.myForEach = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this) {
      callback.call(thisArg, this[i], i, this);
    }
  }
};

// ─────────────────────────────────────────────
// 5. myFind — returns first element where callback is true
// ─────────────────────────────────────────────
Array.prototype.myFind = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return this[i];
    }
  }
  return undefined;
};

// ─────────────────────────────────────────────
// 6. myFindIndex — returns index of first match
// ─────────────────────────────────────────────
Array.prototype.myFindIndex = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return i;
    }
  }
  return -1;
};

// ─────────────────────────────────────────────
// 7. myEvery — true if ALL elements pass the test
// ─────────────────────────────────────────────
Array.prototype.myEvery = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && !callback.call(thisArg, this[i], i, this)) {
      return false;
    }
  }
  return true;
};

// ─────────────────────────────────────────────
// 8. mySome — true if ANY element passes the test
// ─────────────────────────────────────────────
Array.prototype.mySome = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return true;
    }
  }
  return false;
};

// ─────────────────────────────────────────────
// 9. myFlat — flatten without .flat()
// ─────────────────────────────────────────────
Array.prototype.myFlat = function (depth = 1) {
  return this.myReduce((acc, val) => {
    if (Array.isArray(val) && depth > 0) {
      acc.push(...val.myFlat(depth - 1));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
};

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const nums = [1, 2, 3, 4, 5];

console.log(nums.myMap((x) => x * 2));              // [2,4,6,8,10]
console.log(nums.myFilter((x) => x % 2 === 0));     // [2,4]
console.log(nums.myReduce((acc, x) => acc + x, 0)); // 15
console.log(nums.myFind((x) => x > 3));             // 4
console.log(nums.myFindIndex((x) => x > 3));        // 3
console.log(nums.myEvery((x) => x > 0));            // true
console.log(nums.mySome((x) => x > 4));             // true
console.log([1, [2, [3, [4]]]].myFlat(2));          // [1,2,3,[4]]

nums.myForEach((x) => process.stdout.write(x + " ")); // 1 2 3 4 5
console.log();
