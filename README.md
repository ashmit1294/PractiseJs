# Full Stack MERN Developer — Interview Revision Reference

**Level:** 7+ Years Full Stack (MERN)  |  **Topics:** 12  |  **Last Updated:** March 19, 2026

A single consolidated reference covering everything from JavaScript fundamentals and
TypeScript to React, Node.js, Docker, Kubernetes, Azure, AWS, Next.js, GraphQL, MongoDB,
and Web Security. Every section contains working code examples, edge cases, complexity
analysis, and direct interview question-and-answer material.

---

## ⭐ NEW: MASTER CONSOLIDATED INTERVIEW Q&A FILE

**📁 [MASTER_INTERVIEW_QA.md](MASTER_INTERVIEW_QA.md)** — Complete consolidated reference with all interview questions from 8 technologies

- ✅ **150+ Interview Questions** organized by technology
- ✅ **ELI5 Explanations** added to ALL questions for beginner accessibility
- ✅ **Table of Contents** with quick navigation links
- ✅ **Code Examples** and working implementations included
- ✅ **Perfect for:** Quick reference, interview prep, teaching concepts

**Tech covered:** JavaScript (19) → React (20) → Next.js (10) → Node.js (13) → MongoDB (9) → Docker (28) → AWS (20+) → Azure (20+)

---

## 📋 Master Interview Questions Collection

All 28 interview questions organized by technology domain with flow diagrams:

| # | Technology | Questions | File | Interview Q&A |
|---|-----------|-----------|------|---|
| 1 | **JavaScript** | Q1-Q19 (var/let/const, closures, prototypes, V8 optimization, memory leaks, design patterns, bundlers, IIFE) | [JavaScript/26_theory_interview_qa.js](JavaScript/26_theory_interview_qa.js) | **19 Q&A** |
| 2 | **React** | Q1-Q20 (vDOM, rules of hooks, controlled components, memoization, design patterns, Jira design, webpack) | [React/10_theory_interview_qa.jsx](React/10_theory_interview_qa.jsx) | **20 Q&A** |
| 3 | **Next.js** | Q1-Q15 (App Router, caching layers, Server Actions, SSR, hydration, streaming, Turbopack, SWC, bundle analysis) | [NextJS/09_theory_interview_qa.tsx](NextJS/09_theory_interview_qa.tsx) | **15 Q&A** |
| 4 | **Node.js** | Q1-Q13 (event loop, non-blocking I/O, streams, AsyncLocalStorage, clustering, backpressure, memory leaks, buffers) | [NodeJS/11_theory_interview_qa.js](NodeJS/11_theory_interview_qa.js) | **13 Q&A** |
| 5 | **MongoDB** | 9 Scenarios (e-commerce orders, real-time dashboard, sharding, denormalization, transactions, aggregation) | [MongoDB/09_interview_qa_scenarios.md](MongoDB/09_interview_qa_scenarios.md) | **8 Detailed Scenarios** |
| 6 | **Docker** | Q1-Q28 (Dockerfile, layers, networking, storage, security, operations, GitHub Actions, ECR/ECS, Compose) | [Docker/08_interview_qa.md](Docker/08_interview_qa.md) | **28 Q&A + Flow Diagrams** |
| 7 | **AWS** | CI/CD Pipelines, Resilience Strategies, CodeBuild, CodePipeline, Blue-Green Deployment, Multi-Region | [AWS/08_cicd_interview_qa.md](AWS/08_cicd_interview_qa.md) | **Comprehensive DevOps** |
| 8 | **Azure** | Entra ID Authentication, RBAC, App Service, Key Vault, Azure DevOps Pipelines, Deployments | [Azure/08_interview_qa.md](Azure/08_interview_qa.md) | **Identity & DevOps** |
| 9 | **TypeScript** | Q1-Q11 (generics, utility types, type guards, decorators, full-stack type safety with tRPC) | [TypeScript/09_theory_interview_qa.ts](TypeScript/09_theory_interview_qa.ts) | **11 Q&A** |
| 10 | **GraphQL** | Q1-Q12 (schema design, resolvers, N+1 problem with DataLoaders, mutations, optimization patterns) | [GraphQL/09_theory_interview_qa.js](GraphQL/09_theory_interview_qa.js) | **12 Q&A** |

