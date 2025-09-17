# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

The MCP Context Provider is a Python-based Model Context Protocol (MCP) server that provides persistent tool context to Claude Desktop. The architecture follows a singleton pattern with JSON-based context files and dynamic loading capabilities.

### Core Components

1. **ContextProvider Class** (`context_provider_server.py:24-134`): Singleton that manages context loading and serves tool-specific rules
2. **MCP Server** (`context_provider_server.py:137-264`): Asyncio-based server providing 4 core tools via MCP protocol
3. **Context Files** (`contexts/*.json`): JSON files following standardized schema with tool-specific rules, syntax preferences, and auto-correction patterns
4. **Session Initialization Framework**: Present in `memory_context.json` with `session_initialization` actions for auto-execution on startup

### Context File Schema

Each context file follows this structure:
- `tool_category`: Primary identifier
- `description`: Human-readable description
- `auto_convert`: Boolean for automatic syntax conversion
- `session_initialization`: Startup actions (already implemented in memory_context.json)
- `auto_store_triggers`/`auto_retrieve_triggers`: Pattern-based automation
- `syntax_rules`, `preferences`, `auto_corrections`: Tool-specific configurations
- `metadata`: Version, priority, inheritance information

## Development Commands

### Installation & Setup
```bash
# Automated installation (recommended)
curl -sSL https://raw.githubusercontent.com/doobidoo/MCP-Context-Provider/main/install.sh | bash

# Verification
python verify_install.py

# Development setup from source
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Testing & Verification
```bash
# Comprehensive installation check
python verify_install.py

# Information about current installation
python verify_install.py --info

# Server testing with auto-loading disabled (for development)
env AUTO_LOAD_CONTEXTS=false python context_provider_server.py
```

### Context Development
```bash
# Context files location
ls contexts/*.json

# Validate context file JSON syntax
python -m json.tool contexts/your_context.json

# Test context loading
CONTEXT_CONFIG_DIR=./contexts python context_provider_server.py
```

### DXT Package Management
```bash
# Build DXT package
cd dxt
dxt pack

# Install DXT CLI (if needed)
npm install -g @anthropic-ai/dxt

# Unpack for testing
dxt unpack mcp-context-provider-1.2.1.dxt ~/test-installation
```

## Key Implementation Patterns

### Context Loading
- **Dynamic Discovery**: Server auto-discovers `*_context.json` files
- **Singleton Pattern**: ContextProvider.get_instance() ensures single context manager
- **Environment Variables**: `CONTEXT_CONFIG_DIR` and `AUTO_LOAD_CONTEXTS` control behavior
- **Graceful Degradation**: Server continues if individual context files fail to load

### Session Initialization (Existing Framework)
The `memory_context.json` already implements session initialization patterns that can be extended:
- `session_initialization.actions.on_startup`: Array of actions to execute
- `greeting_format`: Template for context-aware greetings
- Pattern-based triggers for automatic storage/retrieval

### MCP Tool Architecture
Current tools are extensible via the `@app.call_tool()` decorator pattern:
- `get_tool_context`: Retrieves complete context for a tool
- `get_syntax_rules`: Returns syntax-specific rules
- `list_available_contexts`: Lists all loaded context categories
- `apply_auto_corrections`: Applies regex-based text transformations

### Security Considerations
- Input validation in tool handlers
- File path restrictions in context loading
- Environment variable configuration
- No direct file system access from MCP tools

## Configuration Integration

### Claude Desktop Configuration
The server integrates via `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "context-provider": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/context_provider_server.py"],
      "env": {
        "CONTEXT_CONFIG_DIR": "/path/to/contexts",
        "AUTO_LOAD_CONTEXTS": "true"
      }
    }
  }
}
```

### Environment Variables
- `CONTEXT_CONFIG_DIR`: Path to context files directory (default: `./contexts`)
- `AUTO_LOAD_CONTEXTS`: Enable/disable automatic context loading (default: `true`)

## Extension Points for Feature Requests

The codebase is already structured to support the planned feature requests:

1. **Auto-Execution (Issue #2)**: Session initialization framework exists in memory_context.json
2. **Dynamic Context Management (Issue #3)**: ContextProvider class can be extended with new MCP tools for runtime context modification
3. **Synergistic Integration (Issue #4)**: Existing pattern matching and auto-trigger system provides foundation for learning capabilities

### Context Inheritance System
The general_preferences.json serves as a fallback system with `"inheritance": "fallback_for_unspecified_tools"`, providing a foundation for hierarchical context inheritance.