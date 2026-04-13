# Transformer Vocabulary — Core Concepts for RAG & LLM Interviews
> Resume Signal: transformer architecture, self-attention, encoder-decoder, decoder-only, LLM internals

---

## ELI5

A **Transformer** is the architecture inside every modern LLM (GPT, Claude, BERT, T5). It replaced RNNs (which processed words one at a time, sequentially) with **attention** (which looks at ALL words simultaneously and decides which are most relevant to each other). Two key flavours:
- **Encoder-decoder** (like T5, BART): one half reads and understands, the other half generates. Best for: summarisation, translation, question answering with a structured answer.
- **Decoder-only** (like GPT-4, Claude, LLaMA): no separate encoder — just a stack of decoders that generate the next token, conditioned on all previous tokens. Best for: open-ended generation, chat, code, RAG generation.

---

## Key Terms Defined

| Term | What it is | Why it matters here |
|---|---|---|
| **Token** | The atomic unit of text that a transformer processes. Not a character, not a word — it's a subword unit produced by a tokeniser (e.g., BPE, WordPiece). "unbelievable" might be tokenised as ["un", "believ", "able"] = 3 tokens. Context window limits are measured in tokens, not words (~1 word ≈ 1.3 tokens). | RAG context window budgeting — you need to know how many tokens your retrieved chunks consume |
| **Embedding (token embedding)** | A dense float vector representing one token's meaning. Learned during training. Dimensions: 512 (small models) to 12,288 (GPT-4 size). Two tokens with similar meanings have embeddings close in vector space. NOT the same as "query embeddings" in RAG — those are sentence-level embeddings from a different model. | The first step in the transformer: every token is converted to its embedding before attention runs |
| **Positional encoding** | Added to token embeddings to give the model a sense of ORDER (since self-attention is position-agnostic by default — treating the input as a set, not a sequence). Original paper: sinusoidal. Modern: RoPE (Rotary Position Embedding, used in LLaMA/Mistral) or ALiBi. Enables long context extension via RoPE scaling. | Without positional encoding: "dog bites man" ≡ "man bites dog" — order is lost. Positional encoding fixes this. |
| **Attention head** | One parallel attention computation in a Multi-Head Attention layer. Each head learns to attend to different relationships (one head might focus on subject-verb, another on coreference, another on long-range dependencies). Each head uses its own Q, K, V projection matrices. | Multi-Head Attention = run H attention heads in parallel, concatenate their outputs, project back. H is the number of heads: GPT-2 had 12 heads; GPT-3 had 96 heads. |
| **Query (Q), Key (K), Value (V)** | Three linear projections from the input embedding for each token. Q = "what this token is looking for." K = "what this token is offering." V = "what information to pass if selected." Attention score = `softmax(QK^T / sqrt(d_k)) × V`. | The math at the heart of self-attention — every token generates a Q, K, V. Each token attends to all others by dot-product of its Q against everyone's K. |
| **Causal masking** | In decoder-only models: when computing attention for token at position i, the model CANNOT see tokens at positions i+1, i+2, ... (future tokens). The attention matrix is masked to -∞ for future positions (zeroed out by softmax). | Enforces autoregressive generation: each token is predicted from only previous tokens. Required for next-token prediction training. BERT (encoder-only) does NOT use causal masking — it can see the full sequence. |
| **Feed-Forward Network (FFN)** | The second sub-layer in each Transformer block (after attention). A simple 2-layer MLP applied independently to each token position: `FFN(x) = max(0, xW₁ + b₁)W₂ + b₂`. Dimensions: inner layer is typically 4× the model's hidden size. | Contains ~2/3 of a transformer's parameters. Thought to act as a "key-value memory" that stores factual associations learned during training. |
| **Softmax** | `softmax(x_i) = e^(x_i) / Σ e^(x_j)` — converts a vector of raw scores to a probability distribution (all values sum to 1.0, all ≥ 0). Used in attention to convert raw attention scores to attention weights. Used in the final layer to convert logits to next-token probabilities. | Core operation in attention — after `QK^T / sqrt(d_k)` produces raw scores, softmax normalises them so each token's attention is a probability distribution over all other tokens. |
| **Layer Norm** | `LayerNorm(x) = (x - mean) / std * γ + β`. Normalises activations within each transformer layer. Placed before each sub-layer (Pre-LN: modern practice, e.g., GPT-2+) or after (Post-LN: original paper). Stabilises training. | Ensures activations don't explode or vanish during training. Pre-LN placement significantly improves training stability over the original Post-LN formulation. |
| **Residual connection** | Each sub-layer (attention, FFN) uses `output = sublayer(x) + x`. Adds the input directly to the output. Solves the vanishing gradient problem by providing a "highway" for gradients to flow to earlier layers. | Enables training very deep transformers (100+ layers in GPT-4). Without residuals: gradients vanish long before they reach early layers. |
| **Context window** | The maximum number of tokens a model can process in a single forward pass (input + output combined). GPT-4: 128K tokens. Claude 3.5 Sonnet: 200K tokens. Gemini 1.5 Pro: 1M tokens. All tokens in the window participate in attention (each token attends to all previous tokens). | Determines how much retrieved context can be stuffed into a single RAG call. 128K tokens ≈ ~200 pages of text. |

