import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Post, slugify } from './models.js';

const { MONGODB_URI } = process.env;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const posts = [
  {
    title: 'Getting started with retrieval-augmented generation',
    excerpt: 'A practical architecture for grounding language-model answers in your own documents, with retrieval, evaluation, and production guardrails.',
    image: '/seed-covers/rag.svg',
    content: `Retrieval-augmented generation (RAG) connects a language model to a collection of trusted, current documents at answer time. It is useful when a model's training data is stale, private, or too broad to reliably answer a product-specific question. A dependable system is not simply a vector database followed by a prompt: it is a data pipeline, a retrieval service, an evidence policy, and an evaluation loop. Each stage can introduce omissions or distortions, so teams should make those stages observable and independently testable. This guide follows a small support knowledge base from ingestion through deployment and focuses on the engineering decisions that determine whether an answer is useful and auditable.

![Diagram of a retrieval-augmented generation pipeline](/seed-covers/rag.svg)

> Ground every answer in retrievable evidence, and make “not enough evidence” a valid result rather than a failure to hide.

## Prepare documents as durable source data

Start with an inventory of authoritative sources: product manuals, release notes, runbooks, and approved support articles. Record ownership, update cadence, access policy, and canonical URL for each source before extracting text. A crawler that indiscriminately ingests every page can quietly mix deprecated instructions with current policy. Normalize source text while retaining headings, lists, tables, timestamps, and stable identifiers. Store the original document and a versioned extraction so an answer can later be traced to the exact input that produced it.

Chunking is a retrieval design choice, not a string-length setting. Split at meaningful boundaries such as a procedure step, a subsection, or a product concept, then apply a modest overlap only where context would otherwise be lost. Very large chunks dilute similarity scores; very small chunks omit the qualification that makes a sentence safe to follow. Include metadata such as product version, locale, visibility, and document date in every chunk. Metadata gives the query layer a principled way to filter results instead of expecting embedding similarity to enforce access or freshness.

## Retrieve with explicit constraints

At query time, first authenticate the user and determine which documents they are allowed to see. Apply that scope as a database filter before or during vector search; retrieving restricted text and discarding it afterward can leak information through logs, traces, or accidental prompt construction. Embed the query with the same model family and preprocessing conventions used for the indexed corpus. Ask for more candidates than will fit in the prompt, then rank them using a combination of semantic similarity, lexical matches, freshness, and product metadata.

The retrieval response should preserve the source ID, title, URL, version, and a relevance score. Keep this structured evidence separate from the prompt string until the final assembly step. That separation lets an engineer inspect why a candidate was selected, compare retrieval versions, and redact fields before they are sent to a model provider. A score threshold is useful only after it has been calibrated on real queries; the numeric range of a vector distance does not itself tell you whether a passage supports an answer.

### Add reranking only where it earns its cost

A cross-encoder or model-based reranker can improve the ordering of a small candidate set because it evaluates the query and passage together. It also adds latency, compute expense, and another dependency to operate. Establish a baseline with representative queries before adopting it. If reranking helps only one document type, route that type explicitly rather than paying the cost for every request. Capture the candidates before and after reranking in sampled, access-controlled traces so quality regressions can be diagnosed without retaining unnecessary user data.

## Build answers around evidence

Construct a prompt that labels retrieved passages as untrusted reference material, tells the model not to follow instructions contained in those passages, and requires citations to their source identifiers. Treat the prompt as a contract, not a security boundary: validate the response after generation. A useful response schema can include answer text, cited chunk IDs, and a disposition such as answered, insufficient evidence, or clarification needed. Verify that every cited ID appeared in the retrieval result and that the answer does not claim support from an uncited source.

\`\`\`js
async function answerQuestion(question, principal) {
  const filters = { tenantId: principal.tenantId, status: 'current' };
  const candidates = await retrieve(question, { filters, limit: 12 });
  const evidence = await rerank(question, candidates);
  if (!evidence.length || evidence[0].score < MIN_EVIDENCE_SCORE) {
    return { disposition: 'insufficient_evidence', citations: [] };
  }
  const result = await generateWithCitations(question, evidence.slice(0, 5));
  return validateCitations(result, evidence);
}
\`\`\`

Keep the retrieved context compact and remove duplicate passages before generation. If the documents disagree, surface the conflict or ask a follow-up instead of blending incompatible instructions into a confident answer. Include a short citation beside each material claim and link it to the canonical document. For sensitive workflows, require a human approval step before the generated text can trigger an action. Generation should create a draft grounded in evidence; authorization and execution remain the responsibility of trusted application code.

## Evaluate and operate the full pipeline

Build an evaluation set from anonymized, reviewed questions that include answerable cases, ambiguous requests, stale documents, and questions for which the corpus has no answer. Measure retrieval recall at the context limit, citation validity, factual support, refusal quality, and end-to-end latency separately. A single “looks good” score hides whether a failure came from extraction, ranking, prompt construction, or model behavior. Review difficult examples with subject-matter experts, and keep the set versioned so a model or chunking change can be compared against the same cases.

| Design choice | Strength | Cost or failure mode | Useful signal |
| --- | --- | --- | --- |
| Vector-only retrieval | Finds paraphrases | Can miss exact identifiers | Recall at K |
| Hybrid lexical and vector search | Balances terms and meaning | Needs score normalization | Recall by query type |
| Reranking candidates | Improves top-result ordering | Adds latency and cost | NDCG and p95 latency |

In production, measure ingestion lag, empty retrieval rate, answer refusal rate, citation validation failures, provider errors, and p50/p95 latency. Log identifiers and scores rather than full private passages by default; set retention, access, and redaction rules for any sampled traces. Reindexing should be repeatable from source versions, and model, prompt, and embedding changes should be rolled out behind a measurable canary. Start with a read-only use case, compare answers with the existing support workflow, and expand only when evidence quality and operational ownership are clear.`,
  },
  {
    title: 'Zero-trust security for small teams',
    excerpt: 'A practical, proportionate zero-trust program for small engineering teams: identity, device posture, least privilege, and measurable verification.',
    image: '/seed-covers/zero-trust.svg',
    content: `Zero trust is a way to make each access decision explicit, not a product bundle or a promise that every request can be perfectly verified. Small teams often assume it requires a large security operations center, but its core practices are familiar engineering work: reliable identity, scoped permissions, managed devices, and useful audit trails. The goal is to reduce the blast radius of a compromised account while keeping legitimate work straightforward. Begin with the systems that hold production credentials and customer data, document how access is granted, and improve the weakest control first. A small, consistently enforced policy is more valuable than an ambitious diagram that nobody can operate.

![Diagram illustrating identity, device, and resource checks](/seed-covers/zero-trust.svg)

> Verify the principal and the requested action at the resource boundary; network location is not proof of trust.

## Make identity the first control plane

Use a central identity provider with multifactor authentication, unique named accounts, and prompt deprovisioning. Shared administrator logins make it impossible to attribute actions and difficult to remove access for one departing person. Prefer phishing-resistant authentication for owners and anyone who can alter production infrastructure. Recovery methods matter as much as enrollment: protect backup codes, establish a documented recovery owner, and test account recovery before an incident. Avoid security policies that encourage staff to bypass controls because normal work is blocked.

Map roles to actual tasks before creating groups. An engineer who deploys a service may need permission to promote a reviewed build, but not permission to read every customer record or change billing ownership. Separate emergency access from everyday access, and record the reason, approver, and expiration whenever elevated access is granted. Automate joiner, mover, and leaver workflows where possible; for a small team, even a reviewed checklist connected to the identity provider is safer than relying on memory.

## Protect devices and sessions proportionately

Require supported operating-system versions, screen locks, disk encryption, and automatic security updates on devices used to administer production. A lightweight device-management policy can report whether a device meets those requirements without collecting personal browsing activity. If the team has contractors or bring-your-own-device workflows, define which resources are reachable from unmanaged devices and use short-lived, narrowly scoped sessions for exceptions.

Session controls should match the risk of the action. Reading a public dashboard should not require repeated prompts, while creating a new production credential may justify fresh authentication and a second-person review. Revoke active sessions when an account is disabled, and rotate credentials if a device is lost or its state is unknown. Establish a safe path for software updates and recovery so a lost device does not become an excuse to reuse a shared administrator account.

### Apply least privilege to credentials

Inventory API keys, deployment tokens, database users, and cloud roles with an owner and expiration or review date. Prefer workload identity or short-lived credentials over long-lived secrets in local files and CI variables. Where a secret is unavoidable, store it in a managed secret store, restrict which workflow can request it, and rotate it with a tested procedure. Keep development, staging, and production identities separate so a test tool cannot accidentally inherit production authority.

## Enforce decisions at each resource

A VPN can protect traffic, but it does not establish that a user should read a database or deploy a service. Put authorization checks at the application, cloud resource, and data boundaries. Use narrowly scoped roles, environment-specific projects, and explicit allowlists for privileged operations. For web applications, verify authorization on the server for every protected request; hiding a button or route in the client is only a usability choice. Review background jobs and service accounts with the same rigor as human accounts because unattended credentials can persist unnoticed.

\`\`\`js
function canDeploy(principal, deployment) {
  const permittedGroup = deployment.environment === 'production'
    ? principal.groups.includes('production-approvers')
    : principal.groups.includes('release-engineers');
  return principal.active && permittedGroup &&
    (deployment.environment !== 'production' ||
      Boolean(deployment.approvedBy && deployment.approvedBy !== principal.id));
}

async function deploy(principal, deployment) {
  if (!canDeploy(principal, deployment)) throw new Error('Deployment not authorized');
  await audit.record({ actor: principal.id, action: 'deploy', target: deployment.id });
  return deploymentService.promote(deployment);
}
\`\`\`

Authorization code should be easy to test and difficult to bypass. In a real implementation, express the policy with named predicates and explicit parentheses rather than relying on operator precedence in a compact example. Test both allowed and denied paths, including disabled users, wrong environments, missing approvals, and stale tokens. Log the decision outcome and reason code while avoiding passwords, access tokens, and unnecessary personal data in application logs.

## Measure and rehearse the controls

Choose a few outcomes the team can review each month: percentage of privileged accounts with strong MFA, number of unowned secrets, access-review completion, and time to disable a departed account. A metric is useful when it leads to a specific action; a dashboard full of counts is not a security program. Review high-impact grants when roles change, and remove permissions that have no current owner or business purpose. Keep an exception register with a named approver and a near-term review date.

| Control | Small-team starting point | Evidence to review |
| --- | --- | --- |
| Identity | MFA and named accounts | Enrollment and disabled-account audit |
| Devices | Encryption, lock, supported OS | Compliance status and exception age |
| Secrets | Scoped, owned, rotated credentials | Inventory and last-rotation date |

Run a short tabletop exercise for a stolen laptop, a leaked deployment token, and a compromised email account. The team should know how to revoke sessions, disable keys, preserve relevant audit logs, notify the right owner, and restore service without improvising privileged access. Capture what was confusing and fix that workflow. Zero trust is continuous verification paired with usable operations: invest in the checks that meaningfully limit exposure, review their evidence, and make the safe path the easiest path for the people doing the work.`,
  },
  {
    title: 'Choosing a cloud region without regrets',
    excerpt: 'A decision framework for cloud-region selection that balances user latency, data residency, service availability, recovery objectives, and cost.',
    image: '/seed-covers/cloud-region.svg',
    content: `Selecting a cloud region is an architectural decision with operational, legal, and financial consequences. The nearest region is not always the right one: a database may need to remain within a jurisdiction, a required managed service may not be available everywhere, or a second region may be necessary for recovery. Conversely, choosing a distant default because it is familiar can add avoidable latency to every request. Start with measurable user locations, the data each service processes, and the recovery objectives the business actually needs. Treat a region choice as a documented trade-off that can be revisited, not as a dropdown selected during account setup.

![Diagram showing primary and recovery cloud regions](/seed-covers/cloud-region.svg)

> Pick a region from requirements and measured behavior, not from a map or a marketing claim.

## Translate product needs into constraints

Map the user journey and identify which operations are latency-sensitive. A static content request can tolerate a different path from an interactive write that waits for a database commit. Use application telemetry or representative synthetic probes to measure round-trip time from real user geographies to candidate regions. Include network variability and p95 or p99 latency rather than comparing only a single median from a developer laptop. Decide which endpoints need a nearby point of presence and which can remain centralized.

Next, classify the data. Customer records, logs, backups, support artifacts, and analytics exports may have different residency or retention requirements. Confirm the applicable contracts and regulations with qualified legal and compliance partners; region selection alone does not establish compliance. Document where data is stored, processed, replicated, and backed up, including managed services that create secondary copies. Record the interpretation and owner so the architecture decision can be reviewed when a product expands to a new country.

## Compare service capability and failure domains

Build a shortlist based on the managed services, instance families, quotas, and availability zones the workload needs. Feature parity changes over time, and a service name in a regional catalog does not guarantee identical limits or behavior. Validate critical dependencies in a small deployment and request quota increases before a launch. Consider whether the region has enough independent zones for the failure model you have chosen and how control-plane operations behave during a regional incident.

Distinguish a region from an availability zone and from a provider edge point of presence. Multiple zones inside one region can protect against some facility failures, but they do not automatically provide regional disaster recovery. A global DNS record can route users around an endpoint only if the alternate application, data, identity, and secrets are ready to serve them. Make the failure boundary explicit for each dependency instead of assuming that a “multi-region” checkbox creates a tested recovery plan.

### Model latency and data movement together

A service can appear close to users while its primary database is far away. Measure the complete request path, including authentication, cache misses, synchronous writes, and third-party APIs. If services are split across regions, account for cross-region round trips and possible consistency behavior. Replication reduces some read latency but introduces lag, conflict resolution, and additional cost. Keep tightly coupled services near their authoritative data unless measurements show that a more distributed design is worth its operational complexity.

## Price the steady state and the failure case

Compare total cost rather than a compute instance price. Include managed database tiers, backups, inter-region transfer, observability, support plans, data egress, and staff time for operating additional environments. Cross-region traffic can dominate a seemingly inexpensive architecture if every request fans out to a remote service. Ask the provider for pricing assumptions in writing when a workload has material transfer volume, and estimate both normal operation and recovery traffic.

\`\`\`js
const regions = [
  { name: 'region-a', p95Ms: 42, dataPolicy: 'approved', services: 9, monthlyCost: 820 },
  { name: 'region-b', p95Ms: 68, dataPolicy: 'approved', services: 9, monthlyCost: 690 },
  { name: 'region-c', p95Ms: 35, dataPolicy: 'review', services: 7, monthlyCost: 760 }
];

const eligible = regions.filter(region =>
  region.dataPolicy === 'approved' && region.services >= 9
);
const recommendation = eligible
  .filter(region => region.p95Ms < 100)
  .sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
\`\`\`

Use a decision table to make the criteria and their relative importance visible. The example is not a universal scoring formula; assign weights with product, security, and operations stakeholders. Reject an option that violates a hard compliance or availability constraint even if its weighted score looks attractive. Preserve the alternatives and assumptions so future teams can understand why the selected option won.

| Criterion | Questions to answer | Evidence |
| --- | --- | --- |
| User experience | What are p95 request times by market? | Production traces and probes |
| Data handling | Which copies and logs remain in scope? | Data map and legal review |
| Resilience | What failure is the design expected to survive? | Tested recovery exercise |
| Cost | What are transfer and backup costs at forecast load? | Usage model and quote |

## Validate recovery before declaring the choice

Write down recovery time and recovery point objectives for each important service. A backup is not a recovery strategy until someone has restored it into an isolated environment and measured the result. If the business needs regional recovery, replicate only the necessary data, automate infrastructure deployment, and document how to handle writes during failover. Practice failback as carefully as failover; returning to the primary region can create data loss if teams have not agreed which copy is authoritative.

Revisit the decision when user geography, regulation, service availability, or workload shape changes materially. Put the decision record beside the infrastructure code, with an owner and review trigger. A well-chosen region is the one that satisfies the real constraints, has a measured user experience, and can be operated through its expected failures. That clarity is what prevents a quick initial choice from turning into an expensive and risky migration later.`,
  },
  {
    title: 'Clean architecture in a React codebase',
    excerpt: 'A pragmatic way to separate React UI, application workflows, and external services without burying a small product in abstractions.',
    image: '/seed-covers/clean-architecture.svg',
    content: `Clean architecture in a React application is less about reproducing a textbook folder tree and more about controlling change. A component should not need to understand HTTP status codes, local storage formats, and domain rules simply to display a button. At the same time, a small application does not benefit from a dozen layers that only pass arguments through. Start by identifying decisions likely to vary: where data comes from, how user intent becomes a workflow, and how the interface represents loading, success, and failure. Put boundaries around those decisions, keep the simplest path visible, and add abstraction only when it makes a real change easier to test or review.

![Diagram showing UI, application, and infrastructure boundaries](/seed-covers/clean-architecture.svg)

> The useful boundary is the one that lets a feature change without requiring unrelated parts of the application to change with it.

## Separate rendering from application decisions

React components are excellent at describing a view from state. Keep route composition, form state, accessibility behavior, and presentation near the component that owns them. Move reusable domain decisions out when the same rule is duplicated or when it deserves direct tests without mounting a browser. For example, a pricing calculation can be a pure function; a save workflow can be a hook or service that coordinates a repository and reports typed outcomes. Avoid adding a generic “use case” wrapper around a single line of code that is already clear at its call site.

Choose modules by feature where that makes ownership obvious. A profile feature might own its page, data types, validation, and API adapter rather than scattering those files across global components, hooks, and utilities folders. Shared UI components should be genuinely reusable and should not import feature-specific business state. This direction of dependency keeps common visual primitives stable while allowing a feature to evolve without turning a global utility folder into a hidden dependency graph.

## Put external effects behind small interfaces

Network calls, browser storage, timers, and analytics are effects. Centralize low-level request behavior such as base URLs, authorization headers, and error normalization, but let feature code express the operation it needs in product language. A loadArticle function with a slug is easier to reason about than exposing a generic fetch client to every component. Keep request and response types at the boundary, validate untrusted data when the application requires runtime guarantees, and avoid returning loosely shaped objects that merely postpone errors.

For browser storage, define what happens when data is absent, malformed, or from an older version. A small adapter can catch parse errors, migrate a known format, and return a visible error state where persistence is essential. Do not silently convert every failure into an empty collection; that may make a user's saved work appear deleted. Injecting an interface for a complicated effect can help tests, but a direct function parameter or module mock is often enough for a modest codebase.

### Make dependencies point toward stable rules

The view may depend on application behavior, and application behavior may depend on a small interface for persistence. The infrastructure implementation then satisfies that interface. In React, that does not require a dependency-injection container: a factory, hook parameter, or module-level adapter can make the direction clear. Keep the number of indirections proportional to the number of implementations or tests that need to vary. If a reader has to jump through five files to discover which endpoint a button calls, the architecture has made the change harder rather than safer.

## Model loading, errors, and mutations explicitly

Asynchronous UI has more states than “data or spinner.” Represent loading, success, empty results, and recoverable failure clearly. A typed discriminated union can prevent a component from rendering contradictory combinations such as loading being true alongside stale data that looks current. For mutations, disable duplicate submissions when appropriate, preserve user input on failure, and report a useful message. Error handling belongs at the layer that can decide whether to retry, show a local explanation, or route the failure to observability.

\`\`\`ts
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'success'; value: T }
  | { status: 'error'; message: string };

async function loadProfile(
  profileId: string,
  repository: ProfileRepository
): Promise<LoadState<Profile>> {
  try {
    return { status: 'success', value: await repository.get(profileId) };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to load profile'
    };
  }
}
\`\`\`

This example keeps the application decision independent of React rendering, while a component can map each state to an accessible presentation. In a real product, normalize expected API errors at the repository boundary and avoid exposing internal server messages directly to users. Tests should exercise the expected failure modes, not only the successful request. The goal is not to catch every exception and pretend the workflow succeeded; it is to preserve enough context for the user and the engineer to respond correctly.

## Choose tests and boundaries by risk

Pure business rules are cheap to unit test. Repository adapters can be tested against a mocked transport, while critical user journeys deserve a smaller number of browser-level tests. Avoid testing implementation details such as hook call order or private state names; test outcomes a user relies on. For a form, cover invalid input, successful submission, server rejection, keyboard navigation, and duplicate submission. Run type checking and linting as fast feedback, then use integration tests for the boundaries where serialization or routing errors are most likely.

| Approach | Benefits | Trade-off |
| --- | --- | --- |
| Feature modules | Clear ownership and local changes | Requires intentional shared-code boundaries |
| Layered modules | Explicit technical roles | Can scatter one feature across folders |
| One-file feature | Fast for very small UI | Becomes hard to test as effects accumulate |

Refactor incrementally around a real change. First extract a repeated rule or an effect with multiple callers; then update tests and remove the old path. Do not rename every folder because an architecture diagram suggests it. Keep public module APIs small, document important invariants, and review dependency direction when adding a new feature. A healthy React architecture helps a teammate answer “where does this behavior belong?” quickly while keeping the product responsive to changing requirements.`,
  },
  {
    title: 'Shipping a mobile app with one codebase',
    excerpt: 'How to ship a reliable cross-platform mobile app by sharing domain logic while respecting native navigation, permissions, and release workflows.',
    image: '/seed-covers/mobile-app.svg',
    content: `A single codebase can reduce duplicated product logic across iOS and Android, but it does not make the platforms identical. Users expect platform-appropriate navigation, permission prompts, keyboard behavior, accessibility, and background execution. The strongest cross-platform architecture shares domain rules and stable interface patterns while isolating native capabilities behind deliberate adapters. Decide what should be shared by measuring the cost of duplication against the cost of conditional complexity. A feature that behaves differently because of operating-system constraints may deserve a small platform-specific implementation rather than a universal component filled with exceptions.

![Diagram of shared application logic with native platform adapters](/seed-covers/mobile-app.svg)

> Share the rules and workflows that are genuinely common; adapt the edges where each platform has its own contract.

## Define a product and platform boundary

List the user journeys before choosing an architecture. For each journey, identify its UI, domain rules, persistence, network calls, and native integrations. Authentication, validation, data transformation, and API contracts are often good candidates for sharing. Push notification registration, secure credential storage, camera access, and deep-link handoff need platform-aware behavior. Record platform requirements such as minimum OS versions, supported device sizes, and offline expectations early enough to influence the design.

Keep platform decisions at the boundary. A location feature can expose a typed request-current-location operation while separate native adapters handle platform permission APIs, accuracy options, and denial states. The shared layer should receive an explicit result such as permission-denied or unavailable, not guess from a missing coordinate. This makes the product behavior testable without simulating every device and gives the interface enough information to explain how a user can recover.

## Design offline behavior and synchronization

Mobile connectivity is intermittent, and an app that assumes every request succeeds will feel unreliable on ordinary networks. Decide which screens can use a cached snapshot, which edits can be queued, and which actions must be confirmed online. Store local data with a clear ownership and expiration policy. If users can edit the same record on multiple devices, define conflict behavior explicitly: last-write-wins may be acceptable for a preference but not for a collaborative draft or financial instruction.

Use stable operation IDs for queued mutations so retrying after a timeout does not create duplicate server-side effects. Make synchronization observable through states such as pending, syncing, synced, and needs-attention. Protect sensitive local data with platform-supported secure storage where appropriate, and avoid assuming that encrypted storage eliminates the need for server authorization. Test airplane mode, network changes during uploads, app termination while queued, and expired sessions.

### Keep native capabilities narrow and reviewable

Wrap platform APIs in small modules with typed inputs, outputs, and errors. A permission request should distinguish denied, restricted, and unavailable states where the platform exposes them. Do not request microphone, camera, contacts, or location access at launch unless the immediate user journey needs it. Explain why access is needed at the point of use, handle refusal without trapping the user, and make optional features remain optional. Review platform manifests and privacy declarations as part of feature review because unused permissions can erode user trust and complicate store approval.

## Automate repeatable builds and releases

Pin runtime and toolchain versions, keep signing material out of source control, and make release builds reproducible in CI. Separate development, staging, and production configuration without embedding secret API keys in the client bundle. Use a staged rollout so a crash or backend incompatibility can be detected before the full user base updates. Maintain a release checklist covering app identifiers, build numbers, store metadata, privacy declarations, and rollback or hotfix ownership.

\`\`\`yaml
name: mobile-checks
on:
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test -- --runInBand
\`\`\`

The example shows a small deterministic verification job; native compilation and signing may require platform-specific runners or a managed build service. Cache dependencies carefully, but do not let a cache hide a missing lockfile or an unpinned compiler. Run unit tests on every change and schedule device-level smoke tests against representative OS versions. Keep signing credentials in a protected secret manager, limit which workflow can access them, and rotate them through a rehearsed process.

| Delivery strategy | Advantage | Risk to manage |
| --- | --- | --- |
| One shared UI for both platforms | Fast iteration and consistent flows | Platform conventions can feel unnatural |
| Shared domain, native interface | Better native fit | More UI code and coordination |
| Platform-specific features | Best use of native capability | Divergent behavior and maintenance |

## Validate the experience beyond the happy path

Test on physical devices with different screen sizes, memory pressure, and network quality. Emulators are valuable for coverage but cannot fully reproduce camera focus, biometric enrollment, notification delivery, or real-world radio changes. Include accessibility checks for screen readers, text scaling, focus order, and touch target size. Capture crash-free sessions and startup time by platform and version, and watch them during staged rollout. A successful build is not evidence that the app behaves correctly on a user's device.

Finally, plan the release as a product operation rather than a one-time binary upload. Coordinate API compatibility so older app versions remain functional during rollout. Provide support with a clear version identifier and a way to report diagnostics without collecting unnecessary personal information. Review crash reports, store feedback, and rollout metrics daily during an initial release window. One codebase is valuable when it makes improvements safer and faster; that outcome depends on respecting the native edges, testing real conditions, and keeping release ownership explicit.`,
  },
  {
    title: 'What 2026 means for engineering leaders',
    excerpt: 'A field guide for engineering leaders balancing AI adoption, reliability, developer experience, and sustainable delivery in 2026.',
    image: '/seed-covers/engineering-leadership.svg',
    content: `Engineering leadership in 2026 is less about choosing a fashionable tool and more about helping teams make good decisions under faster change. AI-assisted development, platform engineering, security expectations, and customer demand are all moving at once, but no organization can optimize every dimension simultaneously. Leaders need a credible view of where time goes, which risks matter, and what outcome a proposed investment should improve. That means preserving space for technical judgment, measuring work at the system level, and communicating trade-offs plainly. The teams that adapt well will not be the ones that automate everything; they will be the ones that learn quickly without losing accountability.

![Diagram of engineering outcomes and feedback loops](/seed-covers/engineering-leadership.svg)

> Technology creates options; leadership makes the priorities, ownership, and feedback loops clear enough to use them well.

## Treat AI as a workflow change

AI coding assistants can shorten some tasks, especially when engineers have clear requirements, local tests, and a bounded change. They can also produce plausible code that misses product assumptions, security constraints, or repository conventions. Evaluate them against representative work from your own codebase instead of relying on general productivity claims. Measure cycle time, review effort, defect rates, and developer confidence. Segment results by task type and experience level so an average does not conceal that one group is doing more cleanup.

Set expectations for review and data handling before making a tool mandatory. Developers remain responsible for understanding and testing code they submit. Decide which repositories or data may be sent to a model provider, how usage is logged, and how generated dependencies or licenses are reviewed. Encourage teams to report where assistance is useful and where it creates friction. Tool adoption should follow a real workflow improvement, not a utilization target that rewards activity without confirming value.

## Improve the system that delivers software

Teams often respond to slow delivery by asking engineers to work faster, when the actual constraint is a long approval queue, fragile integration environment, or unreliable test suite. Map the path from an idea to production and identify where work waits or repeats. Delivery metrics such as lead time, deployment frequency, change failure rate, and recovery time become useful when teams use them to investigate their own bottlenecks rather than to rank individuals.

Invest in developer experience where many teams repeatedly lose time. A paved road can offer secure defaults for service creation, deployment, observability, and ownership without preventing teams from making justified exceptions. Track adoption alongside the cost of maintaining the platform itself. An internal platform is a product: it needs users, documentation, support, and a roadmap. If its interface is harder than the manual path, teams will route around it and create untracked operational risk.

### Protect reliability and security as product work

Reliability does not improve through incident-free dashboards alone. Define service objectives that reflect user expectations, use error budgets to guide release risk, and review incidents for systemic contributors. Security belongs in those same planning discussions: owners need time to patch, rotate credentials, retire unsupported systems, and respond to vulnerabilities. Avoid treating reliability and security work as optional cleanup after feature delivery, because deferred risk eventually appears as an urgent interruption that is more expensive to address.

## Build durable teams and technical judgment

Clear ownership helps people act without waiting for a distant approval chain. Pair that ownership with decision records for consequential choices, lightweight review paths, and an escalation mechanism for risks that cross team boundaries. Good delegation includes context, authority, and a definition of success. It does not mean handing off an ambiguous problem and measuring a team only by the date it returns. Leaders should remove cross-team obstacles and make the constraints visible so teams can choose a feasible plan.

\`\`\`js
function reviewInvestment(proposal, baseline) {
  return {
    expectedOutcome: proposal.metric,
    currentValue: baseline[proposal.metric],
    targetValue: proposal.target,
    reviewDate: proposal.reviewDate,
    owner: proposal.owner,
    guardrails: proposal.guardrails
  };
}

const decision = reviewInvestment(platformProposal, currentMetrics);
if (!decision.owner || !decision.reviewDate || !Array.isArray(decision.guardrails) || !decision.guardrails.length) {
  throw new Error('Investment needs an accountable owner and review plan');
}
\`\`\`

Use this kind of small decision record to make an investment falsifiable. State the problem, baseline, expected outcome, responsible owner, and the date when the team will review evidence. If the expected benefit does not appear, change direction rather than defending sunk cost. A pilot should be large enough to expose real integration costs but bounded enough that stopping it is practical. Good technical judgment includes the ability to say no, narrow scope, or retire a tool that no longer earns its maintenance burden.

| Leadership signal | What it can reveal | What it should not become |
| --- | --- | --- |
| Lead time by work type | Queueing and rework | An individual productivity ranking |
| Change failure rate | Risk in delivery practices | A reason to avoid all change |
| Developer feedback | Friction and missing context | A substitute for observed outcomes |

## Make the year legible through outcomes

Choose a few priorities that connect engineering work to customer or business outcomes. Explain what will not be prioritized as well as what will. Review progress at a useful cadence, acknowledge changes in assumptions, and keep a visible backlog for reliability and foundational work. Teams become skeptical when every quarter introduces a new theme while old commitments remain unresolved. Consistent follow-through is a strategic advantage because it lets people plan and reduces the hidden cost of context switching.

Leaders should make room for learning without pretending every experiment will succeed. Fund small tests, define a stop condition, and share the result—including failures—so other teams do not repeat the same work. Balance near-term delivery with architectural health through explicit capacity and a review of recurring operational pain. The most useful leadership question is not “How many features shipped?” but “Which constraints became less costly, and what evidence supports that?” In a fast-moving year, clarity and trust are practical engineering tools.`,
  },
  {
    title: 'Edge computing, explained plainly',
    excerpt: 'Where edge computing reduces latency or bandwidth, what it costs in operational complexity, and how to decide whether it belongs in your system.',
    image: '/seed-covers/edge-computing.svg',
    content: `Edge computing places some processing closer to the devices, users, or data sources that need it. “Closer” may mean a gateway on a factory floor, a regional point of presence, or a constrained device; it does not automatically mean a faster or cheaper system. Edge is useful when a workload has a measurable latency target, must continue during a network interruption, or moves more raw data than a central service should receive. It also creates more deployment locations, partial failures, and synchronization paths. Before choosing an edge platform, describe which decision must happen locally, how quickly it must happen, and what the system should do when connectivity returns.

![Diagram showing devices, edge processing, and cloud coordination](/seed-covers/edge-computing.svg)

> Move computation outward only when locality solves a measured constraint that a simpler design cannot meet.

## Identify work that benefits from locality

Start by measuring where latency is spent. A client may be waiting on a distant database, a model inference call, a large upload, or an inefficient application protocol. Content delivery networks already handle many static and cacheable workloads without requiring teams to operate custom edge code. If an operation depends on authoritative global state, moving only its compute closer to a user may not help because the remote read remains on the critical path.

Edge execution is compelling for bounded transformations: filtering sensor noise, validating a local safety threshold, resizing media, or responding to a request when a wide-area link is unavailable. Define the maximum acceptable response time, the data available locally, and the consequence of using stale information. A system that can safely serve a cached catalog during an outage has a different risk profile from one that controls industrial equipment. Make the failure behavior an explicit product decision, not an implementation detail.

## Partition state and responsibilities

Separate state into categories such as authoritative, replicated, cached, and ephemeral. Decide which system owns each write and how a local change is reconciled with the central record. Offline queues need stable operation identifiers, retry limits, ordering rules, and a way to surface conflicts. If two locations can update the same entity, define a merge policy based on the domain; last-write-wins is simple but can discard meaningful user work. Provide a reconciliation path for records that cannot be merged automatically.

Keep edge workloads small and constrained. Bundle only the configuration and models required for a location, validate their version and integrity before activation, and support rollback when a release behaves unexpectedly. Protect device identity and secrets with platform-appropriate mechanisms. A disconnected device still needs a policy for expired credentials, revoked access, and locally retained data. Define how long it may operate without contacting the control plane and what capabilities become unavailable after that window.

### Treat fleet operations as part of the design

A successful local prototype says little about managing thousands of heterogeneous nodes. Plan enrollment, software updates, configuration drift detection, health reporting, remote diagnostics, and physical replacement. Devices may be behind firewalls, powered off, or on expensive links; the management system should tolerate delayed check-ins and staggered rollouts. Use staged deployment rings, compatibility checks, and a recovery partition or equivalent rollback mechanism. Track the last known configuration and software version without exposing sensitive payloads in central telemetry.

## Build for intermittent connectivity

Assume the edge can be isolated from the cloud and that messages can be duplicated, delayed, or reordered. Design APIs and event handlers to be idempotent where possible. Use bounded local storage with clear retention rules so a long outage cannot fill a device and silently corrupt future writes. When the connection returns, apply backoff, prioritize important control messages, and limit bulk synchronization so recovery traffic does not overwhelm a narrow link.

\`\`\`js
async function handleEvent(event, store, upstream) {
  if (await store.hasProcessed(event.id)) return { status: 'duplicate' };
  await store.transaction(async tx => {
    await tx.apply(event.payload);
    await tx.markProcessed(event.id);
  });

  if (upstream.isConnected()) {
    await upstream.enqueue({ id: event.id, payload: event.payload });
  }
  return { status: 'accepted' };
}
\`\`\`

This sketch highlights a durable deduplication record, but production systems must ensure the state change and processed marker share a transaction or an equivalent atomic guarantee. Otherwise a crash between the two writes can lose or repeat an event. Define what happens when the upstream queue is full, whether the event can be safely dropped, and how operators are alerted. Offline-first behavior is a reliability contract and must be tested under process restarts, storage exhaustion, and reconnect storms.

| Architecture | Best fit | Main trade-off |
| --- | --- | --- |
| Central service with CDN | Cacheable responses and static assets | Limited local decision-making |
| Regional edge functions | Short-lived request computation | Provider limits and distributed observability |
| Managed on-site gateway | Local devices and disconnected work | Fleet maintenance and physical access |

## Compare cost and risk before expanding

Include hardware, connectivity, remote management, secure provisioning, software updates, and replacement in the cost model. Edge can reduce outbound bandwidth or cloud compute, but it can increase engineering and support costs. Model a normal day, an extended network outage, and a bad rollout. Identify who can diagnose an issue when the device is thousands of kilometers away and what minimum service remains if the control plane is unavailable. A system that depends on a rare specialist for routine recovery is not operationally ready.

Begin with a pilot at one representative location, including the worst connectivity conditions you expect. Measure end-to-end latency, availability during isolation, synchronization backlog, CPU and storage use, and operator time. Compare those results with a centralized baseline that uses caching and protocol improvements. Expand only if locality provides a clear benefit that justifies the added fleet and consistency complexity. Document the boundary between local autonomy and central control so future features do not accidentally depend on assumptions the network cannot guarantee.`,
  },
];

