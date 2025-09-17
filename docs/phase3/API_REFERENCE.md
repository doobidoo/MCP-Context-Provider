# Phase 3: Learning Engine API Reference

## Overview

This document provides a comprehensive API reference for the Phase 3 Intelligent Learning System, including all classes, methods, and data structures introduced in the synergistic integration.

## Table of Contents

1. [MemoryServiceIntegration](#memoryserviceintegration)
2. [ContextLearningEngine](#contextlearningengine)
3. [Enhanced ContextProvider](#enhanced-contextprovider)
4. [MCP Tools API](#mcp-tools-api)
5. [Data Structures](#data-structures)
6. [Error Handling](#error-handling)

## MemoryServiceIntegration

Real memory service integration class that replaces the simulation layer with actual `mcp-memory-service` calls.

### Class Definition

```python
class MemoryServiceIntegration:
    """
    Real memory service integration for MCP Context Provider
    Replaces simulation layer with actual mcp-memory-service calls
    """
```

### Constructor

```python
def __init__(self):
    """Initialize memory service integration with health check"""
    self.memory_available = self._check_memory_service()
```

### Methods

#### `store_memory(content, tags=None, metadata=None)`

Stores content in the memory service with associated tags and metadata.

**Parameters:**
- `content` (str): The content to store
- `tags` (List[str], optional): Tags for categorization
- `metadata` (Dict[str, Any], optional): Additional metadata

**Returns:**
```python
{
    "success": bool,
    "stored_content": str,
    "tags": List[str],
    "memory_id": str,
    "error": str  # Only present if success=False
}
```

**Example:**
```python
result = await memory_service.store_memory(
    "Context optimization completed successfully",
    ["optimization", "context_change"],
    {"context_name": "terraform", "optimization_type": "preference_tuning"}
)
```

#### `recall_memory(query, n_results=5, tags=None)`

Retrieves memories based on a query string.

**Parameters:**
- `query` (str): Search query
- `n_results` (int): Maximum number of results to return
- `tags` (List[str], optional): Filter by specific tags

**Returns:**
```python
{
    "success": bool,
    "query": str,
    "results": List[Dict],
    "total_results": int,
    "error": str  # Only present if success=False
}
```

**Result Structure:**
```python
{
    "content": str,
    "relevance": float,  # 0.0-1.0
    "tags": List[str],
    "timestamp": str
}
```

#### `search_by_tag(tags, limit=10)`

Searches memories by specific tags.

**Parameters:**
- `tags` (List[str]): Tags to search for
- `limit` (int): Maximum number of results

**Returns:**
```python
{
    "success": bool,
    "tags": List[str],
    "results": List[Dict],
    "total_results": int,
    "error": str  # Only present if success=False
}
```

#### `get_memory_stats()`

Retrieves memory service statistics and health information.

**Returns:**
```python
{
    "success": bool,
    "total_memories": int,
    "tags_available": List[str],
    "storage_backend": str,
    "service_status": str,
    "error": str  # Only present if success=False
}
```

## ContextLearningEngine

Intelligent learning engine for context optimization and pattern recognition.

### Class Definition

```python
class ContextLearningEngine:
    """
    Phase 3: Intelligent learning engine for context optimization
    Analyzes usage patterns and suggests context improvements
    """
```

### Constructor

```python
def __init__(self, memory_service: MemoryServiceIntegration):
    """Initialize learning engine with memory service integration"""
    self.memory_service = memory_service
    self.learning_enabled = True
```

### Methods

#### `analyze_context_effectiveness(context_name)`

Analyzes the effectiveness of a specific context based on memory data.

**Parameters:**
- `context_name` (str): Name of the context to analyze

**Returns:**
```python
{
    "success": bool,
    "context_name": str,
    "usage_stats": Dict[str, Any],
    "effectiveness_score": float,  # 0.0-1.0
    "recommendations": List[str],
    "error": str  # Only present if success=False
}
```

**Usage Stats Structure:**
```python
{
    "total_interactions": int,
    "creation_count": int,
    "update_count": int,
    "pattern_additions": int,
    "last_activity": str  # ISO timestamp or None
}
```

#### `suggest_context_optimizations()`

Analyzes all contexts and suggests global optimizations.

**Returns:**
```python
List[Dict[str, Any]]  # List of optimization suggestions
```

**Suggestion Structure:**
```python
{
    "context_name": str,
    "optimization_type": str,
    "priority": str,  # "high", "medium", "low"
    "description": str
}
```

#### `learn_from_session_patterns(session_data)`

Learns from session initialization patterns to improve future sessions.

**Parameters:**
- `session_data` (Dict[str, Any]): Session performance data

**Session Data Structure:**
```python
{
    "initialized": bool,
    "execution_time_seconds": float,
    "executed_actions": List[Dict],
    "errors": List[str],
    "memory_retrieval_results": Dict
}
```

**Returns:**
```python
{
    "success": bool,
    "patterns_learned": int,
    "insights_gained": List[str],
    "session_analysis": Dict[str, Any],
    "memory_stored": bool,
    "error": str  # Only present if success=False
}
```

#### `proactive_context_suggestions(current_contexts)`

Provides proactive suggestions for new contexts based on usage patterns.

**Parameters:**
- `current_contexts` (List[str]): List of currently loaded context names

**Returns:**
```python
List[Dict[str, Any]]  # List of suggestions
```

**Suggestion Structure:**
```python
{
    "suggested_context": str,
    "reason": str,
    "confidence": float,  # 0.0-1.0
    "type": str,
    "priority": str
}
```

### Private Methods

#### `_calculate_effectiveness_score(usage_stats)`

Calculates effectiveness score based on usage patterns.

**Scoring Algorithm:**
- Base score (0.3) for having interactions
- Active use score (0.4) for regular updates
- Evolution score (0.3) for pattern additions
- Normalized to 0-1 range

#### `_generate_recommendations(context_name, usage_stats)`

Generates improvement recommendations based on usage statistics.

## Enhanced ContextProvider

The main context provider class enhanced with Phase 3 learning capabilities.

### New Attributes

```python
self.memory_service: MemoryServiceIntegration
self.learning_engine: ContextLearningEngine
self.contexts_dir: Path  # Added for consistency
```

### New Methods

#### `auto_optimize_context(context_name, optimization_data)`

Automatically optimizes a context based on learning engine recommendations.

**Parameters:**
- `context_name` (str): Name of context to optimize
- `optimization_data` (Dict[str, Any]): Optimization instructions

**Optimization Data Structure:**
```python
{
    "type": str,  # "pattern_improvement", "preference_tuning", "rule_refinement"
    "patterns": Dict[str, List],  # For pattern_improvement
    "preferences": Dict[str, Any],  # For preference_tuning
    "syntax_rules": Dict[str, Dict],  # For rule_refinement
    "effectiveness_data": Dict[str, Any]  # Optional metadata
}
```

**Returns:**
```python
{
    "success": bool,
    "message": str,
    "context_name": str,
    "optimization_type": str,
    "optimizations_applied": List[str],
    "backup_file": str,
    "error": str  # Only present if success=False
}
```

#### Enhanced `execute_session_initialization()`

Now includes automatic learning from session patterns.

**New Session Status Fields:**
```python
{
    "learning_insights": List[str],  # Generated insights
    # ... existing fields
}
```

## MCP Tools API

### Learning Tools

#### `analyze_context_effectiveness`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "context_name": {
      "type": "string",
      "description": "Name of the context to analyze"
    }
  },
  "required": ["context_name"]
}
```

#### `suggest_context_optimizations`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### `get_proactive_suggestions`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "current_contexts": {
      "type": "array",
      "items": {"type": "string"},
      "description": "List of currently loaded context names"
    }
  },
  "required": ["current_contexts"]
}
```

#### `auto_optimize_context`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "context_name": {
      "type": "string",
      "description": "Name of the context to optimize"
    },
    "optimization_data": {
      "type": "object",
      "description": "Optimization instructions and data"
    }
  },
  "required": ["context_name", "optimization_data"]
}
```

## Data Structures

### Memory Storage Format

**Context Change Events:**
```python
{
    "content": "Context {operation}: {context_name} - {description}",
    "tags": ["context_change", operation, context_name],
    "metadata": {
        "operation": str,  # "created", "updated", "optimized"
        "context_name": str,
        "details": Dict[str, Any],
        "timestamp": str
    }
}
```

**Session Learning Events:**
```python
{
    "content": "Session learning: Executed {n} actions in {time}s with {errors} errors",
    "tags": ["session_learning", "performance", "initialization"],
    "metadata": {
        "execution_time": float,
        "actions_count": int,
        "errors_count": int,
        "timestamp": str
    }
}
```

### Context Metadata Extensions

**Learning Metadata:**
```python
{
    "metadata": {
        "version": "1.0.0",
        "last_updated": str,
        "last_optimization": str,  # New in Phase 3
        "optimization_count": int,  # New in Phase 3
        "effectiveness_score": float,  # Cached score
        # ... existing fields
    }
}
```

### Optimization Types

#### Pattern Improvement
```python
{
    "type": "pattern_improvement",
    "patterns": {
        "section_name": ["new_pattern_1", "new_pattern_2"]
    }
}
```

#### Preference Tuning
```python
{
    "type": "preference_tuning",
    "preferences": {
        "setting_name": "new_value",
        "another_setting": true
    }
}
```

#### Rule Refinement
```python
{
    "type": "rule_refinement",
    "syntax_rules": {
        "category_name": {
            "patterns": ["regex_pattern"],
            "description": "Rule description"
        }
    }
}
```

## Error Handling

### Common Error Types

#### Memory Service Errors
```python
{
    "success": False,
    "error": "Memory service not available"
}
```

#### Learning Engine Errors
```python
{
    "success": False,
    "error": "Analysis failed: {detailed_error_message}"
}
```

#### Optimization Errors
```python
{
    "success": False,
    "error": "Auto-optimization failed: {detailed_error_message}",
    "context_name": str,
    "backup_file": str  # If backup was created
}
```

### Error Recovery

All optimization operations create backups before modification:

```python
backup_file = f"backup_{context_name}_context_{timestamp}.json"
```

Failed operations preserve the original context file and provide the backup location for manual recovery.

### Validation Errors

Context optimization includes comprehensive validation:

```python
{
    "success": False,
    "error": "Optimized context validation failed",
    "validation_errors": List[str],
    "backup_file": str
}
```

## Performance Considerations

### Memory Service Calls

- All memory operations are asynchronous
- Failed memory calls don't block context operations
- Memory unavailability gracefully degrades functionality

### Learning Engine Performance

- Effectiveness analysis cached for 1 hour
- Optimization suggestions computed on-demand
- Session learning runs asynchronously during initialization

### Context Optimization

- Atomic operations with backup-first approach
- Validation before applying changes
- Automatic rollback on validation failure

## Integration Examples

### Basic Learning Workflow

```python
# Initialize provider with learning engine
provider = ContextProvider()

# Analyze context effectiveness
effectiveness = await provider.learning_engine.analyze_context_effectiveness("terraform")

# Get optimization suggestions
suggestions = await provider.learning_engine.suggest_context_optimizations()

# Apply automatic optimization
optimization_data = {
    "type": "preference_tuning",
    "preferences": {"default_region": "us-west-2"}
}
result = await provider.auto_optimize_context("terraform", optimization_data)
```

### Memory Integration Pattern

```python
# Store learning event
await provider.memory_service.store_memory(
    "Successfully optimized terraform context preferences",
    ["optimization", "terraform", "preferences"],
    {"optimization_type": "preference_tuning", "score_improvement": 0.2}
)

# Retrieve related memories
memories = await provider.memory_service.recall_memory(
    "terraform optimization",
    n_results=5
)
```

This API reference provides the foundation for building intelligent context management systems that continuously learn and improve based on usage patterns and user feedback.