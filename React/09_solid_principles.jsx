/**
 * SOLID PRINCIPLES IN REACT
 *
 * SOLID is an acronym for 5 object-oriented design principles.
 * In React, we apply these to components, hooks, and module structure.
 *
 * S - Single Responsibility Principle
 * O - Open/Closed Principle
 * L - Liskov Substitution Principle
 * I - Interface Segregation Principle
 * D - Dependency Inversion Principle
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// S — SINGLE RESPONSIBILITY PRINCIPLE (SRP)
// "A component/function should have only ONE reason to change."
// Every component should do ONE thing only.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: This component does too many things:
//   - fetches data from API
//   - formats the date
//   - renders the UI
//   If any of these change, you must edit this one big component.
function UserProfileBAD({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);

  if (!user) return <p>Loading...</p>;

  const formatted = new Date(user.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <small>Joined: {formatted}</small>
    </div>
  );
}

// ✅ GOOD: Each piece has one job
// 1. Custom hook handles data fetching — only changes if API changes
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => { setUser(data); setLoading(false); });
  }, [userId]);

  return { user, loading };
}

// 2. Utility handles formatting — only changes if date format changes
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

// 3. Component handles rendering — only changes if UI design changes
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {/* formatDate is separate so it can be tested and reused independently */}
      <small>Joined: {formatDate(user.createdAt)}</small>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// O — OPEN/CLOSED PRINCIPLE (OCP)
// "Open for extension, closed for modification."
// You should be able to ADD new behaviour without editing existing code.
// In React: use composition, props, and render patterns.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: To add a new button type, you MUST edit this component (adding else-if)
function ButtonBAD({ type, label, onClick }) {
  if (type === 'primary') {
    return <button style={{ background: 'blue', color: '#fff' }} onClick={onClick}>{label}</button>;
  } else if (type === 'danger') {
    return <button style={{ background: 'red', color: '#fff' }} onClick={onClick}>{label}</button>;
  }
  // Every new type requires editing THIS file ← violates OCP
  return <button onClick={onClick}>{label}</button>;
}

