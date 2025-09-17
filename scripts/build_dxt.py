#!/usr/bin/env python3
"""
Automated DXT Package Builder for MCP Context Provider

This script eliminates duplication by building the DXT package from
the single source of truth in the repository root.

Usage:
    python scripts/build_dxt.py [--clean] [--version VERSION]
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any
import tempfile


class DXTBuilder:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.dxt_dir = repo_root / "dxt"
        self.contexts_dir = repo_root / "contexts"
        self.server_file = repo_root / "context_provider_server.py"
        self.manifest_template = repo_root / "dxt_manifest_template.json"

    def clean_build_directory(self):
        """Remove existing DXT build directory"""
        if self.dxt_dir.exists():
            print(f"🧹 Cleaning existing build directory: {self.dxt_dir}")
            shutil.rmtree(self.dxt_dir)

    def validate_source_files(self) -> bool:
        """Validate that all required source files exist"""
        print("🔍 Validating source files...")

        # Check server file
        if not self.server_file.exists():
            print(f"❌ Server file not found: {self.server_file}")
            return False
        print(f"✅ Server file: {self.server_file}")

        # Check contexts directory
        if not self.contexts_dir.exists():
            print(f"❌ Contexts directory not found: {self.contexts_dir}")
            return False

        # Count context files
        context_files = list(self.contexts_dir.glob("*.json"))
        if not context_files:
            print(f"❌ No context files found in: {self.contexts_dir}")
            return False
        print(f"✅ Found {len(context_files)} context files")

        # Validate JSON syntax
        for context_file in context_files:
            try:
                with open(context_file, 'r') as f:
                    json.load(f)
                print(f"✅ Valid JSON: {context_file.name}")
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON in {context_file.name}: {e}")
                return False

        return True

    def create_dxt_structure(self):
        """Create the DXT directory structure"""
        print("📁 Creating DXT directory structure...")

        # Create directories
        self.dxt_dir.mkdir(exist_ok=True)
        (self.dxt_dir / "server").mkdir(exist_ok=True)
        (self.dxt_dir / "contexts").mkdir(exist_ok=True)

        print(f"✅ Created: {self.dxt_dir}")
        print(f"✅ Created: {self.dxt_dir / 'server'}")
        print(f"✅ Created: {self.dxt_dir / 'contexts'}")

    def copy_source_files(self):
        """Copy source files to DXT structure"""
        print("📋 Copying source files...")

        # Copy server file
        server_dest = self.dxt_dir / "server" / "context_provider_server.py"
        shutil.copy2(self.server_file, server_dest)
        print(f"✅ Copied server: {self.server_file} → {server_dest}")

        # Copy all context files
        context_files = list(self.contexts_dir.glob("*.json"))
        for context_file in context_files:
            dest_file = self.dxt_dir / "contexts" / context_file.name
            shutil.copy2(context_file, dest_file)
            print(f"✅ Copied context: {context_file.name}")

        print(f"✅ Copied {len(context_files)} context files")

    def create_manifest(self, version: str = None):
        """Create or update the DXT manifest"""
        print("📄 Creating DXT manifest...")

        # Read version from existing manifest if available, or use default
        if not version:
            existing_manifest = self.dxt_dir / "manifest.json"
            if existing_manifest.exists():
                try:
                    with open(existing_manifest, 'r') as f:
                        existing_data = json.load(f)
                        version = existing_data.get('version', '1.7.0')
                except:
                    version = "1.8.0"
            else:
                version = "1.8.0"

        # Use template if available, otherwise create basic manifest
        if self.manifest_template.exists():
            with open(self.manifest_template, 'r') as f:
                manifest_data = json.load(f)
        else:
            manifest_data = {
                "dxt_version": "0.1.0",
                "name": "mcp-context-provider",
                "display_name": "MCP Context Provider",
                "description": "MCP server providing persistent tool context across Claude Desktop sessions",
                "long_description": "The MCP Context Provider delivers persistent, tool-specific context rules and user preferences that survive chat session restarts in Claude Desktop. It provides auto-corrections, syntax transformations, and customizable preferences for tools like Terraform, Git, Azure, and DokuWiki, ensuring consistent behavior across all conversations.",
                "author": {
                    "name": "doobidoo",
                    "url": "https://github.com/doobidoo/MCP-Context-Provider"
                },
                "server": {
                    "type": "python",
                    "entry_point": "server/context_provider_server.py",
                    "mcp_config": {
                        "command": "python",
                        "args": ["server/context_provider_server.py"],
                        "env": {
                            "CONTEXT_CONFIG_DIR": "contexts",
                            "PYTHONPATH": "server/lib"
                        }
                    }
                },
                "tools": [
                    {
                        "name": "list_available_contexts",
                        "description": "List all available context configurations"
                    },
                    {
                        "name": "get_context_rules",
                        "description": "Get context rules for a specific tool category"
                    },
                    {
                        "name": "apply_auto_corrections",
                        "description": "Apply auto-corrections to text based on context rules"
                    },
                    {
                        "name": "get_tool_preferences",
                        "description": "Get preferences for a specific tool category"
                    }
                ],
                "keywords": [
                    "mcp",
                    "claude",
                    "context",
                    "tool-context",
                    "persistent",
                    "claude-desktop",
                    "terraform",
                    "git",
                    "azure",
                    "dokuwiki",
                    "preferences"
                ],
                "license": "MIT",
                "user_config": {
                    "context_config_dir": {
                        "type": "string",
                        "title": "Context Configuration Directory",
                        "description": "Directory path containing context JSON files (relative to extension root)",
                        "default": "contexts",
                        "required": False
                    }
                },
                "compatibility": {
                    "claude_desktop": ">=1.0.0",
                    "platforms": ["win32", "darwin", "linux"],
                    "runtimes": {
                        "python": ">=3.8"
                    }
                },
                "repository": {
                    "type": "git",
                    "url": "https://github.com/doobidoo/MCP-Context-Provider.git"
                }
            }

        # Update version
        manifest_data["version"] = version

        # Write manifest
        manifest_file = self.dxt_dir / "manifest.json"
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Created manifest: {manifest_file}")
        print(f"📦 Package version: {version}")

    def copy_additional_files(self):
        """Copy additional required files"""
        print("📋 Copying additional files...")

        # Copy requirements.txt
        requirements_src = self.repo_root / "requirements.txt"
        if requirements_src.exists():
            requirements_dest = self.dxt_dir / "requirements.txt"
            shutil.copy2(requirements_src, requirements_dest)
            print(f"✅ Copied: requirements.txt")
        else:
            # Create minimal requirements.txt
            requirements_dest = self.dxt_dir / "requirements.txt"
            with open(requirements_dest, 'w') as f:
                f.write("mcp>=1.9.4\n")
            print(f"✅ Created: requirements.txt")

        # Copy README for DXT if it exists
        readme_src = self.repo_root / "README.md"
        if readme_src.exists():
            readme_dest = self.dxt_dir / "README.md"
            # Create a shortened README for the package
            with open(readme_src, 'r') as f:
                readme_content = f.read()

            # Take first few sections only
            lines = readme_content.split('\n')
            package_readme = []
            for line in lines[:50]:  # First 50 lines should cover the basics
                package_readme.append(line)
                if line.startswith('##') and len(package_readme) > 20:
                    break

            with open(readme_dest, 'w') as f:
                f.write('\n'.join(package_readme))
            print(f"✅ Created package README")

    def build_package(self) -> Path:
        """Build the DXT package"""
        print("🔨 Building DXT package...")

        # Change to DXT directory and run dxt pack
        original_cwd = os.getcwd()
        try:
            os.chdir(self.dxt_dir)
            result = subprocess.run(['dxt', 'pack'], capture_output=True, text=True)

            if result.returncode != 0:
                print(f"❌ DXT pack failed:")
                print(f"STDOUT: {result.stdout}")
                print(f"STDERR: {result.stderr}")
                raise subprocess.CalledProcessError(result.returncode, 'dxt pack')

            print("✅ DXT package built successfully")
            print(result.stdout)

            # Find the created package file
            package_files = list(self.dxt_dir.glob("*.dxt"))
            if package_files:
                package_file = package_files[0]
                print(f"📦 Package created: {package_file}")
                return package_file
            else:
                raise FileNotFoundError("No .dxt file found after building")

        finally:
            os.chdir(original_cwd)

    def move_package_to_root(self, package_file: Path):
        """Move the built package to repository root"""
        dest_file = self.repo_root / package_file.name
        if dest_file.exists():
            dest_file.unlink()  # Remove existing package

        shutil.move(package_file, dest_file)
        print(f"✅ Package moved to: {dest_file}")
        return dest_file

    def build(self, clean: bool = True, version: str = None) -> Path:
        """Complete build process"""
        print("🚀 Starting DXT package build...")
        print(f"📁 Repository root: {self.repo_root}")

        # Clean if requested
        if clean:
            self.clean_build_directory()

        # Validate source files
        if not self.validate_source_files():
            raise ValueError("Source file validation failed")

        # Build process
        self.create_dxt_structure()
        self.copy_source_files()
        self.create_manifest(version)
        self.copy_additional_files()

        # Build package
        package_file = self.build_package()
        final_package = self.move_package_to_root(package_file)

        print(f"🎉 Build completed successfully!")
        print(f"📦 Package: {final_package}")
        print(f"📊 Package size: {final_package.stat().st_size / 1024:.1f} KB")

        return final_package


def main():
    parser = argparse.ArgumentParser(description="Build DXT package for MCP Context Provider")
    parser.add_argument("--clean", action="store_true", help="Clean build directory before building")
    parser.add_argument("--version", help="Package version (default: auto-detect or 1.7.0)")
    parser.add_argument("--no-clean", action="store_true", help="Don't clean build directory")

    args = parser.parse_args()

    # Determine repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent

    try:
        # Build the package
        builder = DXTBuilder(repo_root)
        package_file = builder.build(
            clean=not args.no_clean if args.no_clean else True,
            version=args.version
        )

        print(f"\n✅ SUCCESS: DXT package built at {package_file}")
        return 0

    except Exception as e:
        print(f"\n❌ BUILD FAILED: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())