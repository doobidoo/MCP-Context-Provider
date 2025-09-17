# Changelog

All notable changes to the MCP Context Provider project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-09-17

### Fixed
- **macOS Configuration Path Issue**: Fixed incorrect Claude Desktop configuration path detection
  - `install.sh`: Added proper macOS detection using `$OSTYPE` to use `~/Library/Application Support/Claude/` instead of `~/.config/claude/`
  - `verify_install.py`: Updated `find_claude_config()` function to use correct macOS path
  - Updated error messages to show platform-specific paths for better troubleshooting

### Changed
- **Documentation Updates**: Corrected macOS paths throughout documentation
  - `README.md`: Separated Linux/macOS configuration file locations
  - `QUICKSTART.md`: Updated configuration paths and uninstall instructions
  - `TROUBLESHOOTING.md`: Fixed all references to use platform-specific paths for config files and logs
- **Version References**: Updated all package references from 1.1.0 to 1.2.1

### Technical Details
- The installation scripts now correctly detect macOS and place configuration files in the proper location that Claude Desktop actually uses
- Windows and Linux path detection were already correct and remain unchanged
- This resolves the issue where the installer would create config files in the wrong location on macOS systems

## [1.2.0] - 2025-08-21

### Fixed
- **Issue #1**: DXT Package Installation Not Working as Documented
  - Removed references to non-existent `dxt install` command
  - Fixed bundled dependencies compatibility issues with Python 3.13+
  - Added proper virtual environment-based installation approach

### Added
- **Automated Installation Scripts**: Cross-platform installation automation
  - `install.sh`: Unix/Linux/macOS automated installer with error handling
  - `install.bat`: Windows automated installer with proper path handling
- **Installation Verification**: `verify_install.py` script for comprehensive installation checks
- **Quick Start Guide**: `QUICKSTART.md` with step-by-step installation instructions
- **Enhanced Documentation**: 
  - Updated README.md with accurate installation methods
  - Added platform-specific installation instructions
  - Improved troubleshooting documentation

### Changed
- **Installation Process**: Now uses virtual environment approach instead of bundled dependencies
- **Documentation Structure**: Reorganized installation options with automated scripts as primary method
- **DXT Package Usage**: Updated to use `dxt unpack` instead of non-existent `dxt install`

### Technical Improvements
- **Error Handling**: Comprehensive error detection and reporting in installation scripts
- **Cross-Platform Support**: Proper path handling for Windows, macOS, and Linux
- **Installation Verification**: Automated checks for Python version, dependencies, and configuration
- **User Experience**: Clear progress indicators and helpful error messages

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

- **v1.2.0**: Fixed DXT installation issues and added automated installation scripts
- **v1.1.0**: Added DXT package distribution and enhanced installation options
- **v1.0.0**: Initial release with core MCP server and context system

## Upgrade Notes

### From 1.1.0 to 1.2.0
- **Breaking Change**: DXT bundled dependencies no longer recommended due to Python 3.13+ compatibility
- **Migration**: Use new automated installation scripts or manual virtual environment setup
- **Benefits**: More reliable installation across different Python versions and Linux distributions
- **No Context Changes**: All existing context files and server functionality remain identical

### From 1.0.0 to 1.1.0
- **Existing Users**: Can continue using manual installation method
- **New Users**: Recommended to use DXT installation for easier setup
- **No Breaking Changes**: All existing context files and configurations remain compatible
- **Enhanced Distribution**: DXT package provides better deployment and management options