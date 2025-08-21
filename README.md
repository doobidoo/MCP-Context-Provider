# MCP Context Provider

A static MCP (Model Context Protocol) server that provides AI models with persistent tool context, preventing context loss between chat sessions. This server automatically loads and injects tool-specific rules, syntax preferences, and best practices at Claude Desktop startup.

## Overview

The Context Provider eliminates the need to re-establish context in each new chat session by:

- 🔄 **Persistent Context**: Rules and preferences survive across Claude Desktop restarts
- ⚡ **Automatic Injection**: Context is loaded once at startup and available to all tools
- 🎯 **Tool-Specific**: Each tool gets its own context rules and syntax preferences  
- 🔧 **Auto-Corrections**: Automatic syntax transformations (e.g., Markdown → DokuWiki)
- 📈 **Scalable**: Easy to add new tools and context rules
- 🏢 **Enterprise-Ready**: Version-controlled context management

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/MCP-Context-Provider.git
cd MCP-Context-Provider

# Install dependencies
pip install mcp
```

### 2. Configuration

Update your Claude Desktop configuration file with the correct path:

**Location**: `~/.config/claude/claude_desktop_config.json` (Linux/Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "python",
      "args": ["context_provider_server.py"],
      "cwd": "/path/to/MCP-Context-Provider",
      "env": {
        "CONTEXT_CONFIG_DIR": "./contexts",
        "AUTO_LOAD_CONTEXTS": "true"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the MCP server.

## How It Works

### Architecture

1. **Context Provider Server**: Python MCP server that loads JSON context files
2. **Context Files**: Tool-specific rules stored in `/contexts` directory  
3. **Claude Desktop Integration**: MCP server registered in configuration
4. **Automatic Loading**: Context is injected at startup and persists across chats

### Context Flow

```
Startup → Load Context Files → Register MCP Tools → Context Available in All Chats
```

### Available Tools

Once loaded, the following tools are available in all chat sessions:

- `get_tool_context`: Get context rules for specific tool
- `get_syntax_rules`: Get syntax conversion rules
- `list_available_contexts`: List all loaded context categories
- `apply_auto_corrections`: Apply automatic syntax corrections

## Context Files

The server loads context files from the `/contexts` directory:

- **`dokuwiki_context.json`**: DokuWiki syntax rules and preferences
- **`terraform_context.json`**: Terraform naming conventions and best practices
- **`azure_context.json`**: Azure resource naming and compliance rules
- **`git_context.json`**: Git commit conventions and workflow patterns
- **`general_preferences.json`**: Cross-tool preferences and standards

### Context File Structure

Each context file follows this pattern:

```json
{
  "tool_category": "toolname",
  "description": "Tool-specific context rules",
  "auto_convert": true,
  "syntax_rules": {
    "format_rules": "conversion patterns"
  },
  "preferences": {
    "user_preferences": "settings"
  },
  "auto_corrections": {
    "regex_patterns": "automatic fixes"
  },
  "metadata": {
    "version": "1.0.0",
    "applies_to_tools": ["tool:*"]
  }
}
```

## Examples

### DokuWiki Syntax Conversion

Input (Markdown):
```markdown
# My Header
This is `inline code` and here's a [link](http://example.com).
```

Auto-converted to DokuWiki:
```
====== My Header ======
This is ''inline code'' and here's a [[http://example.com|link]].
```

### Azure Resource Naming

Input: `storage_account_logs_prod`
Auto-corrected to: `stlogsprod` (following Azure naming conventions)

### Git Commit Messages

Input: `Fixed the login bug`
Auto-corrected to: `fix: resolve login authentication issue`

## Adding New Context

To add support for a new tool:

1. Create a new JSON file: `contexts/{toolname}_context.json`
2. Follow the standard context structure
3. Restart Claude Desktop to load the new context

The server automatically detects and loads any `*_context.json` files in the contexts directory.

## Benefits

### For Developers
- No need to re-establish context in new chats
- Automatic syntax corrections save time
- Consistent formatting across all work
- Best practices automatically applied

### For Teams
- Shared context rules across team members
- Version-controlled standards
- Consistent code and documentation formatting
- Enterprise compliance automatically enforced

### For Organizations
- Centralized context management
- Scalable across multiple tools
- Audit trail of context changes
- Easy deployment and updates

## Advanced Usage

### Custom Context Rules

Create your own context files by following the established pattern. The server supports:

- Regex-based auto-corrections
- Tool-specific preferences
- Conditional formatting rules
- Multi-tool context inheritance

### Environment-Specific Context

Use environment variables to load different context sets:

```json
{
  "env": {
    "CONTEXT_CONFIG_DIR": "./contexts/production",
    "ENVIRONMENT": "prod"
  }
}
```

## Troubleshooting

### Common Issues

1. **Context not loading**: Check file path in Claude Desktop config
2. **Server not starting**: Verify Python dependencies installed
3. **Rules not applying**: Check JSON syntax in context files

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

## Documentation

- [Context Guide](CONTEXT_GUIDE.md): Complete context file reference
- [Developer Guide](DEVELOPER_GUIDE.md): Creating custom contexts
- [Examples](EXAMPLES.md): Real-world usage examples
- [Troubleshooting](TROUBLESHOOTING.md): Common issues and solutions

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-context`
3. Add your context file to `/contexts`
4. Test with your Claude Desktop setup
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
