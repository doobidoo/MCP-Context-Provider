# GitHub Actions Workflow Troubleshooting Guide

This guide provides comprehensive troubleshooting steps to ensure GitHub Actions workflows run successfully in the MCP Context Provider repository.

## 🔍 Quick Diagnostic Commands

```bash
# Validate all workflows
python scripts/test_workflows.py --report

# Check recent workflow runs
gh run list --limit=10

# View specific workflow run details
gh run view <run-id>

# View failed workflow logs
gh run view <run-id> --log-failed
```

## 🛠️ Common Issues and Solutions

### 1. Permission Errors (403 Forbidden)

**Symptoms:**
- `⚠️ GitHub release failed with status: 403`
- `Resource not accessible by integration`
- Release creation fails

**Root Cause:**
Missing or insufficient `GITHUB_TOKEN` permissions in workflow.

**Solution:**
Ensure workflows have proper permissions block:

```yaml
permissions:
  contents: write    # Required to create releases and upload assets
  actions: read      # Required to read workflow status
  checks: read       # Required to read check results
```

**Applied Fix:**
- ✅ Added permissions to `.github/workflows/release.yml`
- ✅ Added permissions to `.github/workflows/ci.yml`

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

### Manual Validation Checklist

1. **Permissions Block Present**
   - [ ] `contents: write` for releases
   - [ ] `actions: read` for workflow status
   - [ ] `checks: write` for CI results

2. **Trigger Configuration**
   - [ ] Appropriate triggers defined (`push`, `pull_request`, etc.)
   - [ ] Correct tag patterns for releases
   - [ ] Branch filters for CI

3. **Job Structure**
   - [ ] `runs-on` specified for all jobs
   - [ ] Required steps present
   - [ ] Action versions up to date

4. **Security**
   - [ ] No hardcoded secrets or tokens
   - [ ] Proper use of `${{ secrets.GITHUB_TOKEN }}`
   - [ ] Environment variables properly configured

5. **File Dependencies**
   - [ ] All referenced files exist in repository
   - [ ] Build scripts executable and functional
   - [ ] Required dependencies installed

## 🚀 Best Practices for Reliable Workflows

### 1. Use Explicit Permissions

Always define minimum required permissions:

```yaml
permissions:
  contents: write    # Only what you need
  actions: read      # Be specific
```

### 2. Version Pin Actions

Use specific action versions for reliability:

```yaml
- uses: actions/checkout@v4  # ✅ Pinned version
- uses: actions/checkout@main  # ❌ Unstable
```

### 3. Add Validation Steps

Include validation in workflows:

```yaml
- name: Validate workflows
  run: python scripts/test_workflows.py

- name: Validate build process
  run: python scripts/test_build.py
```

### 4. Handle Errors Gracefully

Add error handling and cleanup:

```yaml
- name: Cleanup on failure
  if: failure()
  run: |
    rm -f *.dxt
    rm -rf dxt/
```

### 5. Test Locally First

Before pushing tags:

```bash
# Test build process
python scripts/build_dxt.py --version 1.8.0

# Validate workflows
python scripts/test_workflows.py --report

# Check workflow syntax
yamllint .github/workflows/
```

## 📋 Workflow Health Monitoring

### Regular Checks

1. **Monthly Workflow Review**
   ```bash
   # Check recent workflow success rates
   gh run list --limit=20

   # Review failed runs
   gh run list --status=failure --limit=10
   ```

2. **Action Version Updates**
   ```bash
   # Check for outdated actions
   python scripts/test_workflows.py --report
   ```

3. **Permission Audits**
   ```bash
   # Review workflow permissions
   grep -r "permissions:" .github/workflows/
   ```

### Metrics to Track

- Workflow success rate (target: >95%)
- Build time (target: <5 minutes)
- Time to release (target: <10 minutes)
- Failed workflow recovery time

## 🆘 Emergency Procedures

### Workflow Completely Broken

1. **Immediate Actions:**
   ```bash
   # Disable automatic workflows
   gh workflow disable <workflow-name>

   # Create manual release
   gh release create v1.8.0 --generate-notes package.dxt
   ```

2. **Root Cause Analysis:**
   ```bash
   # Check recent changes
   git log --oneline -10 .github/workflows/

   # Compare with working version
   git show HEAD~1:.github/workflows/release.yml
   ```

3. **Recovery:**
   ```bash
   # Revert to working version
   git checkout HEAD~1 -- .github/workflows/

   # Test and commit fix
   python scripts/test_workflows.py --report
   git commit -m "fix: restore working workflow"
   ```

### Release Pipeline Blocked

1. **Manual Release Process:**
   ```bash
   # Build package locally
   python scripts/build_dxt.py --version 1.8.0

   # Create release manually
   gh release create v1.8.0 \\
     --title "Manual Release v1.8.0" \\
     --notes "Emergency manual release" \\
     mcp-context-provider-1.8.0.dxt
   ```

2. **Hotfix Workflow:**
   ```bash
   # Create hotfix branch
   git checkout -b hotfix/workflow-fix

   # Apply minimal fix
   # Test thoroughly
   # Fast-track review and merge
   ```

## 📞 Getting Help

### Internal Resources

- **Workflow Validation**: `python scripts/test_workflows.py --report`
- **Build Testing**: `python scripts/test_build.py`
- **Documentation**: `docs/guides/DEVELOPER_GUIDE.md`

### External Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Troubleshooting Workflows](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)

### Emergency Contacts

- Repository Maintainer: Check GitHub repository settings
- CI/CD Issues: Create issue with `workflow` label
- Security Concerns: Follow security policy guidelines

---

## Summary

This troubleshooting guide covers the most common workflow issues encountered in the MCP Context Provider repository. The implemented solutions include:

- ✅ **Permission fixes** in workflow files
- ✅ **Automated validation** with `test_workflows.py`
- ✅ **Build system fixes** for proper package naming
- ✅ **Comprehensive monitoring** and health checks

Regular use of the validation tools and following the best practices outlined here will ensure reliable, successful workflow execution.