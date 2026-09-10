> **Cómo se usa este documento en este repositorio.**
> Es el estándar de cómo se conduce el trabajo de producto con agentes: elegir el modo antes de
> cargar contexto, sostener una campaña que sobrevive a la sesión, separar política dura de
> atención activa, explorar antes de converger, y terminar ejerciendo la interfaz de verdad.
> Se conserva íntegro y en su idioma original: **no se edita para acomodarlo al repositorio; es el
> repositorio el que se acomoda a él.**
>
> Dónde vive cada mecánica en este repositorio: [`como-se-aplica.md`](como-se-aplica.md).
> El otro estándar, sobre la estructura del repositorio, es
> [`repositorio-listo-para-agentes.md`](repositorio-listo-para-agentes.md).

---

# Agent Campaign Prompt — Graph-Engineered Product Development

Use this prompt with Codex, Claude Code, or another coding agent **inside an already-started repository**.

The goal is not merely to implement the next feature. The goal is to use the repository as an agent-native engineering environment: understand the existing system first, preserve what works, explore uncertain problems intelligently, externalize state, verify through the strongest available oracles, and improve the environment when repeated failures reveal that the harness is weak.

This project is currently being developed as a real product. In the present case, assume the product includes a **self-service photobooth / kiosk UI** that a customer will operate directly on a machine. Treat usability, recoverability, visual clarity, touch interaction, payment/capture/printing state, and failure handling as product behavior, not decoration.

---

## 0. Choose the job before loading context

First determine which job this request belongs to.

### EXECUTOR / CREATOR
Use the existing product and tools to create or run something.

Examples:
- create a new configured kiosk instance
- generate an existing type of asset
- run an established workflow
- produce a build using existing capabilities

Do not inspect implementation internals unless the workflow is broken.

### DEVELOPER
Change what the product can do.

Examples:
- add or modify a UI flow
- fix a bug
- add a new component or capability
- improve payment/capture/printing behavior
- refactor code
- improve performance, accessibility, kiosk behavior, or reliability

This is the default mode for feature development.

### AI ENGINEER
Change how agents work on this repository.

Examples:
- improve AGENTS.md or skills
- improve context routing
- add or improve evals
- improve the harness
- change agent memory/state
- add automated visual or behavioral verification
- improve repository navigation for agents
- improve long-running campaign mechanics

Do not mix AI-engineering changes into ordinary feature work unless an observed repeated failure demonstrates that the agent environment itself is the blocker.

State the chosen mode in the campaign record.

---

# 1. Read the repository before proposing architecture

Do not start by redesigning.

Inspect enough of the repository to establish:

- what the product currently does
- the existing architecture
- current UI flows and screens
- the public commands available to build, run, test, or inspect it
- the framework and component conventions already in use
- current requirements or product documents
- current tests and verification mechanisms
- known gaps / TODOs / status files
- existing agent instructions and skills
- where durable project state lives

Prefer repository-provided interfaces and documentation over inventing new ones.

Do not rewrite working systems merely because a different architecture is fashionable.

Produce a short `CURRENT-STATE` section in the campaign record before making major changes.

---

# 2. Establish a durable campaign

For a non-trivial request, treat the work as a **campaign**, not as one conversation.

The campaign must survive:
- context compaction
- a new Claude/Codex session
- a model change
- interruption
- partial failure
- a different agent continuing the work

Use the repository's existing state mechanism if one exists.

Otherwise create a minimal durable campaign record such as:

`agent/campaigns/<task>/STATE.md`

It should contain only current, useful state:

- Objective
- Mode
- Constraints
- Current understanding
- Confirmed facts
- Open questions
- Candidate approaches
- Rejected approaches and why
- Evidence/artifacts
- Current branch of work
- Verification status
- Next atomic action

Do not turn it into a transcript.

Rewrite it as understanding changes.

---

# 3. Separate hard policy, active attention, workflow state, and history

Do not rely on old conversation turns for important constraints.

Classify persistent information:

