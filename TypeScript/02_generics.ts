/**
 * QUESTION SET: TypeScript Generics
 *
 * 1. Generic functions
 * 2. Generic interfaces and classes
 * 3. Constraints (extends)
 * 4. Default type parameters
 * 5. Conditional types with generics
 * 6. Variadic tuple generics
 * 7. Generic utility patterns
 */

// ─────────────────────────────────────────────
// Q1. Generic functions
// ─────────────────────────────────────────────

// Identity — simplest generic function
function identity<T>(value: T): T {
  return value;
}
identity<string>("hello"); // explicit
identity(42);              // inferred T = number

// First/last element (type safety over any[])
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

// Pair builder
function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return a.map((item, i) => [item, b[i]]);
}
const pairs = zip([1, 2, 3], ["a", "b", "c"]); // [number, string][]

// Safer Object.keys with type inference
function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

// Pipe — compose functions generically (left to right)
function pipe<A>(value: A): A;
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe(value: any, ...fns: Function[]): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// ─────────────────────────────────────────────
// Q2. Generic interfaces and classes
// ─────────────────────────────────────────────

// Generic interface
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

interface User { id: string; name: string; email: string; }

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> { return null; }
  async findAll(filter?: Partial<User>): Promise<User[]> { return []; }
  async create(data: Omit<User, "id">): Promise<User> { return { id: "1", ...data }; }
  async update(id: string, data: Partial<User>): Promise<User> { return { id, name: "", email: "", ...data }; }
  async delete(id: string): Promise<void> {}
}

// Generic class — type-safe stack
class Stack<T> {
  private items: T[] = [];

  push(item: T): this {
    this.items.push(item);
    return this; // chaining
  }

  pop(): T {
    if (this.isEmpty()) throw new Error("Stack underflow");
    return this.items.pop()!;
  }

  peek(): T {
    if (this.isEmpty()) throw new Error("Empty stack");
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean { return this.items.length === 0; }
  size(): number { return this.items.length; }
  toArray(): T[] { return [...this.items]; }
}

const numStack = new Stack<number>();
numStack.push(1).push(2).push(3);
const top = numStack.pop(); // number

// Generic Result / Option types
type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function succeed<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─────────────────────────────────────────────
// Q3. Constraints with extends
// ─────────────────────────────────────────────

// Constrain T to have a length property
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
longest("hello", "world");  // string
longest([1, 2], [3]);       // number[]

// Constrain to object keys
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user: User = { id: "1", name: "Alice", email: "alice@example.com" };
const name = getProperty(user, "name"); // string — inferred precisely

// Merge two objects (shallow)
function merge<T extends object, U extends object>(target: T, source: U): T & U {
  return { ...target, ...source };
}

// Constrain T to be a constructor
type Constructor<T = object> = new (...args: any[]) => T;

function withTimestamp<T extends Constructor>(Base: T) {
  return class extends Base {
    createdAt = new Date();
    updatedAt = new Date();
  };
}

// ─────────────────────────────────────────────
// Q4. Default type parameters
// ─────────────────────────────────────────────

// Default type makes the second parameter optional
interface ApiResponse<T, M = Record<string, never>> {
  data: T;
  meta: M;
  status: number;
}

type SimpleResponse<T> = ApiResponse<T>; // M defaults to empty object

interface PaginatedMeta {
  page: number;
  total: number;
  hasNext: boolean;
}
type PaginatedResponse<T> = ApiResponse<T, PaginatedMeta>;

// ─────────────────────────────────────────────
// Q5. Conditional types with generics
// ─────────────────────────────────────────────

// IsArray<T>: resolves to true if T is an array
type IsArray<T> = T extends any[] ? true : false;
type A = IsArray<string[]>; // true
type B = IsArray<string>;   // false

// Unwrap array element type
type ElementOf<T> = T extends (infer E)[] ? E : never;
type Num = ElementOf<number[]>; // number

// Unwrap Promise
type Awaited_<T> = T extends Promise<infer R> ? Awaited_<R> : T;
type Str = Awaited_<Promise<Promise<string>>>; // string

// Flatten function return type
type ReturnValue<T> = T extends (...args: any[]) => infer R ? R : never;
type AsyncReturn<T> = T extends (...args: any[]) => Promise<infer R> ? R : never;

// NonNullable — built-in but illustration of the pattern
type NonNullable_<T> = T extends null | undefined ? never : T;

// Distributive conditional types
type ToArray<T> = T extends any ? T[] : never;
type StrOrNumArray = ToArray<string | number>; // string[] | number[]  (distributes over union)

// Non-distributive (wrap in tuple to prevent distribution)
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type Mixed = ToArrayNonDist<string | number>; // (string | number)[]

// ─────────────────────────────────────────────
// Q6. Variadic tuple generics (TypeScript 4.0+)
// ─────────────────────────────────────────────

// Concat two tuples
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];
type AB = Concat<[1, 2], [3, 4]>; // [1, 2, 3, 4]

