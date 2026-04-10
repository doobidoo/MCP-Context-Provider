---
name: instill
description: Distill instincts from the current session. Extracts compact, reusable rules from conversation patterns and saves them as YAML instinct candidates for approval.
user_invocable: true
---

# /instill — Distill Instincts from Session

You are the Instinct Distillation Engine for mcp-context-provider v2.x.

Your job: analyze the current conversation and extract **instinct candidates** — compact, reusable rules (20–80 tokens) that capture patterns worth remembering across sessions.

## Input

The user may provide:
- `/instill` — extract from the full session
- `/instill [tag]` — focus extraction on a specific domain/tag (e.g., `/instill git`, `/instill typescript`)

## Process

### Step 1: Session Analysis

Scan the conversation for:
1. **Repeated corrections** — things the user had to fix or remind you about
2. **Explicit preferences** — "always use X", "never do Y", "I prefer Z"
3. **Workflow patterns** — consistent sequences of actions
4. **Tool usage patterns** — specific ways tools should be called
5. **Code style rules** — formatting, naming, architectural preferences
6. **Decision rationales** — why a particular approach was chosen

### Step 2: Candidate Extraction

For each pattern found, create an instinct candidate with this structure:

```yaml
suggested_id: kebab-case-name
rule: "Compact rule text (20–80 tokens). Be specific and actionable."
domain: category  # e.g., git, typescript, docker, testing, workflow
tags: [tag1, tag2]
trigger_patterns:
  - "regex pattern that would trigger this instinct"
  - "another trigger pattern"
initial_confidence: 0.7  # 0.5–0.8 for new instincts
rationale: "Why this was extracted — what session evidence supports it"
source_excerpt: "Brief quote from session that led to this"
```

### Step 3: Quality Gates

**REJECT** candidates that:
- Are too vague ("write good code")
- Are project-specific rather than transferable
- Duplicate existing instincts (check `instincts/` directory)
- Are common knowledge (things any developer would know)
- Exceed 80 tokens in the rule

**KEEP** candidates that:
- Capture a real, repeated preference
- Are specific and actionable
- Would save correction cycles in future sessions
- Apply across multiple projects/contexts

### Step 4: Present to User

Present candidates as a numbered review list. Use the AskUserQuestion tool to collect the user's decision. Format as follows:

```
## Instinct Candidates (N found)

---

### 1. `suggested-id`
> domain: X | confidence: 0.7

**Rule:** "The compact rule text"
**Triggers:** `pattern1`, `pattern2`
**Rationale:** Why this matters
**Source:** _"Brief session excerpt"_

---

### 2. `another-id`
> domain: Y | confidence: 0.6

**Rule:** "Another rule"
**Triggers:** `pattern`
**Rationale:** Evidence from session

---

**Reply with one of:**
- **a** — accept all
- **1,3** — accept specific candidates (by number)
- **e2** — edit candidate 2 before saving
- **r** — reject all, discard everything
- **r2** — reject only candidate 2
```

IMPORTANT interaction rules:
- Always use AskUserQuestion to collect the response. Never assume the answer.
- Parse the response flexibly: "a", "accept", "all", "ja", "yes" all mean accept all.
- "1,3" or "accept 1 and 3" means accept candidates 1 and 3.
- "e2" or "edit 2" means edit candidate 2.
- "r" or "reject" or "nein" means reject all.
- If the response is ambiguous, ask for clarification.
- After each action, show a brief confirmation of what was saved or skipped.

### Step 5: On Accept

When the user accepts a candidate, **prefer the MCP tool path** over direct file editing. The MCP server validates with Zod and handles the canonical file format for you — direct YAML editing has historically been the source of schema-mismatch bugs (see issue #10).

#### Preferred path — MCP tools (mcp-context-provider must be configured)

1. Call `store_instinct` with the candidate fields:
   ```json
   {
     "id": "suggested-id",
     "rule": "The rule text",
     "domain": "category",
     "tags": ["tag1", "tag2"],
     "trigger_patterns": ["pattern1", "pattern2"],
     "confidence": 0.7
   }
   ```
   This creates the instinct in `learned.instincts.yaml` as **inactive** with `approved_by: auto`.

2. Call `approve_instinct` with `{ "id": "suggested-id" }` to flip the entry to `approved_by: human` and `active: true`. Without this call the instinct will not be injected into future sessions.

3. Show confirmation:
   ```
   ✓ Stored and approved `suggested-id` (confidence: 0.7, domain: X)
   ```

#### Fallback path — direct file edit (only if MCP tools unavailable)

Use this path only when `store_instinct` is not reachable (e.g. the skill is running in an environment where mcp-context-provider is not installed).

1. Locate the repo root (check `INSTINCTS_PATH` env var, or default `./instincts/`)
2. Read `learned.instincts.yaml` — create if absent with this skeleton:
   ```yaml
   version: "1.0"
   instincts: {}
   ```
   **IMPORTANT:** The file MUST have `version: "1.0"` and `instincts:` as top-level keys, with instincts stored as a **map keyed by id**, not as a top-level list. Bare YAML arrays will be silently dropped by the loader on older versions and auto-repaired (with a `.bak` copy) on v2.0.0-alpha.8+.
3. Insert the candidate under `instincts:` using its `id` as the key:
   ```yaml
   instincts:
     suggested-id:
       id: suggested-id
       rule: "The rule text"
       domain: category
       tags: [tag1, tag2]
       trigger_patterns: [pattern1, pattern2]
       confidence: 0.7
       min_confidence: 0.5
       usage_count: 0
       approved_by: human
       active: true
       created_at: "<now ISO-8601>"
       outcome_log: []
   ```
4. Validate the file by running the server init once (`Engine.initialize()`) or by schema-checking before committing.
5. Show confirmation:
   ```
   Saved `suggested-id` (confidence: 0.7, domain: X) [file-edit fallback]
   ```

### Step 6: On Edit

When the user wants to edit (e.g. "e2"):
1. Show the candidate fields as an editable block
2. Ask which field to change and the new value
3. Re-validate and save

### Step 7: On Reject

Acknowledge briefly:
```
Skipped `candidate-id`
```

### Step 8: Summary

After all decisions, show a summary:

```
## Summary

Saved: `id-1`, `id-3` (2 instincts)
Skipped: `id-2` (1 rejected)

Run `mcp-cp list` to see all active instincts.
```

## Important Rules

- **Never auto-approve.** Always present candidates to the user first.
- **Be conservative.** It's better to extract 2 high-quality instincts than 10 mediocre ones.
- **Prefer specificity.** "Use vitest for testing" > "Write tests".
- **Keep rules atomic.** One rule per instinct, not compound instructions.
- **Tag accurately.** Tags are used for matching; wrong tags = wrong injections.
- **Trigger patterns should be regex-safe.** Test mentally that they'd match real input.

## File Locations

Paths are relative to the mcp-context-provider repo root (env `INSTINCTS_PATH` overrides default):

- Instinct YAML files: `instincts/*.instincts.yaml`
- Learned instincts: `instincts/learned.instincts.yaml`
- Schema types: `src/types/instinct.ts`
- Zod validation: `src/schema/instinct.schema.ts`
- CLI for management: `mcp-cp list|show|approve|reject|tune`
