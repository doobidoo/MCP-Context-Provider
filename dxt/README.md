# DXT Package for MCP Context Provider

This directory contains the Desktop Extension (DXT) package structure for the MCP Context Provider.

## Package Contents

- `manifest.json` - DXT metadata and configuration
- `server/` - Python MCP server and bundled dependencies
- `contexts/` - Context configuration files
- `requirements.txt` - Dependency reference

## Building the Package

```bash
# From the dxt directory
dxt pack

# This creates: mcp-context-provider-1.0.0.dxt
```

## Package Information

- **Size**: ~18.6 MB (compressed)
- **Unpacked Size**: ~45 MB 
- **Dependencies**: All bundled (MCP SDK, Pydantic, etc.)
- **Platform**: Windows, macOS, Linux
- **Python**: 3.8+ required

## Installation

Users can install the package with:

```bash
dxt install mcp-context-provider-1.0.0.dxt
```

This automatically:
- Installs the MCP server with all dependencies
- Sets up context configurations  
- Registers with Claude Desktop

## Development Notes

The DXT package structure follows the standard DXT format with:
- Python entry point in `server/context_provider_server.py`
- Dependencies bundled in `server/lib/`
- Relative paths for context files
- Environment variables for configuration