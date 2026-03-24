# AI System Design — LLM Orchestration & Production Patterns
> Resume Signal: LangChain.js, GPT-4o orchestration, multi-step LLM workflows, prompt engineering

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A customer-facing AI assistant needed to handle multi-step workflows: answering questions from a knowledge base, summarising uploaded documents, and routing between specialised tools (calendar, CRM lookups). A naive "send everything to GPT-4o" approach was costing $0.12 per conversation and had inconsistent outputs. |
| **Task** | Design a production LLM system that is cost-efficient, reliable under failure, and produces consistent structured outputs — while remaining maintainable as models and prompts evolve. |
| **Action** | LangChain.js for orchestration: defined chains with tool routing. LLM gateway layer to centralise all OpenAI calls (adds retry, fallback to GPT-3.5 for cheap queries, logging, cost tracking). Prompt caching for system prompts (stable prefix = cache hit with OpenAI). Structured output with Zod schemas and `zodResponseFormat` — all LLM outputs validated before downstream use. Context window management: summarise older conversation turns when context approaches limit. |
| **Result** | Cost per conversation reduced from $0.12 to $0.03 (75% reduction): GPT-3.5 handles 70% of queries (simple FAQ), GPT-4o handles 30% (complex reasoning). Structured output validation eliminated JSON parse errors entirely. System is auditable — every LLM call logged with tokens, cost, and latency. |

---

## ELI5

An **LLM** (Large Language Model) is incredibly capable but has three problems in production: it's expensive, it sometimes makes things up, and it produces unstructured text. **Orchestration** is building the scaffolding around the LLM: routing cheap queries to cheaper models, caching repeated prompts, validating that the output has the shape you expected, retrying on failure, and stitching together multiple model calls into a coherent workflow.

---

## LLM System Design — Key Challenges

| Challenge | Problem | Solution |
|--|--|--|
| Cost | GPT-4o charges per token; long prompts are expensive | Model routing, prompt compression, caching |
| Latency | LLM responses are 1–10s; streaming helps UX | Streaming, async parallel tool calls |
| Hallucination | Model invents facts | RAG (grounding), temperature=0, output validation |
| Structured output | Model returns prose not JSON | Function calling / `responseFormat: json_schema` |
| Context limits | GPT-4o = 128K tokens, but large context still costs money | Summarise old turns, sliding window |
| Reliability | OpenAI API can return 429 / 500 | Retry with exponential backoff, fallback model |
| Prompt drift | Prompts change silently → regressions | Version prompts, run evals against golden set |

---

## LLM Gateway Pattern

Centralise all model calls — one place to add retry, fallback, logging, cost tracking.

```javascript
// llm-gateway.js
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODELS = {
  fast:    'gpt-3.5-turbo',
  smart:   'gpt-4o',
  mini:    'gpt-4o-mini',
};

async function llmCall({ messages, model = 'smart', schema = null, retries = 3 }) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const options = {
        model:       MODELS[model],
        messages,
        temperature: schema ? 0 : 0.7,    // deterministic for structured output
      };

      // Structured output — validate against Zod schema
      if (schema) {
        options.response_format = zodResponseFormat(schema, 'output');
      }

      const start    = Date.now();
      const response = await openai.chat.completions.create(options);
      const latencyMs = Date.now() - start;

      const usage = response.usage;

      // Audit log every call
      await auditLog({
        model:       options.model,
        promptTokens:     usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        latencyMs,
        cost: calculateCost(options.model, usage),
      });

      return schema
        ? response.choices[0].message.parsed    // already validated by OpenAI SDK
        : response.choices[0].message.content;

    } catch (error) {
      lastError = error;

      if (error.status === 429) {              // rate limited
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (error.status === 500 && model === 'smart') {
        // Fallback: try cheaper model before giving up
        model = 'mini';
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

function calculateCost(model, usage) {
  const PRICING = {
    'gpt-4o':           { input: 0.005, output: 0.015 },  // per 1K tokens
    'gpt-4o-mini':      { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo':    { input: 0.0005, output: 0.0015 },
  };
  const p = PRICING[model];
  if (!p) return 0;
  return (usage.prompt_tokens / 1000 * p.input) +
         (usage.completion_tokens / 1000 * p.output);
}
```

---

## Model Routing — Cheap vs Smart

```javascript
// Route queries to cheaper models based on complexity heuristics
async function routedLlmCall(userMessage, context) {
  const isSimple = isSimpleQuery(userMessage);

  return llmCall({
    messages: buildMessages(userMessage, context),
    model:    isSimple ? 'fast' : 'smart',
  });
}

function isSimpleQuery(text) {
  // Heuristics: short queries tend to be simple FAQ
  const SIMPLE_PATTERNS = [
    /^(what is|how do|when is|where is)\b/i,
    /^(yes|no|hi|hello|thanks)/i,
  ];
  const isShort      = text.split(' ').length < 15;
  const matchesSimple = SIMPLE_PATTERNS.some(p => p.test(text));
  return isShort && matchesSimple;
}
```

---

## Structured Output with Zod

