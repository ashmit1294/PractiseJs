# TypeScript — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9
> **Status:** ✅ File 01_basic_types_interfaces.ts (Q1-Q5) enriched with WHAT/THEORY format & Complexity | ⏳ Files 02-09 pending

## Table of Contents

1. [01_basic_types_interfaces.ts — QUESTION SET: TypeScript Basic Types & Interfaces](#typescript-basic-types-interfaces) ✅ ENRICHED (Q1-Q5)
2. [02_generics.ts — QUESTION SET: TypeScript Generics](#typescript-generics)
3. [03_utility_types.ts — QUESTION SET: TypeScript Utility Types](#typescript-utility-types)
4. [04_type_guards.ts — QUESTION SET: TypeScript Type Guards & Narrowing](#typescript-type-guards)
5. [05_advanced_types.ts — QUESTION SET: TypeScript Advanced Types](#typescript-advanced-types)
6. [06_decorators.ts — QUESTION SET: TypeScript Decorators & Metadata](#typescript-decorators)
7. [07_design_patterns.ts — QUESTION SET: TypeScript Design Patterns](#typescript-design-patterns)
8. [08_react_typescript.tsx — QUESTION SET: TypeScript with React](#typescript-react-typescript)
9. [FILE: 09_theory_interview_qa.ts](#typescript-theory-interview-qa)
   - [Scenario-Based Questions](#typescript-scenarios)

---

<a id="typescript-basic-types-interfaces"></a>
## 01_basic_types_interfaces.ts — QUESTION SET: TypeScript Basic Types & Interfaces

```typescript
/**
 * QUESTION SET: TypeScript Basic Types & Interfaces
 *
 * 1. Primitive types and type inference
 * 2. Object shapes — interface vs type alias
 * 3. Optional, readonly, and index signatures
 * 4. Function types
 * 5. Union & intersection types
 * 6. Literal types and const assertion
 * 7. Tuple types
 * 8. Enum vs const enum vs union literal
 */

// ─────────────────────────────────────────────
// Q1. Primitive types
// ─────────────────────────────────────────────

// TypeScript infers types; explicit annotations only needed when inference is weak
const name: string = "Alice";
const age: number = 30;
const active: boolean = true;
const nothing: null = null;
const missing: undefined = undefined;
const id: symbol = Symbol("id");
const bigNum: bigint = 9007199254740991n;

// any — disables type checking (avoid unless absolutely necessary)
let data: any = "hello";
data = 42; // OK — no type safety

// unknown — type-safe alternative to any; must narrow before use
let input: unknown = getUserInput();
if (typeof input === "string") {
  console.log(input.toUpperCase()); // narrowed to string — safe
}

// never — value that never occurs (exhaustive check helper, infinite loops, throws)
function assertNever(x: never): never {
  throw new Error("Unexpected value: " + x);
}

// void — function returns nothing
function logMessage(msg: string): void {
  console.log(msg);
}

// ─────────────────────────────────────────────
// Q2. Interface vs type alias
// ─────────────────────────────────────────────

// INTERFACE — can be extended and re-declared (declaration merging)
interface User {
  id: string;
  email: string;
  name: string;
}

// Declaration merging — second declaration merges with first
interface User {
  createdAt: Date; // added to existing User interface
}

// Extending interfaces
interface Admin extends User {
  role: "ADMIN";
  permissions: string[];
}

// TYPE ALIAS — more flexible; supports unions, intersections, mapped, conditional types
type Point = { x: number; y: number };
type ID = string | number; // types support union at the top level; interfaces do not

// Intersection type (combines shapes) — similar to interface extends
type AdminUser = User & { role: string; permissions: string[] };

// When to choose:
//   interface — for object shapes in public APIs, when you need declaration merging
//   type — for complex compositions: unions, intersections, mapped types, conditionals

// ─────────────────────────────────────────────
// Q3. Optional, readonly, and index signatures
// ─────────────────────────────────────────────

interface Product {
  readonly id: string;       // cannot be reassigned after creation
  name: string;
  price: number;
  description?: string;      // optional — type is string | undefined
  tags: readonly string[];   // immutable array
}

// Index signature — allows additional properties of a given type
interface StringMap {
  [key: string]: string;     // any string key, string value
}

interface NumberRecord {
  id: number;                // specific required key
  [key: string]: number;     // all other keys must also be numbers
}

// Record utility type — cleaner alternative to index signature
type Config = Record<string, string>;
type UserRoles = Record<string, "admin" | "user" | "guest">;

// ─────────────────────────────────────────────
// Q4. Function types
// ─────────────────────────────────────────────

// Function type alias
type Comparator<T> = (a: T, b: T) => number;
type Predicate<T> = (value: T) => boolean;
type Mapper<A, B> = (value: A) => B;

const compareNumbers: Comparator<number> = (a, b) => a - b;

// Call signature in interface
interface Logger {
  (message: string, level?: "info" | "warn" | "error"): void;
  prefix: string;
}

// Overloads — multiple signatures for the same function
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  if (typeof input === "string") return parseInt(input, 10);
  return String(input);
}

// Rest parameters
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─────────────────────────────────────────────
// Q5. Union and intersection types
// ─────────────────────────────────────────────

type StringOrNumber = string | number;
type Status = "active" | "inactive" | "pending";

// Discriminated union — each variant has a unique literal discriminant
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return 0.5 * shape.base * shape.height;
    default:
      return assertNever(shape); // exhaustive check — compiler error if case is missing
  }
}

// Intersection type — must satisfy BOTH constraints
type Serialisable = { serialize(): string };
type Loggable = { log(): void };
type SerialLoggable = Serialisable & Loggable;

// ─────────────────────────────────────────────
// Q6. Literal types and const assertion
// ─────────────────────────────────────────────

// Literal type — only one specific value is allowed
const direction: "north" | "south" | "east" | "west" = "north";

// as const — narrows types to their exact literal values
const Routes = {
  HOME: "/",
  ABOUT: "/about",
  BLOG: "/blog",
} as const;
// type: { readonly HOME: "/"; readonly ABOUT: "/about"; readonly BLOG: "/blog" }

type Route = (typeof Routes)[keyof typeof Routes]; // "/" | "/about" | "/blog"

// Tuple with as const
const coords = [51.5074, -0.1278] as const; // readonly [51.5074, -0.1278]
// coords[0] = 0; // Error — readonly

// ─────────────────────────────────────────────
// Q7. Tuple types
// ─────────────────────────────────────────────

type Pair<T, U> = [T, U];
type RGB = [number, number, number];
type Entry<K, V> = [key: K, value: V]; // named tuple elements

const rgb: RGB = [255, 0, 0];
const [r, g, b] = rgb; // destructuring

// Variable-length tuple (rest elements)
type AtLeastOne<T> = [T, ...T[]];
type StringAndNumbers = [string, ...number[]]; // "label", 1, 2, 3

// Return tuple from function (useState-like)
function useCounter(initial = 0): [number, () => void, () => void] {
  let count = initial;
  const increment = () => { count++; };
  const decrement = () => { count--; };
  return [count, increment, decrement];
}
const [count, inc, dec] = useCounter(10);

// ─────────────────────────────────────────────
// Q8. Enum vs const enum vs union literal
// ─────────────────────────────────────────────

// Regular enum — generates a runtime object (two-way mapping for numeric)
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right, // 3
}

enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE",
}

// const enum — inlined at compile time, NO runtime object generated
const enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}
// Compiles to: const method = "GET"; (no object lookup overhead)

// Union literal — preferred modern approach; no boilerplate, pure TypeScript
type Alignment = "left" | "center" | "right";
type LogLevel = "debug" | "info" | "warn" | "error";

// Comparison:
//   enum: verbose, two-way numeric mapping, runtime object, compatible with flags
//   const enum: inlined, no runtime object, cannot be iterated, not compatible across modules
//   union literal: idiomatic TS, no runtime object, exhaustive checks work perfectly

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between interface and type alias?
  A: Interface: can be extended, supports declaration merging, object shapes only.
     Type alias: supports ALL type constructs (unions, intersections, tuples, conditional, mapped).
     Both can describe object shapes.
     Prefer interface for public APIs and library definitions (declaration merging support).
     Prefer type alias for computed/complex types.

  Q: What does 'unknown' add over 'any'?
  A: unknown forces you to NARROW the type before using it.
     any bypasses type checking completely.
     Use unknown for values from external sources (parse results, API responses) to
     force proper type validation before use.

  Q: What is a discriminated union?
  A: A union type where each member has a common property (the discriminant)
     with a unique literal type. TypeScript narrows the type in switch/if based on that property.
     This enables exhaustive checks and is the standard pattern for Redux actions, state machines, etc.

  Q: When do you get 'never' as a type?
  A: - Function that always throws or has infinite loop: return type is never
     - Exhaustive switch default: unreachable variable is never
     - Intersection of incompatible types: string & number = never
     - Filtering in conditional types: string extends never = false

  Q: What is the difference between a tuple and an array?
  A: Array: homogeneous, any length, e.g., string[].
     Tuple: fixed length, each position can have a different type.
     Tuples enable destructured returns (like hooks) with precise typing.
*/

function getUserInput(): unknown { return "input"; }

export type { User, Admin, Shape, Status, RGB, LogLevel, Route };
export { Direction, Color, HttpMethod, Routes };

---
```

<a id="typescript-generics"></a>
## 02_generics.ts — QUESTION SET: TypeScript Generics

```typescript
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

---
```

<a id="typescript-utility-types"></a>
## 03_utility_types.ts — QUESTION SET: TypeScript Utility Types

```typescript
/**
 * QUESTION SET: TypeScript Utility Types
 *
 * Built-in utility types + manual implementations to understand mechanics:
 * 1.  Partial<T>
 * 2.  Required<T>
 * 3.  Readonly<T>
 * 4.  Pick<T, K>
 * 5.  Omit<T, K>
 * 6.  Record<K, V>
 * 7.  Exclude<T, U> / Extract<T, U>
 * 8.  NonNullable<T>
 * 9.  ReturnType<T>
 * 10. Parameters<T>
 * 11. InstanceType<T>
 * 12. Awaited<T>
 * 13. Custom utility types
 */

// ─────────────────────────────────────────────
// Base types used throughout
// ─────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: "admin" | "user" | "guest";
  address?: { city: string; country: string };
}

// ─────────────────────────────────────────────
// Q1. Partial<T> — all properties optional
// ─────────────────────────────────────────────

type UpdateUserDto = Partial<User>;
// { id?: string; name?: string; email?: string; ... }

// Manual implementation
type MyPartial<T> = { [K in keyof T]?: T[K] };

// Use case: update functions accept only the fields to change
function updateUser(id: string, changes: Partial<User>) {
  return { id, ...changes }; // merge only provided fields
}

// ─────────────────────────────────────────────
// Q2. Required<T> — all properties mandatory
// ─────────────────────────────────────────────

type CompleteUser = Required<User>;
// { id: string; name: string; email: string; age: number; role: …; address: {…} }

type MyRequired<T> = { [K in keyof T]-?: T[K] }; // -? removes the optional modifier

// ─────────────────────────────────────────────
// Q3. Readonly<T> — all properties non-writable
// ─────────────────────────────────────────────

type ImmutableUser = Readonly<User>;

type MyReadonly<T> = { readonly [K in keyof T]: T[K] };

// Deep readonly (recursively immutable)
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type ImmutableConfig = DeepReadonly<{ db: { host: string; port: number } }>;

// ─────────────────────────────────────────────
// Q4. Pick<T, K> — select subset of keys
// ─────────────────────────────────────────────

type UserPreview = Pick<User, "id" | "name">;
// { id: string; name: string }

type MyPick<T, K extends keyof T> = { [P in K]: T[P] };

// Use case: safe DTO projection
type PublicUser = Pick<User, "id" | "name" | "role">;

// ─────────────────────────────────────────────
// Q5. Omit<T, K> — exclude keys
// ─────────────────────────────────────────────

type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; ... } — no id

// Manual implementation — uses Exclude on keyof T
type MyOmit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

// Common pattern: CreateDto omits auto-generated fields
type CreateUserDto = Omit<User, "id" | "role">;

// ─────────────────────────────────────────────
// Q6. Record<K, V> — dictionary type
// ─────────────────────────────────────────────

type RoleDescriptions = Record<User["role"], string>;
// { admin: string; user: string; guest: string }

type MyRecord<K extends keyof any, V> = { [P in K]: V };

// Config map
const featureFlags: Record<string, boolean> = {
  newDashboard: true,
  betaSearch: false,
};

// ─────────────────────────────────────────────
// Q7. Exclude<T, U> and Extract<T, U>
// ─────────────────────────────────────────────

type NonAdminRoles = Exclude<User["role"], "admin">; // "user" | "guest"
type OnlyAdminRole = Extract<User["role"], "admin">;  // "admin"

type MyExclude<T, U> = T extends U ? never : T;
type MyExtract<T, U> = T extends U ? T : never;

// Practical use: filter out null/undefined from a union
type StringValues = Exclude<string | number | null | undefined, null | undefined>; // string | number

// ─────────────────────────────────────────────
// Q8. NonNullable<T>
// ─────────────────────────────────────────────

type MaybeString = string | null | undefined;
type DefinitelyString = NonNullable<MaybeString>; // string

type MyNonNullable<T> = T extends null | undefined ? never : T;

// ─────────────────────────────────────────────
// Q9. ReturnType<T>
// ─────────────────────────────────────────────

function createUser(dto: CreateUserDto) {
  return { id: crypto.randomUUID(), ...dto, role: "user" as const };
}

type CreatedUser = ReturnType<typeof createUser>;
// { id: string; name: string; email: string; age: number; role: "user" }

type MyReturnType<T extends (...args: any[]) => any> =
  T extends (...args: any[]) => infer R ? R : never;

// ─────────────────────────────────────────────
// Q10. Parameters<T>
// ─────────────────────────────────────────────

function processPayment(amount: number, currency: string, userId: string): boolean {
  return true;
}

type PaymentParams = Parameters<typeof processPayment>; // [amount: number, currency: string, userId: string]
type FirstParam = Parameters<typeof processPayment>[0]; // number

type MyParameters<T extends (...args: any[]) => any> =
  T extends (...args: infer P) => any ? P : never;

// ─────────────────────────────────────────────
// Q11. InstanceType<T>
// ─────────────────────────────────────────────

class UserService {
  private users: User[] = [];
  add(user: User) { this.users.push(user); }
}

type UserServiceInstance = InstanceType<typeof UserService>; // UserService

// Use case: factory function that accepts a class constructor
function createInstance<T extends new (...args: any[]) => any>(
  Class: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new Class(...args);
}

// ─────────────────────────────────────────────
// Q12. Awaited<T> — unwrap nested Promises
// ─────────────────────────────────────────────

type NestedPromise = Promise<Promise<Promise<string>>>;
type Resolved = Awaited<NestedPromise>; // string

// ─────────────────────────────────────────────
// Q13. Custom utility types
// ─────────────────────────────────────────────

// Mutable<T> — opposite of Readonly<T>
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// DeepPartial<T>
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Nullable<T>
type Nullable<T> = T | null;

// Maybe<T>
type Maybe<T> = T | null | undefined;

// ValueOf<T> — union of all property value types
type ValueOf<T> = T[keyof T];
type UserPropertyValues = ValueOf<Pick<User, "id" | "role">>; // string | "admin" | "user" | "guest"

// PromiseValue<T>
type PromiseValue<T> = T extends Promise<infer V> ? V : T;

// FunctionKeys<T> — keys whose values are functions
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T];

// NonFunctionKeys<T>
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K
}[keyof T];

// RequireSome<T, K> — make specific keys required
type RequireSome<T, K extends keyof T> = T & Required<Pick<T, K>>;
type UserWithAddress = RequireSome<User, "address">; // address is required

// AtLeastOne<T> — object must have at least one key
type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

// XOR — exclusive or (exactly one of two types)
type XOR<T, U> =
  | (T & { [K in Exclude<keyof U, keyof T>]?: never })
  | (U & { [K in Exclude<keyof T, keyof U>]?: never });

type EmailOrPhone = XOR<{ email: string }, { phone: string }>;

// ─────────────────────────────────────────────
// Q14. Practical combinations
// ─────────────────────────────────────────────

// OmitNever<T> — remove never properties
type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

// FilterByType<T, Type> — keep only keys whose value extends Type
type FilterByType<T, Type> = {
  [K in keyof T as T[K] extends Type ? K : never]: T[K];
};
type StringFields = FilterByType<User, string>; // { id: string; name: string; email: string; role: string }

// Rename keys
type RenameKey<T, K extends keyof T, NewKey extends string> =
  Omit<T, K> & Record<NewKey, T[K]>;

type UserWithUserId = RenameKey<User, "id", "userId">;

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between Omit and Exclude?
  A: Exclude operates on union types: Exclude<"a" | "b" | "c", "a"> = "b" | "c"
     Omit operates on object type keys: Omit<{ a: 1; b: 2 }, "a"> = { b: 2 }
     Omit is built on top of Exclude: Omit<T, K> = Pick<T, Exclude<keyof T, K>>

  Q: How does mapped type modifier removal work (+/- prefix)?
  A: type Mutable<T> = { -readonly [K in keyof T]: T[K] };
     type Required<T>  = { [K in keyof T]-?: T[K] };
     The - removes the modifier. + (default) adds it.
     You can add readonly with: { +readonly [K in keyof T]: T[K] }

  Q: How do you use utility types in function signatures?
  A: function patch(id: string, updates: Partial<User>): Promise<User>
     function create(data: Omit<User, 'id' | 'createdAt'>): Promise<User>
     function display(user: Pick<User, 'name' | 'role'>): void

  Q: What is the Readonly utility type useful for in practice?
  A: Prevent accidental mutation of state in function bodies.
     Describe immutable data structures (config, constants).
     Work with React's props (they should never be mutated).

  Q: How does infer work in utility type implementations?
  A: infer declares a type variable that is captured when the conditional type matches.
     ReturnType: T extends (...args: any[]) => infer R ? R : never
     The R variable captures whatever comes after '=>' when T matches the function pattern.
*/

export type {
  DeepReadonly, DeepPartial, Mutable, Nullable, Maybe, ValueOf,
  FunctionKeys, NonFunctionKeys, RequireSome, XOR, FilterByType,
};

---
```

<a id="typescript-type-guards"></a>
## 04_type_guards.ts — QUESTION SET: TypeScript Type Guards & Narrowing

```typescript
/**
 * QUESTION SET: TypeScript Type Guards & Narrowing
 *
 * 1. typeof guard
 * 2. instanceof guard
 * 3. in operator narrowing
 * 4. User-defined type guard (is)
 * 5. Assertion functions (asserts)
 * 6. Discriminated union narrowing
 * 7. Exhaustive checks with never
 * 8. Nullability narrowing
 */

// ─────────────────────────────────────────────
// Q1. typeof guards
// ─────────────────────────────────────────────

function formatValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return value.trim().toUpperCase();
  } else if (typeof value === "number") {
    return value.toFixed(2);
  } else {
    return value ? "yes" : "no";
  }
}

// typeof works for: string, number, bigint, boolean, symbol, undefined, object, function
// NOTE: typeof null === "object" — the historical JS bug

// ─────────────────────────────────────────────
// Q2. instanceof guard
// ─────────────────────────────────────────────

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

class NetworkError extends Error {
  constructor(public url: string, message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function handleError(err: unknown): string {
  if (err instanceof ApiError) {
    return `API Error ${err.statusCode}: ${err.message}`;
  }
  if (err instanceof NetworkError) {
    return `Network Error (${err.url}): ${err.message}`;
  }
  if (err instanceof Error) {
    return `Unknown Error: ${err.message}`;
  }
  return "Non-error thrown";
}

// ─────────────────────────────────────────────
// Q3. in operator — check property existence
// ─────────────────────────────────────────────

interface Cat { meow(): void; }
interface Dog { bark(): void; }
type Pet = Cat | Dog;

function makeNoise(pet: Pet) {
  if ("meow" in pet) {
    pet.meow(); // TypeScript narrows to Cat
  } else {
    pet.bark(); // TypeScript narrows to Dog
  }
}

// ─────────────────────────────────────────────
// Q4. User-defined type guard (predicate function)
// Return type is: value is SomeType
// ─────────────────────────────────────────────

// Basic type guard
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

// Object shape guard
interface User { id: string; name: string; email: string; }
interface Post { id: string; title: string; authorId: string; }

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj && typeof (obj as any).id === "string" &&
    "name" in obj && typeof (obj as any).name === "string" &&
    "email" in obj && typeof (obj as any).email === "string"
  );
}

function isPost(obj: unknown): obj is Post {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "title" in obj &&
    "authorId" in obj
  );
}

// Array guard
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

// Generic guard
function hasKey<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

// ─────────────────────────────────────────────
// Q5. Assertion functions — throws if condition fails
// ─────────────────────────────────────────────

// Return type: asserts value is T
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
}

function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value == null) {
    throw new Error(message ?? "Value is null or undefined");
  }
}

// After an assertion function call, TypeScript trusts the narrowed type
function processConfig(rawConfig: unknown) {
  assertIsString(rawConfig);
  // rawConfig is now narrowed to string
  const parsed = JSON.parse(rawConfig);
  return parsed;
}

// asserts condition variant
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function process(value: number | null) {
  assert(value !== null, "value must not be null");
  // value is now number
  return value * 2;
}

// ─────────────────────────────────────────────
// Q6. Discriminated union narrowing
// ─────────────────────────────────────────────

// API response pattern
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: string; code: number }
  | { status: "loading" };

function renderResponse(response: ApiResponse<User[]>) {
  switch (response.status) {
    case "success":
      return response.data.map((u) => u.name);    // data: User[] available
    case "error":
      return `Error ${response.code}: ${response.error}`;
    case "loading":
      return "Loading...";
  }
}

// Redux-style actions
type AppAction =
  | { type: "INCREMENT"; payload: number }
  | { type: "DECREMENT"; payload: number }
  | { type: "RESET" }
  | { type: "SET_USER"; payload: User };

function reducer(state: { count: number; user: User | null }, action: AppAction) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + action.payload };
    case "DECREMENT":
      return { ...state, count: state.count - action.payload };
    case "RESET":
      return { ...state, count: 0 };
    case "SET_USER":
      return { ...state, user: action.payload };
  }
}

// ─────────────────────────────────────────────
// Q7. Exhaustive checks with never
// ─────────────────────────────────────────────

function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; w: number; h: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":    return Math.PI * shape.radius ** 2;
    case "rect":      return shape.w * shape.h;
    case "triangle":  return 0.5 * shape.base * shape.height;
    default:          return exhaustiveCheck(shape); // compile error if case is added without handling
  }
}

// ─────────────────────────────────────────────
// Q8. Nullability narrowing patterns
// ─────────────────────────────────────────────

// Truthy check narrows out null/undefined
function processName(name: string | null | undefined): string {
  if (!name) return "Anonymous"; // null and undefined → default
  return name.trim();            // name is string here
}

// Optional chaining + nullish coalescing
function getCity(user: { address?: { city?: string } } | null): string {
  return user?.address?.city ?? "Unknown";
}

// Non-null assertion (!) — use sparingly, you take responsibility
function getElement(id: string): HTMLElement {
  return document.getElementById(id)!; // asserts non-null
}

// Type guards with arrays
function processItems(items: (string | null | undefined)[]) {
  // Filter removes nullish and narrows type
  const valid: string[] = items.filter((i): i is string => i != null);
  return valid.map((s) => s.toUpperCase());
}

// ─────────────────────────────────────────────
// Q9. Class-based type guards with static methods
// ─────────────────────────────────────────────

class ValidationResult {
  private constructor(
    public readonly ok: boolean,
    public readonly value?: string,
    public readonly error?: string
  ) {}

  static success(value: string): ValidationResult {
    return new ValidationResult(true, value);
  }

  static failure(error: string): ValidationResult {
    return new ValidationResult(false, undefined, error);
  }

  isSuccess(): this is { ok: true; value: string } {
    return this.ok;
  }
}

function validate(input: unknown): ValidationResult {
  if (typeof input !== "string") return ValidationResult.failure("Must be a string");
  if (input.length < 3) return ValidationResult.failure("Too short");
  return ValidationResult.success(input.trim());
}

function use(result: ValidationResult) {
  if (result.isSuccess()) {
    console.log(result.value.toUpperCase()); // value is string (narrowed)
  } else {
    console.error(result.error);
  }
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between a type guard and an assertion function?
  A: Type guard: predicate function — returns boolean, narrows within if-blocks.
       function isString(v: unknown): v is string
     Assertion function: throws if condition fails, narrows AFTER the call for all subsequent code.
       function assertIsString(v: unknown): asserts v is string
     Type guard: callers choose how to handle false. Assertion: throws automatically.

  Q: Why should you prefer user-defined type guards over type casting (as)?
  A: Type casting (as) bypasses the type checker — you could be wrong.
     User-defined type guards perform RUNTIME checks — the validation actually executes.
     If your guard is wrong, JavaScript will throw at runtime (detectable).
     As casting: no runtime check, errors only manifest when wrong property is accessed.

  Q: What is the 'in' operator guard useful for?
  A: When you have types without a common discriminant property.
     Also useful for handling unknown objects from APIs:
     if ('error' in response) { handle error }

  Q: How does narrowing work in TypeScript?
  A: TypeScript tracks the type of a variable through control flow analysis.
     Each branch (if/switch/try/finally) is analysed independently.
     TypeScript intersects the narrowed type from each guard.
     Assignments reset the narrowed type back to the declared type.

  Q: What is the type of 'err' in a catch clause?
  A: TypeScript 4.0+ defaults catch clause variables to unknown (strict option).
     Previously was any. You must narrow it (instanceof Error) before accessing properties.
     Always catch with: catch (err: unknown) and narrow before use.
*/

export {
  isString, isNumber, isUser, isPost, isStringArray, hasKey,
  assertIsString, assertDefined, assert, exhaustiveCheck,
};

---
```

<a id="typescript-advanced-types"></a>
## 05_advanced_types.ts — QUESTION SET: TypeScript Advanced Types

```typescript
/**
 * QUESTION SET: TypeScript Advanced Types
 *
 * 1. Mapped types
 * 2. Template literal types
 * 3. Conditional types (advanced)
 * 4. Recursive types
 * 5. Variance (covariance, contravariance)
 * 6. Module augmentation
 * 7. Opaque / branded types
 * 8. TypeScript satisfies operator
 */

// ─────────────────────────────────────────────
// Q1. Mapped types — transform every property of a type
// ─────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

// Make all props optional and nullable
type NullablePartial<T> = { [K in keyof T]?: T[K] | null };

// Convert all string properties to number
type StringsToNumbers<T> = {
  [K in keyof T]: T[K] extends string ? number : T[K];
};
type UserWithNumericIds = StringsToNumbers<User>; // id: number, age: number

// Key remapping with 'as' (TypeScript 4.1+)
// Prefix every key with 'get'
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type UserGetters = Getters<User>;
// { getId: () => string; getName: () => string; ... }

// Filter keys — keep only string-value keys
type StringProperties<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
type UserStringKeys = StringProperties<User>; // { id: string, name: string, email: string }

// Setters with validation
type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (
    value: T[K],
    validate?: (v: T[K]) => boolean
  ) => void;
};

// ─────────────────────────────────────────────
// Q2. Template literal types
// ─────────────────────────────────────────────

// Event system with strict typing
type EventName<T extends string> = `on${Capitalize<T>}`;
type UserEvents = EventName<"click" | "hover" | "focus">; // "onClick" | "onHover" | "onFocus"

// CSS property types
type CSSProperty = "margin" | "padding" | "border";
type CSSDirection = "top" | "right" | "bottom" | "left";
type FullCSSProperty = `${CSSProperty}-${CSSDirection}`;
// "margin-top" | "margin-right" | ... | "border-left"

// HTTP endpoints
type HttpMethod = "get" | "post" | "put" | "delete" | "patch";
type ApiEndpoint = `/${string}`;

// DB event types
type EntityAction = "created" | "updated" | "deleted";
type EntityName = "user" | "post" | "comment";
type DbEvent = `${EntityName}:${EntityAction}`;
// "user:created" | "user:updated" | "user:deleted" | "post:created" | ...

// Extract segments from URL pattern
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<`/${Rest}`>
    : T extends `${string}:${infer Param}`
    ? Param
    : never;

type Params = ExtractRouteParams<"/users/:userId/posts/:postId">; // "userId" | "postId"

// ─────────────────────────────────────────────
// Q3. Conditional types — advanced
// ─────────────────────────────────────────────

// Infer from function parameters
type PromiseResolveType<T> = T extends Promise<infer R> ? R : T;
type UnwrapArray<T> = T extends (infer E)[] ? E : T;

// Flatten nested arrays
type Flatten<T> = T extends (infer E)[] ? Flatten<E> : T;
type Nested = Flatten<number[][][]>; // number

// Unpacked: handle both arrays and promises
type Unpack<T> =
  T extends (infer U)[] ? U :
  T extends Promise<infer U> ? U :
  T;

// OmitNested — remove keys from nested objects
type OmitNested<T, K extends string> = {
  [P in keyof T as P extends K ? never : P]: T[P] extends object
    ? OmitNested<T[P], K>
    : T[P];
};

// IsUnion — true if T is a union type
type IsUnion<T, U = T> = [T] extends [never]
  ? false
  : T extends U
  ? [U] extends [T]
    ? false
    : true
  : never;

type TrueTest = IsUnion<string | number>; // true
type FalseTest = IsUnion<string>;         // false

// ─────────────────────────────────────────────
// Q4. Recursive types
// ─────────────────────────────────────────────

// JSON value type
type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [K: string]: JsonValue };
type JsonArray = JsonValue[];
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// Recursive partial (DeepPartial)
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// Recursive readonly
type DeepReadonly<T> = T extends (infer E)[]
  ? ReadonlyArray<DeepReadonly<E>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// Tree structure
type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};

function traverseTree<T>(node: TreeNode<T>, visit: (value: T) => void): void {
  visit(node.value);
  node.children.forEach((child) => traverseTree(child, visit));
}

// Recursive tuple length
type Length<T extends any[]> = T["length"];
type BuildTuple<N extends number, T extends any[] = []> =
  T["length"] extends N ? T : BuildTuple<N, [...T, unknown]>;
type Tuple5 = BuildTuple<5>; // [unknown, unknown, unknown, unknown, unknown]

// ─────────────────────────────────────────────
// Q5. Variance — covariance and contravariance
// ─────────────────────────────────────────────

/*
  COVARIANCE — output positions (returns)
  A type T<Child> is assignable to T<Parent> when Child extends Parent.
  Example: () => Dog is assignable to () => Animal (if Dog extends Animal)
  
  CONTRAVARIANCE — input positions (parameters)
  A function accepting Parent is assignable to one accepting Child.
  Example: (a: Animal) => void is assignable to (d: Dog) => void
  because the Animal handler can handle any Dog.
  
  BIVARIANCE — function parameters in method syntax (unsafe, TypeScript default for methods)
  INVARIANCE — exact type must match (no substitution)
*/

// In TypeScript, function parameters are CONTRAVARIANT:
type Handler<T> = (event: T) => void;

class Animal { species = "animal"; }
class Dog extends Animal { bark() {} }

type DogHandler = (dog: Dog) => void;
type AnimalHandler = (animal: Animal) => void;

// Dog handler cannot handle arbitrary Animals (Dog has .bark, Animal might not)
// Animal handler CAN handle Dogs (all animals, including dogs)
// So: AnimalHandler is assignable to DogHandler (contravariance)
declare let dogHandler: DogHandler;
declare let animalHandler: AnimalHandler;
// dogHandler = animalHandler; // OK — AnimalHandler = contravariant (can handle more)
// animalHandler = dogHandler; // Error — DogHandler = can't handle all Animals

// ─────────────────────────────────────────────
// Q6. Opaque / Branded types
// Prevent mixing up semantically different primitives of the same type
// ─────────────────────────────────────────────

// Brand pattern
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

type UserId = Brand<string, "UserId">;
type PostId = Brand<string, "PostId">;
type Email = Brand<string, "Email">;

// Constructors with validation
function toUserId(id: string): UserId {
  if (!id) throw new Error("Invalid user ID");
  return id as UserId;
}

function toEmail(value: string): Email {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Invalid email");
  }
  return value as Email;
}

// Now these two can't be mixed up even though both are strings
function getUser(id: UserId) {}
function getPost(id: PostId) {}

const userId = toUserId("abc");
const postId = "xyz" as PostId;
// getUser(postId); // Error! PostId is not assignable to UserId

// ─────────────────────────────────────────────
// Q7. Module augmentation
// Add properties to existing module types
// ─────────────────────────────────────────────

// Augmenting Express Request (declare in a .d.ts file)
declare module "express" {
  interface Request {
    user?: { id: string; role: string };
    requestId?: string;
  }
}

// Augmenting Array prototype (add custom methods)
declare global {
  interface Array<T> {
    groupBy<K extends string>(fn: (item: T) => K): Record<K, T[]>;
    chunk(size: number): T[][];
  }
}

// Augmenting process.env for type safety
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "test" | "production";
      DATABASE_URL: string;
      JWT_SECRET: string;
      PORT?: string;
    }
  }
}

// ─────────────────────────────────────────────
// Q8. The satisfies operator (TypeScript 4.9+)
// Validates a value matches a type without widening
// ─────────────────────────────────────────────

type RouteConfig = Record<string, { method: string; path: string }>;

// Without satisfies — type is widened to RouteConfig, loses specific literal types
// const routes: RouteConfig = { ... }

// With satisfies — validates against RouteConfig but keeps specific types
const routes = {
  GET_USERS:   { method: "GET",  path: "/users" },
  CREATE_USER: { method: "POST", path: "/users" },
  GET_USER:    { method: "GET",  path: "/users/:id" },
} satisfies RouteConfig;

// TypeScript knows GET_USERS.method is "GET" (literal), not just string
type GetUsersMethod = (typeof routes)["GET_USERS"]["method"]; // "GET"

// Another satisfies use case — palette
const palette = {
  red:   [255, 0, 0],
  green: "#00ff00",
  blue:  [0, 0, 255],
} satisfies Record<string, string | number[]>;

palette.red.map;    // OK — TypeScript knows red is number[], not string | number[]
palette.green.toUpperCase; // OK — TypeScript knows green is string

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between a mapped type and a conditional type?
  A: Mapped type: iterates over keys of an existing type — [K in keyof T]: transformation
     Conditional type: branches based on structural relationship — T extends U ? A : B
     Both can be combined: map over keys, apply conditional to each value.

  Q: When would you use template literal types?
  A: - Generating event names from base types: `on${Capitalize<EventName>}`
     - API method/path combinations
     - Extracting dynamic path params from string literal routes
     - Type-safe CSS property names (margin-top, padding-left, etc.)

  Q: What is a branded type and why is it important?
  A: A branded type attaches a phantom property to a primitive, preventing
     values from being mixed up even though their base type is the same.
     Critical for domain safety: UserId vs PostId vs OrderId are all strings
     but should never be passed in place of each other.

  Q: What does the satisfies operator do differently from a type annotation?
  A: Type annotation (const x: T = ...): infers as T, loses specific literal types.
     satisfies: validates the value conforms to T but keeps the most specific inferred type.
     Use satisfies when you want type-checking but want to retain specific literal inference.

  Q: What is declaration merging in TypeScript?
  A: When multiple declarations for the same name exist in the same scope,
     TypeScript merges them. Works for: interfaces, namespaces, enums.
     Used for module augmentation: adding properties to Express.Request,
     adding methods to Array, augmenting process.env types.
*/

export type { JsonValue, DeepPartial, DeepReadonly, TreeNode, UserId, PostId, Email };
export { toUserId, toEmail };

---
```

<a id="typescript-decorators"></a>
## 06_decorators.ts — QUESTION SET: TypeScript Decorators & Metadata

```typescript
/**
 * QUESTION SET: TypeScript Decorators & Metadata
 *
 * Uses: experimentalDecorators: true, emitDecoratorMetadata: true in tsconfig
 *
 * 1. Class decorators
 * 2. Method decorators
 * 3. Property decorators
 * 4. Parameter decorators
 * 5. Compose multiple decorators
 * 6. Reflect metadata API
 * 7. Dependency injection (simplified)
 */

import "reflect-metadata"; // required for Reflect.metadata API

// ─────────────────────────────────────────────
// Q1. Class decorator
// ─────────────────────────────────────────────

// Decorator factory — returns a decorator function
function Singleton<T extends { new (...args: any[]): {} }>(constructor: T) {
  let instance: InstanceType<T>;
  return class extends constructor {
    constructor(...args: any[]) {
      if (instance) return instance;
      super(...args);
      instance = this as any;
    }
  };
}

@Singleton
class Database {
  connect() { console.log("Connected"); }
}

const db1 = new Database();
const db2 = new Database();
// db1 === db2 → true (singleton)

// Sealed class decorator — prevent extension and property addition
function Sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@Sealed
class Config {
  apiUrl = "https://api.example.com";
}

// Logging class decorator
function log(prefix: string) {
  return function <T extends { new (...args: any[]): {} }>(Target: T) {
    return class extends Target {
      constructor(...args: any[]) {
        console.log(`[${prefix}] Creating instance`);
        super(...args);
      }
    };
  };
}

@log("UserService")
class UserService {
  findAll() {}
}

// ─────────────────────────────────────────────
// Q2. Method decorators
// ─────────────────────────────────────────────

// Method decorator signature: (target, propertyKey, descriptor)
function readonly(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  descriptor.writable = false;
  return descriptor;
}

// Timing decorator
function time(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const result = await original.apply(this, args);
    console.log(`[${propertyKey}] ${(performance.now() - start).toFixed(2)}ms`);
    return result;
  };
  return descriptor;
}

// Memoize decorator
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cache = new Map<string, any>();
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = original.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}

// Retry decorator — retries async method on failure
function retry(times: number, delayMs = 0) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      for (let i = 0; i <= times; i++) {
        try {
          return await original.apply(this, args);
        } catch (err: any) {
          lastError = err;
          if (i < times && delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      throw lastError!;
    };
    return descriptor;
  };
}

// Throttle decorator
function throttle(limitMs: number) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    let lastCall = 0;
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const now = Date.now();
      if (now - lastCall < limitMs) return;
      lastCall = now;
      return original.apply(this, args);
    };
    return descriptor;
  };
}

class ApiClient {
  @time
  @retry(3, 1000)
  async fetchUser(id: string) {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }

  @memoize
  expensiveCalc(n: number): number {
    return n * n; // heavy computation
  }

  @throttle(1000)
  onScroll() {
    console.log("Scroll event handled");
  }
}

// ─────────────────────────────────────────────
// Q3. Property decorators
// ─────────────────────────────────────────────

// Validate property values via setter
function Min(min: number) {
  return function (target: any, propertyKey: string) {
    let value: number;
    Object.defineProperty(target, propertyKey, {
      get() { return value; },
      set(next: number) {
        if (next < min) throw new RangeError(`${propertyKey} must be >= ${min}`);
        value = next;
      },
    });
  };
}

function MaxLength(max: number) {
  return function (target: any, propertyKey: string) {
    let value: string;
    Object.defineProperty(target, propertyKey, {
      get() { return value; },
      set(next: string) {
        if (next.length > max) throw new RangeError(`${propertyKey} max length is ${max}`);
        value = next;
      },
    });
  };
}

class Product {
  @MaxLength(200)
  name!: string;

  @Min(0)
  price!: number;

  @Min(0)
  stock!: number;
}

// ─────────────────────────────────────────────
// Q4. Parameter decorators
// ─────────────────────────────────────────────

const REQUIRED_PARAMS = Symbol("required_params");

function Required(target: any, methodName: string, paramIndex: number) {
  const existing: number[] = Reflect.getMetadata(REQUIRED_PARAMS, target, methodName) || [];
  existing.push(paramIndex);
  Reflect.defineMetadata(REQUIRED_PARAMS, existing, target, methodName);
}

function ValidateParams(target: any, methodName: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const required: number[] = Reflect.getMetadata(REQUIRED_PARAMS, target, methodName) || [];
    for (const idx of required) {
      if (args[idx] == null) throw new Error(`Parameter ${idx} of ${methodName} is required`);
    }
    return original.apply(this, args);
  };
  return descriptor;
}

class OrderService {
  @ValidateParams
  createOrder(@Required userId: string, @Required amount: number, note?: string) {
    return { userId, amount, note };
  }
}

// ─────────────────────────────────────────────
// Q5. Reflect metadata — store and retrieve metadata
// ─────────────────────────────────────────────

const ROLES_KEY = Symbol("roles");

function Roles(...roles: string[]) {
  return Reflect.metadata(ROLES_KEY, roles);
}

function hasRole(target: any, methodName: string, role: string): boolean {
  const roles = Reflect.getMetadata(ROLES_KEY, target.prototype, methodName) ?? [];
  return roles.includes(role);
}

class PostController {
  @Roles("admin", "moderator")
  deletePost(id: string) {}

  @Roles("admin")
  purgeAll() {}
}

console.log(hasRole(PostController, "deletePost", "moderator")); // true
console.log(hasRole(PostController, "purgeAll", "moderator"));   // false

// ─────────────────────────────────────────────
// Q6. SimpleContainer — lightweight DI
// ─────────────────────────────────────────────

const INJECT_TOKEN = Symbol("inject");

function Injectable(target: any) {
  Reflect.defineMetadata(INJECT_TOKEN, true, target);
}

class Container {
  private registry = new Map<any, any>();

  register<T>(token: any, value: T): void {
    this.registry.set(token, value);
  }

  resolve<T>(token: any): T {
    if (this.registry.has(token)) return this.registry.get(token);
    // Auto-resolve by reading constructor param types
    const paramTypes: any[] = Reflect.getMetadata("design:paramtypes", token) || [];
    const deps = paramTypes.map((dep) => this.resolve(dep));
    const instance = new token(...deps);
    this.registry.set(token, instance);
    return instance;
  }
}

@Injectable
class LogService {
  log(msg: string) { console.log("[LOG]", msg); }
}

@Injectable
class UserRepository2 {
  findAll() { return []; }
}

@Injectable
class UserController {
  constructor(
    private log: LogService,
    private repo: UserRepository2
  ) {}

  listUsers() {
    this.log.log("listing users");
    return this.repo.findAll();
  }
}

const container = new Container();
const ctrl = container.resolve<UserController>(UserController);

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What are decorators in TypeScript?
  A: Decorators are functions that apply to class declarations, methods, properties, or parameters
     at class definition time. They receive metadata about the decorated target and can
     modify/augment its behaviour. Currently stage 3 TC39 proposal; TypeScript uses an
     earlier version behind experimentalDecorators.

  Q: What is the order of decorator execution?
  A: Multiple decorators on one target: evaluated bottom-up (closest to function runs first).
     Class → property → method → parameter decorators.
     Factory outer functions run top-down, inner decorators run bottom-up.
     @A @B method()  — B factory, A factory, then B decorator, A decorator.

  Q: What is Reflect.metadata?
  A: An API from the 'reflect-metadata' polyfill (used by Angular, TypeORM, NestJS).
     Attaches metadata key-value pairs to classes, methods, properties.
     emitDecoratorMetadata: true makes TypeScript emit design:type, design:paramtypes,
     design:returntype for each decorated symbol automatically.

  Q: How does NestJS use decorators?
  A: @Module, @Controller, @Injectable — class decorators registering providers.
     @Get, @Post — method decorators mapping routes.
     @Body, @Param, @Query — parameter decorators extracting request data.
     @UseGuards, @UseInterceptors — applying middleware-like layers.
     All built on the same mechanism: class + Reflect.metadata.

  Q: What are the risks of using decorators?
  A: They execute at class definition time — eager loading, potential side effects.
     They rely on TC39 experimental proposal — the spec has changed (TypeScript decorators
     differ from the finalised TC39 v3 decorators).
     Heavy use can make code harder to reason about (implicit behaviour injection).
*/

export { Singleton, retry, memoize, throttle, Container };

---
```

<a id="typescript-design-patterns"></a>
## 07_design_patterns.ts — QUESTION SET: TypeScript Design Patterns

```typescript
/**
 * QUESTION SET: TypeScript Design Patterns
 *
 * 1. Singleton
 * 2. Factory / Abstract Factory
 * 3. Builder
 * 4. Observer
 * 5. Strategy
 * 6. Command
 * 7. Repository + Unit of Work
 * 8. State machine
 */

// ─────────────────────────────────────────────
// Q1. Singleton (thread-safe in JS)
// ─────────────────────────────────────────────

class AppConfig {
  private static instance: AppConfig;
  private config: Map<string, string>;

  private constructor() {
    this.config = new Map(Object.entries(process.env as Record<string, string>));
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  get(key: string): string | undefined {
    return this.config.get(key);
  }
}

const config1 = AppConfig.getInstance();
const config2 = AppConfig.getInstance();
// config1 === config2  true

// ─────────────────────────────────────────────
// Q2. Factory pattern
// ─────────────────────────────────────────────

interface Notification {
  send(to: string, message: string): Promise<void>;
}

class EmailNotification implements Notification {
  async send(to: string, message: string) {
    console.log(`[EMAIL] To: ${to} — ${message}`);
  }
}

class SMSNotification implements Notification {
  async send(to: string, message: string) {
    console.log(`[SMS] To: ${to} — ${message}`);
  }
}

class PushNotification implements Notification {
  async send(to: string, message: string) {
    console.log(`[PUSH] To: ${to} — ${message}`);
  }
}

type NotificationChannel = "email" | "sms" | "push";

class NotificationFactory {
  private static creators: Record<NotificationChannel, () => Notification> = {
    email: () => new EmailNotification(),
    sms:   () => new SMSNotification(),
    push:  () => new PushNotification(),
  };

  static create(channel: NotificationChannel): Notification {
    const creator = this.creators[channel];
    if (!creator) throw new Error(`Unknown notification channel: ${channel}`);
    return creator();
  }

  // Register new channel types without modifying factory (Open/Closed principle)
  static register(channel: string, creator: () => Notification) {
    (this.creators as any)[channel] = creator;
  }
}

// ─────────────────────────────────────────────
// Q3. Builder pattern
// ─────────────────────────────────────────────

interface Query {
  table: string;
  conditions: string[];
  fields: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

class QueryBuilder {
  private query: Partial<Query> = { conditions: [], fields: [] };

  from(table: string): this {
    this.query.table = table;
    return this;
  }

  select(...fields: string[]): this {
    this.query.fields = fields;
    return this;
  }

  where(condition: string): this {
    this.query.conditions!.push(condition);
    return this;
  }

  orderBy(field: string): this {
    this.query.orderBy = field;
    return this;
  }

  limit(n: number): this {
    this.query.limit = n;
    return this;
  }

  offset(n: number): this {
    this.query.offset = n;
    return this;
  }

  build(): string {
    if (!this.query.table) throw new Error("Table is required");
    const fields = this.query.fields!.length ? this.query.fields!.join(", ") : "*";
    let sql = `SELECT ${fields} FROM ${this.query.table}`;
    if (this.query.conditions!.length) sql += ` WHERE ${this.query.conditions!.join(" AND ")}`;
    if (this.query.orderBy) sql += ` ORDER BY ${this.query.orderBy}`;
    if (this.query.limit != null) sql += ` LIMIT ${this.query.limit}`;
    if (this.query.offset != null) sql += ` OFFSET ${this.query.offset}`;
    return sql;
  }
}

const sql = new QueryBuilder()
  .from("users")
  .select("id", "name", "email")
  .where("age > 18")
  .where("active = true")
  .orderBy("name")
  .limit(10)
  .offset(0)
  .build();

// ─────────────────────────────────────────────
// Q4. Observer pattern — type-safe
// ─────────────────────────────────────────────

type EventMap = Record<string, any>;

class TypedEventEmitter<Events extends EventMap> {
  private listeners = new Map<keyof Events, Set<(data: any) => void>>();

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

// Typed event definitions
interface StoreEvents {
  "item:added":   { item: { id: string; name: string }; userId: string };
  "item:removed": { itemId: string };
  "cart:cleared": void;
}

const cartEmitter = new TypedEventEmitter<StoreEvents>();

const unsubscribe = cartEmitter.on("item:added", ({ item, userId }) => {
  console.log(`User ${userId} added ${item.name}`);
});

cartEmitter.emit("item:added", { item: { id: "1", name: "Book" }, userId: "user-1" });
unsubscribe();

// ─────────────────────────────────────────────
// Q5. Strategy pattern
// ─────────────────────────────────────────────

interface SortStrategy<T> {
  sort(items: T[]): T[];
}

class BubbleSortStrategy<T extends number> implements SortStrategy<T> {
  sort(items: T[]): T[] {
    const arr = [...items];
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length - i - 1; j++) {
        if (arr[j] > arr[j + 1]) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
    return arr;
  }
}

class QuickSortStrategy<T extends number> implements SortStrategy<T> {
  sort(items: T[]): T[] {
    if (items.length <= 1) return items;
    const [pivot, ...rest] = items;
    return [
      ...this.sort(rest.filter((x) => x <= pivot) as T[]),
      pivot,
      ...this.sort(rest.filter((x) => x > pivot) as T[]),
    ];
  }
}

class Sorter<T extends number> {
  constructor(private strategy: SortStrategy<T>) {}

  setStrategy(strategy: SortStrategy<T>): void {
    this.strategy = strategy;
  }

  sort(items: T[]): T[] {
    return this.strategy.sort(items);
  }
}

const sorter = new Sorter(new QuickSortStrategy());
sorter.sort([5, 3, 8, 1, 2]);

// ─────────────────────────────────────────────
// Q6. Command pattern — undo/redo
// ─────────────────────────────────────────────

interface Command {
  execute(): void;
  undo(): void;
}

class TextEditor {
  text = "";

  private history: Command[] = [];
  private undone: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.history.push(command);
    this.undone = []; // clear redo stack on new command
  }

  undo(): void {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.undone.push(command);
    }
  }

  redo(): void {
    const command = this.undone.pop();
    if (command) {
      command.execute();
      this.history.push(command);
    }
  }
}

class InsertTextCommand implements Command {
  constructor(
    private editor: TextEditor,
    private text: string,
    private position: number
  ) {}

  execute(): void {
    this.editor.text =
      this.editor.text.slice(0, this.position) +
      this.text +
      this.editor.text.slice(this.position);
  }

  undo(): void {
    this.editor.text =
      this.editor.text.slice(0, this.position) +
      this.editor.text.slice(this.position + this.text.length);
  }
}

// ─────────────────────────────────────────────
// Q7. State machine — typed
// ─────────────────────────────────────────────

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

type Transitions = {
  [S in OrderStatus]?: Partial<Record<string, OrderStatus>>;
};

const orderTransitions: Transitions = {
  pending:   { pay: "paid",       cancel: "cancelled" },
  paid:      { ship: "shipped",   refund: "pending" },
  shipped:   { deliver: "delivered" },
  delivered: {},
  cancelled: {},
};

class OrderStateMachine {
  private state: OrderStatus;

  constructor(initial: OrderStatus = "pending") {
    this.state = initial;
  }

  transition(action: string): boolean {
    const next = orderTransitions[this.state]?.[action];
    if (!next) {
      console.warn(`Transition '${action}' not allowed from state '${this.state}'`);
      return false;
    }
    this.state = next;
    return true;
  }

  getState(): OrderStatus { return this.state; }

  canTransition(action: string): boolean {
    return action in (orderTransitions[this.state] ?? {});
  }
}

const order = new OrderStateMachine();
order.transition("pay");       // pending → paid
order.transition("ship");      // paid → shipped
order.transition("deliver");   // shipped → delivered
order.transition("cancel");    // warn: not allowed from delivered

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the Open/Closed principle?
  A: Classes should be open for extension but closed for modification.
     The NotificationFactory.register() example shows this: you can add new
     channel types without modifying the factory class itself.

  Q: What is the difference between Strategy and State patterns?
  A: Strategy: algorithm is chosen once and can be swapped explicitly by the client.
     State: the object's current state determines which behaviour executes,
     and transitions happen automatically based on actions.

  Q: What makes the Builder pattern useful?
  A: When constructing complex objects with many optional parameters.
     Avoids telescope constructor anti-pattern (many overloaded constructors).
     Provides a fluent, readable API. Each method validates and returns this.

  Q: Why use a typed EventEmitter?
  A: TypeScript checks that emitted event names and payloads match at compile time.
     Prevents typos in event names and mis-typed payloads.
     Provides auto-complete for event names and listener parameters.

  Q: What are SOLID principles applied in TypeScript?
  A: S — Single Responsibility: each class has one reason to change
     O — Open/Closed: extend via abstractions, not modification
     L — Liskov Substitution: subtypes must be substitutable for their base type
     I — Interface Segregation: prefer small, specific interfaces over fat ones
     D — Dependency Inversion: depend on abstractions, not concrete implementations
*/

export { AppConfig, NotificationFactory, QueryBuilder, TypedEventEmitter, OrderStateMachine };

---
```

<a id="typescript-react-typescript"></a>
## 08_react_typescript.tsx — QUESTION SET: TypeScript with React

```tsx
/**
 * QUESTION SET: TypeScript with React
 *
 * 1. Component props typing
 * 2. Event handlers
 * 3. useRef typing
 * 4. useState / useReducer typing
 * 5. Custom hooks with generics
 * 6. Context with TypeScript
 * 7. HOC typing
 * 8. React Query / SWR patterns
 */

import React, {
  useState, useEffect, useRef, useReducer, useCallback, useMemo,
  createContext, useContext, forwardRef, ComponentPropsWithRef,
  HTMLAttributes, ReactNode, FC, ComponentType,
} from "react";

// ─────────────────────────────────────────────
// Q1. Component props typing
// ─────────────────────────────────────────────

// Basic props — use interface (declaration merging support)
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button: FC<ButtonProps> = ({ label, onClick, disabled = false, variant = "primary", size = "md" }) => (
  <button onClick={onClick} disabled={disabled} className={`btn ${variant} ${size}`}>
    {label}
  </button>
);

// Extend native HTML element props — allows passing any div attribute
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const Card: FC<CardProps> = ({ title, children, footer, className, ...rest }) => (
  <div className={`card ${className ?? ""}`} {...rest}>
    <h2>{title}</h2>
    <div>{children}</div>
    {footer && <footer>{footer}</footer>}
  </div>
);

// Polymorphic component — render as different HTML elements
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "children">;

function Box<E extends React.ElementType = "div">({ as, children, ...rest }: PolymorphicProps<E>) {
  const Component = as ?? "div";
  return <Component {...rest}>{children}</Component>;
}

// <Box as="section" id="hero">...</Box>
// <Box as="button" onClick={handler}>...</Box>

// ─────────────────────────────────────────────
// Q2. Event handlers
// ─────────────────────────────────────────────

const FormExample: FC = () => {
  const [value, setValue] = useState("");

  // React.ChangeEvent<HTMLInputElement>
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);

  // React.FormEvent<HTMLFormElement>
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(value);
  };

  // React.MouseEvent<HTMLButtonElement>
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    console.log(e.currentTarget.name);
  };

  // React.KeyboardEvent<HTMLInputElement>
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit(e as any);
    if (e.ctrlKey && e.key === "s") console.log("save");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={value} onChange={handleChange} onKeyDown={handleKeyDown} />
      <button name="submit" onClick={handleClick}>Submit</button>
    </form>
  );
};

// ─────────────────────────────────────────────
// Q3. useRef typing
// ─────────────────────────────────────────────

const InputFocus: FC = () => {
  // Mutable ref to DOM element — initial value null, type is readonly after assignment
  const inputRef = useRef<HTMLInputElement>(null);
  // inputRef.current is HTMLInputElement | null

  // Mutable value ref (not a DOM ref) — not null initially
  const countRef = useRef<number>(0);
  // countRef.current is number

  useEffect(() => {
    inputRef.current?.focus(); // optional chain because it may be null before mount
  }, []);

  const increment = () => { countRef.current++; }; // mutate without re-render

  return <input ref={inputRef} />;
};

// forwardRef with proper typing
interface FancyInputProps {
  label: string;
  error?: string;
}

const FancyInput = forwardRef<HTMLInputElement, FancyInputProps>(
  ({ label, error }, ref) => (
    <div>
      <label>{label}</label>
      <input ref={ref} aria-invalid={!!error} />
      {error && <span role="alert">{error}</span>}
    </div>
  )
);
FancyInput.displayName = "FancyInput";

// ─────────────────────────────────────────────
// Q4. useReducer with discriminated union
// ─────────────────────────────────────────────

interface CartItem { id: string; name: string; price: number; qty: number; }
interface CartState { items: CartItem[]; total: number; }

type CartAction =
  | { type: "ADD_ITEM";    payload: Omit<CartItem, "qty"> }
  | { type: "REMOVE_ITEM"; payload: string } // id
  | { type: "UPDATE_QTY";  payload: { id: string; qty: number } }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      const items = existing
        ? state.items.map((i) => i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i)
        : [...state.items, { ...action.payload, qty: 1 }];
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case "REMOVE_ITEM": {
      const items = state.items.filter((i) => i.id !== action.payload);
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case "UPDATE_QTY": {
      const items = state.items.map((i) =>
        i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
      );
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }
    case "CLEAR":
      return { items: [], total: 0 };
  }
}

const CartComponent: FC = () => {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });
  return <div>{state.total}</div>;
};

// ─────────────────────────────────────────────
// Q5. Custom hooks with generics
// ─────────────────────────────────────────────

// useFetch — generic fetch hook
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function useFetch<T>(url: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error }); });

    return () => { cancelled = true; };
  }, [url]);

  return state;
}

// useLocalStorage — persists to localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key]
  );

  return [stored, setValue];
}

// ─────────────────────────────────────────────
// Q6. Context with TypeScript
// ─────────────────────────────────────────────

interface AuthUser { id: string; name: string; role: "admin" | "user"; }

interface AuthContextValue {
  user: AuthUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  isAuthenticated: boolean;
}

// undefined as default ensures the consumer is inside the provider
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const u = await fakeLogin(email, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, isAuthenticated: user !== null }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─────────────────────────────────────────────
// Q7. HOC typing
// ─────────────────────────────────────────────

// HOC that injects an extra prop
function withUser<Props extends { user: AuthUser }>(
  WrappedComponent: ComponentType<Props>
): FC<Omit<Props, "user">> {
  return function WithUserWrapper(props: Omit<Props, "user">) {
    const { user } = useAuth();
    if (!user) return null;
    return <WrappedComponent {...(props as Props)} user={user} />;
  };
}

interface ProfileProps { user: AuthUser; className?: string; }
const Profile: FC<ProfileProps> = ({ user, className }) => <div className={className}>{user.name}</div>;
const ProfileWithUser = withUser(Profile); // FC<{ className?: string }>

// ─────────────────────────────────────────────
// Q8. Common TypeScript + React gotchas
// ─────────────────────────────────────────────

// React.ReactNode vs React.ReactElement vs JSX.Element
// ReactNode: anything renderable — ReactElement, string, number, null, boolean, array
// ReactElement: the object returned by React.createElement (or JSX) — has type, props, key
// JSX.Element: alias for ReactElement<any, any>
// Use ReactNode for children props (most permissive)

// ComponentPropsWithRef vs ComponentPropsWithoutRef
// WithRef: includes ref in the type (for forwardRef components)
// WithoutRef: excludes ref — use for regular components

type DivProps = ComponentPropsWithRef<"div">;
// { ref?: Ref<HTMLDivElement>; className?: string; onClick?: ... }

// as const for literal types in JSX
const SIZES = ["sm", "md", "lg"] as const;
type Size = (typeof SIZES)[number]; // "sm" | "md" | "lg"

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between FC<Props> and (props: Props) => JSX.Element?
  A: FC<Props> (FunctionComponent) adds implicit children prop (in older React), implicitReturn,
     and displayName. In React 18+, FC no longer implicitly includes children.
     (props: Props) => JSX.Element is more explicit and preferred in modern React.
     Both are functionally equivalent for most use cases.
     The explicit form gives better TypeScript error messages.

  Q: How do you type an event handler that can be reused for multiple element types?
  A: Use the generic type: React.EventHandler<React.SyntheticEvent<T>>
     Or use a union: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
     For the most flexibility, use (e: React.SyntheticEvent) and cast within.

  Q: What is the difference between useRef<HTMLInputElement>(null) and useRef<HTMLInputElement | null>(null)?
  A: useRef<HTMLInputElement>(null) — TypeScript marks current as readonly: HTMLInputElement | null
     You can't reassign ref.current directly (immutable ref = DOM node ref).
     useRef<HTMLInputElement | null>(null) — current is mutable, assignable.
     Use the first form for DOM refs, second for mutable value storage.

  Q: How do you ensure exhaustive action handling in useReducer?
  A: Use a discriminated union for the action type and switch on action.type.
     Add a default case that calls assertNever(action) — it gets type never if all cases are handled.
     TypeScript will produce a compile error if you add a new action type without a case.

  Q: What is the correct way to type React context to avoid null assertion everywhere?
  A: Initialise context as: createContext<ContextType | undefined>(undefined)
     Create a custom hook that throws if the context is undefined.
     Callers of the hook get a non-null type; the throw gives a clear error if used outside provider.
*/

async function fakeLogin(email: string, password: string): Promise<AuthUser> {
  return { id: "1", name: "Alice", role: "user" };
}

export { Button, Card, FancyInput, CartComponent, AuthProvider, useAuth, useFetch, useLocalStorage };

---
```

<a id="typescript-theory-interview-qa"></a>
## FILE: 09_theory_interview_qa.ts

```typescript
/*
=============================================================
  TYPESCRIPT THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the difference between `type` and `interface` in TypeScript?
──────────────────────────────────────────────────────────────────────────────────
A: Both define object shapes, but they differ in:
   1. Declaration merging — ONLY interface supports it
   2. Computed / union shapes — ONLY type supports them
   3. extends syntax — interface uses 'extends'; type uses intersection '&'
   4. Error messages — interfaces often give better error messages for object shapes
*/

// Declaration Merging (interface only):
interface Window {
  myPlugin: () => void;
}
interface Window {
  anotherPlugin: string;
}
// Merged into one interface — useful for module augmentation
// const w: Window → has both myPlugin and anotherPlugin

// Union types (type alias only):
type StringOrNumber = string | number;       // impossible with interface
type Nullable<T>   = T | null;
type EventName     = 'click' | 'focus' | 'blur';

// Intersection vs extends (structurally equivalent but syntax differs):
interface Named { name: string; }
interface Aged extends Named { age: number; }  // interface extends

type Named2 = { name: string };
type Aged2  = Named2 & { age: number };        // type intersection

// Rule of thumb: use 'interface' for public API / class shapes (mergeable),
// use 'type' for computed, union, and complex generic utilities.

/*
Q2 [BASIC]: What is the difference between `any`, `unknown`, and `never`?
──────────────────────────────────────────────────────────────────────────
A: any    → opt out of type checking entirely. Values are both assignable FROM any and TO any.
   unknown → safe version of any. Unknown values can't be used until you narrow the type.
   never   → the type of values that never exist. Return type of functions that always throw or loop forever.
*/

function handleAny(val: any) {
  val.nonExistentMethod();   // ← no error! TypeScript trusts you. Dangerous.
  const n: number = val;     // also OK — any is assignable everywhere
}

function handleUnknown(val: unknown) {
  // val.nonExistentMethod();  // ← ERROR: Object is of type 'unknown'
  // Must narrow first:
  if (typeof val === 'string') {
    console.log(val.toUpperCase());  // ← OK: narrowed to string
  }
  if (val instanceof Error) {
    console.log(val.message);        // ← OK: narrowed to Error
  }
}

// never: exhaustive check pattern (compile-time guarantee you handled all cases)
type Shape = 'circle' | 'square' | 'triangle';

function getArea(shape: Shape): number {
  switch (shape) {
    case 'circle':   return Math.PI;
    case 'square':   return 1;
    case 'triangle': return 0.5;
    default:
      const _exhaustive: never = shape;  // ← if you add 'hexagon' to Shape without handling it
      throw new Error(`Unhandled shape: ${_exhaustive}`);  // TypeScript will error here
  }
}

/*
Q3 [BASIC]: What are generics and why are they needed?
────────────────────────────────────────────────────────
A: Generics allow writing reusable, type-safe code that works with multiple types
   without losing type information (unlike using `any`).
*/

// Without generics: forces you to use any or create duplicate functions
function identityAny(arg: any): any { return arg; }  // loses type info

// With generics: type is preserved
function identity<T>(arg: T): T { return arg; }
const s = identity('hello');  // T inferred as string, return type is string
const n = identity(42);       // T inferred as number

// Generic constraints: T must have a .length property
function logLength<T extends { length: number }>(arg: T): T {
  console.log(arg.length);
  return arg;
}

// Generic interface for a repository pattern:
interface Repository<T, ID = number> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: Omit<T, 'id'>): Promise<T>;
  delete(id: ID): Promise<void>;
}

interface User { id: number; name: string; email: string; }

class UserRepository implements Repository<User> {
  async findById(id: number): Promise<User | null> { return null; }
  async findAll(): Promise<User[]> { return []; }
  async save(entity: Omit<User, 'id'>): Promise<User> { return { id: 1, ...entity }; }
  async delete(id: number): Promise<void> {}
}

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: What are conditional types and how do you use `infer`?
──────────────────────────────────────────────────────────────────────────
A: Conditional types: T extends U ? X : Y   (like ternary for types)
   infer: declare a type variable within the conditional type to capture a subtype.
   Both are the foundation of TypeScript's built-in utility types.
*/

// Basic conditional type:
type IsString<T> = T extends string ? 'yes' : 'no';
type A = IsString<string>;  // 'yes'
type B = IsString<number>;  // 'no'

// Distributive conditional types (distributes over unions automatically):
type NonNullable2<T> = T extends null | undefined ? never : T;
type C = NonNullable2<string | null | undefined>;  // string

// infer: extract parts of a type
type ReturnType2<T> = T extends (...args: any[]) => infer R ? R : never;
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
type FirstArg<T>     = T extends (first: infer F, ...rest: any[]) => any ? F : never;

type FetchResult = ReturnType2<typeof fetch>;         // Promise<Response>
type Resolved    = UnpackPromise<Promise<number>>;    // number
type First       = FirstArg<(x: string, y: number) => void>;  // string

// Recursive conditional type: deep readonly
type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

interface Config {
  server: { host: string; port: number; ssl: { cert: string } };
  db: string[];
}
type FrozenConfig = DeepReadonly<Config>;
// FrozenConfig.server.port → readonly number
// FrozenConfig.db → ReadonlyArray<string>

/*
Q5 [INTERMEDIATE]: What are mapped types and how do you use keyof and in?
──────────────────────────────────────────────────────────────────────────
A: Mapped types iterate over a union of keys and transform each property.
   keyof T → union of keys of T
   { [K in keyof T]: ... } → iterate over all keys of T
*/

interface Product { id: number; name: string; price: number; active: boolean; }

// Implementing standard utility types from scratch (shows how they work):
type MyPartial<T>  = { [K in keyof T]?: T[K] };            // Partial
type MyRequired<T> = { [K in keyof T]-?: T[K] };           // Required (remove optional)
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };    // Readonly
type MyRecord<K extends keyof any, V> = { [P in K]: V };   // Record

// With remapping (TypeScript 4.1+): rename keys via 'as'
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type ProductGetters = Getters<Product>;
// → { getId: () => number; getName: () => string; getPrice: () => number; ... }

// Filtering keys by type:
type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

type ProductStringKeys = StringKeys<Product>;  // 'name'

// Pick only string-valued fields:
type StringFields<T> = Pick<T, StringKeys<T>>;
type ProductStringFields = StringFields<Product>;  // { name: string }

/*
Q6 [INTERMEDIATE]: What are Template Literal Types?
─────────────────────────────────────────────────────
A: TypeScript 4.1+ allows constructing string literal types at the type level.
   Extremely powerful for event names, CSS properties, type-safe API routes.
*/

// Type-safe event system:
type EventPrefix = 'click' | 'focus' | 'blur' | 'change';
type DOMElement  = 'Button' | 'Input' | 'Form';
type EventName2  = `on${DOMElement}${Capitalize<EventPrefix>}`;
// → 'onButtonClick' | 'onButtonFocus' | 'onButtonBlur' | 'onButtonChange' | ...

// Extract route params from string literal:
type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<`/${Rest}`>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {};

type RouteParams = ExtractRouteParams<'/users/:userId/posts/:postId'>;
// → { userId: string; postId: string }

// Type-safe CSS property builder:
type CSSProperty = `${string}-${string}`;
type StyleValue  = `${number}px` | `${number}%` | `${number}rem` | 'auto' | 'none';

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q7 [ADVANCED]: What are branded (nominal) types and when do you need them?
───────────────────────────────────────────────────────────────────────────
A: TypeScript is STRUCTURALLY typed: two types with the same shape are interchangeable.
   Sometimes you want NOMINAL typing: UserId and ProductId are both numbers but
   should NOT be interchangeable. Branded types solve this.
*/

// Without branding: bug compiles fine
declare function getUser(id: number): void;
declare function getProduct(id: number): void;
const userId    = 42;
const productId = 99;
getUser(productId);    // ← compiles! But semantically wrong.

// Branded types: append a phantom type marker
type Brand<T, B> = T & { readonly _brand: B };
type UserId    = Brand<number, 'UserId'>;
type ProductId = Brand<number, 'ProductId'>;
type OrderId   = Brand<string, 'OrderId'>;

// Smart constructors (the only way to create branded values):
function createUserId(id: number): UserId {
  if (id <= 0) throw new Error('UserId must be positive');
  return id as UserId;  // single assertion, controlled
}

declare function getUser2(id: UserId): void;
declare function getProduct2(id: ProductId): void;

const uid = createUserId(42);
// getProduct2(uid);  // ← TypeScript ERROR: UserId is not assignable to ProductId ✓
getUser2(uid);       // ← OK

// Real-world: validated email
type ValidEmail = Brand<string, 'ValidEmail'>;
function validateEmail(email: string): ValidEmail {
  if (!email.includes('@')) throw new Error('Invalid email');
  return email as ValidEmail;
}

/*
Q8 [ADVANCED]: What is TypeScript variance? Covariance vs contravariance.
──────────────────────────────────────────────────────────────────────────
A: Variance describes how subtype relationships flow through generic types.
   Covariant: if A extends B, then Container<A> extends Container<B> (same direction)
   Contravariant: if A extends B, then Handler<B> extends Handler<A> (opposite direction)

   In TypeScript:
   - Return types are COVARIANT (can return more specific type)
   - Parameter types are CONTRAVARIANT (can accept more general type)
   - Array<T> is technically covariant but TypeScript allows unsound mutation
*/
class Animal { breathe() {} }
class Dog extends Animal { bark() {} }
class Cat extends Animal { meow() {} }

// Covariant: return type can be MORE specific (narrower)
function animalFactory(): Animal { return new Animal(); }
// It's safe to substitute a function that returns Dog where Animal is expected:
const dogFactory: () => Animal = (): Dog => new Dog();  // ← OK: Dog is a subtype of Animal

// Contravariant: parameter type must be MORE general (wider)
function handleDog(handler: (d: Dog) => void) { handler(new Dog()); }
// Safe to pass a handler that handles ANY Animal (can handle Dog too):
handleDog((a: Animal) => a.breathe());   // ← OK: function accepting Animal can handle Dog
// handleDog((c: Cat) => c.meow());     // ← ERROR: Cat handler can't necessarily handle Dog

// TypeScript 4.7 explicit variance annotations:
interface Container<out T> { get(): T }        // out = covariant (produce T)
interface Consumer<in T>   { consume(t: T): void } // in = contravariant (consume T)

/*
Q9 [ADVANCED]: How do you use module augmentation and declaration merging in TypeScript?
─────────────────────────────────────────────────────────────────────────────────────────
A: Module augmentation: add properties to existing types from external libraries.
   Useful for: extending Express Request, adding properties to global Window,
   augmenting 3rd-party library types without modifying them.
*/

// Extending Express Request type (common pattern):
// In types/express.d.ts:
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; roles: string[] };
      requestId: string;
    }
  }
}
// Now in route handlers: req.user.id is properly typed without casting

// Extending Window for analytics:
declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
    gtag: (command: string, ...args: unknown[]) => void;
  }
}

// Module augmentation for a library (not global):
// import 'my-ui-lib'; // necessary to make this a module augmentation
// declare module 'my-ui-lib' {
//   interface Theme {
//     customColor: string;  // add to existing Theme interface
//   }
// }

/*
Q10 [ADVANCED]: What is the `satisfies` operator (TS 4.9) and how does it differ from `as`?
─────────────────────────────────────────────────────────────────────────────────────────────
A: `satisfies` validates that a value conforms to a type WITHOUT widening the value to that type.
   With `as const` + `satisfies`: you get BOTH strict inference AND type safety.
   Compare:
   - `as Type`    → forces type, loses literal inference, unsafe (can assert wrong type)
   - `: Type`     → widens type, loses literals
   - `satisfies Type` → validates against Type, but KEEPS narrowed/literal type
*/

type Routes = Record<string, { path: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE' }>;

// Problem with `: Routes` — widens method to 'GET' | 'POST' | ... (loses literal 'GET')
const routes1: Routes = {
  users: { path: '/users', method: 'GET' },
};
type R1Method = typeof routes1.users.method;  // string literal union — actually widened

// `satisfies` validates the type but preserves the literal 'GET':
const routes2 = {
  users:   { path: '/users',        method: 'GET'    },
  createUser: { path: '/users',     method: 'POST'   },
  updateUser: { path: '/users/:id', method: 'PUT'    },
} satisfies Routes;

type R2Method = typeof routes2.users.method;  // 'GET' — preserved!
// routes2.users.method = 'DELETE';  // ← type error: 'DELETE' not assignable to 'GET'

// Combined with autocomplete: IDE gives full Routes validation + keeps literal types
const config = {
  theme: 'dark',
  debug: true,
  retries: 3,
} satisfies Partial<{
  theme: 'dark' | 'light';
  debug: boolean;
  retries: number;
  timeout: number;
}>;
// config.theme is 'dark' not 'dark' | 'light'

export { UserRepository };
export type { Repository, UserId, ProductId, ValidEmail, RouteParams, DeepReadonly };

---
```

---

<a id="typescript-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Migrating a 60 k-LOC JavaScript Codebase to TypeScript

**Situation:** Your team decides to migrate a large Express + React monorepo to TypeScript. You lead the effort.

**Question:** What is your strategy to minimise disruption?

**Answer:**
1. **Rename incrementally** `.js` → `.ts` one module at a time; start with utility functions (least side effects).
2. Enable `"allowJs": true` and `"checkJs": true` first — get errors without renaming.
3. Set `"strict": false` initially, enable strict flags one at a time (`strictNullChecks`, `noImplicitAny`, etc.) per module.
4. Use `// @ts-nocheck` at the top of complex files to unblock PRs while you revisit.
5. Add `"incremental": true` from day one to keep build times manageable.
6. Migrate shared types/interfaces first (API contracts, DB models) so the rest of the codebase can import them.

---

### Scenario 2: Third-Party Library Has Wrong or Missing Typings

**Situation:** An analytics library you use has incorrect `@types/analytics` that says a function returns `void` but it actually returns a `Promise`. This causes a type error in your code.

**Question:** How do you fix it without waiting for an upstream patch?

**Answer:**
- Create a **declaration merging file** in your project:

```typescript
// src/types/analytics.d.ts
declare module 'some-analytics-lib' {
  export function track(event: string, props?: Record<string, unknown>): Promise<void>;
}
```

- Or use a local `*.d.ts` patch via `paths` in `tsconfig.json` to shadow the installed types.
- Long-term: open a PR to DefinitelyTyped or the library's own typings.

---

### Scenario 3: Discriminated Union Exhaustiveness — Adding a New Case Breaks Nothing

**Situation:** Your codebase uses a discriminated union for notification types. A new type `"push"` is added and nobody updates the render switch. Users silently see nothing.

**Question:** How do you make TypeScript catch missing cases at compile time?

**Answer:**

```typescript
type Notification =
  | { kind: 'email'; address: string }
  | { kind: 'sms'; phone: string }
  | { kind: 'push'; deviceToken: string };   // newly added

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function render(n: Notification) {
  switch (n.kind) {
    case 'email': return renderEmail(n);
    case 'sms':   return renderSms(n);
    // Forgetting 'push' → TypeScript error: Argument of type '{ kind: "push" }' is not assignable to parameter 'never'
    default: return assertNever(n);
  }
}
```

---

### Scenario 4: Generic Utility — Deep Readonly

**Situation:** You want to prevent deep mutation of configuration objects at compile time. `Readonly<T>` only works one level deep.

**Question:** Implement `DeepReadonly<T>`.

**Answer:**

```typescript
type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// Usage
type Config = DeepReadonly<{ db: { host: string; port: number } }>;
const cfg: Config = { db: { host: 'localhost', port: 5432 } };
cfg.db.port = 9999; // TS Error: Cannot assign to 'port' because it is a read-only property
```

---

### Scenario 5: Type-Safe API Client — Inferring Response Types from Route Definitions

**Situation:** Your team builds an internal fetch wrapper. Every time someone calls `api.get('/users')` they manually cast `as User[]`, leading to silent mismatches when the API changes.

**Question:** How do you make the response type inferred automatically?

**Answer:**

```typescript
// Define route → response type mapping
interface RouteMap {
  '/users':        User[];
  '/users/:id':    User;
  '/products':     Product[];
}

async function api<R extends keyof RouteMap>(route: R): Promise<RouteMap[R]> {
  const res = await fetch(route as string);
  return res.json();
}

// Now this is typed automatically
const users = await api('/users');   // type: User[]
const user  = await api('/users/:id'); // type: User
```

---

### Scenario 6: `any` Creeping In — Maintaining Type Safety Over Time

**Situation:** Code reviews show that `any` is being used to unblock PRs. Over time 40% of functions have `any` in their signatures. How do you enforce discipline?

**Answer:**
- Enable `"noImplicitAny": true` — requires explicit annotation when TypeScript can't infer.
- Add ESLint rule `@typescript-eslint/no-explicit-any` with `warn` or `error`.
- Use `unknown` instead of `any` for truly unknown input — forces narrowing before use.
- Create an `eslint-disable` audit in CI: count `// eslint-disable` comments; fail the build if count grows.
- For external data (API responses, JSON.parse), define Zod/io-ts schemas that validate AND infer types simultaneously.

---

### Scenario 7: Conditional Types for a Flexible API

**Situation:** You're building a function `fetchResource(type, id?)` where passing `id` returns a single object and omitting `id` returns an array.

**Question:** Type this so the return type changes based on whether `id` is passed.

**Answer:**

```typescript
type FetchResult<T, HasId extends boolean> = HasId extends true ? T : T[];

function fetchResource<HasId extends boolean = false>(
  type: 'user' | 'product',
  id?: HasId extends true ? string : never
): Promise<FetchResult<User | Product, HasId>> {
  return id
    ? fetch(`/api/${type}/${id}`).then(r => r.json())
    : fetch(`/api/${type}`).then(r => r.json());
}
```

---

### Scenario 8: Runtime Validation + TypeScript Types from One Source

**Situation:** You define TypeScript interfaces for API payloads. Developers manually maintain a validation function separately. They drift apart causing runtime errors.

**Question:** What tool eliminates this duplication?

**Answer:**
- Use **Zod** (or io-ts / Yup with TypeScript mode):

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id:    z.string().uuid(),
  email: z.string().email(),
  age:   z.number().min(0).max(120),
});

// Type inferred automatically — no separate interface needed
type User = z.infer<typeof UserSchema>;

// Runtime validation
const result = UserSchema.safeParse(req.body);
if (!result.success) return res.status(400).json(result.error.format());
const user: User = result.data; // fully typed and validated
```

---

### Scenario 9: Decorator-Based Validation in a NestJS Context

**Situation:** You have a NestJS controller where DTOs use class-validator decorators. A new repo member asks why the decorators are needed when TypeScript already defines the shape.

**Question:** Explain the difference between TypeScript types and runtime validation, and how decorators bridge the gap.

**Answer:**
- TypeScript types are **erased at compile time** — they provide zero runtime protection.
- When a request hits your API, the body is raw JSON (`unknown`). TypeScript will NOT throw if the payload has wrong or missing fields.
- `class-validator` + `class-transformer` decorators run at runtime, validating the actual data.
- NestJS `ValidationPipe` applies both: transforms the raw body into a class instance, then runs decorator validators.
- This means `@IsEmail()`, `@IsNotEmpty()` are your runtime safety net; TypeScript types just give you IDE completion.

---

### Scenario 10: Mapped Type for an ORM Repository Pattern

**Situation:** You want every repository to expose typed CRUD methods based on the entity type, without writing the same `findById`, `save`, `delete` signatures 20 times.

**Answer:**

```typescript
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  save(entity: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<T>;
  delete(id: string): Promise<void>;
}

class UserRepository implements Repository<User> { /* ... */ }
class ProductRepository implements Repository<Product> { /* ... */ }
// Each gets full type safety and IDE autocomplete for free
```
