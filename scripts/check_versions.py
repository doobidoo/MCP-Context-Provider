#!/usr/bin/env python3
"""
Version Consistency Checker

Ensures version numbers are consistent across all project files.
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional


def extract_version_from_package_json(repo_root: Path) -> Optional[str]:
    """Extract version from package.json"""
    package_file = repo_root / "package.json"
    if not package_file.exists():
        return None

    try:
        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("version")
    except Exception as e:
        print(f"❌ Error reading package.json: {e}")
        return None


def extract_version_from_build_script(repo_root: Path) -> Optional[str]:
    """Extract default version from build script"""
    build_script = repo_root / "scripts" / "build_dxt.py"
    if not build_script.exists():
        return None

    try:
        with open(build_script, "r", encoding="utf-8") as f:
            content = f.read()

        # Look for version patterns in the build script
        # Check for default version assignments
        version_patterns = [
            r'version\s*=\s*["\']([^"\']+)["\']',
            r'VERSION\s*=\s*["\']([^"\']+)["\']',
            r'default.*version.*["\']([^"\']+)["\']',
            r'version.*["\']([0-9]+\.[0-9]+\.[0-9]+)["\']',
        ]

        for pattern in version_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                return match.group(1)

        return None
    except Exception as e:
        print(f"❌ Error reading build script: {e}")
        return None


def extract_version_from_changelog(repo_root: Path) -> Optional[str]:
    """Extract latest version from CHANGELOG.md"""
    changelog_file = repo_root / "CHANGELOG.md"
    if not changelog_file.exists():
        return None

    try:
        with open(changelog_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Look for version patterns like [1.7.0] or ## [1.7.0]
        version_patterns = [
            r"##\s*\[([0-9]+\.[0-9]+\.[0-9]+)\]",
            r"\[([0-9]+\.[0-9]+\.[0-9]+)\]\s*-",
        ]

        for pattern in version_patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(1)

        return None
    except Exception as e:
        print(f"❌ Error reading CHANGELOG.md: {e}")
        return None


def check_version_consistency():
    """Check version consistency across all files"""
    print("🔍 Checking version consistency...")

    # Find repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent

    # Extract versions from different files
    versions = {}

    package_version = extract_version_from_package_json(repo_root)
    if package_version:
        versions["package.json"] = package_version
        print(f"📦 package.json: {package_version}")

    build_version = extract_version_from_build_script(repo_root)
    if build_version:
        versions["build_script"] = build_version
        print(f"🔨 build script: {build_version}")

    changelog_version = extract_version_from_changelog(repo_root)
    if changelog_version:
        versions["CHANGELOG.md"] = changelog_version
        print(f"📋 CHANGELOG.md: {changelog_version}")

    # Check if we found any versions
    if not versions:
        print("⚠️  No versions found in any files")
        return True  # Don't fail if no versions are found

    # Check consistency
    unique_versions = set(versions.values())
    if len(unique_versions) == 1:
        version = list(unique_versions)[0]
        print(f"✅ All versions are consistent: {version}")
        return True
    else:
        print("❌ Version inconsistency detected:")
        for file, version in versions.items():
            print(f"  • {file}: {version}")

        # Suggest the most common version or the package.json version
        if "package.json" in versions:
            suggested_version = versions["package.json"]
            print(
                f"\n💡 Suggestion: Update all files to match package.json version: {suggested_version}"
            )
        else:
            # Find most common version
            from collections import Counter

            version_counts = Counter(versions.values())
            suggested_version = version_counts.most_common(1)[0][0]
            print(f"\n💡 Suggestion: Update all files to version: {suggested_version}")

        return False


def main():
    """Main function"""
    if check_version_consistency():
        print("✅ Version consistency check passed")
        sys.exit(0)
    else:
        print("❌ Version consistency check failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
