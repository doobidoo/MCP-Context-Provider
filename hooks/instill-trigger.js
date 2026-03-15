#!/usr/bin/env node
/**
 * Instill Trigger Hook
 *
 * Detects user corrections (UserPromptSubmit) and tool failures (PostToolUse),
 * tracks a session-level counter, and nudges Claude to suggest /instill after
 * a configurable threshold of "mistake signals" is reached.
 *
 * Hook events: UserPromptSubmit, PostToolUse
 * Output: JSON with systemMessage when threshold is met
 *
 * @module instill-trigger
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
    // Number of mistake signals before nudging
    correctionThreshold: 2,
    failureThreshold: 3,
    // Combined threshold (corrections + failures weighted)
    combinedThreshold: 3,
    // Weights for combined scoring
    correctionWeight: 1.5,  // User corrections are stronger signals
    failureWeight: 0.5,     // Tool failures are weaker (some are just iterative)
    // Cooldown: don't nudge more than once per session
    maxNudgesPerSession: 1,
    // Tool failures that are "normal" and should be ignored
    ignoredErrorPatterns: [
        /No files found/i,                 // Glob finding nothing is normal
        /No such file or directory/i,      // Exploring paths
        /already exists/i,                 // Idempotent operations
        /nothing to commit/i,             // Clean git state
        /up to date/i,                     // Already current
    ],
    // Patterns in tool output indicating real failures
    failurePatterns: [
        /error/i,
        /failed/i,
        /exit code [1-9]/i,
        /traceback/i,
        /exception/i,
        /permission denied/i,
        /syntax error/i,
        /command not found/i,
    ],
};

// ── Correction Detection Patterns ──────────────────────────────────────────

const CORRECTION_PATTERNS = [
    // Direct corrections
    /\bno[,.]?\s+(not\s+)?that/i,
    /\bthat'?s\s+(not|wrong)/i,
    /\bwrong\b/i,
    /\bnot\s+what\s+I\s+(meant|asked|said|wanted)/i,
    /\bI\s+(said|meant|asked|wanted)\b/i,
    /\bincorrect\b/i,
    /\bthat\s+doesn'?t?\s+work/i,
    /\bstill\s+(not|broken|failing|missing|wrong)/i,
    /\bdidn'?t\s+work/i,
    /\bisn'?t?\s+working/i,
    // Redirection
    /\binstead[,.]?\s+(do|use|try)/i,
    /\bdon'?t\s+(do|use|add|change|modify|remove)/i,
    /\bshouldn'?t/i,
    /\bactually[,.]?\s+(I|we|it|the)/i,
    /\blet'?s?\s+not\b/i,
    // Frustration signals
    /\bagain\b.*\b(wrong|fail|error|broken)/i,
    /\bstill\s+(the\s+)?same\s+(error|issue|problem|bug)/i,
    /\byou\s+(already|just)\s+(did|made|broke)/i,
    // Explicit preference override
    /\balways\s+use\b/i,
    /\bnever\s+(use|do|add)\b/i,
    /\bI\s+prefer\b/i,
    /\bplease\s+stop\b/i,
];

// Patterns that look like corrections but aren't (reduce false positives)
const FALSE_POSITIVE_PATTERNS = [
    /\bno[,.]?\s+(I\s+)?(don'?t\s+)?(think|know|need|have)/i, // "no I don't think so"
    /\bwrong\s+(with|about)\b/i,   // "what's wrong with X" (question, not correction)
    /\bnot\s+sure/i,                // Uncertainty, not correction
    /\bif\s+.*wrong/i,              // Conditional, not correction
];

// ── State Management ───────────────────────────────────────────────────────

function getStateFilePath(sessionId) {
    return path.join(os.tmpdir(), `claude-instill-${sessionId || 'default'}.json`);
}

function loadState(sessionId) {
    try {
        const statePath = getStateFilePath(sessionId);
        if (fs.existsSync(statePath)) {
            return JSON.parse(fs.readFileSync(statePath, 'utf8'));
        }
    } catch (e) {
        // Corrupted state, start fresh
    }
    return {
        corrections: 0,
        failures: 0,
        nudgeCount: 0,
        correctionExcerpts: [],
        failureExcerpts: [],
        createdAt: new Date().toISOString(),
    };
}

function saveState(sessionId, state) {
    try {
        const statePath = getStateFilePath(sessionId);
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch (e) {
        // Non-critical, don't block
    }
}

// ── Detection Logic ────────────────────────────────────────────────────────

function isCorrection(prompt) {
    if (!prompt || typeof prompt !== 'string') return { isCorrection: false };

    const trimmed = prompt.trim();

    // Skip very short prompts (single words like "no" might be answers, not corrections)
    if (trimmed.length < 8) return { isCorrection: false };

    // Check false positives first
    for (const fp of FALSE_POSITIVE_PATTERNS) {
        if (fp.test(trimmed)) return { isCorrection: false };
    }

    // Check correction patterns
    const matches = [];
    for (const pattern of CORRECTION_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            matches.push(match[0]);
        }
    }

    if (matches.length === 0) return { isCorrection: false };

    // Require at least some substance (not just "wrong")
    const confidence = Math.min(0.5 + matches.length * 0.15, 1.0);

    return {
        isCorrection: true,
        confidence,
        matchedPatterns: matches,
        excerpt: trimmed.substring(0, 120),
    };
}

function isToolFailure(toolName, toolInput, toolResponse) {
    // Only check Bash and specific tool types
    if (!['Bash', 'Edit', 'Write'].includes(toolName)) return { isFailure: false };

    const responseStr = typeof toolResponse === 'string'
        ? toolResponse
        : JSON.stringify(toolResponse || {});

    // Check ignored patterns first
    for (const ignored of CONFIG.ignoredErrorPatterns) {
        if (ignored.test(responseStr)) return { isFailure: false };
    }

    // Check for failure signals
    const failureMatches = [];
    for (const pattern of CONFIG.failurePatterns) {
        if (pattern.test(responseStr)) {
            failureMatches.push(pattern.source);
        }
    }

    // Check exit code for Bash
    if (toolName === 'Bash') {
        const exitCodeMatch = responseStr.match(/exit code (\d+)/i);
        if (exitCodeMatch && parseInt(exitCodeMatch[1]) !== 0) {
            failureMatches.push(`exit_code_${exitCodeMatch[1]}`);
        }
        // Also check the tool_response structure
        if (toolResponse && typeof toolResponse === 'object') {
            if (toolResponse.exitCode && toolResponse.exitCode !== 0) {
                failureMatches.push(`exit_code_${toolResponse.exitCode}`);
            }
            // Check stderr in error field
            if (toolResponse.error) {
                failureMatches.push('stderr_present');
            }
        }
    }

    if (failureMatches.length === 0) return { isFailure: false };

    const command = toolInput?.command || toolInput?.file_path || 'unknown';
    return {
        isFailure: true,
        matchCount: failureMatches.length,
        excerpt: `${toolName}: ${command}`.substring(0, 80),
    };
}

// ── Nudge Generation ───────────────────────────────────────────────────────

function shouldNudge(state) {
    if (state.nudgeCount >= CONFIG.maxNudgesPerSession) return false;

    const combinedScore =
        state.corrections * CONFIG.correctionWeight +
        state.failures * CONFIG.failureWeight;

    return (
        combinedScore >= CONFIG.combinedThreshold ||
        state.corrections >= CONFIG.correctionThreshold
    );
}

function buildNudgeMessage(state) {
    const parts = [];

    if (state.corrections > 0) {
        parts.push(`${state.corrections} correction(s) detected`);
    }
    if (state.failures > 0) {
        parts.push(`${state.failures} tool failure(s)`);
    }

    const excerpts = [
        ...state.correctionExcerpts.slice(-2),
        ...state.failureExcerpts.slice(-2),
    ].map(e => `  - ${e}`).join('\n');

    return [
        `[instill-trigger] Session has accumulated ${parts.join(' and ')}.`,
        `Signals:`,
        excerpts,
        ``,
        `Consider suggesting /instill to the user before ending this session,`,
        `so these correction patterns can be distilled into reusable instincts.`,
        `Only suggest this once, naturally, when there's a pause in the work.`,
    ].join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        const timeout = setTimeout(() => resolve(data || '{}'), 1500);
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => { clearTimeout(timeout); resolve(data); });
        process.stdin.on('error', () => { clearTimeout(timeout); resolve('{}'); });
        process.stdin.resume();
    });
}

async function main() {
    try {
        const raw = await readStdin();
        const input = JSON.parse(raw);

        const sessionId = input.session_id || 'default';
        const hookEvent = input.hook_event_name;
        const state = loadState(sessionId);

        let stateChanged = false;

        // ── UserPromptSubmit: detect corrections ──
        if (hookEvent === 'UserPromptSubmit' && input.prompt) {
            const result = isCorrection(input.prompt);
            if (result.isCorrection) {
                state.corrections++;
                state.correctionExcerpts.push(result.excerpt);
                // Keep only last 5
                if (state.correctionExcerpts.length > 5) {
                    state.correctionExcerpts = state.correctionExcerpts.slice(-5);
                }
                stateChanged = true;
            }
        }

        // ── PostToolUse: detect failures ──
        if (hookEvent === 'PostToolUse' && input.tool_name) {
            const result = isToolFailure(input.tool_name, input.tool_input, input.tool_response);
            if (result.isFailure) {
                state.failures++;
                state.failureExcerpts.push(result.excerpt);
                if (state.failureExcerpts.length > 5) {
                    state.failureExcerpts = state.failureExcerpts.slice(-5);
                }
                stateChanged = true;
            }
        }

        // ── Check threshold and nudge ──
        if (shouldNudge(state)) {
            state.nudgeCount++;
            stateChanged = true;
            saveState(sessionId, state);

            const output = {
                systemMessage: buildNudgeMessage(state),
            };
            process.stdout.write(JSON.stringify(output));
            process.exit(0);
            return;
        }

        if (stateChanged) {
            saveState(sessionId, state);
        }

        // No nudge needed — exit silently
        process.exit(0);

    } catch (error) {
        // Never block the user's workflow
        process.exit(0);
    }
}

main();
