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
