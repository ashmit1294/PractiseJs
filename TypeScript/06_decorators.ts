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
