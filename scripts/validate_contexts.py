#!/usr/bin/env python3
"""
Context File Structure Validator

Validates that context JSON files follow the expected structure
and contain required fields.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any


def validate_context_structure(file_path: Path) -> List[str]:
    """Validate a single context file structure"""
    errors = []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"Invalid JSON syntax: {e}"]
    except Exception as e:
        return [f"Failed to read file: {e}"]

    # Required fields
    required_fields = ["tool_category", "description"]
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
        elif not isinstance(data[field], str):
            errors.append(f"Field '{field}' must be a string")

    # Validate tool_category format
    if "tool_category" in data:
        tool_category = data["tool_category"]
        if not tool_category.replace("_", "").replace("-", "").isalnum():
            errors.append(
                "tool_category should contain only alphanumeric characters, underscores, and hyphens"
            )

    # Validate optional sections structure
    optional_sections = {
        "syntax_rules": dict,
        "preferences": dict,
        "auto_corrections": dict,
        "session_initialization": dict,
        "auto_store_triggers": dict,
        "auto_retrieve_triggers": dict,
        "metadata": dict,
    }

    for section, expected_type in optional_sections.items():
        if section in data and not isinstance(data[section], expected_type):
            errors.append(f"Section '{section}' must be a {expected_type.__name__}")

    # Validate metadata structure if present
    if "metadata" in data:
        metadata = data["metadata"]
        if "version" in metadata:
            version = metadata["version"]
            if not isinstance(version, str):
                errors.append("metadata.version must be a string")
            elif not version.count(".") >= 2:
                errors.append(
                    "metadata.version should follow semantic versioning (x.y.z)"
                )

    # Validate session_initialization structure
    if "session_initialization" in data:
        session_init = data["session_initialization"]
        if "enabled" in session_init and not isinstance(session_init["enabled"], bool):
            errors.append("session_initialization.enabled must be a boolean")

        if "actions" in session_init:
            actions = session_init["actions"]
            if not isinstance(actions, dict):
                errors.append("session_initialization.actions must be a dictionary")
            elif "on_startup" in actions:
                on_startup = actions["on_startup"]
                if not isinstance(on_startup, list):
                    errors.append(
                        "session_initialization.actions.on_startup must be a list"
                    )
                else:
                    for i, action in enumerate(on_startup):
                        if not isinstance(action, dict):
                            errors.append(
                                f"session_initialization.actions.on_startup[{i}] must be a dictionary"
                            )
                        elif "action" not in action:
                            errors.append(
                                f"session_initialization.actions.on_startup[{i}] must have 'action' field"
                            )

    return errors


def main():
    """Main validation function"""
    if len(sys.argv) < 2:
        print("Usage: python validate_contexts.py <context_file1> [context_file2] ...")
        sys.exit(1)

    total_errors = 0

    for file_path_str in sys.argv[1:]:
        file_path = Path(file_path_str)

        if not file_path.exists():
            print(f"[ERROR] File not found: {file_path}")
            total_errors += 1
            continue

        if not file_path.name.endswith(".json"):
            print(f"[WARN] Skipping non-JSON file: {file_path}")
            continue

        print(f"[INFO] Validating: {file_path}")
        errors = validate_context_structure(file_path)

        if errors:
            print(f"[ERROR] {file_path}: {len(errors)} error(s)")
            for error in errors:
                print(f"  - {error}")
            total_errors += len(errors)
        else:
            print(f"[OK] {file_path}: Valid")

    if total_errors > 0:
        print(f"\n[FAIL] Validation failed: {total_errors} error(s) found")
        sys.exit(1)
    else:
        print(f"\n[PASS] All context files validated successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
