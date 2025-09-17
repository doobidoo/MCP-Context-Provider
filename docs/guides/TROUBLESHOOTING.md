# Troubleshooting Guide

Common issues and solutions for the MCP Context Provider.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Context Loading Issues](#context-loading-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Integration Problems](#integration-problems)
- [Debugging Techniques](#debugging-techniques)

## Installation Issues

### DXT Package Installation

**Problem**: `dxt: command not found` or `error: unknown command 'install'`

**Symptoms**: 
- `dxt install` command doesn't exist
- Error: "unknown command 'install'" when running `dxt install mcp-context-provider-1.2.1.dxt`

**Root Cause**: The DXT CLI doesn't have an `install` command. Available commands are: `init`, `validate`, `clean`, `pack`, `unpack`, `sign`, `verify`, `info`, `unsign`.

**Solution**:
```bash
# Method 1: Use automated installation script (recommended)
curl -sSL https://raw.githubusercontent.com/doobidoo/MCP-Context-Provider/main/install.sh | bash

# Method 2: Manual DXT unpack + virtual environment
# 1. Install DXT CLI
npm install -g @anthropic-ai/dxt

# 2. Download and unpack
wget https://github.com/doobidoo/MCP-Context-Provider/raw/main/mcp-context-provider-1.2.1.dxt
dxt unpack mcp-context-provider-1.2.1.dxt ~/mcp-context-provider

# 3. Set up virtual environment
cd ~/mcp-context-provider
python -m venv venv
source venv/bin/activate
pip install mcp>=1.9.4
```

### Bundled Dependencies Issues

**Problem**: Bundled Python dependencies in DXT package don't work

**Symptoms**:
- ImportError when using bundled dependencies from `server/lib/`
- `jsonschema`, `pydantic`, or other dependency import failures
- Works with fresh pip install but not with DXT package

**Root Cause**: Python 3.13+ compatibility issues with bundled packages, or incomplete dependency bundling.

**Solution**:
```bash
# Always use virtual environment approach instead of bundled deps
cd ~/mcp-context-provider
python -m venv venv
source venv/bin/activate  # Linux/Mac
# OR
venv\Scripts\activate     # Windows

# Install fresh dependencies
pip install mcp>=1.9.4

# Update Claude Desktop config to use venv Python
# Use: /path/to/mcp-context-provider/venv/bin/python
```

### Modern Linux Restrictions

**Problem**: `error: externally-managed-environment` when installing packages

**Symptoms**:
- Pip refuses to install packages globally on Arch/Manjaro/Ubuntu 23+
- Error: "This environment is externally managed"

**Solution**:
```bash
# NEVER use --break-system-packages (dangerous)
# Always use virtual environment instead:

python -m venv venv
source venv/bin/activate
pip install mcp>=1.9.4

# Virtual environment isolates packages safely
```

### Python Dependencies

**Problem**: `ModuleNotFoundError: No module named 'mcp'`

**Solution**:
```bash
# Activate virtual environment first
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Then install MCP package
pip install mcp>=1.9.4

# Verify installation
python -c "import mcp; print('MCP installed successfully')"
```

**Problem**: Python version compatibility issues

**Solution**:
```bash
# Check Python version (requires 3.8+)
python --version

# Use virtual environment for isolation
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install mcp>=1.9.4
```

### Installation Verification

**Problem**: Unsure if installation completed correctly

**Solution**:
```bash
# Run the verification script
cd ~/mcp-context-provider
python verify_install.py

# Should show:
# ✓ Python version: 3.x.x
# ✓ MCP package installed
# ✓ Contexts directory found
# ✓ Server loads successfully
```

### File Permissions

**Problem**: Permission denied when running server

**Solution (Linux/Mac)**:
```bash
# Make server executable
chmod +x context_provider_server.py

# Check file ownership
ls -la context_provider_server.py

# Fix ownership if needed
sudo chown $USER:$USER context_provider_server.py
```

**Solution (Windows)**:
```powershell
# Run as administrator or check file properties
# Right-click → Properties → Security → Edit permissions
```

## Configuration Problems

### Claude Desktop Configuration

**Problem**: Server not appearing in Claude Desktop

**Solution**:
1. **Check configuration file location**:
   - Linux: `~/.config/claude/claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Validate JSON syntax**:
   ```bash
   # Use online JSON validator or:
   python -m json.tool claude_desktop_config.json
   ```

3. **Check file paths**:
   ```json
   {
     "mcpServers": {
       "context-provider": {
         "command": "python",
         "args": ["context_provider_server.py"],
         "cwd": "/absolute/path/to/MCP-Context-Provider"
       }
     }
   }
   ```

**Problem**: Wrong working directory

**Symptoms**: 
- Server starts but context files not found
- Error: `FileNotFoundError: [Errno 2] No such file or directory`

**Solution**:
```json
{
  "mcpServers": {
    "context-provider": {
      "cwd": "C:/REPOSITORIES/MCP-Context-Provider",  // Use forward slashes
      "env": {
        "CONTEXT_CONFIG_DIR": "./contexts"
      }
    }
  }
}
```

### Path Issues

**Problem**: Context files not loading

**Solution**:
```bash
# Check if contexts directory exists
ls -la contexts/

# Check file permissions
ls -la contexts/*.json

# Verify JSON syntax
python -m json.tool contexts/dokuwiki_context.json
```

## Context Loading Issues

### Invalid JSON Format

**Problem**: `json.JSONDecodeError: Expecting ',' delimiter`

**Solution**:
1. **Validate each context file**:
   ```bash
   for file in contexts/*.json; do
     echo "Validating $file"
     python -m json.tool "$file" > /dev/null || echo "ERROR in $file"
   done
   ```

2. **Common JSON errors**:
   ```json
   // WRONG - trailing comma
   {
     "field1": "value1",
     "field2": "value2",  ← Remove this comma
   }
   
   // WRONG - unescaped quotes
   {
     "pattern": "string with "quotes""  
   }
   
   // CORRECT
   {
     "pattern": "string with \"quotes\""
   }
   ```

### Missing Required Fields

**Problem**: Context files missing required fields

**Solution**:
```json
{
  "tool_category": "required",     // ✓ Required
  "description": "required",       // ✓ Required  
  "auto_convert": true,           // ✓ Optional but recommended
  "metadata": {                   // ✓ Recommended
    "version": "1.0.0"
  }
}
```

### Regex Pattern Errors

**Problem**: `re.error: bad character range`

**Solution**:
1. **Test regex patterns online** (regex101.com, regexr.com)

2. **Common regex mistakes**:
   ```json
   // WRONG - unescaped backslashes
   {
     "pattern": "\d+"
   }
   
   // CORRECT - double escaping for JSON
   {
     "pattern": "\\d+"
   }
   
   // WRONG - invalid character range  
   {
     "pattern": "[z-a]"
   }
   
   // CORRECT
   {
     "pattern": "[a-z]"
   }
   ```

3. **Test patterns in Python**:
   ```python
   import re
   pattern = r"\\d+"  # Test your pattern
   text = "Test 123"
   result = re.sub(pattern, "NUMBER", text)
   print(result)
   ```

## Runtime Errors

### MCP Server Startup Failures

**Problem**: Server fails to start with no error message

**Solution**:
1. **Enable debug mode**:
   ```json
   {
     "env": {
       "DEBUG_MODE": "true"
     }
   }
   ```

2. **Test server manually**:
   ```bash
   python context_provider_server.py
   # Should show error messages if any
   ```

3. **Check Claude Desktop logs**:
   - **macOS**: `~/Library/Logs/Claude/`
   - **Windows**: `%APPDATA%\Claude\logs\`
   - **Linux**: `~/.config/claude/logs/`

### Tool Call Failures

**Problem**: `CallToolResult` with error: "Tool context not found"

**Solution**:
1. **Check available contexts**:
   ```python
   from context_provider_server import ContextProvider
   provider = ContextProvider()
   print("Available contexts:", list(provider.contexts.keys()))
   ```

2. **Verify tool name matching**:
   ```python
   # Tool names are matched by category
   # For "dokuwiki:core_savePage" → looks for "dokuwiki" context
   tool_name = "dokuwiki:core_savePage"
   category = tool_name.split(':')[0]
   print(f"Looking for context: {category}")
   ```

### Memory/Performance Issues

**Problem**: High memory usage or slow response times

**Solution**:
1. **Check context file sizes**:
   ```bash
   ls -lah contexts/*.json
   # Files should typically be < 100KB
   ```

2. **Optimize regex patterns**:
   ```python
   # SLOW - greedy matching
   pattern = r".*some.*pattern.*"
   
   # FASTER - specific matching
   pattern = r"some[a-z]+pattern"
   
   # FASTEST - anchor patterns
   pattern = r"^some pattern$"
   ```

3. **Limit auto-correction scope**:
   ```json
   {
     "auto_corrections": {
       "limited_scope": {
         "pattern": "^specific_prefix.*",  // Only match specific cases
         "replacement": "corrected_prefix"
       }
     }
   }
   ```

## Integration Problems

### Claude Desktop Integration

**Problem**: Tools not appearing in Claude interface

**Checklist**:
1. ✓ MCP server configured correctly
2. ✓ Claude Desktop restarted after config change
3. ✓ Server starts without errors
4. ✓ Context files load successfully

**Debug steps**:
```bash
# 1. Test server independently
python context_provider_server.py

# 2. Check Claude Desktop logs
# On Linux:
tail -f ~/.config/claude/logs/claude_desktop.log
# On macOS:
tail -f ~/Library/Logs/Claude/claude_desktop.log

# 3. Verify configuration
python -c "
import json
with open('claude_desktop_config.json') as f:
    config = json.load(f)
    print('Config valid')
    print('Servers:', list(config.get('mcpServers', {}).keys()))
"
```

### Tool Context Not Applied

**Problem**: Context rules not being applied automatically

**Solution**:
1. **Check auto_convert setting**:
   ```json
   {
     "auto_convert": true  // Must be true for automatic application
   }
   ```

2. **Verify tool matching**:
   ```json
   {
     "metadata": {
       "applies_to_tools": [
         "dokuwiki:*",          // All dokuwiki tools
         "specific_tool_name"   // Specific tool only
       ]
     }
   }
   ```

3. **Test tool matching manually**:
   ```python
   provider = ContextProvider()
   context = provider.get_tool_context("dokuwiki")
   print("Auto-convert enabled:", context.get('auto_convert', False))
   ```

## Performance Issues

### Slow Context Loading

**Problem**: Server takes too long to start

**Solution**:
1. **Reduce context file complexity**:
   ```json
   // Remove unnecessary nested structures
   // Simplify regex patterns
   // Remove unused rules
   ```

2. **Optimize file I/O**:
   ```python
   # Check if files are on slow network drive
   # Move to local storage if needed
   ```

3. **Profile loading time**:
   ```python
   import time
   start = time.time()
   provider = ContextProvider()
   print(f"Loading took {time.time() - start:.2f} seconds")
   ```

### High Memory Usage

**Problem**: Server consuming too much memory

**Solution**:
1. **Check for large context files**:
   ```bash
   find contexts/ -name "*.json" -size +100k
   ```

2. **Optimize context structure**:
   ```json
   // MEMORY HEAVY - large embedded data
   {
     "large_lookup_table": {
       "item1": "data1",
       "item2": "data2"
       // ... thousands of items
     }
   }
   
   // MEMORY EFFICIENT - reference external data
   {
     "lookup_table_file": "data/lookup.json"
   }
   ```

### Slow Regex Processing

**Problem**: Auto-corrections taking too long

**Solution**:
1. **Optimize patterns**:
   ```python
   # SLOW - complex backtracking
   pattern = r"(.*?)(complex)+(.*?)pattern(.*?)"
   
   # FAST - specific, anchored patterns  
   pattern = r"^specific_text_to_replace$"
   ```

2. **Limit text processing**:
   ```python
   # Add size limits to prevent processing huge texts
   if len(text) > 10000:
       return text  # Skip processing for large texts
   ```

## Debugging Techniques

### Enable Debug Logging

**Environment variable**:
```bash
export DEBUG_MODE=true
python context_provider_server.py
```

**Configuration**:
```json
{
  "env": {
    "DEBUG_MODE": "true"
  }
}
```

### Manual Testing

**Test context loading**:
```python
#!/usr/bin/env python3
from context_provider_server import ContextProvider
import json

# Test loading
provider = ContextProvider()
print(f"Loaded {len(provider.contexts)} contexts")

# Test specific context
context = provider.get_tool_context("dokuwiki")
print(json.dumps(context, indent=2))

# Test auto-corrections
text = "# Header"
corrected = provider.apply_auto_corrections("dokuwiki", text)
print(f"'{text}' → '{corrected}'")
```

### MCP Tool Testing

**Test individual tools**:
```python
import asyncio
from context_provider_server import app

async def test_tools():
    # Test list_tools
    tools = await app.list_tools()
    print(f"Available tools: {[t.name for t in tools]}")
    
    # Test tool call
    result = await app.call_tool("list_available_contexts", {})
    print(f"Contexts: {result.content[0].text}")

# Run test
asyncio.run(test_tools())
```

### Log Analysis

**Common log patterns to look for**:

```bash
# Success patterns
grep "Loaded.*contexts" logs/
grep "Server ready" logs/

# Error patterns  
grep -i "error\|exception\|failed" logs/
grep -i "permission denied" logs/
grep -i "file not found" logs/

# Performance patterns
grep -i "timeout\|slow\|memory" logs/
```

### Network Issues

**Problem**: Server not communicating with Claude Desktop

**Solution**:
1. **Check STDIO communication**:
   ```python
   # Server uses STDIO, not network sockets
   # Should not have firewall issues
   ```

2. **Test process communication**:
   ```bash
   # Run server and test input/output
   echo '{"jsonrpc": "2.0", "method": "initialize", "id": 1}' | python context_provider_server.py
   ```

## Getting Help

### Information to Collect

Before seeking help, collect:

1. **System information**:
   ```bash
   python --version
   pip show mcp
   uname -a  # Linux/Mac
   systeminfo  # Windows
   ```

2. **Configuration**:
   ```bash
   # Sanitized config (remove credentials)
   cat claude_desktop_config.json
   ```

3. **Error logs**:
   ```bash
   # Recent errors from Claude Desktop logs
   # On Linux:
   tail -100 ~/.config/claude/logs/claude_desktop.log
   # On macOS:
   tail -100 ~/Library/Logs/Claude/claude_desktop.log
   ```

4. **Context files**:
   ```bash
   ls -la contexts/
   head -20 contexts/*.json
   ```

### Support Channels

- **GitHub Issues**: Report bugs with full system information
- **Documentation**: Check all guide files for solutions
- **Community**: Share troubleshooting experiences

### Quick Diagnostic Script

```python
#!/usr/bin/env python3
"""
Quick diagnostic script for MCP Context Provider
"""
import os
import json
import sys
from pathlib import Path

def diagnose():
    print("=== MCP Context Provider Diagnostic ===\n")
    
    # Check Python version
    print(f"Python version: {sys.version}")
    
    # Check MCP installation
    try:
        import mcp
        print("✓ MCP package installed")
    except ImportError:
        print("✗ MCP package not found - run 'pip install mcp'")
        return
    
    # Check context files
    contexts_dir = Path("./contexts")
    if contexts_dir.exists():
        print(f"✓ Contexts directory found")
        json_files = list(contexts_dir.glob("*.json"))
        print(f"✓ Found {len(json_files)} JSON files")
        
        for file in json_files:
            try:
                with open(file) as f:
                    json.load(f)
                print(f"  ✓ {file.name} - valid JSON")
            except json.JSONDecodeError as e:
                print(f"  ✗ {file.name} - invalid JSON: {e}")
    else:
        print("✗ Contexts directory not found")
    
    # Test server loading
    try:
        from context_provider_server import ContextProvider
        provider = ContextProvider()
        print(f"✓ Server loads successfully ({len(provider.contexts)} contexts)")
    except Exception as e:
        print(f"✗ Server loading failed: {e}")
    
    print("\n=== Diagnostic Complete ===")

if __name__ == "__main__":
    diagnose()
```

Save as `diagnose.py` and run with `python diagnose.py` for quick troubleshooting.