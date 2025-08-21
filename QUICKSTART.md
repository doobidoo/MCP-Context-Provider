# Quick Start Guide

Get the MCP Context Provider running in 5 minutes with this step-by-step guide.

## Overview

The MCP Context Provider gives Claude persistent memory across chat sessions. Instead of losing context when you restart Claude Desktop, your tool preferences, syntax rules, and best practices persist automatically.

## Prerequisites

- **Python 3.8+** (check with `python --version`)
- **Claude Desktop** installed and working
- **Internet connection** for downloading dependencies

## Installation Methods

### 🚀 Option 1: Automated Installation (Recommended)

**For Linux/macOS/Unix:**
```bash
# One-line install
curl -sSL https://raw.githubusercontent.com/doobidoo/MCP-Context-Provider/main/install.sh | bash
```

**For Windows:**
```powershell
# Download and run installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/doobidoo/MCP-Context-Provider/main/install.bat" -OutFile "install.bat"
.\install.bat
```

**What it does:**
- ✅ Downloads the MCP Context Provider package
- ✅ Creates a Python virtual environment  
- ✅ Installs all dependencies
- ✅ Configures Claude Desktop automatically
- ✅ Verifies the installation

**Skip to Step 4** if using automated installation.

### 🔧 Option 2: Manual Installation

#### Step 1: Install Prerequisites

**Install DXT CLI:**
```bash
npm install -g @anthropic-ai/dxt
```

**Verify installation:**
```bash
dxt --version
python --version  # Should be 3.8+
```

#### Step 2: Download and Extract

```bash
# Download the DXT package
wget https://github.com/doobidoo/MCP-Context-Provider/raw/main/mcp-context-provider-1.1.0.dxt

# Extract to your preferred location
dxt unpack mcp-context-provider-1.1.0.dxt ~/mcp-context-provider
cd ~/mcp-context-provider
```

#### Step 3: Set Up Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate  # Linux/macOS
# OR
venv\Scripts\activate     # Windows

# Install dependencies
pip install mcp>=1.9.4
```

#### Step 4: Configure Claude Desktop

**Find your configuration file:**
- **Linux/macOS:** `~/.config/claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Add this configuration:**
```json
{
  "mcpServers": {
    "context-provider": {
      "command": "/home/user/mcp-context-provider/venv/bin/python",
      "args": ["/home/user/mcp-context-provider/server/context_provider_server.py"],
      "env": {
        "CONTEXT_CONFIG_DIR": "/home/user/mcp-context-provider/contexts",
        "AUTO_LOAD_CONTEXTS": "true"
      }
    }
  }
}
```

**Important:** Replace `/home/user/mcp-context-provider` with your actual installation path.

### Step 5: Verify Installation

**Run the verification script:**
```bash
cd ~/mcp-context-provider
python verify_install.py
```

**Expected output:**
```
✓ Python version: 3.11.5
✓ MCP package installed
✓ Contexts directory found
✓ Found 5 JSON files
✓ Server loads successfully (5 contexts)
=== Installation verified ===
```

### Step 6: Restart and Test

1. **Restart Claude Desktop** completely
2. **Start a new chat** in Claude Desktop
3. **Test the installation** by asking Claude:

```
Can you list available contexts using the MCP Context Provider?
```

**Expected response:** Claude should use the `list_available_contexts` tool and show:
- dokuwiki
- terraform  
- azure
- git
- general_preferences

## What You Get

Once installed, these tools are available in every Claude chat:

- **`list_available_contexts`** - See all loaded context categories
- **`get_context_rules`** - Get rules for specific tools (e.g., Terraform, Git)
- **`apply_auto_corrections`** - Auto-correct syntax (Markdown → DokuWiki)
- **`get_tool_preferences`** - Get your saved preferences for tools

## Example Usage

**Get Terraform naming rules:**
```
Get the context rules for terraform
```

**Auto-convert Markdown to DokuWiki:**
```
Apply auto-corrections to this markdown for dokuwiki:
# My Header
This is `code` and a [link](http://example.com)
```

**Check what contexts are available:**
```
List all available contexts
```

## Troubleshooting

### Installation Issues

**Problem:** `dxt: command not found`
```bash
# Install Node.js first, then:
npm install -g @anthropic-ai/dxt
```

**Problem:** `ModuleNotFoundError: No module named 'mcp'`
```bash
# Activate venv and install:
source venv/bin/activate
pip install mcp>=1.9.4
```

**Problem:** Context Provider not showing in Claude
1. Check Claude Desktop config file syntax with: `python -m json.tool claude_desktop_config.json`
2. Verify all file paths in config are absolute and correct
3. Restart Claude Desktop completely

### Quick Diagnostic

Run this to check your setup:
```bash
# Test server manually
cd ~/mcp-context-provider
source venv/bin/activate
python server/context_provider_server.py
# Should start without errors
```

### Reset Installation

If something goes wrong:
```bash
# Remove installation
rm -rf ~/mcp-context-provider

# Remove from Claude config  
# Edit ~/.config/claude/claude_desktop_config.json
# Remove the "context-provider" section

# Start over with fresh install
```

## Advanced Configuration

### Custom Context Location

Set a different context directory:
```json
{
  "env": {
    "CONTEXT_CONFIG_DIR": "/path/to/my/custom/contexts"
  }
}
```

### Debug Mode

Enable detailed logging:
```json
{
  "env": {
    "DEBUG_MODE": "true"
  }
}
```

### Multiple Environments

Use different contexts for different projects:
```json
{
  "mcpServers": {
    "context-provider-work": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/server/context_provider_server.py"],
      "env": {
        "CONTEXT_CONFIG_DIR": "/work/contexts"
      }
    },
    "context-provider-personal": {
      "command": "/path/to/venv/bin/python", 
      "args": ["/path/to/server/context_provider_server.py"],
      "env": {
        "CONTEXT_CONFIG_DIR": "/personal/contexts"
      }
    }
  }
}
```

## Next Steps

1. **Explore the context files** in the `contexts/` directory
2. **Customize existing contexts** or create new ones
3. **Read the [Context Guide](CONTEXT_GUIDE.md)** for advanced usage
4. **Check [Examples](EXAMPLES.md)** for real-world scenarios

## Getting Help

- **Installation issues:** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Context customization:** Read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)  
- **Bug reports:** Open an issue on [GitHub](https://github.com/doobidoo/MCP-Context-Provider/issues)

---

**That's it!** Your Claude Desktop now has persistent context that survives across all chat sessions. No more re-explaining your preferences every time you start a new conversation.