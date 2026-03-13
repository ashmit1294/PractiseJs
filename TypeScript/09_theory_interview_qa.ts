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
