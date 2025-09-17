#!/usr/bin/env python3
"""
Version Management Script

Automatically updates version numbers across all project files.
Supports semantic versioning (major.minor.patch).
"""

import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional


class VersionManager:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.files_to_update = {
            'package.json': self.update_package_json,
            'scripts/build_dxt.py': self.update_build_script,
            'CHANGELOG.md': self.update_changelog,
            'scripts/install.sh': self.update_install_script
        }

    def parse_version(self, version_str: str) -> tuple:
        """Parse semantic version string into (major, minor, patch)"""
        try:
            parts = version_str.split('.')
            if len(parts) != 3:
                raise ValueError("Version must be in format major.minor.patch")
            return (int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError as e:
            raise ValueError(f"Invalid version format '{version_str}': {e}")

    def format_version(self, major: int, minor: int, patch: int) -> str:
        """Format version tuple as string"""
        return f"{major}.{minor}.{patch}"

    def increment_version(self, current_version: str, bump_type: str) -> str:
        """Increment version based on bump type"""
        major, minor, patch = self.parse_version(current_version)

        if bump_type == 'major':
            major += 1
            minor = 0
            patch = 0
        elif bump_type == 'minor':
            minor += 1
            patch = 0
        elif bump_type == 'patch':
            patch += 1
        else:
            raise ValueError(f"Invalid bump type: {bump_type}")

        return self.format_version(major, minor, patch)

    def get_current_version(self) -> Optional[str]:
        """Get current version from package.json"""
        package_file = self.repo_root / 'package.json'
        if not package_file.exists():
            return None

        try:
            with open(package_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('version')
        except Exception as e:
            print(f"❌ Error reading package.json: {e}")
            return None

    def update_package_json(self, new_version: str) -> bool:
        """Update version in package.json"""
        package_file = self.repo_root / 'package.json'
        if not package_file.exists():
            print(f"⚠️  package.json not found, skipping")
            return True

        try:
            with open(package_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            old_version = data.get('version', 'unknown')
            data['version'] = new_version

            with open(package_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write('\n')  # Add final newline

            print(f"✅ package.json: {old_version} → {new_version}")
            return True

        except Exception as e:
            print(f"❌ Error updating package.json: {e}")
            return False

    def update_build_script(self, new_version: str) -> bool:
        """Update default version in build script"""
        build_script = self.repo_root / 'scripts' / 'build_dxt.py'
        if not build_script.exists():
            print(f"⚠️  build script not found, skipping")
            return True

        try:
            with open(build_script, 'r', encoding='utf-8') as f:
                content = f.read()

            # Look for version patterns and update them
            patterns = [
                (r'PACKAGE_VERSION\s*=\s*["\']([^"\']+)["\']', f'PACKAGE_VERSION = "{new_version}"'),
                (r'version\s*=\s*["\']([^"\']+)["\']', f'version = "{new_version}"'),
                (r'default.*["\']([0-9]+\.[0-9]+\.[0-9]+)["\']', f'default: "{new_version}"'),
            ]

            updated = False
            for pattern, replacement in patterns:
                if re.search(pattern, content):
                    old_content = content
                    content = re.sub(pattern, replacement, content)
                    if content != old_content:
                        updated = True
                        break

            if updated:
                with open(build_script, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ build script: Updated default version to {new_version}")
            else:
                print(f"⚠️  build script: No version pattern found to update")

            return True

        except Exception as e:
            print(f"❌ Error updating build script: {e}")
            return False

    def update_install_script(self, new_version: str) -> bool:
        """Update version in install script"""
        install_script = self.repo_root / 'scripts' / 'install.sh'
        if not install_script.exists():
            print(f"⚠️  install script not found, skipping")
            return True

        try:
            with open(install_script, 'r', encoding='utf-8') as f:
                content = f.read()

            # Update PACKAGE_VERSION variable
            pattern = r'PACKAGE_VERSION\s*=\s*["\']([^"\']+)["\']'
            replacement = f'PACKAGE_VERSION="{new_version}"'

            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)

                with open(install_script, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ install script: Updated version to {new_version}")
            else:
                print(f"⚠️  install script: No version pattern found")

            return True

        except Exception as e:
            print(f"❌ Error updating install script: {e}")
            return False

    def update_changelog(self, new_version: str) -> bool:
        """Add new version entry to changelog"""
        changelog_file = self.repo_root / 'CHANGELOG.md'
        if not changelog_file.exists():
            print(f"⚠️  CHANGELOG.md not found, skipping")
            return True

        try:
            with open(changelog_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the position to insert new version
            # Look for the first version entry and insert before it
            date_str = datetime.now().strftime('%Y-%m-%d')
            new_entry = f"""
## [{new_version}] - {date_str}

### Added
-

### Changed
-

### Fixed
-

"""

            # Find insertion point (after the header but before first version)
            lines = content.split('\n')
            insert_index = -1

            for i, line in enumerate(lines):
                if re.match(r'^##\s*\[.*\]', line):
                    insert_index = i
                    break

            if insert_index == -1:
                # No existing version entries, add after the header
                for i, line in enumerate(lines):
                    if line.startswith('# ') or line.startswith('## '):
                        # Skip headers, look for content start
                        continue
                    elif line.strip() == '':
                        continue
                    else:
                        insert_index = max(0, i - 1)
                        break

            if insert_index >= 0:
                lines.insert(insert_index, new_entry.strip())
                content = '\n'.join(lines)

                with open(changelog_file, 'w', encoding='utf-8') as f:
                    f.write(content)

                print(f"✅ CHANGELOG.md: Added entry for version {new_version}")
            else:
                print(f"⚠️  CHANGELOG.md: Could not find insertion point")

            return True

        except Exception as e:
            print(f"❌ Error updating CHANGELOG.md: {e}")
            return False

    def update_all_files(self, new_version: str) -> bool:
        """Update version in all relevant files"""
        print(f"🔄 Updating version to {new_version} in all files...")

        success = True
        for file_path, update_func in self.files_to_update.items():
            try:
                if not update_func(new_version):
                    success = False
            except Exception as e:
                print(f"❌ Error updating {file_path}: {e}")
                success = False

        return success

    def bump_version(self, bump_type: str) -> str:
        """Bump version and update all files"""
        current_version = self.get_current_version()
        if not current_version:
            raise ValueError("Could not determine current version from package.json")

        new_version = self.increment_version(current_version, bump_type)
        print(f"📦 Version bump: {current_version} → {new_version} ({bump_type})")

        if self.update_all_files(new_version):
            print(f"✅ Version successfully updated to {new_version}")
            return new_version
        else:
            raise RuntimeError("Failed to update some files")

    def set_version(self, version: str) -> str:
        """Set specific version and update all files"""
        # Validate version format
        self.parse_version(version)

        current_version = self.get_current_version()
        print(f"📦 Setting version: {current_version or 'unknown'} → {version}")

        if self.update_all_files(version):
            print(f"✅ Version successfully set to {version}")
            return version
        else:
            raise RuntimeError("Failed to update some files")


def main():
    parser = argparse.ArgumentParser(description="Manage project version across all files")
    parser.add_argument(
        'action',
        choices=['bump', 'set', 'show'],
        help="Action to perform"
    )
    parser.add_argument(
        'value',
        nargs='?',
        help="Bump type (major|minor|patch) for 'bump' or version string for 'set'"
    )

    args = parser.parse_args()

    # Find repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent

    version_manager = VersionManager(repo_root)

    try:
        if args.action == 'show':
            current_version = version_manager.get_current_version()
            if current_version:
                print(f"Current version: {current_version}")
            else:
                print("❌ Could not determine current version")
                sys.exit(1)

        elif args.action == 'bump':
            if not args.value:
                print("❌ Bump type required (major|minor|patch)")
                sys.exit(1)

            if args.value not in ['major', 'minor', 'patch']:
                print(f"❌ Invalid bump type: {args.value}")
                sys.exit(1)

            new_version = version_manager.bump_version(args.value)
            print(f"🏷️  Next steps:")
            print(f"   git add .")
            print(f"   git commit -m 'chore: bump version to {new_version}'")
            print(f"   git tag v{new_version}")

        elif args.action == 'set':
            if not args.value:
                print("❌ Version string required")
                sys.exit(1)

            new_version = version_manager.set_version(args.value)
            print(f"🏷️  Next steps:")
            print(f"   git add .")
            print(f"   git commit -m 'chore: set version to {new_version}'")
            print(f"   git tag v{new_version}")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()