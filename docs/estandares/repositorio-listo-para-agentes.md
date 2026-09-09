> **Cómo se usa este documento en este repositorio.**
> Es el estándar que sigue `photo-station-platform` para poder ser operado por agentes de IA
> (Claude, Codex, Gemini, Kimi, OpenHands o el que venga). Se conserva íntegro y en su idioma
> original, tal como lo publicó su autor: **no se edita para acomodarlo al repositorio; es el
> repositorio el que se acomoda a él.**
>
> La medición de este repositorio contra sus veinticuatro guías vive en
> [`auditoria.md`](auditoria.md), y se vuelve a hacer cuando el estándar cambie.

---

# Make this repository AI-ready

*A living standard. Last reviewed 2026-09-09. Part 0 says how it grows; Parts 1–3 are the
standard; Part 4 is the evidence from repositories that already run this way; Part 5 is the
full reference list; Part 6 is what is still open.*

An AI-ready repository is one that an agent — Claude Code, Codex, Antigravity, Gemini CLI, Kimi,
OpenHands, any harness — can open cold and operate correctly: it finds what the repository is
for, which of its jobs it is being asked to do, what "done" means, and what it may not do; its
state survives the end of a session; its rules are enforced by code where they are facts and
written as know-how where they are judgement; and it keeps the record that lets the next
session, and the next model, do better than the last.

**How to use this as a prompt.** Paste it whole into an agent opened on the repository, followed
by one line: *"Work in construction mode. Read the repository first, write down what it already
has against every guideline in Parts 1–3, then implement what is missing in small reviewable
commits, each with the test that proves it. Do not rewrite what already works. Report N/M at the
end, what you left out first."*

---

## Part 0 — How this document evolves

This document is not a snapshot. It is maintained the way an AI-ready repository maintains its
own docs (Guideline 8): rewritten in place, stating the present, with a reference list that
grows and a watch list that is re-read every term.

**A guideline is added when four things exist.** (1) A principle stated in one sentence.
(2) A source: a course lecture, a paper, an engineering post, or a measured result. (3) A
mechanic: a concrete implementation that exists in at least one repository we run, named by
file. (4) A check: how a repository is measured against it. A guideline with a principle and a
source but no mechanic goes into Part 6 (open) until one exists.

**A reference is added the day it is read**, with venue and year, and a URL only when verified.
Never a URL from memory: a wrong link is worse than a title.

**The watch list, re-read each term (September, January, April):**

| Source | What to look for |
| --- | --- |
| Stanford CS 329Z *Engineering AI Agents* — https://cs329z.stanford.edu | the reading list under Logistics; it is a curated bibliography of the field, refreshed each offering |
| Stanford CS146S *The Modern Software Developer* — https://themodernsoftware.dev | the week list; 85% of the content was replaced between the Fall 2025 and Fall 2026 offerings, so it tracks practice, not theory |
| Stanford CS329A *Self-Improving AI Agents* — https://cs329a.stanford.edu | the research edge: agents that learn from their own traces |
| CMU 11-768 *AI Agents* (Neubig, Fried) — https://www.cmu-agents.com/#/schedule | per-lecture readings and references; the harness, eval and training assignments |
| CMU 17-445/645 *Machine Learning in Production / AI Engineering* — https://mlip-cmu.github.io | the production-engineering side: monitoring, data quality, responsible deployment |
| Berkeley *LLM Agents* MOOC (Song et al.) — https://llmagents-learning.org | guest lectures from the labs building the frameworks |
| Anthropic Engineering — https://www.anthropic.com/engineering | harnesses, context engineering, evals, Claude Code practice |
| OpenAI research and engineering posts | prompt injection, Codex practice |
| OpenHands blog and docs — https://docs.all-hands.dev | skills, single-agent arguments, SWE-bench practice |
| The AGENTS.md convention — https://agents.md | which tools read which files |
| Model Context Protocol — https://modelcontextprotocol.io/specification | the tool-surface standard |
| arXiv cs.AI / cs.SE, weekly | anything cited by two of the above |

**When a source changes a guideline**, the guideline is rewritten, its source line updated, and
the mechanic re-checked against the repositories in Part 4. When a mechanic is superseded, the
old one is deleted from this document, not kept as history.

---

## Part 1 — Orientation: what an agent finds when it opens the repository

### 1. One entry file, one router