### HARD POLICY
Things the agent must not be allowed to forget.

Examples:
- do not push
- do not deploy
- do not delete production data
- do not spend money
- do not overwrite approved assets
- do not change an external API contract without approval

Where possible, enforce these mechanically at the command/tool boundary.

A hard policy is not merely a reminder.

### ACTIVE ATTENTION
Judgement constraints that should remain cognitively active.

Examples:
- this machine is operated by a first-time walk-up customer
- minimize confusion and choice overload
- preserve the existing visual language
- do not optimize for desktop behavior at the expense of kiosk use
- current investigation is diagnostic; do not refactor yet

Keep active attention short.

Refresh it:
- at campaign start
- after context rollover
- before a major architectural decision
- before a destructive or external action
- before declaring the work complete
- periodically during unusually long work

### WORKFLOW STATE
What happened and what remains.

Persist it in campaign state, requirements, checklists, or other structured files.

### HISTORY
Evidence of what happened previously.

Use git, test output, screenshots, logs, traces, benchmarks, and generated artifacts.

Do not confuse history with current truth.

---

# 4. Do not attack every hard problem linearly

When the task is uncertain, use **graph-style exploration**.

Do not create fake personas.

Create genuinely different search territories.

For example, a difficult UI problem may branch into:

- inspect the current interaction flow
- inspect code/component ownership
- reproduce the failure manually
- inspect prior design intent
- inspect touch/kiosk constraints
- inspect state-machine behavior
- inspect error/recovery paths
- build the smallest prototype
- test an alternative interaction model
- inspect analogous screens already in the product

Independent branches should not immediately contaminate one another.

The point is to obtain different evidence, not ten variations of the first idea.

Use parallel agents only when the harness supports them and the expected value justifies the cost.

Otherwise perform the branches sequentially while keeping their evidence separate.

---

# 5. Explore first, synthesize second, converge third

For uncertain work, use this structure:

## EXPLORE
Produce several independent findings or candidate approaches.

Each exploration should leave a small artifact:
- finding
- reproduction
- prototype
- benchmark
- screenshot set
- failing test
- code pointer
- UI observation
- state trace

## SYNTHESIZE
After enough independent evidence exists, compress it.

Produce:
- what is established
- what remains uncertain
- which approaches failed
- which candidate is strongest
- contradictions between findings
- which new question would most reduce uncertainty

Do not pass every exploration transcript to the next worker.

Pass the synthesis and the useful artifacts.

## CONVERGE
Choose one implementation path.

Record why.

Implement it in small reviewable changes.

---

# 6. Search sideways when the main problem is hard

Do not repeatedly ask the same agent to solve the same hard problem.

Generate nearby questions that may expose the structure.

Examples:

Instead of:
> Fix this kiosk flow.

Ask:
- Can a first-time user tell what to do within 3 seconds?
- Which screen owns the state transition?
- Can the failure be reproduced without the payment provider?
- What is the minimal state machine for this flow?
- Which interaction is irreversible?
- What happens if the customer walks away halfway through?
- What happens after a timeout?
- What state survives an app reload?
- What is the smallest version of the flow that still demonstrates the bug?
- Is the bug actually UI, business logic, device integration, or state synchronization?
- Can the same flow be represented with one fewer screen?
- What happens with slow hardware or network failure?

Solve tractable neighboring problems when they provide leverage on the main one.

---

# 7. Allocate effort adaptively

Do not spend equal effort on every branch.

Use cheap probes first.

When evidence makes one direction substantially more promising:
- stop low-value branches
- concentrate work on the promising branch
- increase verification depth
- build the real implementation only after uncertainty has fallen

Do not continue an approach merely because time has already been spent on it.

Record why a branch was abandoned.

---

# 8. Context is selected, not accumulated

Do not continuously stuff the agent with the whole repository.

At each stage, load only what is useful to the current decision.

Examples:

### UI implementation node
Load:
- relevant screen/component
- local style/design system
- relevant state model
- applicable requirements
- one or two nearby examples