---

## Self-Attention — The Core Mechanism

### What Problem Does Self-Attention Solve?

RNNs processed words sequentially (word 1 → word 2 → ... → word N). By the time the model reached word N, the gradient signal from word 1 had almost vanished — **long-range dependencies were lost**.

Self-attention solves this by letting **every token attend to every other token in a single step**, regardless of distance. Token 1 and Token 100 are equally "close" from the attention mechanism's perspective.

### The Math

For a sequence of N tokens, each with embedding dimension `d_model`:

1. **Project** each token embedding into Q, K, V using learned weight matrices:
   - `Q = X × W_Q`  (shape: N × d_k)
   - `K = X × W_K`  (shape: N × d_k)
   - `V = X × W_V`  (shape: N × d_v)

2. **Compute attention scores:**
   $$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V$$

3. **Interpret the formula:**
   - `QK^T` — dot product of each query with each key → raw relevance score between every pair of tokens. Shape: N × N ("attention matrix").
   - `/ sqrt(d_k)` — scaled dot-product. Without scaling: dot products become very large when `d_k` is large → softmax saturates → gradients vanish. Dividing by `sqrt(d_k)` keeps values in a reasonable range.
   - `softmax(...)` — converts each row of the N×N matrix to a probability distribution. Row i sums to 1.0.
   - `× V` — weighted sum of values. Each output token = a weighted combination of all value vectors, weighted by how much that token attends to each other token.

```
Example: "The cat sat on the mat, and it was happy."
                   ↑
When processing "it", the attention weights for "it" might be:
  "cat"   → 0.55  (high — "it" refers to the cat)
  "mat"   → 0.20  (some attention — possible referent)
  "sat"   → 0.10  (verb, some relevance)
  ... other tokens → small weights
```

### Multi-Head Attention

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, ..., \text{head}_H) W^O$$

where each $\text{head}_i = \text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)$

**Why multiple heads?** Each head can specialise. Head 1 might capture syntactic subject-verb relationships. Head 2 might capture coreference ("it" → "cat"). Head 3 might track positional proximity. Running H heads in parallel and concatenating enriches what the model can represent.

---

## Encoder-Decoder vs Decoder-Only

### Encoder-Decoder (Sequence-to-Sequence)

**Models:** T5, BART, mT5, Flan-T5, MarianMT

**Architecture:**
```
Input: "Translate to French: The quick brown fox"
         ↓
    [ENCODER]
    - Full bidirectional self-attention (each token sees ALL other input tokens)
    - Causal masking: NONE — encoder can see the full input at once
    - Output: contextualised representations of each input token
         ↓
    [CROSS-ATTENTION in Decoder]
    - Decoder attends to encoder's output (the input representation)
         ↓
    [DECODER]
    - Causal masked self-attention (can only see previously generated tokens)
    - Cross-attention to encoder output
    - Output: next token, one at a time
         ↓
Output: "Le renard brun rapide" (generated token by token)
```

**Cross-attention:** Only present in encoder-decoder models. In the decoder layers, Q comes from the decoder's hidden state, K and V come from the encoder's output. This is how the decoder "reads" the encoder's understanding of the input while generating the output.

**Use cases:** Summarisation, translation, question answering (structured), text-to-SQL. T5 treats ALL NLP tasks as "text-to-text" — the input is always a string, the output is always a string.

**RAG use:** BART and T5 can be used as the generator in RAG — feed `[question + retrieved context]` as encoder input, generate answer as decoder output. Fine-tuning is more straightforward for fixed input/output pairs.

---

### Decoder-Only (Autoregressive)

**Models:** GPT-4, GPT-3.5, Claude 3.5 Sonnet, LLaMA 3, Mistral, Gemini

**Architecture:**
```
Input: "The capital of France is"
         ↓
    [DECODER STACK — N identical blocks]
    Each block:
    1. Masked self-attention (token i sees only tokens 1..i — causal)
    2. Feed-forward network
    No encoder. No cross-attention.
         ↓
Output: "Paris" (next token with highest probability)
         ↓ Feed "Paris" back as new input
Output: " ." (next token)
         ↓ ... repeat until <EOS>
```

**Key property:** Bidirectional attention is IMPOSSIBLE. Each token can only attend to previous tokens (causal mask). This is required for autoregressive training: the model is trained to predict the next token from all previous tokens.

**Why decoder-only dominates LLMs today:**
- Simpler architecture (no cross-attention, one type of attention block)
- Scales better with data and compute (GPT-3 → GPT-4 scaling findings)
- In-context learning: by packing examples into the context window, the model adapts at inference time without fine-tuning — "few-shot prompting"
- Chat and RAG: the `[system prompt + retrieved context + user question]` is just a long input string — decoder-only handles this naturally

