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

Present candidates in this format:

```
## Instinct Candidates

### 1. `suggested-id` (domain: X, confidence: 0.7)
**Rule:** "The compact rule text"
**Triggers:** pattern1, pattern2
**Rationale:** Why this matters
**Source:** "Brief session excerpt"

[Accept] [Edit] [Reject]
```

### Step 5: On Accept

When the user accepts a candidate:

1. Read the existing instincts file (or create new):
   - Check `instincts/learned.instincts.yaml`
2. Transform the candidate into a full Instinct:
   ```yaml
   id: suggested-id
   rule: "The rule text"
   domain: category
   tags: [tags]
   trigger_patterns: [patterns]
   confidence: <initial_confidence>
   min_confidence: 0.5
   usage_count: 0
   approved_by: human
   active: true
   created_at: <now ISO-8601>
   outcome_log: []
   ```
3. Append to `instincts/learned.instincts.yaml`
4. Validate with Zod schema before writing
5. Confirm to user

### Step 6: On Edit

Let the user modify any field, then re-validate and save.

### Step 7: On Reject

Acknowledge and skip. Do not persist rejected candidates.

## Important Rules

- **Never auto-approve.** Always present candidates to the user first.
- **Be conservative.** It's better to extract 2 high-quality instincts than 10 mediocre ones.
- **Prefer specificity.** "Use vitest for testing" > "Write tests".
- **Keep rules atomic.** One rule per instinct, not compound instructions.
- **Tag accurately.** Tags are used for matching; wrong tags = wrong injections.
- **Trigger patterns should be regex-safe.** Test mentally that they'd match real input.

## File Locations

- Instinct YAML files: `instincts/*.instincts.yaml`
- Learned instincts: `instincts/learned.instincts.yaml`
- Schema types: `src/types/instinct.ts`
- Zod validation: `src/schema/instinct.schema.ts`