🎯 **Get Started:** 
- Start with **JavaScript** for fundamentals
- Move to **React/Next.js** for frontend depth
- Continue with **Node.js** for backend
- Then **MongoDB** for data modeling
- Finish with **Docker, AWS, Azure** for DevOps/Cloud

---

## 🎓 Interview Q&A by Technology (Alphabetical Order)

### JavaScript → React/Next.js → Node.js → MongoDB → Docker → AWS → Azure

**Recommended learning order** (19 → 20 → 15 → 13 → 9 → 28 → 8 questions):

1. **[JavaScript - 19 Questions](JavaScript/26_theory_interview_qa.js)**
   - var/let/const, hoisting, prototype chain, closures, `this`, microtask/macrotask queue, generators, Proxy/Reflect, TDZ, WeakMap, V8 optimization, memory leaks, CommonJS vs ESM, tail call optimization, Symbols, Promise utilities, design patterns, bundling (Webpack/Rollup/Esbuild/Vite), IIFE

2. **[React - 20 Questions](React/10_theory_interview_qa.jsx)**
   - Virtual DOM, rules of hooks, controlled/uncontrolled components, re-rendering prevention (memo/useMemo/useCallback), useEffect cleanup, Context API pitfalls, Fiber architecture, reconciliation/diffing, useSyncExternalStore, Server Components vs Client Components, batching React 18, React.memo patterns, design patterns (HOC/Render Props/Custom Hooks/Compound Components), Axios vs Fetch with React Query, Jira-scale app design (virtualization, a11y), CSS preprocessors, Webpack, lazy/Suspense, code splitting

3. **[Next.js - 15 Questions](NextJS/09_theory_interview_qa.tsx)**
   - Pages Router vs App Router, 4 caching layers (request memoization, data cache, full route cache, router cache), Server Actions, streaming SSR, Middleware, on-demand ISR/revalidation, RSC Payload, parallel routes, intercepting routes, secure Server Actions authentication, Image Optimization, Isomorphic React (SSR/hydration), webpack customization, Turbopack incremental computation, SWC compiler, bundle analysis

4. **[Node.js - 13 Questions](NodeJS/11_theory_interview_qa.js)**
   - Event loop phases (timers, pending I/O, poll, check, close callbacks with nextTick/Promise draining), non-blocking I/O via OS and libuv thread pool, streams (Readable/Writable/Transform/Duplex), AsyncLocalStorage context, clustering for multi-core, backpressure handling in streams with .pipe(), module caching singleton pattern, memory leak diagnosis, uncaught exceptions/unhandled rejections, child_process (spawn/exec/fork), CPU-intensive tasks (setImmediate chunking/worker_threads), HTTP keep-alive and connection pooling, Buffers and streams deep dive

5. **[MongoDB - 9 Scenarios](MongoDB/09_interview_qa_scenarios.md)**
   - E-commerce order system (data modeling, transactions, atomic operations, inventory management), real-time dashboard with time-series bucketing for scale, hot shard problem and solutions (hashing, compound keys), eventual consistency with denormalization, multi-tenant SaaS schema design, all common Q&A patterns with code examples

6. **[Docker - 28 Questions (with Flow Diagrams)](Docker/08_interview_qa.md)**
   - Fundamentals: containers vs VMs, layers/caching, build context, CMD vs ENTRYPOINT, multi-stage builds
   - Networking: drivers (bridge/host/overlay), EXPOSE vs -p, DNS resolution
   - Storage: named volumes, bind mounts, tmpfs, node_modules shadowing
   - Security: Linux capabilities, secret handling, container escape
   - Operations: restart policies, rolling updates, signal handling, OOM prevention, debugging
   - GitHub Actions: workflows, jobs, steps, secrets, environment variables, execution flow diagram
   - ECR/ECS: build → push → deploy pipeline, end-to-end flow diagram
   - Docker Compose: service dependencies, healthchecks, volumes, networking flow diagram