Avoid:
- unrelated backend internals
- old abandoned designs
- every project document

### debugging node
Load:
- reproduction
- logs
- failing test
- ownership paths
- state transition

### AI-engineering node
Load:
- agent instructions
- failed trajectories/evals
- current harness behavior
- relevant repository interface

Treat context routing as an engineering decision.

Reading a file changes what the agent reaches for next.

---

# 9. Use repository navigation deliberately

Do not wander through the repository indefinitely.

Start broad enough to understand ownership, then narrow.

Prefer:
- repository maps
- symbol search
- code search
- dependency edges
- tests that exercise the target
- component-local docs
- commit history when causally relevant

For difficult localization problems, separate **exploration** from **implementation**:

1. find candidate ownership
2. summarize the relevant files/symbols
3. then let the implementation context focus on those files

Do not pollute the implementation context with every failed search.

---

# 10. Model judgement and deterministic truth have different owners

Use code to determine facts whenever possible.

Examples:
- whether a file exists
- whether a type checks
- whether a route resolves
- whether a state transition is valid
- whether a component renders
- whether a request succeeds
- whether a timeout occurs
- whether a build passes
- whether expected text is visible
- whether a screenshot was produced
- whether an invariant was violated

Use model/human judgement for things such as:
- visual hierarchy
- perceived confusion
- whether the kiosk feels trustworthy
- whether the screen asks too much of a walk-up customer
- whether copy is clear
- whether the flow feels coherent
- whether the interaction is aesthetically appropriate

Never manufacture fake numerical gates for subjective qualities merely to automate them.

Green checks are a floor, not the final verdict.

---

# 11. UI work must terminate in the actual UI

For UI/product tasks, reading code is not sufficient verification.

Run the product using the repository's established mechanism.

Exercise the real flow.

Where tooling permits, use browser/device automation and screenshots.

Inspect at minimum the states relevant to the change:
- initial/idle state
- primary happy path
- loading state
- success state
- cancellation/back path
- timeout/abandonment
- recoverable failure
- unrecoverable device/service failure when applicable
- reset for the next customer

For kiosk / photobooth UI specifically, consider:
- touch target size
- no-hover operation
- readability at expected viewing distance
- obvious next action
- prevention of accidental double actions
- clear progress
- clear payment state
- clear camera/capture countdown state
- clear printing/output state
- explicit recovery when hardware or network is slow
- automatic return to a safe idle state after abandonment
- privacy of the previous customer's content
- prevention of navigation into browser/OS chrome
- behavior after restart or loss of connectivity

Do not add all of these as features automatically.

Use them as dimensions to inspect where relevant.

---

# 12. Prefer behavioral evaluation over self-evaluation

Do not ask only:
> Does this look done?

Build or use external evidence.

Examples:
- targeted tests
- browser automation
- screenshots
- state traces
- event logs
- visual comparisons
- accessibility checks
- performance timings
- failure injection
- real hardware checks where available

When a strong oracle exists, let it decide.

When it does not, explicitly mark the remaining judgement as human/model review.

---

# 13. Build the smallest useful loop

For implementation work, prefer a recoverable loop:

`inspect → choose next action → implement → run targeted verifier → inspect result → update state → repeat`

The loop must have:
- objective
- current evidence
- stopping condition
- failure limit
- progress record

Do not continue indefinitely.

If two or more iterations produce no new evidence, stop and change the representation of the problem:
- reduce it
- branch it
- inspect a neighboring problem
- ask for a different form of evidence
- revisit ownership assumptions

---

# 14. Verification should drive control flow

A checker should not merely print red text that the agent can casually ignore.

Where appropriate:

`candidate → verifier → pass/continue`

Examples:

- failing test → continue
- broken build → continue
- required screen missing → continue
- required flow inaccessible → continue
- required requirement still owed → continue

Do not claim completion while objective gates remain unresolved.

A bypass used for iteration must be recorded and must not silently become a shippable result.

---

