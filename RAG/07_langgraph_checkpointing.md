# LangGraph State & Checkpointing — Stateful Agentic RAG
> Resume Signal: LangGraph, stateful agents, TypedDict, MemorySaver, thread_id, interrupt_before, human-in-the-loop

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A customer support agent built with a simple LLM chain had no memory between turns — users had to repeat context every message. Adding a second agent (an escalation agent) meant passing state manually between them via fragile string parsing. Adding human approval before any refund action was bolted on with ad-hoc if/else logic. |
| **Task** | Rebuild the agent using LangGraph to get persistent multi-turn memory, clean state passing between nodes, and first-class human-in-the-loop interrupts before destructive actions (refunds, account deletions). |
| **Action** | Defined a `TypedDict` state schema (`messages`, `user_id`, `pending_action`, `approved`). Used `MemorySaver` for thread-scoped checkpointing keyed by `thread_id`. Added `interrupt_before=["refund_node"]` so the graph pauses and surfaces the pending state to a human reviewer before the refund executes. On approval, the graph resumes from the exact checkpoint with `approved=True`. |
| **Result** | Every conversation thread (user session) has persistent state across turns. Human reviewers see a clean, structured `pending_action` dict — not raw LLM text. Approval latency dropped from 8 minutes (parsing emails) to 40 seconds (structured dashboard using the checkpointed state). Zero unintended refunds in post-launch audit. |

---

## ELI5

**LangGraph** is a way to build AI agents as a **directed graph** — nodes are processing steps (call LLM, run tool, check condition), edges are transitions between steps. It adds two superpowers over basic LangChain chains:
1. **Persistent state** — every graph run has a state dictionary that every node can read and write. It's like a shared whiteboard that all steps can see and update.
2. **Checkpointing** — the state is saved after every node. If the process is interrupted (crash, human approval needed), you can resume from exactly where it stopped — no re-running the whole graph.

`thread_id` is the "conversation ID" — your graph can have millions of parallel conversations, each with its own isolated state snapshot.
`interrupt_before` is how you pause the graph and ask a human "are you sure?" before a dangerous node runs.

---

## Key Terms Defined