```javascript
import { z } from 'zod';

// Define the schema — LLM must return data matching this shape
const CustomerIntentSchema = z.object({
  intent: z.enum(['billing', 'technical_support', 'cancellation', 'general_question']),
  urgency: z.enum(['low', 'medium', 'high']),
  summary: z.string().max(200),
  requiresHumanAgent: z.boolean(),
});

async function classifyCustomerMessage(message) {
  return llmCall({
    messages: [
      {
        role: 'system',
        content: 'Classify the customer message into the provided schema. Be concise.'
      },
      {
        role: 'user',
        content: message
      }
    ],
    model:  'fast',         // classification = simple task
    schema: CustomerIntentSchema,
  });
}

const result = await classifyCustomerMessage("My invoice is wrong and I need this fixed today");
// { intent: 'billing', urgency: 'high', summary: '...', requiresHumanAgent: false }
// ↑ Typed, validated — if model returns wrong shape, OpenAI SDK throws before we see it
```

---

## Context Window Management

```javascript
// Sliding window with summarisation — keeps context within budget
class ConversationManager {
  constructor({ maxTokens = 8000, summaryThreshold = 6000 } = {}) {
    this.messages        = [];
    this.summary         = null;
    this.maxTokens       = maxTokens;
    this.summaryThreshold = summaryThreshold;
  }

  estimateTokens(messages) {
    // Rough: 4 chars ≈ 1 token
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  async addUserMessage(content) {
    this.messages.push({ role: 'user', content });

    // If approaching limit, summarise oldest messages
    if (this.estimateTokens(this.messages) > this.summaryThreshold) {
      await this.compressOldMessages();
    }
  }

  async compressOldMessages() {
    const keepRecent = this.messages.slice(-6);      // always keep last 3 exchanges
    const toSummarise = this.messages.slice(0, -6);

    if (toSummarise.length === 0) return;

    const summaryText = await llmCall({
      messages: [
        { role: 'system', content: 'Summarise this conversation history concisely.' },
        { role: 'user', content: JSON.stringify(toSummarise) },
      ],
      model: 'fast',
    });

    this.summary  = summaryText;
    this.messages = keepRecent;
  }

  buildContext(systemPrompt) {
    const messages = [{ role: 'system', content: systemPrompt }];
    if (this.summary) {
      messages.push({
        role: 'system',
        content: `Conversation summary so far: ${this.summary}`,
      });
    }
    return [...messages, ...this.messages];
  }
}
```

---

## LangChain.js — Tool Use / Agent

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const llm = new ChatOpenAI({ model: 'gpt-4o', temperature: 0 });

// Define tools the agent can call
const lookupOrderTool = tool(
  async ({ orderId }) => {
    const order = await db.orders.findById(orderId);
    return order ? JSON.stringify(order) : 'Order not found';
  },
  {
    name:        'lookup_order',
    description: 'Look up order status by order ID',
    schema: z.object({ orderId: z.string().describe('The order ID to look up') }),
  }
);

const knowledgeBaseTool = tool(
  async ({ query }) => {
    const { answer } = await ragQuery(query);
    return answer;
  },
  {
    name:        'knowledge_base_search',
    description: 'Search the product knowledge base and FAQs for information',
    schema: z.object({ query: z.string().describe('The question to search for') }),
  }
);

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful customer support agent. Use tools to answer accurately.'],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent   = createToolCallingAgent({ llm, tools: [lookupOrderTool, knowledgeBaseTool], prompt });
const executor = new AgentExecutor({ agent, tools: [lookupOrderTool, knowledgeBaseTool], verbose: false });

const result = await executor.invoke({
  input:        'What's the status of order ORD-12345?',
  chat_history: [],
});
```

---

## Prompt Caching (OpenAI)

OpenAI caches the first 1024+ tokens of a prompt if the prefix is identical across requests — cached tokens cost 50% less.

```javascript
// Stable system prompt = cache hit on every request
// Move stable content to the START of the prompt
const SYSTEM_PROMPT = `
You are a support agent for AcmeCorp.

PRODUCT CATALOGUE:
${productCatalogue}   // ← static content — will be cached

POLICIES:
${policiesText}       // ← static content — will be cached

INSTRUCTIONS:
- Answer only from the context above
- Be concise and friendly
`.trim();

// Dynamic content goes at the END (after the cached prefix)
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },    // cached
  { role: 'user',   content: userMessage },       // varies
];
```

---

## Key Interview Q&A

**Q: How did you reduce LLM cost by 75%?**
> Three levers: (1) Model routing — simple queries (short, FAQ-pattern) go to GPT-3.5-Turbo which is ~10x cheaper. About 70% of queries qualified. (2) Prompt caching — the static system prompt (product catalogue + policies) is always the same prefix, so OpenAI caches it after the first call — saved ~40% on input tokens for cached requests. (3) Context compression — summarising old conversation turns reduced prompt length significantly on long conversations.

**Q: How do you ensure the LLM returns a consistent structure?**
> Use OpenAI structured output with Zod schema (via `zodResponseFormat`). The API guarantees the JSON matches the schema or throws — no more manual regex parsing or defensive JSON.parse. All downstream code gets typed, validated objects.

**Q: What's the difference between an LLM chain and an agent?**
> Chain: deterministic sequence of steps defined at code-writing time (prompt → LLM → parse → next prompt). Agent: LLM decides which tool to call next, based on the result of the previous tool, until it determines the task is complete. Agents are more flexible but harder to predict and debug. Use chains for well-defined workflows; agents for open-ended tasks where the number of steps isn't known in advance.

**Q: How do you handle hallucination in a production LLM system?**
> Grounding: RAG ensures the model answers from retrieved text, not memory. Structured output: forces the model to return a typed response, which makes it harder to "make up" fields. Temperature=0 for factual tasks: deterministic decoding reduces creative deviation. Validation layer: after getting a response, validate claims against source data where possible (e.g., order numbers should actually exist in the DB).