7. **[AWS - 28+ Questions (Comprehensive)](AWS/08_cicd_interview_qa.md)**
   - CI/CD architecture: CodeBuild (buildspec.yml), CodePipeline orchestration, CodeDeploy strategies
   - GitHub Actions alternative pipeline
   - Resilience strategies (10 patterns): HA across AZs, DR with backups, circuit breakers, auto-scaling, caching, async queues, monitoring, graceful degradation, rate limiting, multi-region
   - Complete pipeline design for first-time applications with best practices

8. **[Azure - 8+ Questions](Azure/08_interview_qa.md)**
   - Core: subscriptions, resource groups, IaaS/PaaS/SaaS
   - Entra ID: authentication, Conditional Access, PIM, JWT token validation
   - Entra ID + Azure Functions: middleware-based authentication with role-based authorization (RBAC) with C# code examples
   - Azure SQL, PostgreSQL, Cosmos DB comparisons
   - Azure DevOps Pipelines, blue-green deployments, cost optimization
   - Best practices: Managed Identity, Key Vault integration, secrets management

---

## Overview (Full Table)

| # | Topic | Covers | Files |
|---|-------|--------|-------|
| 1 | [JavaScript](summary/summary_JavaScript.md) | DSA, Algorithms, Patterns, Functional Programming | 26 |
| 2 | [TypeScript](summary/summary_TypeScript.md) | Types, Generics, Decorators, Design Patterns | 9 |
| 3 | [React](summary/summary_React.md) | Hooks, Context, Performance, Advanced Patterns | 10 |
| 4 | [Node.js](summary/summary_NodeJS.md) | Event Loop, Streams, Auth, REST API, Clustering | 11 |
| 5 | [Docker](summary/summary_Docker.md) | Dockerfile, Compose, Networking, Security, CI/CD | 9 |
| 6 | [Kubernetes](summary/summary_Kubernetes.md) | Pods, Workloads, Networking, Storage, Security, Helm | 9 |
| 7 | [Azure](summary/summary_Azure.md) | AAD, App Service, Storage, Databases, AKS, Pipelines | 8 |
| 8 | [AWS](summary/summary_AWS.md) | IAM, EC2, S3, Lambda, RDS, SQS, ECS/EKS | 8 |
| 9 | [Next.js](summary/summary_NextJS.md) | App Router, Data Fetching, Auth, SEO, Performance | 9 |
| 10 | [GraphQL](summary/summary_GraphQL.md) | Schema, Resolvers, DataLoader, Federation, Apollo | 9 |
| 11 | [MongoDB](summary/summary_MongoDB.md) | BSON, Schema Design, Indexing, Aggregation, Transactions, Sharding | 9 |
| 12 | [Web Security](summary/summary_WebSecurity.md) | OWASP, Auth, XSS, CSRF, Injection, Best Practices | 1 |

---

## System Design Resources