| Term | What it is | Why it matters here |
|---|---|---|
| **LangGraph** | Python library (from LangChain team) for building stateful, multi-step LLM agent workflows as explicit directed graphs. Nodes = Python functions (or LLM calls). Edges = transitions (conditional or unconditional). Built on top of LangChain but can be used standalone. | Provides the graph execution engine, state management, and checkpointing infrastructure |
| **StateGraph** | The main LangGraph class. `StateGraph(MyState)` creates a graph whose every node receives and returns the same `MyState` TypedDict. You add nodes and edges, then call `.compile()` to get a runnable graph. | The container that wires together all nodes, edges, and the state schema |
| **TypedDict** | Python stdlib class (from `typing`). A dict with declared key names and types. `class AgentState(TypedDict): messages: list[str]; approved: bool`. LangGraph uses a TypedDict as the state schema — every node is a function `(state: AgentState) -> dict` that returns partial state updates. | Defines what data lives in the graph state — keys, types, and (optionally) reducers for how values merge across nodes |
| **Reducer** | A function attached to a TypedDict key that controls how values from different nodes are MERGED. Default: last write wins. `Annotated[list[str], operator.add]` — appends instead of replacing. Critical for `messages`: you want new messages appended to the list, not the list replaced. | Without a reducer, every node return **replaces** the state key — you'd lose previous messages. With `operator.add` reducer: messages accumulate correctly |
| **MemorySaver** | LangGraph's built-in in-memory checkpointer (`from langgraph.checkpoint.memory import MemorySaver`). Stores all graph state snapshots in a Python dict (in RAM). Thread-safe. Data is lost when the process restarts. Used for: local development, testing, short-lived sessions. Production replacement: `PostgresSaver` (writes checkpoints to Postgres) or `RedisSaver`. | The simplest way to add state persistence to a LangGraph graph. `graph = workflow.compile(checkpointer=MemorySaver())`. |
| **thread_id** | A string key passed in `config={"configurable": {"thread_id": "user_123_session_456"}}` when invoking the graph. The checkpointer stores and retrieves state keyed by `thread_id`. Every user session gets its own isolated state snapshot. Two graphs running with the same `thread_id` share state; different `thread_id`s are completely isolated. | The mechanism for multi-tenant, multi-session state — one process can serve 100,000 concurrent user conversations, each with their own `thread_id` state. |
| **Checkpoint** | A snapshot of the full graph state at a specific point in execution. LangGraph saves a checkpoint AFTER each node completes. Fields: `thread_id`, `node_name` (where we are), full state dict. Resuming a graph: load the latest checkpoint → continue from that node. | Enables pause-and-resume: crash recovery, human approvals, async long-running graphs |
| **interrupt_before** | `workflow.compile(interrupt_before=["node_name"])` — the graph pauses execution BEFORE entering the named node(s). Returns control to the caller with the full current state. A human (or another system) inspects the state, modifies it if needed (e.g., set `approved=True`), then calls `graph.invoke(None, config)` to resume from the interrupt point. | Human-in-the-loop: the agent can run autonomously until it hits a "destructive" step (send email, charge card, delete data) and pause for human approval |
| **interrupt_after** | `compile(interrupt_after=["node_name"])` — pauses AFTER the named node completes. The state after that node is visible before the next node runs. Use for: inspection of intermediate results, debugging, fan-out coordination. | Less common than `interrupt_before` — use when you want to review what a node produced before deciding whether to continue |
| **`graph.get_state(config)`** | Returns the current checkpoint state for the given `thread_id`. Returns a `StateSnapshot` object with `.values` (the state dict) and `.next` (which nodes are queued to execute next). Used to inspect what the graph is waiting on during an interrupt. | How the human reviewer sees the `pending_action` — call `get_state()`, read `state.values["pending_action"]`, display to UI |
| **`graph.update_state(config, values)`** | Modifies the stored checkpoint for the given `thread_id`. Allows an external caller (human UI, approval service) to update specific state keys (e.g., set `{"approved": True}`) before resuming. | How the human approves: `graph.update_state(config, {"approved": True})` then `graph.invoke(None, config)` resumes execution |
| **`graph.stream()`** | Streaming version of `graph.invoke()`. Yields `(node_name, state_chunk)` tuples as each node completes. Useful for: streaming LLM token output to the UI, real-time progress display, debugging node-by-node execution. | Production UX: stream the graph to show users "Retrieving documents... Reranking... Generating answer..." as it runs |
| **`END`** | LangGraph sentinel value (`from langgraph.graph import END`). Add as an edge destination to terminate the graph: `graph.add_edge("final_node", END)`. Without this: the graph has no terminal state. | Required to tell LangGraph "the graph is done after this node" — must explicitly define terminal edges |
| **Conditional edge** | `graph.add_conditional_edges("node_A", routing_fn, {"path_B": "node_B", "path_C": "node_C"})` — the `routing_fn` takes the current state and returns a string key that selects which next node to go to. Used for: retry loops, human-approval branching, error recovery paths. | The "if/else" of LangGraph — route to the refund node or the escalation node based on state values |

---

## The Four Core Primitives

### 1. TypedDict — Defining Your State Schema

```python
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    # Annotated with operator.add = APPEND on each node update (not replace)
    messages: Annotated[list[str], operator.add]
    user_id: str
    pending_action: dict          # e.g., {"type": "refund", "amount": 49.99, "order_id": "ORD-123"}
    approved: bool
    retrieval_context: list[str]  # top-k RAG chunks

# WITHOUT reducer (operator.add):
#   node returns {"messages": ["new msg"]} → state.messages = ["new msg"]  (REPLACES)
# WITH reducer (operator.add):
#   node returns {"messages": ["new msg"]} → state.messages = [...old, "new msg"]  (APPENDS)
```

