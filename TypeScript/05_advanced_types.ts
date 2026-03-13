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
