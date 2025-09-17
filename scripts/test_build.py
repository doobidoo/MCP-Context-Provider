#!/usr/bin/env python3
"""
Build Process Tester

Tests that the DXT build process works correctly without actually
creating the full package. Used for pre-commit validation.
"""

import json
import sys
import tempfile
import shutil
from pathlib import Path


def test_build_process():
    """Test the build process without creating final package"""
    print("🧪 Testing build process...")

    # Find repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent

    # Check required files exist
    server_file = repo_root / "context_provider_server.py"
    contexts_dir = repo_root / "contexts"
    build_script = repo_root / "scripts" / "build_dxt.py"

    if not server_file.exists():
        print(f"❌ Server file not found: {server_file}")
        return False

    if not contexts_dir.exists():
        print(f"❌ Contexts directory not found: {contexts_dir}")
        return False

    if not build_script.exists():
        print(f"❌ Build script not found: {build_script}")
        return False

    print("✅ Required files found")

    # Validate context files
    context_files = list(contexts_dir.glob("*.json"))
    if not context_files:
        print(f"❌ No context files found in: {contexts_dir}")
        return False

    print(f"✅ Found {len(context_files)} context files")

    # Test JSON syntax in all context files
    for context_file in context_files:
        try:
            with open(context_file, 'r', encoding='utf-8') as f:
                json.load(f)
            print(f"✅ Valid JSON: {context_file.name}")
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in {context_file.name}: {e}")
            return False

    # Test build script imports and basic functionality
    try:
        # Import the build script module
        import importlib.util
        import sys

        spec = importlib.util.spec_from_file_location("build_dxt", build_script)
        build_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(build_module)

        # Test DXTBuilder class instantiation
        builder = build_module.DXTBuilder(repo_root)
        print("✅ Build script imports successfully")

        # Test validation method
        if not builder.validate_source_files():
            print("❌ Source file validation failed")
            return False

        print("✅ Source file validation passed")

    except Exception as e:
        print(f"❌ Build script test failed: {e}")
        return False

    # Test creating temporary DXT structure
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        test_dxt_dir = temp_path / "dxt"

        try:
            # Create test DXT structure
            test_dxt_dir.mkdir()
            (test_dxt_dir / "server").mkdir()
            (test_dxt_dir / "contexts").mkdir()

            # Test copying files
            server_dest = test_dxt_dir / "server" / "context_provider_server.py"
            shutil.copy2(server_file, server_dest)

            for context_file in context_files:
                dest_file = test_dxt_dir / "contexts" / context_file.name
                shutil.copy2(context_file, dest_file)

            # Verify structure
            if not server_dest.exists():
                print("❌ Failed to copy server file")
                return False

            copied_contexts = list((test_dxt_dir / "contexts").glob("*.json"))
            if len(copied_contexts) != len(context_files):
                print(f"❌ Context file copy mismatch: {len(copied_contexts)} vs {len(context_files)}")
                return False

            print("✅ Test DXT structure created successfully")

        except Exception as e:
            print(f"❌ DXT structure test failed: {e}")
            return False

    print("✅ Build process test passed")
    return True


def main():
    """Main test function"""
    print("🔍 Testing DXT build process...")

    if test_build_process():
        print("✅ Build process test completed successfully")
        sys.exit(0)
    else:
        print("❌ Build process test failed")
        sys.exit(1)


if __name__ == "__main__":
    main()