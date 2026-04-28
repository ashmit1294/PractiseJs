# 16 — Command Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Encapsulate a request as an object with execute/undo lifecycle |
| Why | Enables undo/redo, queuing, logging; decouples invoker from receiver |
| Components | Command (interface) · ConcreteCommand (holds receiver + pre-state) · Receiver (does work) · Invoker (triggers, holds history) |
| Undo key | Save state BEFORE executing; new command clears redo stack |
| When NOT | Simple one-off actions with no undo/queue requirement |

---

## The Analogy

A **restaurant order slip**: the waiter (invoker) writes the order on a slip and passes it to the kitchen (receiver). The waiter doesn't cook; the slip can be queued, cancelled, or recalled. The kitchen doesn't know who the waiter is. The slip is the command.

---

## Core Concept

Without Command, the invoker calls the receiver directly — tightly coupled, no history, no undo. Command wraps the request in an object, which the invoker stores. Because each command is an object, you can put them in a queue, log them, replay them, and reverse them.

The undo mechanism works by saving enough state *before* `execute()` runs so that `undo()` can restore it. When a new command is executed, the redo stack is cleared because the history has branched.

```python
class TextEditor:
    def __init__(self): self.content = ""

class InsertCommand:
    def __init__(self, editor, text):
        self.editor = editor
        self.text = text
        self._snapshot = None        # state before execute

    def execute(self):
        self._snapshot = self.editor.content
        self.editor.content += self.text

    def undo(self):
        self.editor.content = self._snapshot

editor = TextEditor()
history = []

cmd = InsertCommand(editor, "Hello")
cmd.execute(); history.append(cmd)   # "Hello"
cmd2 = InsertCommand(editor, " World")
cmd2.execute(); history.append(cmd2) # "Hello World"

history.pop().undo()                 # back to "Hello"
```

**MacroCommand** — a command that holds a list of commands, executing them in order and undoing them in reverse.

---

## When to Use / When NOT to Use

**Use when:**
- Undo/redo is a requirement (text editors, drawing apps, game moves)
- Requests need to be queued, scheduled, or replayed (task queues, job systems)
- You need a transaction log for auditing or rollback
- You want to decouple the object that triggers an action from the one that performs it

**Avoid when:**
- The action is fire-and-forget with no undo/queue need — just call the method
- You end up with dozens of nearly identical command classes — use a parameterized command or callable instead

---

## Common Mistakes

**Business logic in the Command** — the command should hold *what* to do and *on whom*, not implement the logic itself. Delegate to the receiver. Commands that do real work become untestable and violate SRP.

**Not saving state for undo** — capturing state *after* execute is useless. Snapshot before.

**Not clearing the redo stack on new command** — after undo, if the user performs a new action, the redo stack is now invalid (the timeline has changed). Always clear it.

**Class explosion** — if every minor action gets its own class, the codebase balloons. Use parameterized commands (e.g., `SetPropertyCommand(obj, "color", new_val, old_val)`) to cover families of similar actions.

---

## Interview Q&A

**Q: Design undo/redo for a text editor.**  
Two stacks: `undo_stack` and `redo_stack`. `execute(cmd)` → `cmd.execute()`, push to undo stack, clear redo stack. `undo()` → pop from undo stack, call `cmd.undo()`, push to redo stack. `redo()` → pop from redo stack, call `cmd.execute()`, push to undo stack.

**Q: How is Command different from Strategy?**  
Strategy swaps *algorithms* at runtime with no lifecycle. Command has a *lifecycle*: execute, undo, queue, log. A command is also typically a one-time action; a strategy is a long-lived policy.

**Q: How would you implement a macro?**  
`MacroCommand` holds a `list[Command]`. Its `execute()` calls each in order; its `undo()` calls each in *reverse* order.

---

## Key Takeaways

- Command turns a request into an object — giving it a lifecycle (queue, log, undo/redo)
- Save state BEFORE execute; undo restores it; new execute clears the redo stack
- Business logic belongs in the Receiver, not the Command — commands just hold references and pre-state
- Prefer parameterized commands over a class-per-action to avoid class explosion