---

### 2. MemorySaver — In-Memory Checkpointing

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# --- Define nodes ---
def retrieve_node(state: AgentState) -> dict:
    # RAG retrieval
    chunks = vector_db.search(state["messages"][-1], top_k=5)
    return {"retrieval_context": chunks}

def generate_node(state: AgentState) -> dict:
    response = llm.invoke(state["messages"] + state["retrieval_context"])
    return {"messages": [response]}  # operator.add reducer appends this

def refund_node(state: AgentState) -> dict:
    # Only runs after human approves (interrupt_before paused before this)
    if state["approved"]:
        process_refund(state["pending_action"])
    return {"pending_action": {}}

# --- Build graph ---
workflow = StateGraph(AgentState)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("generate", generate_node)
workflow.add_node("refund", refund_node)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)   # normal path ends after generate
workflow.add_edge("refund", END)     # refund path ends after refund

# Compile with MemorySaver checkpointer + interrupt before refund
memory = MemorySaver()
graph = workflow.compile(
    checkpointer=memory,
    interrupt_before=["refund"]   # ← pause before the refund node every time
)
```

---

### 3. thread_id — Per-Session State Isolation

```python
# ─────────────────────────────────────────────
# CONFIG: thread_id scopes state to this conversation
# ─────────────────────────────────────────────
config_user_A = {"configurable": {"thread_id": "user_alice_session_001"}}
config_user_B = {"configurable": {"thread_id": "user_bob_session_001"}}

# --- Turn 1: Alice asks a question ---
result_A = graph.invoke(
    {"messages": ["What is my refund status for order ORD-123?"], "approved": False},
    config=config_user_A
)
# State for thread "user_alice_session_001" is saved to MemorySaver

# --- Turn 2: Alice follows up (state persists across invocations) ---
result_A2 = graph.invoke(
    {"messages": ["Can you process that refund now?"]},  # No need to re-send user_id etc — it's in the checkpoint
    config=config_user_A
)
# LangGraph loads last checkpoint for thread_id "user_alice_session_001"
# State.messages now has ALL previous messages (operator.add reducer)

# --- Bob's session is completely isolated ---
result_B = graph.invoke(
    {"messages": ["I want to cancel my order BOB-456"]},
    config=config_user_B
)
# Alice and Bob's states never mix — different thread_ids

# --- Inspect persisted state at any time ---
state_snapshot = graph.get_state(config_user_A)
print(state_snapshot.values["messages"])    # All of Alice's messages so far
print(state_snapshot.next)                  # ["refund"] — waiting at interrupt_before
```

---

### 4. interrupt_before — Human-in-the-Loop

```python
# ─────────────────────────────────────────────
# After the generate node runs and sets pending_action,
# the graph hits interrupt_before=["refund"] and pauses.
# ─────────────────────────────────────────────

# STEP 1: Graph pauses at refund node.
# The invoke() call returns with current state (before refund runs).
paused_state = graph.invoke(
    {"messages": ["Please refund my $49.99 order ORD-123"], "approved": False},
    config=config_user_A
)
# paused_state["pending_action"] = {"type": "refund", "amount": 49.99, "order_id": "ORD-123"}
# The refund has NOT been processed yet.

# STEP 2: Human reviews the pending_action in the dashboard.
snapshot = graph.get_state(config_user_A)
print(snapshot.values["pending_action"])  # {"type": "refund", "amount": 49.99, ...}
print(snapshot.next)                      # ("refund",) — we're paused BEFORE this node

# STEP 3: Human approves — update state with approved=True.
graph.update_state(
    config_user_A,
    {"approved": True}
)

# STEP 4: Resume graph from the interrupt point.
# Pass None as input (graph reads from checkpoint), same config.
final_state = graph.invoke(None, config=config_user_A)
# Now the refund_node runs: state["approved"] == True → refund processes.

