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
// WHAT: How do TypeScript primitive types differ from any/unknown/never/void?
// THEORY: string, number, boolean, null, undefined, symbol, bigint = primitives. any disables checking. unknown requires type narrowing. never = unreachable value. void = no return
// Time: O(1)  Space: O(1)
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
// WHAT: When should you use interface vs type alias in TypeScript?
// THEORY: interface = object shapes, declaration merging, public APIs. type = unions, intersections, mapped/conditional types, complex compositions. Both work for objects; differ in features
// Time: O(1)  Space: O(1)
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


// =============================================================================
// User and UserAddress -- Schema definition and relationship patterns
// =============================================================================

// 1. Base address interface -- define the smaller shape first
interface UserAddress {
  id: string;
  street: string;
  city: string;
  state: string;        // 2-letter code e.g. "CA"
  zip: string;
  country: string;
  isPrimary: boolean;
}

// 2. User interface -- 1-to-1 composition (User HAS one address)
interface UserWithAddress {
  id: string;
  name: string;
  email: string;
  address: UserAddress; // compose, do not embed raw fields
  createdAt: Date;
}

// 3. Optional address variant (user hasn't filled it in yet)
interface UserOptionalAddress {
  id: string;
  name: string;
  email: string;
  address?: UserAddress; // ? = may be undefined
}

// 4. One-to-many variant (multiple shipping / billing addresses)
interface UserMultiAddress {
  id: string;
  name: string;
  email: string;
  addresses: UserAddress[];   // 1-to-many
  primaryAddressId: string;   // FK-style pointer to the default
}

// 5. DTO types -- shape data at API boundaries without leaking internals
type CreateUserDTO = Omit<UserWithAddress, 'id' | 'createdAt'>; // POST
type UpdateUserDTO = Partial<Omit<UserWithAddress, 'id'>>;       // PATCH
type UserSummary   = Pick<UserWithAddress, 'id' | 'name' | 'email'>; // list

// 6. Readonly -- immutable after creation
interface ImmutableUser {
  readonly id: string;
  readonly email: string;
  address: UserAddress;
}

// Usage
const user: UserWithAddress = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@example.com',
  address: {
    id: 'a-1',
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'US',
    isPrimary: true,
  },
  createdAt: new Date(),
};

// TypeScript catches wrong shapes at compile time:
// user.address.zip = 12345; // Error: number not assignable to string

export type { UserAddress, UserWithAddress, UserOptionalAddress,
              UserMultiAddress, CreateUserDTO, UpdateUserDTO, UserSummary };