| Resource | Format | Best For |
|----------|--------|----------|
| [System Design Primer](https://github.com/donnemartin/system-design-primer) | GitHub (free) | Comprehensive reference, all topics |
| [ByteByteGo system-design-101](https://github.com/ByteByteGoHq/system-design-101) | GitHub (free, visual) | Visual diagrams for every concept |
| [ByteByteGo YouTube Crash Course](https://www.youtube.com/@ByteByteGo) | Video (free) | DNS, storage, memory deep dives |
| [System Design Handbook](https://www.freecodecamp.org/news/system-design-for-interviews-and-beyond/) | Web (free) | Interview-format walkthroughs |
| [ByteByteGo Course](https://bytebytego.com) | Text + diagrams (paid) | Structured end-to-end prep |

---

## Table of Contents

### 1. JavaScript

   1. [Flatten array](summary/summary_JavaScript.md#javascript-flatten-array)
   2. [Debounce](summary/summary_JavaScript.md#javascript-debounce)
   3. [Throttle](summary/summary_JavaScript.md#javascript-throttle)
   4. [Memoize](summary/summary_JavaScript.md#javascript-memoize)
   5. [Curry](summary/summary_JavaScript.md#javascript-curry)
   6. [Deep clone](summary/summary_JavaScript.md#javascript-deep-clone)
   7. [Promise all race](summary/summary_JavaScript.md#javascript-promise-all-race)
   8. [Custom array methods](summary/summary_JavaScript.md#javascript-custom-array-methods)
   9. [Map questions](summary/summary_JavaScript.md#javascript-map-questions)
   10. [Set questions](summary/summary_JavaScript.md#javascript-set-questions)
   11. [Stack queue](summary/summary_JavaScript.md#javascript-stack-queue)
   12. [Linked list](summary/summary_JavaScript.md#javascript-linked-list)
   13. [Binary tree bst](summary/summary_JavaScript.md#javascript-binary-tree-bst)
   14. [Call apply bind](summary/summary_JavaScript.md#javascript-call-apply-bind)
   15. [Searching algorithms](summary/summary_JavaScript.md#javascript-searching-algorithms)
   16. [Sorting algorithms](summary/summary_JavaScript.md#javascript-sorting-algorithms)
   17. [Recursion backtracking](summary/summary_JavaScript.md#javascript-recursion-backtracking)
   18. [Dynamic programming](summary/summary_JavaScript.md#javascript-dynamic-programming)
   19. [Graph algorithms](summary/summary_JavaScript.md#javascript-graph-algorithms)
   20. [Sliding window two pointer](summary/summary_JavaScript.md#javascript-sliding-window-two-pointer)
   21. [Functional programming](summary/summary_JavaScript.md#javascript-functional-programming)
   22. [Array manipulation](summary/summary_JavaScript.md#javascript-array-manipulation)
   23. [String questions](summary/summary_JavaScript.md#javascript-string-questions)
   24. [Weakmap weakset symbol proxy](summary/summary_JavaScript.md#javascript-weakmap-weakset-symbol-proxy)
   25. [Heap priority queue](summary/summary_JavaScript.md#javascript-heap-priority-queue)
   26. [Theory interview qa](summary/summary_JavaScript.md#javascript-theory-interview-qa)
   27. [GroupBy and aggregate](summary/summary_JavaScript.md#javascript-groupby-aggregate)
   28. [Array advanced patterns](summary/summary_JavaScript.md#javascript-array-advanced)
   29. [Promise patterns](summary/summary_JavaScript.md#javascript-promise-patterns)
   30. [Design patterns](summary/summary_JavaScript.md#javascript-design-patterns)
   - [Scenario-Based Questions](summary/summary_JavaScript.md#javascript-scenarios)

### 2. TypeScript

   1. [Basic types interfaces](summary/summary_TypeScript.md#typescript-basic-types-interfaces)
   2. [Generics](summary/summary_TypeScript.md#typescript-generics)
   3. [Utility types](summary/summary_TypeScript.md#typescript-utility-types)
   4. [Type guards](summary/summary_TypeScript.md#typescript-type-guards)
   5. [Advanced types](summary/summary_TypeScript.md#typescript-advanced-types)
   6. [Decorators](summary/summary_TypeScript.md#typescript-decorators)
   7. [Design patterns](summary/summary_TypeScript.md#typescript-design-patterns)
   8. [React typescript](summary/summary_TypeScript.md#typescript-react-typescript)
   9. [Theory interview qa](summary/summary_TypeScript.md#typescript-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_TypeScript.md#typescript-scenarios)

### 3. React

   1. [UseState useEffect](summary/summary_React.md#react-usestate-useeffect)
   2. [Custom hooks](summary/summary_React.md#react-custom-hooks)
   3. [UseReducer useContext](summary/summary_React.md#react-usereducer-usecontext)
   4. [UseMemo useCallback](summary/summary_React.md#react-usememo-usecallback)
   5. [UseRef forwardRef](summary/summary_React.md#react-useref-forwardref)
   6. [Component patterns](summary/summary_React.md#react-component-patterns)
   7. [Lazy suspense errorboundary](summary/summary_React.md#react-lazy-suspense-errorboundary)
   8. [Advanced patterns](summary/summary_React.md#react-advanced-patterns)
   9. [Solid principles](summary/summary_React.md#react-solid-principles)
   10. [Theory interview qa](summary/summary_React.md#react-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_React.md#react-scenarios)

### 4. Node.js

   1. [Event loop](summary/summary_NodeJS.md#nodejs-event-loop)
   2. [Streams buffers](summary/summary_NodeJS.md#nodejs-streams-buffers)
   3. [Express middleware](summary/summary_NodeJS.md#nodejs-express-middleware)
   4. [Authentication](summary/summary_NodeJS.md#nodejs-authentication)
   5. [Event emitter](summary/summary_NodeJS.md#nodejs-event-emitter)
   6. [Cluster workers](summary/summary_NodeJS.md#nodejs-cluster-workers)
   7. [File system](summary/summary_NodeJS.md#nodejs-file-system)
   8. [Error handling](summary/summary_NodeJS.md#nodejs-error-handling)
   9. [Rest api patterns](summary/summary_NodeJS.md#nodejs-rest-api-patterns)
   10. [Race conditions](summary/summary_NodeJS.md#nodejs-race-conditions)
   11. [Theory interview qa](summary/summary_NodeJS.md#nodejs-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_NodeJS.md#nodejs-scenarios)

### 5. Docker

   1. [Dockerfile basics](summary/summary_Docker.md#docker-dockerfile-basics)
   2. [Docker compose](summary/summary_Docker.md#docker-docker-compose)
   3. [Networking](summary/summary_Docker.md#docker-networking)
   4. [Volumes storage](summary/summary_Docker.md#docker-volumes-storage)
   5. [Security](summary/summary_Docker.md#docker-security)
   6. [Cicd registry](summary/summary_Docker.md#docker-cicd-registry)
   7. [Production](summary/summary_Docker.md#docker-production)
   8. [Interview qa](summary/summary_Docker.md#docker-interview-qa)
   9. [Theory advanced qa](summary/summary_Docker.md#docker-theory-advanced-qa)
   - [Scenario-Based Questions](summary/summary_Docker.md#docker-scenarios)

### 6. Kubernetes

   1. [Core concepts](summary/summary_Kubernetes.md#kubernetes-core-concepts)
   2. [Workloads](summary/summary_Kubernetes.md#kubernetes-workloads)
   3. [Services networking](summary/summary_Kubernetes.md#kubernetes-services-networking)
   4. [Storage](summary/summary_Kubernetes.md#kubernetes-storage)
   5. [Config secrets](summary/summary_Kubernetes.md#kubernetes-config-secrets)
   6. [Security](summary/summary_Kubernetes.md#kubernetes-security)
   7. [Advanced](summary/summary_Kubernetes.md#kubernetes-advanced)
   8. [Helm interview qa](summary/summary_Kubernetes.md#kubernetes-helm-interview-qa)
   9. [Theory advanced qa](summary/summary_Kubernetes.md#kubernetes-theory-advanced-qa)
   - [Scenario-Based Questions](summary/summary_Kubernetes.md#kubernetes-scenarios)

### 7. Azure

   1. [Core services aad](summary/summary_Azure.md#azure-core-services-aad)
   2. [App service functions](summary/summary_Azure.md#azure-app-service-functions)
   3. [Storage cdn](summary/summary_Azure.md#azure-storage-cdn)
   4. [Databases](summary/summary_Azure.md#azure-databases)
   5. [Networking](summary/summary_Azure.md#azure-networking)
   6. [Aks acr](summary/summary_Azure.md#azure-aks-acr)
   7. [Pipelines devops](summary/summary_Azure.md#azure-pipelines-devops)
   8. [Interview qa](summary/summary_Azure.md#azure-interview-qa)
   - [Scenario-Based Questions](summary/summary_Azure.md#azure-scenarios)

### 8. AWS

   1. [Core services iam](summary/summary_AWS.md#aws-core-services-iam)
   2. [Ec2 vpc](summary/summary_AWS.md#aws-ec2-vpc)
   3. [S3 cloudfront](summary/summary_AWS.md#aws-s3-cloudfront)
   4. [Lambda api gateway](summary/summary_AWS.md#aws-lambda-api-gateway)
   5. [Rds dynamodb cache](summary/summary_AWS.md#aws-rds-dynamodb-cache)
   6. [Sqs sns eventbridge](summary/summary_AWS.md#aws-sqs-sns-eventbridge)
   7. [Ecs eks ecr](summary/summary_AWS.md#aws-ecs-eks-ecr)
   8. [Cicd interview qa](summary/summary_AWS.md#aws-cicd-interview-qa)
   - [Scenario-Based Questions](summary/summary_AWS.md#aws-scenarios)

### 9. Next.js

   1. [App router fundamentals](summary/summary_NextJS.md#nextjs-app-router-fundamentals)
   2. [Data fetching server actions](summary/summary_NextJS.md#nextjs-data-fetching-server-actions)
   3. [Routing middleware](summary/summary_NextJS.md#nextjs-routing-middleware)
   4. [Authentication](summary/summary_NextJS.md#nextjs-authentication)
   5. [Performance optimization](summary/summary_NextJS.md#nextjs-performance-optimization)
   6. [Pages router data fetching](summary/summary_NextJS.md#nextjs-pages-router-data-fetching)
   7. [Seo metadata i18n](summary/summary_NextJS.md#nextjs-seo-metadata-i18n)
   8. [Interview qa](summary/summary_NextJS.md#nextjs-interview-qa)
   9. [Theory interview qa](summary/summary_NextJS.md#nextjs-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_NextJS.md#nextjs-scenarios)

### 10. GraphQL

   1. [Schema types SDL](summary/summary_GraphQL.md#graphql-schema-types-sdl)
   2. [Resolvers context](summary/summary_GraphQL.md#graphql-resolvers-context)
   3. [Dataloader n plus 1](summary/summary_GraphQL.md#graphql-dataloader-n-plus-1)
   4. [Mutations subscriptions](summary/summary_GraphQL.md#graphql-mutations-subscriptions)
   5. [Apollo client](summary/summary_GraphQL.md#graphql-apollo-client)
   6. [Security error handling](summary/summary_GraphQL.md#graphql-security-error-handling)
   7. [Federation stitching](summary/summary_GraphQL.md#graphql-federation-stitching)
   8. [Interview qa patterns](summary/summary_GraphQL.md#graphql-interview-qa-patterns)
   9. [Theory interview qa](summary/summary_GraphQL.md#graphql-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_GraphQL.md#graphql-scenarios)

### 11. MongoDB

   1. [Core concepts BSON](summary/summary_MongoDB.md#mongodb-core-concepts-bson)
   2. [Data modeling schema](summary/summary_MongoDB.md#mongodb-data-modeling-schema)
   3. [Indexing query optimization](summary/summary_MongoDB.md#mongodb-indexing-query-optimization)
   4. [Aggregation pipeline](summary/summary_MongoDB.md#mongodb-aggregation-pipeline)
   5. [Transactions ACID](summary/summary_MongoDB.md#mongodb-transactions-acid)
   6. [Replication sharding](summary/summary_MongoDB.md#mongodb-replication-sharding)
   7. [Performance tuning](summary/summary_MongoDB.md#mongodb-performance-tuning)
   8. [Security](summary/summary_MongoDB.md#mongodb-security)
   9. [Interview qa scenarios](summary/summary_MongoDB.md#mongodb-interview-qa-scenarios)
   - [Scenario-Based Questions](summary/summary_MongoDB.md#mongodb-scenarios)

### 12. Web Security

   1. [Theory interview qa](summary/summary_WebSecurity.md#web-security-theory-interview-qa)
   - [Scenario-Based Questions](summary/summary_WebSecurity.md#web-security-scenarios)

---

> Click any topic or section in the Table of Contents above to open its full reference in the dedicated summary file.