# ─────── REJECTION FLOW ───────
graph.update_state(config_user_A, {"approved": False})
graph.invoke(None, config=config_user_A)
# refund_node runs: state["approved"] == False → refund skipped, cleanup happens
```

---

## Conditional Routing — Agentic Loops

```python
from langgraph.graph import END

def should_refund(state: AgentState) -> str:
    """Routing function: read state and return a string key."""
    if state.get("pending_action", {}).get("type") == "refund":
        return "needs_refund"    # → route to refund node (interrupt_before will catch it)
    return "done"                # → route to END

workflow.add_conditional_edges(
    "generate",                          # after generate node competes
    should_refund,                       # call this function with current state
    {
        "needs_refund": "refund",        # return "needs_refund" → go to refund node
        "done": END                      # return "done" → end the graph
    }
)
```

---

## Production Checkpointing — Postgres & Redis

```python
# ─────────────────────────────────────────────
# PRODUCTION: Replace MemorySaver with PostgresSaver
# MemorySaver: in-RAM, lost on process restart.
# PostgresSaver: persists to Postgres — survives restarts, scales across instances.
# ─────────────────────────────────────────────
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://user:password@localhost:5432/langgraph_checkpoints"
checkpointer = PostgresSaver.from_conn_string(DB_URI)
# Creates tables: checkpoints, checkpoint_blobs, checkpoint_writes

graph = workflow.compile(checkpointer=checkpointer, interrupt_before=["refund"])

# ─────────────────────────────────────────────
# List all checkpoints for a thread (audit trail):
# ─────────────────────────────────────────────
history = list(graph.get_state_history(config_user_A))
# Each entry: StateSnapshot(values={...}, next=(...), created_at="2026-04-13T12:00:00Z")
# Full replay of every step in the conversation — invaluable for debugging

# ─────────────────────────────────────────────
# Time-travel: restore state from an earlier checkpoint
# ─────────────────────────────────────────────
old_snapshot = history[-3]  # 3 steps ago
graph.update_state(config_user_A, old_snapshot.values, as_node="retrieve")
# Now invoke() will replay from that historical state
```

---

## When to Use What

| Need | Solution |
|---|---|
| Single-turn, no memory needed | Plain LangChain `RunnableSequence` — LangGraph overhead not justified |
| Multi-turn chat with message history | `MemorySaver` + `thread_id` scoped per user session |
| Multi-turn chat across server restarts | `PostgresSaver` or `RedisSaver` |
| Human approval before destructive step | `interrupt_before=["node_name"]` + `update_state()` + `invoke(None, config)` |
| Async long-running agent (hours) | `PostgresSaver` — process can die and restart, checkpoint survives |
| Parallel sub-graphs (map-reduce) | LangGraph `Send()` API — spawn multiple parallel branches with their own mini-state |
| Debugging what happened in a run | `graph.get_state_history(config)` — full step-by-step replay |

---

## Common Pitfalls

| Pitfall | What Goes Wrong | Fix |
|---|---|---|
| Forgetting the `operator.add` reducer on `messages` | Each node that appends a message REPLACES the full list — you lose message history | `messages: Annotated[list[BaseMessage], operator.add]` |
| Using `MemorySaver` in production (multi-process) | Each process has its own in-RAM state — different workers serving the same user get different states | Switch to `PostgresSaver` or `RedisSaver` in production |
| Not passing `config` with `thread_id` on every call | LangGraph creates a new empty state for every call (no persistence) | Always pass the same `config={"configurable": {"thread_id": "..."}}` |
| Calling `graph.invoke(new_input, config)` after an interrupt | Appends to existing state — but if `new_input` overwrites a key (without reducer): it replaces checkpoint data | After an interrupt: use `update_state()` to modify specific keys, then `invoke(None, config)` to resume |
| `interrupt_before` node never reached | Conditional edge routes away from the interrupt node — interrupt never fires | Debug with `graph.stream()` to trace which path conditional edges took |
