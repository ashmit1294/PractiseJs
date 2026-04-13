# RAGAS — RAG Evaluation Metrics as CI Gates
> Resume Signal: RAGAS, RAG evaluation, faithfulness, context precision, answer relevancy, LLM CI/CD

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A production RAG system was being actively developed — prompt changes, new chunking strategies, and embedding model upgrades were deployed weekly. Each deployment was validated only by developer "eyeballing" 10 sample answers. A prompt change to improve "friendliness" accidentally reduced faithfulness (answers drifted from source documents) — it made it to production and was caught only after user complaints. |
| **Task** | Build an automated evaluation pipeline that gates every RAG code change with measurable quality metrics — treating RAG evaluation like unit tests in a CI/CD pipeline. |
| **Action** | Integrated RAGAS into the GitHub Actions CI pipeline. On every PR, RAGAS runs against a 50-question golden dataset and produces three scores: faithfulness (≥ 0.85 threshold), context_precision (≥ 0.75), and answer_relevancy (≥ 0.80). A PR that drops any metric below threshold is blocked from merging. Score trends are published to a Grafana dashboard — a dropping trend triggers an alert before it crosses the hard threshold. |
| **Result** | The next "friendliness" prompt change dropped faithfulness from 0.89 → 0.76. CI blocked the merge automatically. The engineer was notified with the exact delta and sample failing questions. Fix took 20 minutes. Zero quality regressions reached production in the 6 months following. |

---

## ELI5

**RAGAS** ("RAG Assessment") is a Python library that acts as a judge for your RAG system. You give it:
- The user's question
- The document chunks your RAG retrieved
- The answer your LLM generated
- (Optionally) the ground-truth correct answer

RAGAS uses an LLM (judge model, usually GPT-4o) to score how good each of those pieces is relative to the others, and returns a float (0.0–1.0) for each metric. You treat those floats like test pass/fail thresholds in your CI pipeline.

---

## Key Terms Defined

