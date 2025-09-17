#!/usr/bin/env python3
"""
GitHub Actions Workflow Testing and Validation Script

This script validates workflow files and provides testing capabilities
for ensuring workflows run successfully.
"""

import argparse
import json
import os
import subprocess
import sys
import yaml
from pathlib import Path
from typing import Dict, List, Any


class WorkflowValidator:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.workflows_dir = repo_root / ".github" / "workflows"

    def validate_workflow_syntax(self, workflow_file: Path) -> bool:
        """Validate YAML syntax of workflow file"""
        try:
            with open(workflow_file, "r") as f:
                yaml.safe_load(f)
            print(f"✅ Valid YAML syntax: {workflow_file.name}")
            return True
        except yaml.YAMLError as e:
            print(f"❌ Invalid YAML syntax in {workflow_file.name}: {e}")
            return False

    def check_required_permissions(self, workflow_file: Path) -> bool:
        """Check if workflow has required permissions"""
        with open(workflow_file, "r") as f:
            workflow = yaml.safe_load(f)

        workflow_name = workflow.get("name", workflow_file.name)
        permissions = workflow.get("permissions", {})

        if not permissions:
            print(f"⚠️  No permissions defined in {workflow_name}")
            return False

        # Check for common required permissions
        required_perms = {
            "release": ["contents: write"],
            "ci": ["contents: read", "checks: write"],
            "security": ["security-events: write"],
        }

        workflow_type = self._detect_workflow_type(workflow)
        if workflow_type in required_perms:
            missing_perms = []
            for perm in required_perms[workflow_type]:
                perm_name = perm.split(":")[0]
                if perm_name not in permissions:
                    missing_perms.append(perm)

            if missing_perms:
                print(f"⚠️  Missing permissions in {workflow_name}: {missing_perms}")
                return False

        print(f"✅ Permissions configured: {workflow_name}")
        return True

    def _detect_workflow_type(self, workflow: Dict[str, Any]) -> str:
        """Detect the type of workflow based on triggers and content"""
        triggers = workflow.get("on", {})
        name = workflow.get("name", "").lower()

        if "tags" in triggers or "release" in name:
            return "release"
        elif any(keyword in name for keyword in ["security", "scan", "codeql"]):
            return "security"
        else:
            return "ci"

    def validate_job_dependencies(self, workflow_file: Path) -> bool:
        """Validate job dependencies and structure"""
        with open(workflow_file, "r") as f:
            workflow = yaml.safe_load(f)

        jobs = workflow.get("jobs", {})
        if not jobs:
            print(f"❌ No jobs defined in {workflow_file.name}")
            return False

        for job_name, job_config in jobs.items():
            if not isinstance(job_config, dict):
                print(f"❌ Invalid job configuration: {job_name}")
                return False

            if "runs-on" not in job_config:
                print(f"❌ Missing 'runs-on' in job: {job_name}")
                return False

            steps = job_config.get("steps", [])
            if not steps:
                print(f"⚠️  No steps defined in job: {job_name}")

        print(f"✅ Job structure valid: {workflow_file.name}")
        return True

    def check_action_versions(self, workflow_file: Path) -> bool:
        """Check for outdated action versions"""
        with open(workflow_file, "r") as f:
            content = f.read()

        # Common actions and their recommended versions
        action_versions = {
            "actions/checkout@v3": "actions/checkout@v4",
            "actions/setup-python@v3": "actions/setup-python@v4",
            "actions/setup-node@v3": "actions/setup-node@v4",
        }

        outdated_actions = []
        for old_version, new_version in action_versions.items():
            if old_version in content:
                outdated_actions.append(f"{old_version} → {new_version}")

        if outdated_actions:
            print(f"⚠️  Outdated actions in {workflow_file.name}:")
            for action in outdated_actions:
                print(f"   {action}")
            return False

        print(f"✅ Action versions current: {workflow_file.name}")
        return True

    def validate_secrets_usage(self, workflow_file: Path) -> bool:
        """Validate proper secrets usage"""
        with open(workflow_file, "r") as f:
            content = f.read()

        # Check for hardcoded tokens or secrets
        security_issues = []

        if "ghp_" in content or "github_pat_" in content:
            security_issues.append("Potential hardcoded GitHub token")

        # Only flag if there are actual hardcoded values, not just the word "token" or "key"
        lines = content.split("\n")
        for line in lines:
            if (
                ":" in line
                and any(word in line.lower() for word in ["token", "key", "password"])
                and "${{ secrets." not in line
            ):
                # Check if it's an actual assignment with a value
                if "=" in line or ": " in line:
                    parts = line.split(":" if ": " in line else "=")
                    if (
                        len(parts) > 1
                        and parts[1].strip()
                        and not parts[1].strip().startswith("${{")
                    ):
                        security_issues.append(
                            f"Potential hardcoded credential in: {line.strip()}"
                        )

        if security_issues:
            print(f"🔒 Security concerns in {workflow_file.name}:")
            for issue in security_issues:
                print(f"   {issue}")
            return False

        print(f"✅ Secrets usage secure: {workflow_file.name}")
        return True

    def test_workflow_trigger_conditions(self, workflow_file: Path) -> bool:
        """Test workflow trigger conditions"""
        with open(workflow_file, "r") as f:
            workflow = yaml.safe_load(f)

        # Handle both 'on' key and potential string values
        triggers = workflow.get("on") or workflow.get(True) or {}

        # If triggers is a string, convert to dict
        if isinstance(triggers, str):
            triggers = {triggers: None}

        if not triggers:
            print(f"❌ No triggers defined in {workflow_file.name}")
            return False

        # Validate trigger syntax
        valid_triggers = [
            "push",
            "pull_request",
            "schedule",
            "workflow_dispatch",
            "release",
            "workflow_call",
        ]
        unusual_triggers = []

        for trigger in triggers:
            if trigger not in valid_triggers:
                unusual_triggers.append(trigger)

        if unusual_triggers:
            print(f"⚠️  Unusual triggers in {workflow_file.name}: {unusual_triggers}")

        print(f"✅ Triggers configured: {workflow_file.name} ({list(triggers.keys())})")
        return True

    def validate_all_workflows(self) -> Dict[str, bool]:
        """Validate all workflow files"""
        results = {}

        if not self.workflows_dir.exists():
            print(f"❌ Workflows directory not found: {self.workflows_dir}")
            return results

        workflow_files = list(self.workflows_dir.glob("*.yml")) + list(
            self.workflows_dir.glob("*.yaml")
        )

        if not workflow_files:
            print(f"❌ No workflow files found in {self.workflows_dir}")
            return results

        print(f"🔍 Validating {len(workflow_files)} workflow files...\n")

        for workflow_file in workflow_files:
            print(f"📝 Validating: {workflow_file.name}")

            checks = [
                self.validate_workflow_syntax(workflow_file),
                self.check_required_permissions(workflow_file),
                self.validate_job_dependencies(workflow_file),
                self.check_action_versions(workflow_file),
                self.validate_secrets_usage(workflow_file),
                self.test_workflow_trigger_conditions(workflow_file),
            ]

            results[workflow_file.name] = all(checks)
            status = "✅ PASS" if results[workflow_file.name] else "❌ FAIL"
            print(f"{status}: {workflow_file.name}\n")

        return results

    def generate_workflow_report(self, results: Dict[str, bool]) -> None:
        """Generate a comprehensive workflow validation report"""
        print("=" * 60)
        print("WORKFLOW VALIDATION REPORT")
        print("=" * 60)

        total_workflows = len(results)
        passed_workflows = sum(results.values())

        print(f"Total workflows: {total_workflows}")
        print(f"Passed validation: {passed_workflows}")
        print(f"Failed validation: {total_workflows - passed_workflows}")
        print(f"Success rate: {(passed_workflows / total_workflows * 100):.1f}%")

        if passed_workflows == total_workflows:
            print("\n🎉 All workflows passed validation!")
        else:
            print(
                f"\n⚠️  {total_workflows - passed_workflows} workflow(s) need attention:"
            )
            for workflow, passed in results.items():
                if not passed:
                    print(f"   - {workflow}")


def main():
    parser = argparse.ArgumentParser(description="Validate GitHub Actions workflows")
    parser.add_argument("--workflow", help="Validate specific workflow file")
    parser.add_argument(
        "--report", action="store_true", help="Generate detailed report"
    )

    args = parser.parse_args()

    # Determine repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent

    validator = WorkflowValidator(repo_root)

    try:
        if args.workflow:
            workflow_file = repo_root / ".github" / "workflows" / args.workflow
            if not workflow_file.exists():
                print(f"❌ Workflow file not found: {workflow_file}")
                return 1

            results = {args.workflow: validator.validate_workflow_syntax(workflow_file)}
        else:
            results = validator.validate_all_workflows()

        if args.report:
            validator.generate_workflow_report(results)

        # Exit with error if any workflow failed
        if not all(results.values()):
            return 1

        return 0

    except Exception as e:
        print(f"❌ Validation failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