`AGENTS.md` at the root is the entry point every tool reads: Codex, Antigravity (1.20.5+) and
Kimi Code read it natively; `CLAUDE.md` and `GEMINI.md` are one-line pointers to it. It opens by
asking which job this session is — using the product, or changing the repository — and gives
each job its own short reading list. It is a router, not an encyclopaedia: under 12,000
characters (Antigravity's rules cap), with the craft in `docs/` read on demand.

*Mechanic:* storytelling `AGENTS.md` ("Two modes. Decide which one you are in before anything
else"); vlogstudio `AGENTS.md` ("First: which of the two jobs is this?" with a table of what
the human says in each); chesspov `CLAUDE.md` ("Opening cold? Your FIRST reply ORIENTS them").
*Check:* an agent given only "make one" or "fix X" lands in the right mode without asking.
*Sources:* [agents.md]; [ANTH-CC]; [ANTH-CTX]; [CS146S] weeks 3–4.

### 2. Two contexts, deliberately small

The product job and the repository job need different files, and each must not read the
other's. A session making a film does not read the refactor ledger; a session refactoring does
not open a film's footage. Reading is priming: what an agent has just read is what it reaches
for, and judgement drifts long before anything visibly breaks.

*Mechanic:* vlogstudio `AGENTS.md` "If you are making a film, stay out of the machinery" —
names the directories not to open and the two costs (context, priming); storytelling's
`docs/` split between how-to (product) and ARCHITECTURE/BACKLOG (repository).
*Check:* each mode's reading list fits in a fraction of the context window; no file appears in
both lists. *Sources:* [ANTH-CTX]; [CS146S] week 3 (context rot and poisoning); [CMU] lecture 3.

### 3. The aim is written, and it outranks convenience

One page says why the repository exists, who it is for, and what a technically perfect output
that betrays the aim would be. Every doc that disagrees with it loses.

*Mechanic:* storytelling `docs/AIM.md`; chesspov `docs/AIM.md` ("where any doc disagrees, this
wins"); vlogstudio "What we are making (before any of the below)".
*Check:* the aim names at least one failure that passes every test. *Sources:* [CS146S] specs as
the new source code; [ANTH-BEA].

### 4. The requirements ledger: what was asked and not yet given

A single file records each request the owner made, one row per clause, with evidence when it
closes and a row that leaves when it is done. Status files say what happened; this says what is
owed. A multi-clause message is the shape that leaks.

*Mechanic:* vlog `REQUIREMENTS.md` + `scripts/check_requirements.py --owed`; storytelling
`Story.brief` (the request verbatim, kept beside the artefact).
*Check:* `--owed` prints an empty list before "done" is claimed. *Sources:* [ANTH-HARNESS]
(feature lists and progress files); [OSMANI].

---

## Part 2 — Mechanics: how the repository works under an agent

### 5. Compound system: deterministic core, judgement in documents

Split the repository into an engine (same input, same output; no model call decides anything;
testable) and the know-how an agent reads before deciding. Do not build an LLM control room —
planners, graders, expert chains, workflow workers — where a checklist and a person would do.
Start with the simplest workflow and add autonomy only where it is measured to pay.

*Mechanic:* vlogstudio decision D13 — the five LLM experts, the plan-grader and the workflow
worker were deleted because "they spent hours and returned bad films"; what survives is
`agentic/craft/`, `agentic/styles/`, four schemas, and no runtime. chesspov: "Python computes
FACTS, the LLM authors the STORY, the director DECIDES, the renderer EXECUTES."
*Check:* grep the engine for model calls; each one is a provider behind an interface, never a
decision. *Sources:* [BAIR]; [ANTH-BEA]; [CEMRI]; [NEUBIG]; [CS329Z] week 4.

### 6. The agent-computer interface is a CLI, and every capability is discoverable

Expose the product to the agent as a small set of verbs with typed, terse, semantic output —
never a GUI, never raw source to read. Every capability is registered in one catalog the CLI
prints; a capability that is not listed does not exist for an agent arriving cold, and shipping
one without registering it is an incomplete change. Tool descriptions are performance levers:
curate, namespace, return what the next decision needs. Wrap the verbs as an MCP server when
other harnesses need typed access.

*Mechanic:* storytelling `tools/studio.py` verbs and `engine/catalog.py` printed by
`studio effects`; vlogstudio `./studio` verbs and `python3 -m effects.menu` ("it reads the
catalog, so it cannot offer you something that does not work", searchable in either language).
*Check:* every effect, provider and verb appears in the printed catalog; the catalog is
generated from code, never typed. *Sources:* [SWE-AGENT]; [CODEACT]; [TOOLFORMER]; [MCP]; [CMU]
lectures 1–2; [CS146S] week 3.

### 7. The human and the agent never share a tool

The human has a cockpit (a UI, a phone, a comment on a clip); the agent has the CLI and the
files. They meet only in the state on disk. The agent never clicks the UI and never starts the
server; the human never edits JSON by hand.

*Mechanic:* vlogstudio `HOW-IT-WORKS.md` §1 "Three actors, one state"; `tools/review.py`
gathers the human's comments for the agent's next turn.
*Check:* the UI code is on the product-mode "ignore" list. *Sources:* [CS329Z] week 11 (mixed
initiative); [CMU] Interaction 2, human-agent interaction.

### 8. State lives on disk, never in the session

Every step ends in a record a tool wrote with evidence (the paths it produced), or a person
wrote with a path they looked at — and a note naming no file is refused. Tools that depend on a
step refuse while its record is missing. A fresh session resumes by reading files: the checklist,
the git history, a progress file. Nothing that matters is only in a conversation or a screen.

*Mechanic:* storytelling `engine/checklist.py` — `tick_tool(item, evidence)`, `tick_look(item,
note, project_dir)` refuses a note naming no existing file, `render`/`publish` refuse missing
ticks; vlogstudio `REFACTOR-STATUS.md` "▶ Current position" block with the next atomic action;
vlog `HANDOFF.md` ("delete it only when every box is ticked").
*Check:* kill the session mid-procedure; a new one resumes from files alone. *Sources:*
[ANTH-HARNESS]; [MEMGPT]; [AWM]; [CMU] lecture 4; [CS329Z] week 4.

### 9. Every version of the authored artefact is kept

A rewrite is a diff, not a memory. Re-registering an artefact keeps the previous version and
prints what changed at the level that matters (which scenes' words). Tool-written fields are
excluded from the hash so generation is not mistaken for authorship.

*Mechanic:* storytelling `engine/history.py` — `history/<n>.<time>.<digest>.json`, `studio
history` lists the chain with words changed per step; vlogstudio: git's object model inside
SQLite (`history_blob/tree/commit`), blob per top-level field, autosaves coalesce, named
checkpoints never do, restore writes forward ("never a reset").
*Check:* the procedure's "rewritten twice" step is provable from the history alone.
*Sources:* [ANTH-HARNESS]; [SHANKAR].

### 10. Gates measure facts; prose carries judgement

A rule that is only prose will not be followed. If a rule is a fact — a file exists, a citation
resolves to a text on disk, a length fits, a field is written — it is a check in code that
refuses. If it is judgement — does this sound right, is this the same person — it is written as
guidance the agent reads before deciding, and a person looks. Green is a floor, never a verdict.
When output is wrong and every check is green, a dimension is not being measured: add the
measurement, not a longer paragraph. A craft judgement compiled into a gate accumulates into a
checklist that makes any output impossible to finish.

*Mechanic:* storytelling `engine/story_lint.py` (seven facts, pure, plus one I/O companion),
`engine/compose_budget.py` (five channels as arithmetic), `engine/verify_clip.py` (numbers
only, each traceable to a threshold), `engine/render/inspect_elements.py` ("never scores one");
vlogstudio "A refusal is legitimate only when it names something the renderer physically cannot
build"; chesspov `verify_narration` — every spoken chess fact checked against the engine,
0 violations, with the drama left to craft.
*Check:* list the gates; each names the field it reads and the number it compares.
*Sources:* [ANTH-EVALS]; [ZHU]; [CS329Z] weeks 7–8; [CMU] assignment 2; [OSMANI].

### 11. A bypassed gate is recorded, and a bypassed result does not ship

Flags that render anyway exist for iteration. Each use is written onto the record with the gates
it turned off, printed by status, and refused by the publishing step until the artefact is made
with every gate on. A fresh output forgets the verification of the previous one.

*Mechanic:* storytelling `rendered:<fmt>/<locale>` tick with `bypassed=[...]`,
`checklist.RESET_BY_RENDER`, `studio publish` problem "rendered with gates off".
*Check:* `--allow-*` leaves a trace a later step reads. *Sources:* [OSMANI] (approval gates and
failure limits); [ANTH-EVALS].

### 12. Ground truth where the domain has one

Where a fact can be checked against an oracle — a chess engine, a compiler, a source text on
disk, a licence field — the agent's output is checked against it before it is allowed to
become prose, and the creative work is spent above that floor.

*Mechanic:* chesspov: `game_state.json` and `analysis.json` (python-chess, Stockfish, Maia, Lc0)
are the only source of any move, square or verdict; a council debates every claim "against the
real board until it can't be broken". storytelling: `Scene.sources` + `Story.source_texts`
resolving to files under `notes/sources/`; `is_safe_license` on every stock image.
*Check:* name the oracle for each class of fact; the classes with none are listed in the
known-gaps file. *Sources:* [CS329Z] week 7 (execution-grounded evaluation); [CMU] Domains 1
(coding agents, where the compiler is the oracle).

### 13. Provenance and idempotence for everything paid

Every generated or fetched artefact carries a sidecar with the fingerprint of what made it: the
full prompt, the parameters, the provider, the bytes of every input it depended on. Reuse is
keyed on that fingerprint, never on a file name. A changed input regenerates; an unchanged one is
never bought twice; nothing paid is deleted, it is retired to a `replaced/` folder. Every call to a
paid provider lands in a ledger with why it ran, so cost and regeneration are answerable.

*Mechanic:* storytelling `engine/provenance.py` (`.made.json` sidecars, states missing / current /
unknown / stale, `retire`, `ledger.jsonl`, `summary` in `studio status`), `engine/assets/once.py`
(the one path every image call takes); chesspov `run_pipeline.py` "stages individually
skippable/cacheable"; vlogstudio takes cached by content hash (`take_id`).
*Check:* run the generation step twice; the ledger shows one call. Edit one character of a
prompt; it shows a regeneration with the reason. *Sources:* [SHANKAR]; [CS329Z] week 6; [CMU]
Safety 2 (observability).

### 14. Model makes, code schedules

When a generative model is in the loop, let it produce the real thing and let the code decide
only when and where it is shown. Never simulate in code what the model can make: a fake brush
stroke, a pasted cutout, a synthesised fact. The output is then exactly what the model composed,
and every downstream property — perspective, scale, light, contact — is right by construction.

*Mechanic:* storytelling "a painting that assembles itself": every figure painted into the full
plate and peeled out (`Layer.peeled`, `engine/assets/peel.py`), never a cutout placed by eye;
the code only reveals. *Check:* frame 0 of a scene reproduces the full plate. *Sources:* our own
measured result (peeled scenes hold perspective and contact shadows; pasted ones do not);
[CS329Z] week 1 (compound systems: choose the component that owns the property).

### 15. Isolation, permissions and secrets

Content and generated output live inside the checkout in gitignored folders, beside the code —
never in a hidden home directory. Parallel agents each get their own git worktree with its own
output folders; credentials resolve from one place and are never copied; an agent never pushes,
never checks out a branch, never writes outside its own checkout. Text that arrives from outside
— web pages, source documents, model output, screenshots — is data, not instruction.

*Mechanic:* storytelling `engine/store/paths.py` (`projects/`, `experiments/`, `data/`,
`vision-venv/` in the checkout; `main_checkout()` for worktrees), `engine/secrets.py` (one
resolver, prints length and origin, never a value; reads sibling studios read-only); vlogstudio
`tools/secrets.py` ("a capability you did not probe is not a capability you lack"; the walk-up
that failed for months and the git-based fix); chesspov `LIKENESS_RISK.md` tiers (GREEN/YELLOW
only, AI disclosed, never living people).
*Check:* four agents on the same task write to four folders and one clean `git status`.
*Sources:* [CMU] Safety 1, sandboxing and credential management; [OPENAI-PI]; [CS329Z] week 8;
[CS146S] week 6; [ANTH-CC] permission modes.

### 16. Deliberation where a single agent is not enough, with a chair who owns the verdict

When a decision is worth more than one opinion, convene seats that are independent (none sees
another's answer), one of which argues to keep, one of which is kept naive (handed the artefact
with no explanation, like the audience), and a chair who reaches one verdict and records the
dissent. The executing agent owns the result; the council exists so it is not deciding alone.

*Mechanic:* vlog `councils/*.json` and `convene(council, {decision, artefact, context,
directives})`; chesspov `NARRATIVE_COUNCIL_PROMPT.md` (writers → ChessDeliberation →
ground-gate). *Check:* a council's output names the dissent. *Sources:* [CEMRI] (why
multi-agent systems fail: roles without accountability); [AUTOGEN]; [CMU] Interaction 1.

### 17. Long work is a sequence of recoverable packets

A request to work for hours is not one conversation. End a packet after one reviewable outcome
or thirty minutes; write the state; stop at a review gate for the owner instead of pushing past
it. Design the loop that prompts the agent rather than prompting it step by step: a spec, real
signals to check against, a stopping criterion, a failure limit, a record.

*Mechanic:* vlog "Long-running Copilot work: mandatory rollover"; vlogstudio resume protocol
(read onboarding → REFACTOR.md §0–3 → STATUS ▶ block → do the next atomic action → update →
commit → stop at ⛔); storytelling's DEADLINE file pattern (start time, deadline, time beside
every step). *Check:* a packet ends with state on disk a stranger can resume. *Sources:*
[ANTH-HARNESS]; [OSMANI]; [CS146S] loop engineering; [REACT].

### 18. Flag, never block, for what the machine cannot judge

Where a detector is available but not calibrated — a face in a layer meant to be scenery, an
image-similarity distance to a reference — report the reading, rank the outliers against the
project's own median, and say when the detector did not run. A check that could not run reports
"unavailable", never green.

*Mechanic:* storytelling `inspect_elements.identity_notes` (relative to the median, needs three
readings), `ElementsReport.vision_ran` ("NOT checked"), `verify_clip.elements_without_people`
(unavailable reads as a failed check with the fix sentence). *Check:* disable the detector; the
report says so. *Sources:* [ANTH-EVALS]; [VALIDATORS].

---

## Part 3 — Growth: how the repository gets better than it was

### 19. Documentation states the present

Docs are read by someone deciding what to do next, not by a historian. No "used to", no
changelog narrative inside a capability's description, no superseded path cited as context,
no DONE entries. When something changes, rewrite the section in place. A known-gaps file lists
what is missing and deletes the entry when it closes ("an entry kept as done is the same stale
documentation as an entry never written"). A component's docs live beside the component; the
top level carries only the model.

*Mechanic:* storytelling `AGENTS.md` "Documentation states the current state, not how it got
there"; `docs/BACKLOG.md` header; vlogstudio "Where documents go: beside the thing".
*Check:* grep the docs for "used to", "no longer", "until now", "previously". *Sources:*
[CS146S] week 3; [agents.md].

### 20. Tests are hermetic and cover the deterministic pieces; agent-written code is reviewed

Fast, no network, no credentials, one test per piece of pure logic; craft judgement is never
gated by a test. In product mode, no tests run at all: the receipt for the product is the
product. Agent-written code is reviewed before it merges — it has its own smell and its own
blind spots — with static analysis on the engine.

*Mechanic:* storytelling `./.venv/bin/python -m pytest -q` (334 tests, ~30 s, hermetic);
vlogstudio "Making a film runs zero tests"; "never the whole suite with no path" in
construction mode. *Check:* the suite passes with the network cable out. *Sources:* [CS146S]
weeks 6–7; [SWEBENCH]; [SWESMITH].

### 21. Feedback on the product goes into the engine, never into the shipped product

When the owner finds a defect by watching the product, the fix is a better default in the code
and a check that fails, plus a shorter document — not a patch to that one project and not a
longer rule. Shipped projects are finished; the gates are for the next one.

*Mechanic:* storytelling: six findings from watching the 2026-09-09 render closed as engine
commits; "no image-content unit tests; measure on the real plates". *Check:* each product
finding maps to an engine commit and a check. *Sources:* [SHANKAR] (the flywheel turns on
rejected outputs); [AUTOLIBRA].

### 22. A data flywheel from the human's own judgement

Keep traces of what each session did, and keep the human's rejections as data: notes on what was
looked at and why it failed, versions before and after a rewrite, the ledger of what was
regenerated. From those, build a small targeted eval set and, where a judge is needed, align it
to the human's labels before trusting it. Treat hand-tuned instruction prose as a program to be
optimised against that set, not re-edited by feel.

*Mechanic (partial):* storytelling `history/`, `ledger.jsonl`, look-tick notes, `verify.json` and
`audit.json` per cut — the raw material exists; no eval set or optimiser runs on it yet (Part 6).
*Check:* the fifth project costs fewer human listening passes than the first, and the number is
on disk. *Sources:* [VALIDATORS]; [AUTOLIBRA]; [DSPY]; [GEPA]; [MIPRO]; [CS329Z] weeks 5–7;
[CS329A].

### 23. Skills and memory as files the agent reads, not weights it hopes for

Reusable know-how — how to do a task in this repository — is a document with a name, a trigger
and a procedure, discoverable like a capability. Memory is structured state the agent queries,
not a transcript it scrolls.

*Mechanic:* storytelling `docs/HOW-TO-*.md` per craft with a "when to reach for it" line; the
harness's own memory directory with one fact per file and an index. *Check:* a new task type
has a document before it has a second instance. *Sources:* [CMU] lecture 4 (skills, AWM, ASI,
ReasoningBank); [OPENHANDS-SKILLS]; [MEMGPT]; [MEM0].

### 24. Original per project, no formula

An engine that produces the same shape every time has stopped being a tool and become a
template. The structure of each output is decided from its own material; reusing the recipe is
fine, reusing the lines or the assets is not.

*Mechanic:* chesspov "a distinct world every time — reuse the recipe, never the lines or the
assets; `check_distinct` passes"; storytelling "never reuse a previous project's cold-open
mechanics or title pattern". *Check:* a distinctness check between the new output and every
shipped one. *Sources:* our own audience measurements; [CS329Z] week 11 (proactive agents adapt
to the user, not the reverse).

---

## Part 4 — The repositories this standard was measured on

| Repository | What it makes | Mechanics it contributes |
| --- | --- | --- |
| **storytelling** | bilingual narrated films on saints' lives; painterly plates, peeled elements, multiplane camera | two-mode router; checklist with evidence; seven-fact lint; five-channel budget; verify by measurement; provenance sidecars and ledger; history per registration; gate-bypass record; anchors built from a declaration; Vision flags; projects inside the checkout; worktree-aware secrets |
| **chesspov** | cinematic chess reels from the loser's seat, every fact engine-verified, a Blender world per game | ground-truth oracle (engine facts → narration gate); council of writers with a ground gate; pipeline DAG with cacheable stages; likeness-risk tiers; distinctness check; the AIM that outranks every doc |
| **vlogstudio** (refactor of **vlog**) | the studio behind a Spanish-language personal vlog channel; state on disk, human cockpit, agent turns, deterministic render | D13 (delete the LLM control room); three actors, one state; git-object history in SQLite; requirements ledger (`--owed`); councils with a naive seat and a keep seat; rollover packets; "a capability you did not probe is not a capability you lack"; zero tests in product mode |

Each mechanic above is named by file in Parts 1–3. A mechanic that exists in one repository and
not the others is a gap in the others, listed in their known-gaps files.

---

## Part 5 — References

Grouped by where they were read. A URL appears only when verified; a title without one is found
from the course page that assigns it.

### Courses (the watch list, with what each assigns)

**[CS329Z]** Yang, Ryan & Yang, *CS 329Z: Engineering AI Agents*, Stanford, Fall 2026 —
https://cs329z.stanford.edu. Three engineering challenges: decomposition, data, evaluation.
Homework: build an agentic system (RAG + tools + agent loop, then in DSPy); evaluate an agent
(code graders, LLM-as-judge, the 4-tuple benchmark). Quarter project: agents that make life at
Stanford better. Required readings, in course order:

1. Zaharia et al., *The Shift from Models to Compound AI Systems*, BAIR Blog (2024) —
   https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/
2. Schluntz & Zhang, *Building Effective Agents*, Anthropic (2024) —
   https://www.anthropic.com/engineering/building-effective-agents
3. Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*, NeurIPS 2020 —
   https://arxiv.org/abs/2005.11401
4. *Model Context Protocol Specification*, Linux Foundation (2025) —
   https://modelcontextprotocol.io/specification
5. Khattab et al., *DSPy: Compiling Declarative Language Model Calls into Self-Improving
   Pipelines*, ICLR 2024 — https://arxiv.org/abs/2310.03714
6. Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models*, ICLR 2023 —
   https://arxiv.org/abs/2210.03629
7. Packer et al., *MemGPT: Towards LLMs as Operating Systems* (2023) —
   https://arxiv.org/abs/2310.08560
8. Wu et al., *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation*, COLM
   2024 — https://arxiv.org/abs/2308.08155
9. Snell et al., *Scaling LLM Test-Time Compute Optimally Can Be More Effective than Scaling
   Model Parameters*, ICLR 2025 — https://arxiv.org/abs/2408.03314
10. Agrawal et al., *GEPA: Reflective Prompt Evolution Can Outperform RL* (2025/2026) —
    https://arxiv.org/abs/2507.19457
11. Shankar, *Data Flywheels for LLM Applications* (2024)
12. Yang et al., *SWE-smith: Scaling Data for Software Engineering Agents*, NeurIPS D&B 2025
13. Shankar et al., *Who Validates the Validators? Aligning LLM-Assisted Evaluation with Human
    Preferences*, UIST 2024 — https://arxiv.org/abs/2404.12272
14. Zhu et al., *Establishing Best Practices for Building Rigorous Agentic Benchmarks* (2025)
15. Grace et al., *Demystifying Evals for AI Agents*, Anthropic (2026)
16. Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*, NeurIPS 2023 —
    https://arxiv.org/abs/2306.05685
17. Ryan et al., *AutoMetrics: Approximate Human Judgements with Automatically Generated
    Evaluators*, ICLR 2026
18. Shao et al., *PrivacyLens: Evaluating Privacy Norm Awareness of LMs in Action*, NeurIPS D&B
    2024
19. Zhang & Yang, *Searching for Privacy Risks in LLM Agents via Simulation* (2025)
20. Li, *Agentic LLMs as Powerful Deanonymizers* (2026)
21. Yang et al., *SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering*,
    NeurIPS 2024 — https://arxiv.org/abs/2405.15793
22. Wang et al., *OpenHands: An Open Platform for AI Software Developers as Generalist Agents*,
    ICLR 2025 — https://arxiv.org/abs/2407.16741
23. Shaikh et al., *Creating General User Models from Computer Use*, UIST 2025

Supplementary readings:

24. Ng, *Agentic Design Patterns Part 1: Four AI Agent Strategies*, The Batch (2024)
25. Si et al., *Towards Execution-Grounded Automated AI Research* (2026)
26. Rajasekaran et al., *Effective Context Engineering for AI Agents*, Anthropic (2025) —
    https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
27. Khattab & Zaharia, *ColBERT: Efficient and Effective Passage Search via Late Interaction over
    BERT*, SIGIR 2020 — https://arxiv.org/abs/2004.12832
28. Letta, *Agent Memory: How to Build Agents that Learn and Remember* (2025)
29. Chhikara et al., *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory*
    (2025) — https://arxiv.org/abs/2504.19413
30. Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*, UIST 2023 —
    https://arxiv.org/abs/2304.03442
31. Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* (2025) — https://arxiv.org/abs/2503.13657
32. Neubig, *Don't Sleep on Single-agent Systems*, OpenHands blog (2024)
33. Liu et al., *A Dynamic LLM-Powered Agent Network for Task-Oriented Agent Collaboration*, COLM
    2024 — https://arxiv.org/abs/2310.02170
34. Soylu et al., *Fine-Tuning and Prompt Optimization: Two Great Steps that Work Better Together*,
    EMNLP 2024 — https://arxiv.org/abs/2407.10930
35. Opsahl-Ong et al., *Optimizing Instructions and Demonstrations for Multi-Stage Language Model
    Programs* (MIPRO), 2024 — https://arxiv.org/abs/2406.11695
36. Tan et al., *Large Language Models for Data Annotation and Synthesis: A Survey*, EMNLP 2024 —
    https://arxiv.org/abs/2402.13446
37. Zhou et al., *LIMA: Less Is More for Alignment*, NeurIPS 2023 — https://arxiv.org/abs/2305.11206
38. Press, *How to Build Good Language Modeling Benchmarks* (2024)
39. Polo et al., *tinyBenchmarks: Evaluating LLMs with Fewer Examples*, ICML 2024 —
    https://arxiv.org/abs/2402.14992
40. Zhu et al., *AutoLibra: Agent Metric Induction from Open-Ended Human Feedback*, ICLR 2026 —
    https://arxiv.org/abs/2505.02820
41. Wen et al., *Contextualized Privacy Defense for LLM Agents* (2026)
42. OpenAI, *Understanding Prompt Injections: A Frontier Security Challenge* (2025)
43. Anthropic, *Responsible Scaling Policy* (2023)
44. Anthropic, *Claude Code: Best Practices for Agentic Coding* (2025) —
    https://www.anthropic.com/engineering/claude-code-best-practices
45. Young, *Effective Harnesses for Long-Running Agents*, Anthropic (2025) —
    https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
46. Jimenez et al., *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?*, ICLR 2024 —
    https://arxiv.org/abs/2310.06770
47. Shaikh et al., *Learning Next Action Predictors from Human-Computer Interaction* (2026)
48. Steinberger, *OpenClaw: Open-source proactive AI agent* (2025)
49. Xie et al., *OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer
    Environments*, NeurIPS D&B 2024 — https://arxiv.org/abs/2404.07972
50. Yao et al., *WebShop: Towards Scalable Real-World Web Interaction with Grounded Language
    Agents*, NeurIPS 2022 — https://arxiv.org/abs/2207.01206

**[CS146S]** Eric, *CS146S: The Modern Software Developer*, Stanford, Fall 2026 —
https://themodernsoftware.dev; assignments
https://github.com/mihail911/modern-software-dev-assignments; Fall 2025 offering
https://themodernsoftware.dev/fall2025. Thesis: software development moved from manual coding to
collaboration with coding agents, which demands new ways to specify intent, organise work and
coordinate tools. Weeks: LLM foundations and a prompting playground; agent architecture and an
MCP server from scratch; context engineering — four failure modes, five tool-design principles
(curation over dumping, namespacing, semantic return values, token efficiency, descriptions as
performance levers), "specs are the new source code"; agent autonomy patterns, from code-writer
to agent-manager; AI-enhanced terminals; security and testing — CVEs in generated code, prompt
injection, OWASP; reviewing AI-generated code; rapid application building; post-deployment
operations and on-call agents; loop engineering and software-factory principles. Tools: Claude
Code, Codex, Semgrep, Warp, Graphite, Vercel v0, OpenHands, CopilotKit.

**[CMU]** Neubig & Fried, *11-768 AI Agents*, Carnegie Mellon University, Fall 2026 —
https://www.cmu-agents.com/#/schedule. Goal: build a harness, build evals, train an agentic LLM
with RL. Assignments: 1 Harness; 2 Eval; 3 Training; final research project with poster
presentations. Lectures and their readings:

- *Course Overview: What Is an Agent?* — Toolformer; ReAct; Mini-SWE-Agent
  (https://github.com/SWE-agent/mini-swe-agent)
- *Tool Use* — Wang et al., *What Are Tools Anyway? A Survey from the Language Model Perspective*
  (2024) — https://arxiv.org/abs/2403.15452; CodeAct — https://arxiv.org/abs/2402.01030;
  Toolformer — https://arxiv.org/abs/2302.04761; XGrammar — https://arxiv.org/abs/2411.15100;
  references: OpenAI Chat Completions API, Hugging Face chat templates, the Berkeley
  Function-Calling Leaderboard V4 — https://gorilla.cs.berkeley.edu/leaderboard.html
- *Context Management for Long-Context Agents* — references: DistServe —
  https://arxiv.org/abs/2401.09670; Needle in a Haystack; *Attention Is All You Need* —
  https://arxiv.org/abs/1706.03762; Longformer — https://arxiv.org/abs/2004.05150; *Transformers
  are RNNs* — https://arxiv.org/abs/2006.16236
- *Skills and Memory* — OpenHands, *How to Create Effective Agent Skills* [OPENHANDS-SKILLS];
  SkillsBench; MemGPT; *Agent Workflow Memory* — https://arxiv.org/abs/2409.07429; *Agent Skill
  Induction*; ReasoningBank; references: Mem0; Reflexion — https://arxiv.org/abs/2303.11366;
  ExpeL — https://arxiv.org/abs/2308.10144; Agent S — https://arxiv.org/abs/2410.08164; Synapse —
  https://arxiv.org/abs/2306.07863
- *Planning, Task Decomposition, and Multi-Agent Coordination* — Cursor, *Introducing Plan
  Mode*; Least-to-Most Prompting — https://arxiv.org/abs/2205.10625; Decomposed Prompting —
  https://arxiv.org/abs/2210.02406; Code as Policies — https://arxiv.org/abs/2209.07753; SayCan —
  https://arxiv.org/abs/2204.01691; Plan-and-Act — https://arxiv.org/abs/2503.09572; *Thinking
  vs. Doing*; *Calibrate-Then-Act*; *Recursive Agent Optimization*; *Multi-Agent Computer Use*;
  references: Claude Code permission modes; OpenAI model guidance; *Large Language Models are
  Zero-Shot Reasoners* — https://arxiv.org/abs/2205.11916; Plan-and-Solve —
  https://arxiv.org/abs/2305.04091; STaR — https://arxiv.org/abs/2203.14465
- *Domains*: coding agents; GUI agents (Koh); deep research agents (Asai)
- *Training*: SFT (Song); RL basics; advanced RL; RL systems (Gandhi)
- *Safety*: sandboxing and credential management; observability and monitoring (Wallace)
- *Frameworks*: OpenHands; LangGraph
- *Interaction*: agents and the future of work (Wang); multi-agent interaction (Vaduguru);
  human-agent interaction (Chen)
- *Search and inference*: reranking and critic models; tree search (Koh)
- Guest lectures: Narasimhan; Rush

**[CS329A]** *Self-Improving AI Agents*, Stanford — https://cs329a.stanford.edu

**[MLIP]** *Machine Learning in Production / AI Engineering*, CMU — https://mlip-cmu.github.io

**[BERKELEY]** *LLM Agents* MOOC, Berkeley RDI — https://llmagents-learning.org

### Engineering practice

- **[agents.md]** The AGENTS.md convention — https://agents.md
- **[ANTH-BEA]** Schluntz & Zhang, *Building Effective Agents* (see CS329Z #2)
- **[ANTH-CTX]** *Effective Context Engineering for AI Agents* (see #26)
- **[ANTH-HARNESS]** *Effective Harnesses for Long-Running Agents* (see #45)
- **[ANTH-CC]** *Claude Code: Best Practices for Agentic Coding* (see #44)
- **[ANTH-EVALS]** *Demystifying Evals for AI Agents* (see #15)
- **[OPENHANDS-SKILLS]** OpenHands, *How to Create Effective Agent Skills* — https://docs.all-hands.dev
- **[OPENAI-PI]** OpenAI, *Understanding Prompt Injections* (see #42)
- **[OSMANI]** Osmani, *Loop Engineering* (2026) — https://addyosmani.com/blog/loop-engineering/
- **[MCP]** Model Context Protocol Specification (see #4)

### Papers cited by guideline key

[AUTOGEN] #8 · [AUTOLIBRA] #40 · [AWM] CMU lecture 4 · [BAIR] #1 · [CEMRI] #31 · [CODEACT] CMU
lecture 2 · [DSPY] #5 · [GEPA] #10 · [MEM0] #29 · [MEMGPT] #7 · [MIPRO] #35 · [NEUBIG] #32 ·
[REACT] #6 · [SHANKAR] #11 · [SWE-AGENT] #21 · [SWEBENCH] #46 · [SWESMITH] #12 · [TOOLFORMER] CMU
lecture 1 · [VALIDATORS] #13 · [ZHU] #14

---

## Part 6 — Open: principles with a source and no mechanic yet

These have evidence in the literature and no implementation in our repositories. Each becomes a
guideline the day one exists.

- **A targeted eval set per repository, built from the owner's rejections**, and a judge aligned
  to it before it is trusted ([VALIDATORS], [AUTOLIBRA], [ANTH-EVALS]). The raw material is on
  disk (history, ledger, look-tick notes, verify and audit JSON); nothing reads it yet.
- **Prompt and instruction optimisation against that set** ([DSPY], [GEPA], [MIPRO]). The
  how-to docs are thousands of lines tuned by hand.
- **Calibrated identity**: a face-level match between a subject cutout and its reference. The
  current reading is image-level and relative ([storytelling `inspect_elements`]).
- **A cue on its word**: comparing an authored light cue's time against the take's word
  alignment; the alignment exists, the comparison does not.
- **Traces of each agent session** — which files it read, which tools it ran, what it cost —
  as a queryable record rather than a transcript ([CMU] Safety 2; [SHANKAR]).
- **An MCP surface** over the CLI verbs, so every harness calls them typed.
- **Static analysis and a review pass on agent-written engine code** before merge ([CS146S]
  weeks 6–7); today the gate is the test suite alone.
- **A proactive mode**: the repository noticing what the owner would ask next ([CS329Z] week 11)
  without being asked; no mechanic, and it may not belong here.