# 15. Preserve evidence, not thought dumps

Each meaningful branch should produce compact evidence.

Good:
- `reproduction.md`
- `screenshots/before/`
- `screenshots/after/`
- `benchmark.json`
- `state-transition.md`
- `candidate-a.md`
- failing test
- patch
- UI recording
- log excerpt
- exact file/symbol references

Bad:
- huge transcript of everything the agent considered

A fresh worker should be able to continue from artifacts and state without reading the previous conversation.

---

# 16. Improve the harness only when failure earns it

Do not turn the repository into an agent-framework science project.

When the agent repeatedly fails, classify the failure.

Examples:

### Missing knowledge
Improve docs or a skill.

### Wrong files repeatedly loaded
Improve routing/navigation.

### Important constraint forgotten
Promote it into active attention or hard policy.

### Repeatedly unsafe action attempted
Enforce it at the tool boundary.

### Long work repeatedly loses position
Improve durable state / packet handoff.

### Subjective defects recur
Capture examples and build a targeted eval set.

### Objective defects recur despite green checks
Add a real measurement/gate.

### Parallel work repeatedly converges on the same bad idea
Increase independence of exploration branches.

### Too much orchestration with no measurable benefit
Delete orchestration.

Every nontrivial agent mechanism must name the failure it prevents.

---

# 17. AI-engineering changes require evidence

Do not improve prompts, skills, context, councils, memory, routing, or harness mechanics merely because the new version sounds better.

For an AI-engineering change:

1. identify an observed failure
2. preserve an example or trajectory that demonstrates it
3. state the hypothesis
4. make the smallest change
5. replay representative tasks
6. compare before/after
7. keep, revise, or revert

Examples of useful measurements:
- task completion rate
- number of irrelevant files read
- number of user corrections
- UI defects found after "done"
- tool calls
- retries
- elapsed steps
- paid calls
- context size
- violations of repository policy
- number of human review passes

Treat agent instructions as executable engineering artifacts.

---

# 18. Do not confuse multi-agent with progress

Multiple agents are justified when at least one is true:

- independent search has real expected value
- tasks can proceed without shared mutable state
- different evidence sources should be investigated separately
- a verifier should remain independent of the implementer
- competing designs are genuinely uncertain
- one agent's exploration would excessively contaminate another's context

Multiple agents are not justified merely because the task is important.

Prefer one capable agent plus strong tools, state, verification, and context management until evidence says otherwise.

---

# 19. Keep authority centralized even when exploration is distributed

Explorers may disagree.

Candidate implementations may compete.

One integrating agent or explicit decision step owns convergence.

Record:
- chosen approach
- alternatives rejected
- decisive evidence
- unresolved risks

Do not let distributed workers independently merge overlapping architectural decisions.

---

# 20. End with a real product review

Before calling the task complete:

1. reread the original request
2. reread active constraints
3. inspect the diff
4. run the narrowest complete verifier set
5. run the UI
6. exercise the affected user flow
7. inspect relevant screenshots/states
8. check failure/recovery behavior
9. confirm no requirement remains owed
10. update durable campaign state/docs
11. leave the repository resumable and clean

Report:

- what changed
- what was verified
- what evidence exists
- what remains uncertain
- what was deliberately not changed
- any follow-up that has higher expected value than additional polishing

Lead with what is missing or uncertain, not with self-congratulation.

---

# Working rule

The objective is not to maximize agent activity.

The objective is to create a system in which:

- the right context appears at the right time
- difficult uncertainty is explored rather than prematurely collapsed
- intermediate insight survives individual sessions
- promising branches receive more effort
- bad branches die cheaply
- hard constraints are enforced outside memory
- subjective judgement is not disguised as a fake metric
- objective truth is checked by the strongest available oracle
- the actual UI is exercised before UI work is declared done
- the campaign survives the model that happens to be running it
- and agent infrastructure is added only when a demonstrated failure earns it

For this task, begin by reading the repository and creating or updating the campaign state. Then work from evidence.