**RAG with decoder-only:** The retrieved chunks are prepended to the question as part of the prompt. The full sequence (context + question) is the "input" (attended to causally). The decoder generates the answer token by token, attending back to the context at each step.

---

## Encoder-Decoder vs Decoder-Only — Side by Side

| Dimension | Encoder-Decoder | Decoder-Only |
|---|---|---|
| **Representative models** | T5, BART, Flan-T5 | GPT-4, Claude, LLaMA, Mistral |
| **Attention in encoder** | Full bidirectional (sees all input tokens) | N/A (no encoder) |
| **Attention in decoder** | Causal masked + cross-attention to encoder | Causal masked only |
| **Cross-attention** | Yes — decoder attends to encoder output | No |
| **Training objective** | Denoising (BART), span-filling (T5) | Next-token prediction (causal LM) |
| **Best for** | Translation, summarisation, structured tasks | Open generation, chat, code, RAG |
| **In-context learning** | Limited | Excellent — few-shot prompting natural |
| **Context window** | Often shorter (T5: 512 tokens default) | Very long (GPT-4: 128K, Gemini: 1M) |
| **Fine-tuning for RAG** | More efficient for closed tasks (no hallucination guard needed) | Requires careful prompting for grounding |
| **Popular RAG usage** | Retrieval-augmented seq2seq (REALM, RAG paper) | GPT-4/Claude + retrieved context in prompt (dominant production pattern) |

---

## Encoder-Only (BERT family) — For Completeness

| Use case | Model |
|---|---|
| Sentence/query embeddings for RAG retrieval | `all-MiniLM-L6-v2`, `text-embedding-ada-002` |
| Classification, NER, sentiment | BERT, RoBERTa, DeBERTa |
| Cross-encoder reranking (RAGAS context precision metric) | `cross-encoder/ms-marco-MiniLM-L-6-v2` |

Encoder-only models use **full bidirectional attention** (no causal mask). They see the entire input at once. They excel at UNDERSTANDING tasks (embed a query, classify a sentence) but CANNOT generate text (no autoregressive decoder). In RAG: encoder-only models are the bi-encoder/cross-encoder components in retrieval and reranking — NOT the generators.

---

## Self-Attention Complexity & Practical Limits

| Property | Value |
|---|---|
| Time complexity of self-attention | O(N²·d) — quadratic in sequence length N |
| Memory complexity | O(N²) — the N×N attention matrix |
| Why long context is expensive | Doubling context window → 4× memory, ~4× compute for attention |
| Flash Attention (Dao et al., 2022) | Recomputes attention in tiles to avoid materialising the full N×N matrix in HBM → 2-4× speedup, same output |
| Grouped Query Attention (GQA) | Multiple query heads share key/value heads — reduces KV cache memory. Used in LLaMA 2/3, Mistral. |
| KV cache | During inference: key and value vectors for previously generated tokens are cached — only new tokens need Q/K/V computation. Makes generation fast (O(N) per new token, not O(N²)). |

---

## Interview Q&A

**Q: Why does self-attention use `sqrt(d_k)` scaling?**
> Without scaling: as `d_k` grows, dot products `QK^T` grow proportionally in magnitude. Larger values push softmax into its saturation region (very large values → near-zero gradients). Dividing by `sqrt(d_k)` keeps the variance of the dot products at ~1.0 regardless of `d_k`, keeping gradients healthy.

**Q: What is the difference between self-attention and cross-attention?**
> Self-attention: Q, K, V all come from the SAME sequence (each position attends to other positions in the same sequence). Cross-attention: Q comes from one sequence (the decoder's current state), K and V come from a DIFFERENT sequence (the encoder's output). Cross-attention is how the decoder "reads" the encoder's representation — only in encoder-decoder models.

**Q: Why does decoder-only dominate over encoder-decoder for modern LLMs despite being architecturally "simpler"?**
> Three reasons: (1) In-context learning: decoder-only models are trained solely on next-token prediction — this objective, at scale, produces emergent few-shot/zero-shot capabilities that encoder-decoder models (trained on specific tasks) don't match. (2) Unified interface: the same model handles any task as text generation — no need for task-specific fine-tuning. (3) Architecture simplicity: no cross-attention means more parameters can go into more layers of the same type — simpler scaling laws discovered by Chinchilla/GPT series favour this design.

**Q: In RAG, why does the retrieved context need to be placed BEFORE the question in the prompt?**
> Recency bias: decoder-only transformers (with causal attention) have been observed to attend more strongly to tokens closer to the current generation position (the "lost in the middle" problem). Placing context BEFORE the question and BEFORE the generation point means: the first few context chunks are furthest from the answer — they're still read but receive less causal weight. Placing the MOST important context chunks at the START or END of the context window (not the middle) improves faithfulness. The question immediately before the generated answer keeps task focus strong. This is an empirical finding (Liu et al., 2023) — not a theoretical property of attention.
