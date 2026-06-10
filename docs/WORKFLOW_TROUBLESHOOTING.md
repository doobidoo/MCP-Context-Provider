# CI Pipeline Troubleshooting Guide

> **Note:** This project has migrated from GitHub Actions to Codeberg/Woodpecker CI.
> The instructions below reference the old GitHub Actions setup. See `.woodpecker.yml` for the current CI configuration.

This guide provides comprehensive troubleshooting steps to ensure CI workflows run successfully in the MCP Context Provider repository.

## 🔍 Quick Diagnostic Commands

```bash
# Validate CI config
yamllint .woodpecker.yml

# Run tests locally
npm run lint && npm test
```

## 🛠️ Common Issues and Solutions

### 1. Woodpecker CI Failures (migration from GitHub Actions)

This project has migrated from GitHub Actions to Woodpecker CI (`.woodpecker.yml`).
The old `.github/workflows/` files are kept for reference only.

For Woodpecker CI issues, check:
- Woodpecker UI on Codeberg (https://codeberg.org/doobidoo/MCP-Context-Provider/ci)
- Pipeline logs for specific step failures
- Verify `.woodpecker.yml` syntax with `yamllint`

### 2. Missing Files During Build

**Symptoms:**
- `No such file or directory: test_build.py`
- Build artifacts not found
- Context files missing

**Root Cause:**
Files excluded by `.gitignore` or incorrect path references.

**Solution:**
1. Review `.gitignore` patterns:
   ```bash
   # Too broad - excludes needed files
   test_*.py

   # Better - specific exclusions
   test_server.py
   test_session_init.py
   ```

2. Verify file paths in workflow:
   ```bash
   ls -la scripts/  # Check if files exist
   git ls-files | grep test  # Check what's tracked
   ```

**Applied Fix:**
- ✅ Made `.gitignore` more specific
- ✅ Added `test_build.py` to repository

### 3. Package Naming Issues

**Symptoms:**
- `Package build failed - file not found: mcp-context-provider-1.8.0.dxt`
- DXT package created with wrong name

**Root Cause:**
Build script creates package with default name instead of versioned name.

**Solution:**
Update build script to use proper naming:

```python
def move_package_to_root(self, package_file: Path, version: str = None):
    """Move the built package to repository root with proper naming"""
    if version:
        dest_name = f"mcp-context-provider-{version}.dxt"
    else:
        dest_name = "mcp-context-provider.dxt"
    # ... rest of implementation
```

**Applied Fix:**
- ✅ Fixed `scripts/build_dxt.py` package naming
- ✅ Packages now correctly named with version

### 4. Workflow Not Triggering

**Symptoms:**
- Push tags but no workflow runs
- Expected workflow doesn't start

**Root Cause:**
- Incorrect trigger conditions
- Tag naming doesn't match pattern
- Workflow file syntax errors

**Solution:**
1. Verify trigger patterns:
   ```yaml
   on:
     push:
       tags:
         - 'v*'  # Matches v1.8.0, v2.0.0, etc.
   ```

2. Check tag format:
   ```bash
   git tag v1.8.0        # ✅ Correct
   git tag 1.8.0         # ❌ Won't trigger 'v*' pattern
   ```

3. Validate workflow syntax:
   ```bash
   python scripts/test_workflows.py
   ```

### 5. Environment Variable Issues

**Symptoms:**
- Context files not loading
- Server configuration errors
- Path-related failures

**Root Cause:**
Missing or incorrect environment variables in workflow.

**Solution:**
Ensure workflows set required environment variables:

```yaml
env:
  CONTEXT_CONFIG_DIR: contexts
  AUTO_LOAD_CONTEXTS: "true"
  PYTHONPATH: server
```

## 🔧 Workflow Validation Framework

### Automated Validation

Use the built-in validation script:

```bash
# Validate all workflows
python scripts/test_workflows.py --report

# Validate specific workflow
python scripts/test_workflows.py --workflow release.yml
```

### Manual Validation Checklist (for `.woodpecker.yml`)

1. **Step Configuration**
   - [ ] `image` specified for all steps
   - [ ] `commands` array with correct shell commands
   - [ ] `when` conditions for conditional steps (tag events, etc.)

2. **Trigger Configuration**
   - [ ] Appropriate `when.event` triggers defined (`push`, `pull_request`, `tag`)
   - [ ] Correct tag patterns for releases (`v*`)

3. **Security**
   - [ ] No hardcoded secrets or tokens
   - [ ] Environment variables from CI secrets

4. **File Dependencies**
   - [ ] All referenced files exist in repository
   - [ ] Build scripts executable and functional
   - [ ] Required dependencies installed

## 🚀 Best Practices for Reliable CI

### 1. Test Locally First

Before pushing:

```bash
# Run tests
npm run lint && npm test

# Check woodpecker config syntax
yamllint .woodpecker.yml
```

### 2. Handle Errors Gracefully

Always add cleanup steps and conditional execution:

```yaml
- name: Cleanup on failure
  when:
    status: failure
  commands:
    - rm -rf temp/
```

## 📋 CI Health Monitoring

### Regular Checks

1. **Monitor Pipeline Results**
   - Check Woodpecker CI dashboard on Codeberg
   - Review step logs for failures
   - Track flaky tests

### Metrics to Track

- Pipeline success rate (target: >95%)
- Build time (target: <5 minutes)
- Time to release (target: <10 minutes)

## 🆘 Emergency Procedures

### Pipeline Completely Broken

1. **Immediate Actions:**
   ```bash
   # Run tests locally
   npm run lint && npm test
   ```

2. **Root Cause Analysis:**
   ```bash
   # Check recent changes
   git log --oneline -10 .woodpecker.yml

   # Compare with working version
   git diff HEAD~1 .woodpecker.yml
   ```

3. **Recovery:**
   ```bash
   # Revert to working version
   git checkout HEAD~1 -- .woodpecker.yml

   # Test locally
   npm test
   git commit -m "fix: restore working CI config"
   ```

### Release Pipeline Blocked

1. **Manual Release Process:**
   ```bash
   # Build locally
   npm run build

   # Create release with tea CLI
   tea release create \
     --title "v2.0.0" \
     --tag v2.0.0
   ```

## 📞 Getting Help

### Internal Resources

- **CI Config**: `.woodpecker.yml`
- **Documentation**: `docs/guides/DEVELOPER_GUIDE.md`

### External Resources

- [Woodpecker CI Documentation](https://woodpecker-ci.org/docs/intro)
- [Codeberg CI Docs](https://docs.codeberg.org/ci/)

---

## Summary

This troubleshooting guide covers the most common workflow issues encountered in the MCP Context Provider repository. The implemented solutions include:

- ✅ **Permission fixes** in workflow files
- ✅ **Automated validation** with `test_workflows.py`
- ✅ **Build system fixes** for proper package naming
- ✅ **Comprehensive monitoring** and health checks

Regular use of the validation tools and following the best practices outlined here will ensure reliable, successful workflow execution.