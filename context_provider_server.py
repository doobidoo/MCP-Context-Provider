#!/usr/bin/env python3
"""
Context-Provider MCP Server
Provides tool-specific context rules and user preferences
Persistent across Claude Desktop chat sessions
"""

import asyncio
import json
import os
import sys
import time
import re
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    ServerCapabilities
)

class ContextProvider:
    """
    Static context provider for Claude Desktop
    Loads and serves tool-specific rules and preferences
    Supports session initialization with memory service integration
    """

    def __init__(self, config_dir: str = None):
        if config_dir is None:
            config_dir = os.getenv('CONTEXT_CONFIG_DIR', './contexts')
        self.config_dir = Path(config_dir)
        self.contexts = {}
        self.session_status = {
            'initialized': False,
            'initialization_time': None,
            'executed_actions': [],
            'errors': [],
            'memory_retrieval_results': {}
        }
        self.load_all_contexts()
    
    @classmethod
    def get_instance(cls) -> 'ContextProvider':
        """Get singleton instance of ContextProvider"""
        if not hasattr(cls, '_instance'):
            cls._instance = cls()
        return cls._instance
    
    def load_all_contexts(self):
        """Load all context files at startup"""
        # Check if auto-loading is enabled
        auto_load = os.getenv('AUTO_LOAD_CONTEXTS', 'true').lower() == 'true'

        if not auto_load:
            print("Auto-loading of contexts is disabled", file=sys.stderr)
            return

        if not self.config_dir.exists():
            print(f"Context directory does not exist: {self.config_dir}", file=sys.stderr)
            return

        # Dynamically discover all JSON context files
        context_files = []

        # Look for *_context.json files first (preferred pattern)
        context_files.extend(self.config_dir.glob("*_context.json"))

        # Also look for other .json files that might be contexts
        for json_file in self.config_dir.glob("*.json"):
            if json_file not in context_files:
                context_files.append(json_file)

        print(f"Discovered {len(context_files)} context files", file=sys.stderr)

        for file_path in context_files:
            try:
                # Extract context name from filename
                if file_path.name.endswith("_context.json"):
                    context_name = file_path.name.replace("_context.json", "")
                elif file_path.name.endswith(".json"):
                    context_name = file_path.name.replace(".json", "")
                else:
                    continue

                self.contexts[context_name] = self.load_context_file(file_path)
                print(f"Loaded context: {context_name}", file=sys.stderr)
            except Exception as e:
                print(f"Error loading context file {file_path.name}: {e}", file=sys.stderr)
    
    def load_context_file(self, file_path: Path) -> Dict[str, Any]:
        """Load individual context file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading context file {file_path}: {e}", file=sys.stderr)
            return {}
    
    def get_tool_context(self, tool_name: str) -> Dict[str, Any]:
        """Get context rules for specific tool"""
        # Extract tool category from name (e.g., "dokuwiki:core_savePage" -> "dokuwiki")
        tool_category = tool_name.split(':')[0] if ':' in tool_name else tool_name
        
        return self.contexts.get(tool_category, {})
    
    def get_syntax_rules(self, tool_name: str) -> Dict[str, Any]:
        """Get syntax rules for specific tool"""
        context = self.get_tool_context(tool_name)
        return context.get('syntax_rules', {})
    
    def get_preferences(self, tool_name: str) -> Dict[str, Any]:
        """Get user preferences for specific tool"""
        context = self.get_tool_context(tool_name)
        return context.get('preferences', {})
    
    def should_auto_convert(self, tool_name: str) -> bool:
        """Check if auto-conversion should be applied"""
        context = self.get_tool_context(tool_name)
        return context.get('auto_convert', False)
    
    def apply_auto_corrections(self, tool_name: str, text: str) -> str:
        """Apply auto-corrections based on tool context"""
        import re
        
        context = self.get_tool_context(tool_name)
        auto_corrections = context.get('auto_corrections', {})
        
        corrected_text = text
        for correction_name, correction_rule in auto_corrections.items():
            if 'pattern' in correction_rule and 'replacement' in correction_rule:
                try:
                    pattern = correction_rule['pattern']
                    replacement = correction_rule['replacement']
                    corrected_text = re.sub(pattern, replacement, corrected_text, flags=re.MULTILINE)
                except re.error as e:
                    print(f"Error in regex pattern {correction_name}: {e}", file=sys.stderr)
                    continue
        
        return corrected_text

    async def execute_session_initialization(self) -> Dict[str, Any]:
        """Execute session initialization actions from all contexts"""
        start_time = time.time()
        self.session_status = {
            'initialized': False,
            'initialization_time': datetime.now().isoformat(),
            'executed_actions': [],
            'errors': [],
            'memory_retrieval_results': {}
        }

        print("Starting session initialization...", file=sys.stderr)

        # Find all contexts with session_initialization enabled
        initialized_contexts = []
        for context_name, context_data in self.contexts.items():
            session_init = context_data.get('session_initialization', {})
            if session_init.get('enabled', False):
                initialized_contexts.append(context_name)
                await self._execute_context_initialization(context_name, context_data)

        # Calculate execution time
        execution_time = time.time() - start_time
        self.session_status['execution_time_seconds'] = execution_time
        self.session_status['initialized'] = True
        self.session_status['initialized_contexts'] = initialized_contexts

        print(f"Session initialization completed in {execution_time:.2f}s", file=sys.stderr)
        return self.session_status

    async def _execute_context_initialization(self, context_name: str, context_data: Dict[str, Any]):
        """Execute initialization actions for a specific context"""
        session_init = context_data.get('session_initialization', {})
        actions = session_init.get('actions', {})
        on_startup = actions.get('on_startup', [])

        for action_config in on_startup:
            try:
                action_type = action_config.get('action')
                parameters = action_config.get('parameters', {})
                description = action_config.get('description', f"Execute {action_type}")

                print(f"Executing {action_type} for {context_name}: {description}", file=sys.stderr)

                # For now, we'll simulate memory service calls
                # In production, these would be actual calls to mcp-memory-service
                result = await self._simulate_memory_action(action_type, parameters)

                self.session_status['executed_actions'].append({
                    'context': context_name,
                    'action': action_type,
                    'description': description,
                    'parameters': parameters,
                    'result_summary': result.get('summary', 'No summary available'),
                    'status': 'success'
                })

                # Store memory retrieval results
                if action_type in ['recall_memory', 'search_by_tag']:
                    self.session_status['memory_retrieval_results'][f"{context_name}_{action_type}"] = result

            except Exception as e:
                error_msg = f"Error executing {action_config.get('action', 'unknown')} for {context_name}: {str(e)}"
                print(error_msg, file=sys.stderr)
                self.session_status['errors'].append(error_msg)

    async def _simulate_memory_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate memory service actions - replace with actual memory service calls"""
        # This is a placeholder for actual memory service integration
        # In production, this would make HTTP requests or MCP calls to memory service

        if action_type == 'recall_memory':
            query = parameters.get('query', '')
            n_results = parameters.get('n_results', 5)
            return {
                'action': 'recall_memory',
                'query': query,
                'results_count': n_results,
                'summary': f"Retrieved {n_results} memories matching '{query}'"
            }

        elif action_type == 'search_by_tag':
            tags = parameters.get('tags', [])
            return {
                'action': 'search_by_tag',
                'tags': tags,
                'results_count': len(tags) * 2,  # Simulated
                'summary': f"Found items with tags: {', '.join(tags)}"
            }

        else:
            return {
                'action': action_type,
                'parameters': parameters,
                'summary': f"Executed {action_type} with parameters {parameters}"
            }

    def get_session_status(self) -> Dict[str, Any]:
        """Get current session initialization status"""
        return self.session_status.copy()

    def has_session_initialization_contexts(self) -> bool:
        """Check if any loaded contexts have session initialization enabled"""
        for context_data in self.contexts.values():
            session_init = context_data.get('session_initialization', {})
            if session_init.get('enabled', False):
                return True
        return False

    # Dynamic Context Management Methods

    def _validate_context_name(self, name: str) -> bool:
        """Validate context name for security and compatibility"""
        # Only allow alphanumeric, underscore, and hyphen
        pattern = r'^[a-zA-Z0-9_-]+$'
        if not re.match(pattern, name):
            return False

        # Check length limits
        if len(name) < 1 or len(name) > 50:
            return False

        # Avoid reserved names
        reserved_names = ['system', 'admin', 'config', 'server']
        if name.lower() in reserved_names:
            return False

        return True

    def _validate_context_data(self, context_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Validate context data structure and return validation results"""
        errors = []
        warnings = []

        # Required fields
        required_fields = ['tool_category', 'description']
        for field in required_fields:
            if field not in context_data:
                errors.append(f"Missing required field: {field}")

        # Validate tool_category
        if 'tool_category' in context_data:
            if not isinstance(context_data['tool_category'], str):
                errors.append("tool_category must be a string")
            elif not self._validate_context_name(context_data['tool_category']):
                errors.append("tool_category contains invalid characters")

        # Validate description
        if 'description' in context_data:
            if not isinstance(context_data['description'], str):
                errors.append("description must be a string")
            elif len(context_data['description']) > 500:
                warnings.append("description is very long (>500 characters)")

        # Validate optional sections
        optional_sections = ['syntax_rules', 'preferences', 'auto_corrections', 'session_initialization']
        for section in optional_sections:
            if section in context_data and not isinstance(context_data[section], dict):
                errors.append(f"{section} must be a dictionary")

        # Validate metadata if present
        if 'metadata' in context_data:
            metadata = context_data['metadata']
            if not isinstance(metadata, dict):
                errors.append("metadata must be a dictionary")
            else:
                # Check version format
                if 'version' in metadata:
                    version_pattern = r'^\d+\.\d+\.\d+$'
                    if not re.match(version_pattern, str(metadata['version'])):
                        warnings.append("version should follow semantic versioning (x.y.z)")

        return {'errors': errors, 'warnings': warnings}

    def _backup_context_file(self, context_name: str) -> Optional[Path]:
        """Create a backup of existing context file"""
        context_file = self.config_dir / f"{context_name}_context.json"
        if not context_file.exists():
            return None

        # Create backup directory if it doesn't exist
        backup_dir = self.config_dir / 'backups'
        backup_dir.mkdir(exist_ok=True)

        # Create timestamped backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = backup_dir / f"{context_name}_context_{timestamp}.json"

        try:
            shutil.copy2(context_file, backup_file)
            return backup_file
        except Exception as e:
            print(f"Warning: Could not create backup for {context_name}: {e}", file=sys.stderr)
            return None

    def create_context_file(self, name: str, category: str, rules: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new context file dynamically"""
        # Validate input
        if not self._validate_context_name(name):
            return {
                'success': False,
                'error': 'Invalid context name. Use only alphanumeric characters, underscores, and hyphens.',
                'context_name': name
            }

        if not self._validate_context_name(category):
            return {
                'success': False,
                'error': 'Invalid category name. Use only alphanumeric characters, underscores, and hyphens.',
                'context_name': name
            }

        # Check if context already exists
        context_file = self.config_dir / f"{name}_context.json"
        if context_file.exists():
            return {
                'success': False,
                'error': f'Context file {name}_context.json already exists. Use update_context_rules to modify it.',
                'context_name': name,
                'existing_file': str(context_file)
            }

        # Build context structure - only add description if provided in rules
        context_data = {
            'tool_category': category,
            'auto_convert': rules.get('auto_convert', False),
            'metadata': {
                'version': '1.0.0',
                'last_updated': datetime.now().isoformat(),
                'created_by': 'dynamic_context_management',
                'applies_to_tools': rules.get('applies_to_tools', [f'{category}:*']),
                'priority': rules.get('priority', 'medium')
            }
        }

        # Add description if provided, otherwise use default
        if 'description' in rules:
            context_data['description'] = rules['description']
        else:
            context_data['description'] = f'Dynamically created context for {category}'

        # Add optional sections from rules
        optional_sections = ['syntax_rules', 'preferences', 'auto_corrections', 'session_initialization']
        for section in optional_sections:
            if section in rules:
                context_data[section] = rules[section]

        # Validate the complete context data
        validation = self._validate_context_data(context_data)
        if validation['errors']:
            return {
                'success': False,
                'error': 'Context data validation failed',
                'validation_errors': validation['errors'],
                'context_name': name
            }

        try:
            # Write context file
            with open(context_file, 'w', encoding='utf-8') as f:
                json.dump(context_data, f, indent=2, ensure_ascii=False)

            # Reload contexts to include the new one
            self.contexts[name] = context_data

            result = {
                'success': True,
                'message': f'Context file {name}_context.json created successfully',
                'context_name': name,
                'context_file': str(context_file),
                'context_data': context_data
            }

            if validation['warnings']:
                result['warnings'] = validation['warnings']

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create context file: {str(e)}',
                'context_name': name
            }

    def update_context_rules(self, context_name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing context rules"""
        # Validate context name
        if not self._validate_context_name(context_name):
            return {
                'success': False,
                'error': 'Invalid context name',
                'context_name': context_name
            }

        # Check if context exists
        if context_name not in self.contexts:
            return {
                'success': False,
                'error': f'Context {context_name} not found. Use create_context_file to create it first.',
                'context_name': context_name,
                'available_contexts': list(self.contexts.keys())
            }

        try:
            # Create backup
            backup_file = self._backup_context_file(context_name)

            # Get current context data
            current_data = self.contexts[context_name].copy()

            # Apply updates
            for key, value in updates.items():
                if key == 'metadata':
                    # Special handling for metadata - merge instead of replace
                    if 'metadata' not in current_data:
                        current_data['metadata'] = {}
                    current_data['metadata'].update(value)
                    current_data['metadata']['last_updated'] = datetime.now().isoformat()
                else:
                    current_data[key] = value

            # Update metadata
            if 'metadata' not in current_data:
                current_data['metadata'] = {}
            current_data['metadata']['last_updated'] = datetime.now().isoformat()

            # Validate updated data
            validation = self._validate_context_data(current_data)
            if validation['errors']:
                return {
                    'success': False,
                    'error': 'Updated context data validation failed',
                    'validation_errors': validation['errors'],
                    'context_name': context_name,
                    'backup_file': str(backup_file) if backup_file else None
                }

            # Write updated context file
            context_file = self.config_dir / f"{context_name}_context.json"
            with open(context_file, 'w', encoding='utf-8') as f:
                json.dump(current_data, f, indent=2, ensure_ascii=False)

            # Update in-memory contexts
            self.contexts[context_name] = current_data

            result = {
                'success': True,
                'message': f'Context {context_name} updated successfully',
                'context_name': context_name,
                'updated_fields': list(updates.keys()),
                'context_file': str(context_file),
                'backup_file': str(backup_file) if backup_file else None
            }

            if validation['warnings']:
                result['warnings'] = validation['warnings']

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to update context: {str(e)}',
                'context_name': context_name,
                'backup_file': str(backup_file) if backup_file else None
            }

    def add_context_pattern(self, context_name: str, pattern_section: str, pattern_name: str, pattern_config: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new pattern to a context's auto-trigger sections"""
        # Validate inputs
        if not self._validate_context_name(context_name):
            return {
                'success': False,
                'error': 'Invalid context name',
                'context_name': context_name
            }

        if context_name not in self.contexts:
            return {
                'success': False,
                'error': f'Context {context_name} not found',
                'context_name': context_name,
                'available_contexts': list(self.contexts.keys())
            }

        # Validate pattern section
        valid_sections = ['auto_store_triggers', 'auto_retrieve_triggers']
        if pattern_section not in valid_sections:
            return {
                'success': False,
                'error': f'Invalid pattern section. Must be one of: {valid_sections}',
                'context_name': context_name,
                'pattern_section': pattern_section
            }

        try:
            # Create backup
            backup_file = self._backup_context_file(context_name)

            # Get current context data
            current_data = self.contexts[context_name].copy()

            # Ensure the pattern section exists
            if pattern_section not in current_data:
                current_data[pattern_section] = {}

            # Add the new pattern
            current_data[pattern_section][pattern_name] = pattern_config

            # Update metadata
            if 'metadata' not in current_data:
                current_data['metadata'] = {}
            current_data['metadata']['last_updated'] = datetime.now().isoformat()

            # Write updated context file
            context_file = self.config_dir / f"{context_name}_context.json"
            with open(context_file, 'w', encoding='utf-8') as f:
                json.dump(current_data, f, indent=2, ensure_ascii=False)

            # Update in-memory contexts
            self.contexts[context_name] = current_data

            return {
                'success': True,
                'message': f'Pattern {pattern_name} added to {context_name}.{pattern_section}',
                'context_name': context_name,
                'pattern_section': pattern_section,
                'pattern_name': pattern_name,
                'context_file': str(context_file),
                'backup_file': str(backup_file) if backup_file else None
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to add pattern: {str(e)}',
                'context_name': context_name,
                'backup_file': str(backup_file) if backup_file else None
            }

# MCP Server Implementation
app = Server("context-provider")

@app.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available tools"""
    return [
        Tool(
            name="get_tool_context",
            description="Get context rules for specific tool",
            inputSchema={
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Name of the tool to get context for"
                    }
                },
                "required": ["tool_name"]
            }
        ),
        Tool(
            name="get_syntax_rules",
            description="Get syntax rules for tool", 
            inputSchema={
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Name of the tool to get syntax rules for"
                    }
                },
                "required": ["tool_name"]
            }
        ),
        Tool(
            name="list_available_contexts",
            description="List all available context categories",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="apply_auto_corrections",
            description="Apply auto-corrections to text based on tool context",
            inputSchema={
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Name of the tool to apply corrections for"
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to apply corrections to"
                    }
                },
                "required": ["tool_name", "text"]
            }
        ),
        Tool(
            name="execute_session_initialization",
            description="Execute session initialization actions from all contexts with memory service integration",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="get_session_status",
            description="Get current session initialization status and results",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="create_context_file",
            description="Create a new context file dynamically with validation and backup",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for the new context file (alphanumeric, underscore, hyphen only)"
                    },
                    "category": {
                        "type": "string",
                        "description": "Tool category for the context (used as tool_category field)"
                    },
                    "rules": {
                        "type": "object",
                        "description": "Context rules and configuration",
                        "properties": {
                            "description": {"type": "string"},
                            "auto_convert": {"type": "boolean"},
                            "syntax_rules": {"type": "object"},
                            "preferences": {"type": "object"},
                            "auto_corrections": {"type": "object"},
                            "session_initialization": {"type": "object"},
                            "applies_to_tools": {"type": "array"},
                            "priority": {"type": "string"}
                        }
                    }
                },
                "required": ["name", "category", "rules"]
            }
        ),
        Tool(
            name="update_context_rules",
            description="Update existing context rules with backup and validation",
            inputSchema={
                "type": "object",
                "properties": {
                    "context_name": {
                        "type": "string",
                        "description": "Name of the existing context to update"
                    },
                    "updates": {
                        "type": "object",
                        "description": "Fields to update in the context"
                    }
                },
                "required": ["context_name", "updates"]
            }
        ),
        Tool(
            name="add_context_pattern",
            description="Add a new pattern to a context's auto-trigger sections",
            inputSchema={
                "type": "object",
                "properties": {
                    "context_name": {
                        "type": "string",
                        "description": "Name of the context to modify"
                    },
                    "pattern_section": {
                        "type": "string",
                        "enum": ["auto_store_triggers", "auto_retrieve_triggers"],
                        "description": "Which trigger section to add the pattern to"
                    },
                    "pattern_name": {
                        "type": "string",
                        "description": "Name for the new pattern"
                    },
                    "pattern_config": {
                        "type": "object",
                        "description": "Pattern configuration with patterns, action, tags, etc."
                    }
                },
                "required": ["context_name", "pattern_section", "pattern_name", "pattern_config"]
            }
        )
    ]

@app.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    """Handle tool calls"""
    provider = ContextProvider.get_instance()
    
    try:
        if name == "get_tool_context":
            tool_name = arguments.get("tool_name")
            if not tool_name:
                return [TextContent(type="text", text="Error: tool_name is required")]
            
            context = provider.get_tool_context(tool_name)
            return [TextContent(type="text", text=json.dumps(context, indent=2))]
            
        elif name == "get_syntax_rules":
            tool_name = arguments.get("tool_name")
            if not tool_name:
                return [TextContent(type="text", text="Error: tool_name is required")]
            
            rules = provider.get_syntax_rules(tool_name)
            return [TextContent(type="text", text=json.dumps(rules, indent=2))]
            
        elif name == "list_available_contexts":
            contexts = list(provider.contexts.keys())
            return [TextContent(type="text", text=json.dumps(contexts, indent=2))]
            
        elif name == "apply_auto_corrections":
            tool_name = arguments.get("tool_name")
            text = arguments.get("text")

            if not tool_name or not text:
                return [TextContent(type="text", text="Error: tool_name and text are required")]

            corrected_text = provider.apply_auto_corrections(tool_name, text)
            return [TextContent(type="text", text=corrected_text)]

        elif name == "execute_session_initialization":
            session_result = await provider.execute_session_initialization()
            return [TextContent(type="text", text=json.dumps(session_result, indent=2))]

        elif name == "get_session_status":
            status = provider.get_session_status()
            return [TextContent(type="text", text=json.dumps(status, indent=2))]

        elif name == "create_context_file":
            name_arg = arguments.get("name")
            category = arguments.get("category")
            rules = arguments.get("rules", {})

            if not name_arg or not category:
                return [TextContent(type="text", text="Error: name and category are required")]

            result = provider.create_context_file(name_arg, category, rules)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "update_context_rules":
            context_name = arguments.get("context_name")
            updates = arguments.get("updates", {})

            if not context_name:
                return [TextContent(type="text", text="Error: context_name is required")]

            result = provider.update_context_rules(context_name, updates)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "add_context_pattern":
            context_name = arguments.get("context_name")
            pattern_section = arguments.get("pattern_section")
            pattern_name = arguments.get("pattern_name")
            pattern_config = arguments.get("pattern_config", {})

            if not all([context_name, pattern_section, pattern_name]):
                return [TextContent(type="text", text="Error: context_name, pattern_section, and pattern_name are required")]

            result = provider.add_context_pattern(context_name, pattern_section, pattern_name, pattern_config)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
            
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Main entry point for the MCP server"""
    # Initialize the context provider
    provider = ContextProvider.get_instance()
    print(f"Loaded {len(provider.contexts)} context files", file=sys.stderr)
    
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="context-provider",
                server_version="1.0.0",
                capabilities=ServerCapabilities(
                    tools={}
                )
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