// ✅ GOOD: A base Button accepts any className/style.
// New variants are EXTENSIONS (new components), not modifications.
function Button({ className = '', children, ...rest }) {
  // Base button is closed for modification
  return (
    <button className={`btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

// Each variant is an EXTENSION — zero changes to Button needed
const PrimaryButton = (props) => <Button className="btn-primary" {...props} />;
const DangerButton  = (props) => <Button className="btn-danger"  {...props} />;
const GhostButton   = (props) => <Button className="btn-ghost"   {...props} />;
// To add "SuccessButton" tomorrow: just create a new extension. Button unchanged.

// ─────────────────────────────────────────────────────────────────────────────
// O — OCP with render props / component composition
// ─────────────────────────────────────────────────────────────────────────────

// A list that is open for extension via a render prop.
// The List itself never changes when you need a new item layout.
function List({ items, renderItem }) {
  // List handles iteration. HOW each item looks is "extended" via renderItem.
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage: extend without touching List
// <List items={users} renderItem={(u) => <UserCard user={u} />} />
// <List items={products} renderItem={(p) => <ProductCard product={p} />} />

// ─────────────────────────────────────────────────────────────────────────────
// L — LISKOV SUBSTITUTION PRINCIPLE (LSP)
// "A child component should be substitutable for its parent
//  without breaking the application."
// In React: a specialised component must honour the same prop contract
//           as the base component it replaces.
// ─────────────────────────────────────────────────────────────────────────────

// Base Input — works as expected when you pass value + onChange
function Input({ value, onChange, placeholder, ...rest }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...rest}                      // pass-through allows any HTML input attribute
    />
  );
}

// ✅ GOOD: PasswordInput substitutes Input without breaking callers.
// It adds behaviour (toggle visibility) but KEEPS the same prop contract.
function PasswordInput({ value, onChange, placeholder, ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Delegates to <input> directly — same HTML contract preserved */}
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Password'}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ❌ BAD LSP violation: SearchInput ignores onChange — callers break
function SearchInputBAD({ placeholder }) {
  // Accepts placeholder but drops the onChange prop entirely
  // Any caller expecting controlled input behaviour gets broken
  return <input placeholder={placeholder} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// I — INTERFACE SEGREGATION PRINCIPLE (ISP)
// "Don't force a component to depend on props it doesn't use."
// In React: keep prop interfaces small and focused.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: UserCard receives a huge user object but only uses name + avatar.
// Every time ANY field on the user object changes shape, UserCard must be updated.
function UserCardBAD({ user }) {
  // user has: id, name, email, avatar, phone, address, createdAt, role, ...
  // But we only use name and avatar — the rest is wasted coupling!
  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <p>{user.name}</p>
    </div>
  );
}

// ✅ GOOD: Only accept the exact props this component needs.
// The caller decides what to pass. UserCard is decoupled from the User type.
function UserCard({ name, avatar }) {
  return (
    <div>
      <img src={avatar} alt={name} />
      <p>{name}</p>
    </div>
  );
}

// Caller example:
// <UserCard name={user.name} avatar={user.avatar} />
//
// Benefits:
// - Component is reusable for ANY data that has name + avatar (not just User)
// - Unit testing is trivial: just pass { name: 'Alice', avatar: '/alice.png' }
// - Renaming user.email won't cause a re-render / test failure in UserCard

// ─────────────────────────────────────────────────────────────────────────────
// I — ISP with custom hooks
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: One massive hook that every component imports but only uses part of
function useAuthEverythingBAD() {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  // login, logout, refresh, checkPermission, updateProfile...
  return { user, permissions, sessionExpiry /*, ... */ };
}

// ✅ GOOD: Small focused hooks. Components import only what they need.
function useCurrentUser() {
  const [user, setUser] = useState(null);
  // fetch & return current user only
  return user;
}

function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  // fetch & return permissions only
  return permissions;
}

function useSessionExpiry() {
  const [expiry, setExpiry] = useState(null);
  return expiry;
}

// ─────────────────────────────────────────────────────────────────────────────
// D — DEPENDENCY INVERSION PRINCIPLE (DIP)
// "High-level components should not depend on low-level details.
//  Both should depend on abstractions."
// In React: inject dependencies (services, fetchers) as props or context
//           instead of hard-coding them inside components.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Component directly calls fetch (hard-coded dependency on browser fetch API)
// You cannot unit-test this without mocking global fetch.
// You cannot swap to GraphQL or a mock API without editing the component.
function UserListBAD() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users')                   // ← tightly coupled to REST fetch
      .then(r => r.json())
      .then(setUsers);
  }, []);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ✅ GOOD: The component depends on the ABSTRACTION (a function that returns users),
// not on the concrete implementation (fetch, axios, GraphQL).
function UserList({ fetchUsers }) {
  // fetchUsers is an INJECTED dependency — could be fetch, axios, mock, anything
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, [fetchUsers]);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Production wiring — the concrete implementation lives at the call site
const realFetchUsers = () =>
  fetch('/api/users').then(r => r.json());

// Test wiring — trivially swap without touching UserList
const mockFetchUsers = () =>
  Promise.resolve([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);

// Usage:
// <UserList fetchUsers={realFetchUsers} />   ← production
// <UserList fetchUsers={mockFetchUsers} />   ← unit test / Storybook

// ─────────────────────────────────────────────────────────────────────────────
// D — DIP with React Context as an abstraction layer
// ─────────────────────────────────────────────────────────────────────────────

// Define the "abstraction" shape (what callers depend on)
const ApiContext = React.createContext(null);

// Provider: swap the implementation by changing ONE value here
function ApiProvider({ children, api }) {
  // api could be: { getUsers: fetchUsers } or { getUsers: mockApi.getUsers }
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

// Consumer: depends on the abstraction (context), not on fetch/axios
function UserListDIP() {
  const api = React.useContext(ApiContext);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.getUsers().then(setUsers);         // depends on abstraction
  }, [api]);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE EXAMPLE: All 5 principles applied together
// ─────────────────────────────────────────────────────────────────────────────

// Each hook has a single responsibility (S)
function useProducts(fetchProducts) {                // DIP: injected dependency
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchProducts()
      .then(data => { setProducts(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, [fetchProducts]);

  return { products, loading, error };
}

// Small, focused props (I)
function ProductCard({ name, price, imageUrl }) {
  return (
    <div className="product-card">
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      <p>${price.toFixed(2)}</p>
    </div>
  );
}

// Open for extension via renderProduct render prop (O)
function ProductList({ fetchProducts, renderProduct }) {
  const { products, loading, error } = useProducts(fetchProducts); // DIP

  if (loading) return <p>Loading products…</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div className="product-grid">
      {products.map(p => (
        <React.Fragment key={p.id}>
          {renderProduct(p)}             {/* O: caller decides how to render */}
        </React.Fragment>
      ))}
    </div>
  );
}

// SaleProductCard SUBSTITUTES ProductCard — same props, extra badge (L)
function SaleProductCard({ name, price, imageUrl, discount }) {
  return (
    <div className="product-card sale">
      <span className="badge">-{discount}%</span>
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      {/* Shows discounted price, original contract (name/price/imageUrl) intact */}
      <p>
        <s>${price.toFixed(2)}</s>
        <strong> ${(price * (1 - discount / 100)).toFixed(2)}</strong>
      </p>
    </div>
  );
}

// App: wires everything together
function App() {
  const fetchProducts = useCallback(
    () => fetch('/api/products').then(r => r.json()),
    []
  );

  return (
    <ProductList
      fetchProducts={fetchProducts}
      renderProduct={(p) =>
        p.discount
          ? <SaleProductCard {...p} />    // Liskov: substitutable for ProductCard
          : <ProductCard {...p} />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/*
Q: What does SOLID stand for?
A:
  S - Single Responsibility: one component, one job
  O - Open/Closed: extend via new code; never edit working code
  L - Liskov Substitution: child can replace parent without breaking things
  I - Interface Segregation: don't force unused props on a component
  D - Dependency Inversion: depend on abstractions, inject concrete things

Q: How does SRP apply to React specifically?
A: Split data-fetching into custom hooks, business logic into utility functions,
   and keep components focused on rendering. If a component has more than one
   reason to change, extract the unrelated concern.

Q: What is the OCP in React components?
A: A button component should not need editing every time you add a new type.
   Instead, extend it: create new wrapper components (PrimaryButton, DangerButton)
   that pass the necessary className/style. The original Button is never touched.

Q: How does render props / component composition support OCP?
A: By accepting a renderItem or renderProduct prop, a List component never needs
   to change when new item layouts are added. Callers provide new layouts by
   passing new render functions — zero modifications to List.

Q: Give a real-world React example of LSP violation.
A: A SearchInput that accepts value + onChange props but ignores onChange. Any
   parent that uses it in a controlled-input pattern will silently break. LSP
   means all components fulfil the prop contract the parent expects.

Q: How does ISP prevent prop drilling / over-coupling?
A: Instead of passing an entire user object to a UserCard (which only needs
   name + avatar), pass just those two props. The card is decoupled from the
   User type and is now reusable for any data that provides name + avatar.

Q: What is the practical difference between DIP in React vs DI in OOP?
A: In OOP you inject class instances into constructors. In React you inject
   functions/services as props or via Context. The goal is the same: the
   component never imports or calls a concrete implementation directly, it
   calls whatever was provided to it.

Q: Does following SOLID make components harder to read?
A: No — usually the opposite. Components become shorter and more focused.
   The "overhead" is naming and structuring files well. Each file/hook/component
   is simpler because it has one job.

Q: When should you NOT strictly follow SOLID?
A: Early prototyping / one-off scripts where future extension is unlikely.
   Aggressively splitting a 20-line component into 5 files would be over-engineering.
   Apply SOLID when a component is growing, being reused, or is hard to test.
*/

export {
  UserProfile, Button, PrimaryButton, DangerButton, GhostButton,
  List, Input, PasswordInput, UserCard, UserList, ProductList,
  ProductCard, SaleProductCard,
};
