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
