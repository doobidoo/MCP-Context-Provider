# Build System Documentation

## Overview

The MCP Context Provider uses an automated build system to eliminate duplication and ensure consistency between source files and packaged distributions.

## Single Source of Truth

- **Source files**: Repository root (`context_provider_server.py`, `contexts/*.json`)
- **Build artifacts**: Generated `dxt/` directory (not version controlled)
- **Package output**: `mcp-context-provider-{version}.dxt`

## Build Process

### 1. Automated Build Script

```bash
python scripts/build_dxt.py [--version VERSION] [--clean]
```

**What it does:**
- Validates all source files (server script and context JSON files)
- Creates temporary `dxt/` directory structure
- Copies latest server and context files
- Generates DXT manifest with correct version
- Builds and packages the DXT file
- Cleans up build artifacts

### 2. Installation Script

```bash
./scripts/install.sh
```

**Updated workflow:**
- Builds package fresh from source (no downloads)
- Uses latest context provider server with dynamic loading
- Installs all 8 context files automatically
- Sets up virtual environment and dependencies

## Development Workflow

### Making Changes

1. **Edit source files** in repository root:
   - `context_provider_server.py` - Main server
   - `contexts/*.json` - Context configurations

2. **Test changes** locally:
   ```bash
   # Test server directly
   python context_provider_server.py

   # Or build and test package
   python scripts/build_dxt.py
   ```

3. **No manual copying required** - build script handles synchronization

### Version Management

- Update version in `scripts/build_dxt.py` or use `--version` flag
- Version is automatically applied to manifest and package name
- Consistent versioning across all components

### File Structure

```
MCP-Context-Provider/
├── context_provider_server.py     # ← Single source server
├── contexts/                      # ← Single source contexts
│   ├── azure_context.json
│   ├── git_context.json
│   └── ... (8 total)
├── scripts/
│   ├── build_dxt.py              # ← Automated builder
│   └── install.sh                # ← Updated installer
├── dxt/                          # ← Generated (gitignored)
│   ├── server/
│   ├── contexts/
│   └── manifest.json
└── mcp-context-provider-*.dxt    # ← Package output
```

## Benefits

- **No duplication**: Single source of truth for all files
- **No version drift**: Build script ensures synchronization
- **Automated packaging**: One command builds complete package
- **Clean repository**: Build artifacts not in version control
- **Dynamic loading**: Server discovers all context files automatically

## Migration Notes

- Old `/dxt/` directory removed from version control
- Existing installations should reinstall to get dynamic loading
- All 8 context files now included automatically
- Build system validates JSON syntax before packaging

## Build Validation

The build script performs comprehensive validation:

- ✅ Source file existence
- ✅ JSON syntax validation
- ✅ Server script functionality
- ✅ Complete file copying
- ✅ Package integrity

Any validation failure stops the build process with clear error messages.