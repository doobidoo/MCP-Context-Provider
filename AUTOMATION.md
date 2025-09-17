# Build Automation Documentation

## Overview

The MCP Context Provider now includes comprehensive build automation to ensure code quality, consistent releases, and streamlined development workflows.

## Automation Components

### 1. GitHub Actions

#### Release Workflow (`.github/workflows/release.yml`)
- **Trigger**: Git tag creation (e.g., `git tag v1.8.0`)
- **Actions**:
  - Validates all source files and JSON syntax
  - Builds DXT package with correct version
  - Tests package integrity
  - Creates GitHub release with package attached
  - Generates comprehensive release notes

#### CI Workflow (`.github/workflows/ci.yml`)
- **Trigger**: Pull requests and pushes to main/develop
- **Actions**:
  - Multi-platform testing (Ubuntu, macOS, Windows)
  - Multi-Python version testing (3.8, 3.9, 3.10, 3.11)
  - Context file validation
  - Build process testing
  - Security scanning
  - Code quality checks

### 2. Pre-commit Hooks (`.pre-commit-config.yaml`)

Automatically run before each commit to ensure code quality:
- JSON validation and formatting
- Python code formatting with Black
- Context file structure validation
- Build process testing
- Version consistency checking

**Setup**:
```bash
pip install pre-commit
pre-commit install
```

### 3. Validation Scripts

#### Context Validation (`scripts/validate_contexts.py`)
- Validates JSON syntax in all context files
- Checks required fields (tool_category, description)
- Validates optional section structure
- Ensures semantic versioning in metadata

#### Build Testing (`scripts/test_build.py`)
- Tests build process without creating full package
- Validates source file accessibility
- Tests DXT structure creation
- Verifies file copying operations

#### Version Consistency (`scripts/check_versions.py`)
- Checks version consistency across:
  - `package.json`
  - `scripts/build_dxt.py`
  - `CHANGELOG.md`
  - `scripts/install.sh`

### 4. Version Management (`scripts/bump_version.py`)

Automated version management across all project files:

```bash
# Show current version
python scripts/bump_version.py show

# Bump patch version (1.7.0 → 1.7.1)
python scripts/bump_version.py bump patch

# Bump minor version (1.7.0 → 1.8.0)
python scripts/bump_version.py bump minor

# Bump major version (1.7.0 → 2.0.0)
python scripts/bump_version.py bump major

# Set specific version
python scripts/bump_version.py set 1.8.5
```

## Development Workflow

### Making Changes
1. **Edit source files** in repository root
2. **Pre-commit hooks** automatically validate changes
3. **Push to branch** triggers CI validation
4. **Create PR** runs full test suite

### Releasing New Version

#### Option 1: Using Version Script
```bash
# Bump version and update all files
python scripts/bump_version.py bump minor

# Commit changes
git add .
git commit -m "chore: bump version to 1.8.0"

# Create and push tag
git tag v1.8.0
git push origin main --tags
```

#### Option 2: Manual Process
```bash
# Create tag directly
git tag v1.8.0
git push origin --tags
```

Both methods trigger the automated release workflow.

### Pre-commit Hook Validation

When you commit, the following validations run automatically:
- ✅ JSON syntax validation
- ✅ JSON formatting (auto-fixes)
- ✅ Context structure validation
- ✅ Build process testing
- ✅ Version consistency check
- ✅ Python code formatting

## CI/CD Pipeline Stages

### Pull Request Validation
1. **Validation Stage**:
   - Context file structure validation
   - Build process testing
   - Version consistency checking
   - JSON syntax validation

2. **Build Test Stage**:
   - Full DXT package build test
   - Package unpack verification
   - Context file count validation

3. **Compatibility Stage**:
   - Multi-OS testing (Ubuntu, macOS, Windows)
   - Multi-Python testing (3.8, 3.9, 3.10, 3.11)
   - Cross-platform build validation

4. **Security Stage**:
   - Secret scanning with TruffleHog
   - Sensitive file detection
   - Security policy compliance

### Release Pipeline
1. **Source Validation**:
   - All source files accessible
   - JSON syntax validation
   - Context file structure validation

2. **Package Building**:
   - DXT package creation with version extraction
   - Package integrity verification
   - Content validation

3. **Testing**:
   - Package unpack testing
   - Structure verification
   - Context file counting

4. **Release Creation**:
   - GitHub release with package attachment
   - Automated release notes generation
   - Package registry information

## Quality Assurance Features

### Automated Validation
- **JSON Schema Validation**: All context files validated against structure requirements
- **Build Process Testing**: Ensures build system works before commits
- **Version Synchronization**: Prevents version drift across files
- **Security Scanning**: Detects potential security issues

### Multi-Platform Support
- **Cross-Platform Testing**: Ensures compatibility across Windows, macOS, Linux
- **Python Version Support**: Tests against Python 3.8+ requirements
- **Build System Compatibility**: Validates DXT CLI across platforms

### Code Quality
- **Python Formatting**: Automatic code formatting with Black
- **JSON Formatting**: Consistent JSON structure and indentation
- **Documentation Consistency**: Ensures all automation is documented

## Troubleshooting

### Common Issues

**Pre-commit hook failures**:
```bash
# Re-run hooks manually
pre-commit run --all-files

# Update hook repositories
pre-commit autoupdate
```

**Version inconsistency**:
```bash
# Check current versions
python scripts/check_versions.py

# Fix with version script
python scripts/bump_version.py set 1.7.0
```

**Build failures**:
```bash
# Test build process
python scripts/test_build.py

# Validate context files
python scripts/validate_contexts.py contexts/*.json
```

**CI/CD failures**:
- Check GitHub Actions logs
- Ensure all required files are committed
- Validate that DXT CLI is accessible
- Check Python version compatibility

## Benefits

✅ **Automated Quality Assurance**: Prevents broken commits and releases
✅ **Consistent Versioning**: Eliminates version drift across files
✅ **Streamlined Releases**: One command creates complete releases
✅ **Multi-Platform Validation**: Ensures compatibility across environments
✅ **Security Integration**: Automatic security scanning and validation
✅ **Developer Experience**: Clear feedback and automated fixing where possible

## Future Enhancements

Potential automation improvements:
- **Automated Documentation**: Generate docs from context files
- **Performance Testing**: Automated performance benchmarks
- **Integration Testing**: Full Claude Desktop integration tests
- **Dependency Management**: Automated dependency updates
- **Release Notifications**: Automated notification systems