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