| Term | What it is | Why it matters here |
|---|---|---|
| **RAGAS** | "Retrieval Augmented Generation Assessment" — open-source Python library (`pip install ragas`). Evaluates RAG pipelines using LLM-as-judge scoring across multiple dimensions. Does NOT require ground-truth answers for some metrics (reference-free). | The evaluation framework used in this pattern — wraps judge-LLM calls into structured metrics |
| **LLM-as-judge** | Using a powerful LLM (GPT-4o, Claude 3.5 Sonnet) to evaluate the output of another LLM (your RAG LLM). The judge LLM is given the question, context, and answer, then asked structured questions: "Is each factual claim in the answer supported by the provided context?" → outputs 0 or 1 per claim. | How RAGAS scores faithfulness, relevancy, etc. without needing human labellers at scale |
| **Golden dataset** | A curated set of `(question, ground_truth_answer, expected_retrieved_context)` examples, representative of real user queries. Used as the fixed test set for CI evaluation. Should be: diverse (edge cases, common cases, ambiguous cases), stable (same set across all evaluations for comparable trends), and version-controlled alongside code. | The "test suite" in RAG CI — without a stable golden dataset, metric scores are incomparable across runs |
| **`EvaluationDataset`** | RAGAS class that holds your evaluation data. Created from a list of `SingleTurnSample` objects. Each sample contains: `user_input`, `retrieved_contexts`, `response`, and optionally `reference` (ground truth). | The container for your golden dataset within RAGAS |
| **`SingleTurnSample`** | A single evaluation example in RAGAS. Fields: `user_input` (the question), `retrieved_contexts` (list of strings — the chunks your RAG retrieved), `response` (the LLM's answer), `reference` (optional ground-truth answer string). | One row in your evaluation dataset. |
| **`evaluate()`** | The RAGAS main function: `evaluate(dataset, metrics=[...], llm=judge_llm)`. Returns an `EvaluationResult` with per-metric float scores (macro-averaged across all samples). Also has `.to_pandas()` to see per-sample scores for debugging. | The function that runs all metrics against your dataset and returns aggregate scores |
| **CI gate** | A quality threshold set in your CI configuration. If `ragas_score < threshold → fail the CI step → block the PR/deployment`. Treats evaluation metrics as hard quality requirements, not nice-to-have dashboards. | The mechanism that prevents quality regressions from reaching production |
| **Reference-free vs reference-required** | Reference-free metrics (faithfulness, answer_relevancy, context_precision, context_recall when using LLM judge): do NOT require a ground-truth answer — the metric is computed from `(question, contexts, answer)` alone. Reference-required metrics (answer_correctness): require a `reference` ground-truth answer to compare against. | Determines which metrics you can use if you don't have ground-truth answers — faithfulness and answer_relevancy are both reference-free |

---

## The Three Core Metrics

---

### Metric 1: Faithfulness

**What it measures:** Are all the factual claims in the LLM's answer actually supported by the retrieved context? Or is the LLM hallucinating facts not present in the context?

**Formula:**
$$\text{Faithfulness} = \frac{\text{number of claims in answer that are supported by context}}{\text{total number of claims in answer}}$$

**Scoring process (LLM-as-judge):**
1. RAGAS prompts the judge LLM to extract all factual claims from the generated answer.
2. For each claim, RAGAS prompts the judge LLM: "Is this claim fully supported by the retrieved context below? Yes/No."
3. Score = (supported claims) / (total claims).

**Score = 1.0:** Every fact in the answer can be directly traced to the retrieved context.
**Score = 0.0:** The LLM invented all facts — pure hallucination.
**Typical threshold:** ≥ 0.85

```python
# Sample: High faithfulness
question = "What is Apple's revenue in Q4 2023?"
contexts = ["Apple reported revenue of $119.6 billion in Q4 2023, up 2% year-over-year."]
answer   = "Apple's Q4 2023 revenue was $119.6 billion, a 2% increase year-over-year."
# → faithfulness ≈ 1.0: both claims ("$119.6B" and "2% increase") in context

# Sample: Low faithfulness (hallucination)
answer_bad = "Apple's Q4 2023 revenue was $119.6 billion, driven primarily by AirPods growth."
# → "driven by AirPods" is NOT in the context → faithfulness ≈ 0.5
```

---

### Metric 2: Context Precision

**What it measures:** Of all the chunks retrieved, how many were actually relevant/useful for answering the question? Penalises noisy, irrelevant retrieved chunks appearing in the top positions.

**Formula (a simplified view):**
$$\text{Context Precision} = \frac{\text{relevant chunks among top-}k}{\text{total chunks retrieved (k)}}$$

RAGAS computes a ranking-aware version (similar to mean average precision) that gives HIGHER credit if relevant chunks appear EARLIER in the retrieved list (position 1 > position 5).

**Scoring process:**
1. RAGAS prompts the judge LLM for each retrieved chunk: "Is this chunk useful for answering the question below? Yes/No."
2. Chunks ranked higher AND marked relevant → higher score.

**Score = 1.0:** All retrieved chunks are relevant to the question; relevant chunks rank highest.
**Score = 0.0:** No retrieved chunks are relevant (wrong retrieval entirely).
**Typical threshold:** ≥ 0.75

```python
# Sample: High context precision
question = "What vaccines does Pfizer make?"
contexts = [
    "Pfizer produces the Comirnaty (COVID-19) mRNA vaccine.",   # relevant ✓
    "Pfizer also manufactures Prevnar 13, a pneumococcal vaccine.",  # relevant ✓
]
# → context_precision ≈ 1.0: both chunks are relevant

# Sample: Low context precision (noisy retrieval)
contexts_noisy = [
    "Pfizer's headquarters is in New York City, founded in 1849.",      # irrelevant ✗
    "Pfizer produces the Comirnaty (COVID-19) mRNA vaccine.",           # relevant ✓ (but position 2)
    "Pfizer's CEO is Albert Bourla as of 2024.",                       # irrelevant ✗
]
# → context_precision ≈ 0.3: only 1/3 relevant, and it's not in position 1
```

---

### Metric 3: Answer Relevancy

**What it measures:** How directly does the LLM's answer address the user's original question? Penalises answers that are technically accurate but evasive, verbose, or off-topic.

**Formula:**
$$\text{Answer Relevancy} = \text{mean cosine similarity}\left(\text{embedding of original question}, \text{embeddings of questions generated from answer}\right)$$

**Scoring process (uniquely clever):**
1. RAGAS prompts the judge LLM to generate N questions (typically 3) that the given answer would correctly answer.
2. Each generated question is embedded. The original user question is embedded.
3. Score = average cosine similarity between original question embedding and generated question embeddings.

**Why this works:** A fully relevant answer would only answer the question asked. The LLM-generated questions from a relevant answer would closely resemble the original question. An irrelevant or evasive answer (e.g., "I don't have information on that, but here's some background...") generates questions far from the original.

**Score = 1.0:** The answer is laser-focused on exactly what was asked.
**Score = 0.0:** The answer is completely off-topic.
**Typical threshold:** ≥ 0.80

```python
# Sample: High answer relevancy
question = "What is the capital of France?"
answer   = "The capital of France is Paris."
# Generated questions from answer: "What city is the capital of France?"
# Cosine similarity with original ≈ 0.97 → answer_relevancy ≈ 0.97

# Sample: Low answer relevancy (evasive or padded answer)
answer_bad = ("France is a beautiful country in Western Europe with a rich history "
              "of art, cuisine, and culture. It is bordered by Belgium, Germany, Italy, "
              "and Spain. France has a diverse landscape including the Alps and the Pyrenees. "
              "The country uses the Euro as its currency.")
# Generated questions: "What are France's neighbouring countries?", "What currency does France use?"
# These are far from "What is the capital?" → answer_relevancy ≈ 0.35
```

---

## Full RAGAS CI Implementation

```python
# ─────────────────────────────────────────────
# pip install ragas langchain-openai
# ─────────────────────────────────────────────
import os
import sys
from ragas import evaluate, EvaluationDataset, SingleTurnSample
from ragas.metrics import faithfulness, context_precision, answer_relevancy
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# ─── 1. Judge LLM + Embeddings (for answer_relevancy scoring) ───
judge_llm = ChatOpenAI(model="gpt-4o", api_key=os.environ["OPENAI_API_KEY"])
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# ─── 2. Your golden dataset (version-controlled in your repo) ───
golden_samples = [
    SingleTurnSample(
        user_input      = "What is Apple's Q4 2023 revenue?",
        retrieved_contexts = [
            "Apple reported net sales of $119.6 billion for Q4 FY2023, up 2% YoY.",
            "iPhone revenue was $43.8 billion, Mac revenue $7.6 billion in Q4 FY2023.",
        ],
        response        = "Apple's Q4 2023 revenue was $119.6 billion, a 2% year-over-year increase.",
        reference       = "Apple Q4 FY2023 revenue was $119.6 billion."  # for answer_correctness if needed
    ),
    SingleTurnSample(
        user_input      = "Who is the CEO of Tesla?",
        retrieved_contexts = [
            "Elon Musk serves as the Chief Executive Officer of Tesla, Inc.",
            "Tesla was founded in 2003 by Martin Eberhard and Marc Tarpenning.",
        ],
        response        = "The CEO of Tesla is Elon Musk.",
    ),
    # ... 48 more samples in your golden dataset ...
]

dataset = EvaluationDataset(samples=golden_samples)

# ─── 3. Run RAGAS evaluation ───
results = evaluate(
    dataset = dataset,
    metrics = [faithfulness, context_precision, answer_relevancy],
    llm     = judge_llm,
    embeddings = embeddings,  # required for answer_relevancy
)

print(results)
# {'faithfulness': 0.912, 'context_precision': 0.784, 'answer_relevancy': 0.863}

# ─── 4. Per-sample breakdown (for debugging failures) ───
df = results.to_pandas()
print(df[["user_input", "faithfulness", "context_precision", "answer_relevancy"]])
# Shows which specific questions are failing — direct signal for what to fix.

# ─── 5. CI gate thresholds ───
THRESHOLDS = {
    "faithfulness":      0.85,
    "context_precision": 0.75,
    "answer_relevancy":  0.80,
}

failed_metrics = []
for metric, threshold in THRESHOLDS.items():
    score = results[metric]
    status = "PASS" if score >= threshold else "FAIL"
    print(f"  {metric}: {score:.3f} (threshold: {threshold}) → {status}")
    if score < threshold:
        failed_metrics.append(f"{metric}={score:.3f} < {threshold}")

if failed_metrics:
    print(f"\nCI FAILED: {', '.join(failed_metrics)}")
    sys.exit(1)  # non-zero exit → GitHub Actions marks the CI step as failed → PR blocked

print("\nCI PASSED: All RAGAS metrics above threshold.")
sys.exit(0)
```

---

## GitHub Actions CI Integration

```yaml
# .github/workflows/rag-eval.yml
name: RAG Quality Gates

on:
  pull_request:
    branches: [main]
    paths:
      - "rag/**"         # only run when RAG code changes
      - "prompts/**"
      - "eval/**"

jobs:
  ragas-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install ragas langchain-openai

      - name: Run RAGAS evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: python eval/run_ragas_ci.py
        # run_ragas_ci.py contains the code above — exits 1 if any metric fails threshold.

      - name: Publish scores to PR comment
        if: always()  # run even if previous step failed
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const scores = JSON.parse(fs.readFileSync('eval/ragas_scores.json', 'utf8'));
            const body = `## RAGAS Evaluation Results\n\n| Metric | Score | Threshold | Status |\n|---|---|---|---|\n` +
              Object.entries(scores).map(([k, v]) =>
                `| ${k} | ${v.score.toFixed(3)} | ${v.threshold} | ${v.passed ? '✅' : '❌'} |`
              ).join('\n');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

---

## Metric Cheat Sheet — What Each Score Tells You

| Failing Metric | Likely Root Cause | Fix |
|---|---|---|
| **Low faithfulness** (< 0.85) | LLM is hallucinating facts not in the retrieved chunks. Common cause: system prompt instructs "be helpful and knowledgeable" — LLM fills in gaps from training data. | Strengthen the grounding instruction: "Answer ONLY from the provided context. If the context doesn't contain the answer, say 'I don't know'." |
| **Low context precision** (< 0.75) | Retrieval is pulling irrelevant chunks (wrong embedding model, too-aggressive metadata filters removed relevant docs, top-k too high returning noise). | Tune retrieval: reduce top-k (5 → 3), add reranker (cross-encoder reranking), improve chunking (smaller chunks = more focused content), use hybrid BM25 + vector retrieval. |
| **Low answer relevancy** (< 0.80) | LLM is answering with padding, caveats, or related but non-specific content. Common cause: over-cautious prompts like "provide comprehensive context" or too-long system prompts that override the task focus. | Shorten and sharpen the system prompt. Test with: "Answer concisely and directly. Do not include information not requested." |

---

## Additional RAGAS Metrics (Beyond the Core Three)

| Metric | What It Measures | Requires Ground Truth? |
|---|---|---|
| **`context_recall`** | Did the retrieved chunks contain ALL the information needed to answer correctly? (Measures retrieval coverage vs ground truth answer) | Yes — `reference` required |
| **`answer_correctness`** | Is the answer factually correct compared to the ground-truth answer? (Combines semantic similarity + factual overlap) | Yes — `reference` required |
| **`noise_sensitivity`** | How much does adding irrelevant (noisy) context chunks degrade answer quality? | No |
| **`ResponseRelevancy`** | Alternative scoring for answer relevancy using direct LLM judge (not embedding similarity) | No |
