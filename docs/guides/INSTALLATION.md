# Installation

Three installation methods are available. The automated script is recommended for most users.

## Option 1: Automated Installation (Recommended)

**macOS / Linux:**

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
./scripts/install.sh
```

**Windows:**

```powershell
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
.\scripts\install.bat
```

The script automatically builds the DXT package, creates a Python virtual environment, installs dependencies, and configures Claude Desktop.

## Option 2: Manual Installation from DXT

```bash
npm install -g @anthropic-ai/dxt
wget https://github.com/doobidoo/MCP-Context-Provider/raw/main/mcp-context-provider-1.8.4.dxt
dxt unpack mcp-context-provider-1.8.4.dxt ~/mcp-context-provider
cd ~/mcp-context-provider
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install mcp>=1.9.4
```

## Option 3: Installation from Source

```bash
git clone https://github.com/doobidoo/MCP-Context-Provider.git
cd MCP-Context-Provider
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Claude Desktop Configuration

Update your `claude_desktop_config.json`:

| Platform | Config Location |
|----------|----------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

**Virtual environment setup (recommended):**

```json
{
  "mcpServers": {
    "context-provider": {
      "command": "/path/to/mcp-context-provider/venv/bin/python",
      "args": ["/path/to/mcp-context-provider/context_provider_server.py"],
      "env": {
        "CONTEXT_CONFIG_DIR": "/path/to/mcp-context-provider/contexts",
        "AUTO_LOAD_CONTEXTS": "true"
      }
    }
  }
}
```

Replace `/path/to/mcp-context-provider` with your actual installation path.

## Verify Installation

```bash
python scripts/verify_install.py
```

Then restart Claude Desktop to load the MCP server.
