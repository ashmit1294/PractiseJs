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