// Prepend element to tuple
type Prepend<T, Tuple extends unknown[]> = [T, ...Tuple];
type Head<T extends unknown[]> = T extends [infer H, ...unknown[]] ? H : never;
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

type H = Head<[string, number, boolean]>; // string
type Ta = Tail<[string, number, boolean]>; // [number, boolean]

// ─────────────────────────────────────────────
// Q7. Generic utility patterns
// ─────────────────────────────────────────────

// Memoize — preserves argument and return types
function memoize<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const fibonacci = memoize(function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

// Promisify — converts callback-style function to Promise
type Callback<T> = (err: Error | null, result: T) => void;
type NodeCallback<T> = (...args: [...any[], Callback<T>]) => void;

function promisify<T>(fn: NodeCallback<T>): (...args: any[]) => Promise<T> {
  return (...args: any[]): Promise<T> =>
    new Promise((resolve, reject) =>
      fn(...args, (err, result) => (err ? reject(err) : resolve(result)))
    );
}

// Builder pattern with generics
class QueryBuilder<T extends object> {
  private conditions: Partial<T> = {};
  private selectedFields: (keyof T)[] = [];
  private limitValue?: number;

  where(condition: Partial<T>): this {
    this.conditions = { ...this.conditions, ...condition };
    return this;
  }

  select(...fields: (keyof T)[]): this {
    this.selectedFields = fields;
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  build(): { where: Partial<T>; select: (keyof T)[]; limit?: number } {
    return { where: this.conditions, select: this.selectedFields, limit: this.limitValue };
  }
}

const query = new QueryBuilder<User>()
  .where({ name: "Alice" })
  .select("id", "email")
  .limit(10)
  .build();

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the rule for generic constraints (extends)?
  A: T extends U means T must be assignable to U.
     It limits which types can be passed as T.
     Common constraints: T extends object (no primitives),
     T extends keyof U (must be a key), T extends (...args: any[]) => any (must be a function).

  Q: What is the difference between T extends any[] and T extends unknown[]?
  A: Both can represent any array type.
     unknown[] is stricter — you can't accidentally use items without narrowing.
     any[] is more permissive. Use unknown[] for safer generic constraints.

  Q: What is type inference in generic functions?
  A: TypeScript infers T from the argument(s) passed.
     identity("hello") → T inferred as string.
     longest([1, 2], [3]) → T inferred as number[].
     Inference works by unifying the types of all positions
     where T appears and finding the best common type.

  Q: What is 'infer' in conditional types?
  A: Introduces a type variable to capture a part of T when it matches a pattern.
     T extends Promise<infer R> → R captures the promise's resolved type.
     T extends (infer E)[] → E captures the array element type.

  Q: What is the difference between type-level and value-level generics?
  A: Type-level: conditional/mapped/utility types — computed at compile time only.
     Value-level: generic functions and classes — runtime code that works on
     actual values, with types guaranteeing correctness.

  Q: What are higher-kinded types and does TypeScript support them?
  A: Higher-kinded types parameterise over type constructors (not just concrete types).
     e.g., Functor<F> where F is itself a generic (F<T>).
     TypeScript does NOT natively support HKT.
     Workarounds exist using interface declaration merging (fp-ts approach).
*/

export { Stack, UserRepository, memoize, promisify, QueryBuilder, succeed, fail };
export type { Repository, Result, ElementOf, Head, Tail, PaginatedResponse };
