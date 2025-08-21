# Changelog

All notable changes to the MCP Context Provider project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-08

### Added
- **DXT Package Distribution**: Complete Desktop Extension (DXT) installer for easy installation
  - Self-contained package with all Python dependencies bundled
  - Cross-platform support (Windows, macOS, Linux)
  - Automatic Claude Desktop configuration
  - Single-command installation: `dxt install mcp-context-provider-1.1.0.dxt`
- **Enhanced Documentation**: Updated README.md with DXT installation instructions
- **DXT Build System**: Added complete DXT directory structure and build process
- **Distribution Ready**: 18.6 MB compressed package (44.6 MB unpacked)

### Changed
- **Installation Methods**: Now supports both DXT (recommended) and manual installation
- **README Structure**: Reorganized with DXT installation as primary method
- **Package Metadata**: Updated manifest.json with comprehensive DXT schema compliance

### Technical Details
- Package size: 18.6 MB compressed, 44.6 MB unpacked
- Bundled dependencies: MCP SDK 1.13.0, Pydantic 2.11.7, and all required packages
- Platform compatibility: Python 3.8+ on Windows, macOS, Linux
- Installation time: < 30 seconds with DXT CLI

## [1.0.0] - 2025-01-08

### Added
- **Initial Release**: Complete MCP Context Provider implementation
- **Core Server**: Python MCP server with STDIO JSON-RPC protocol
- **Context System**: Tool-specific context rules and preferences
- **Auto-Corrections**: Regex-based syntax transformations
- **Persistent Context**: Survives Claude Desktop restarts and chat sessions

### Context Files
- **DokuWiki Context**: Markdown to DokuWiki syntax conversion
- **Terraform Context**: Resource naming conventions and best practices  
- **Azure Context**: Resource naming and compliance rules
- **Git Context**: Commit message conventions and workflow patterns
- **General Preferences**: Cross-tool preferences and standards

### MCP Tools
- `list_available_contexts`: List all loaded context configurations
- `get_context_rules`: Retrieve context rules for specific tool category
- `apply_auto_corrections`: Apply automatic syntax corrections to text
- `get_tool_preferences`: Get preferences for specific tool category

### Documentation
- **README.md**: Comprehensive installation and usage guide
- **CONTEXT_GUIDE.md**: Complete context file reference
- **DEVELOPER_GUIDE.md**: Guide for creating custom contexts
- **EXAMPLES.md**: Real-world usage examples  
- **TROUBLESHOOTING.md**: Common issues and solutions

### Technical Implementation
- **MCP Protocol**: Full compliance with MCP 1.9.4+ specification
- **Error Handling**: Robust error handling and validation
- **Extensibility**: Easy addition of new context files
- **Performance**: Fast startup and minimal resource usage
- **Security**: No hardcoded secrets or credentials

### Testing & Quality
- **Server Testing**: Comprehensive MCP server functionality tests
- **Context Validation**: All context files validated against schema
- **Integration Testing**: Verified with Claude Desktop integration
- **Documentation**: Complete documentation suite with examples

---

## Version History Summary

- **v1.1.0**: Added DXT package distribution and enhanced installation options
- **v1.0.0**: Initial release with core MCP server and context system

## Upgrade Notes

### From 1.0.0 to 1.1.0
- **Existing Users**: Can continue using manual installation method
- **New Users**: Recommended to use DXT installation for easier setup
- **No Breaking Changes**: All existing context files and configurations remain compatible
- **Enhanced Distribution**: DXT package provides better deployment and management options