function countWords(content) {
  const prose = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^!\[[^\]]*\]\([^)]+\)\s*$/gm, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~]/g, '');
  return prose.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function validatePosts() {
  for (const post of posts) {
    const headings = post.content.match(/^#{2,3}\s.+$/gm) ?? [];
    const codeBlocks = post.content.match(/^```/gm) ?? [];
    const words = countWords(post.content);
    const coverPath = path.join(root, 'client', 'public', post.image.slice(1).split('/').join(path.sep));
    if (words < 700) throw new Error(`"${post.title}" has only ${words} prose words; expected at least 700.`);
    if (headings.length < 5 || headings.length > 5) throw new Error(`"${post.title}" must have exactly five H2/H3 headings.`);
    if (codeBlocks.length < 2 || codeBlocks.length % 2 !== 0) throw new Error(`"${post.title}" needs a fenced multi-line code block.`);
    if (!post.content.includes('\n| ') || !post.content.includes('\n> ') || !post.content.includes(`](${post.image})`)) {
      throw new Error(`"${post.title}" is missing its comparison table, callout, or inline image.`);
    }
    if (!fs.existsSync(coverPath)) throw new Error(`Cover or inline diagram not found: ${coverPath}`);
    post.readingTime = Math.max(1, Math.ceil(words / 200));
  }
}

validatePosts();

if (process.argv.includes('--dry-run')) {
  for (const post of posts) console.log(`${slugify(post.title)}: ${countWords(post.content)} words, ${post.readingTime} min, ${post.image}`);
  console.log(`Validated ${posts.length} existing article updates; no database connection made.`);
} else {
  if (!MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env before updating existing articles.');
  await mongoose.connect(MONGODB_URI);
  try {
    const slugs = posts.map(post => slugify(post.title));
    const existing = await Post.find({ slug: { $in: slugs } }).select('slug').lean();
    const existingSlugs = new Set(existing.map(post => post.slug));
    const missing = slugs.filter(slug => !existingSlugs.has(slug));
    if (missing.length) {
      throw new Error(`Refusing to create articles; these existing seed slugs were not found: ${missing.join(', ')}`);
    }

    for (const post of posts) {
      const updated = await Post.findOneAndUpdate(
        { slug: slugify(post.title) },
        { $set: { content: post.content, excerpt: post.excerpt, image: post.image, readingTime: post.readingTime } },
        { new: true, runValidators: true }
      );
      if (!updated) throw new Error(`Existing article disappeared during update: ${slugify(post.title)}`);
      console.log(`Updated ${updated.slug}: ${countWords(updated.content)} words, ${updated.readingTime} min`);
    }
    console.log(`Updated ${posts.length} existing articles; no articles were created.`);
  } finally {
    await mongoose.disconnect();
  }
}
