#!/usr/bin/env python3
"""
Test schema validation for MCP tools
Ensures all array-type parameters have proper 'items' definitions
"""

import pytest
import json
import asyncio
from context_provider_server import app


@pytest.fixture
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop()
    yield loop


@pytest.mark.asyncio
async def test_all_tools_have_valid_schemas():
    """Test that all tool schemas are valid JSON Schema"""
    tools = await app.list_tools()

    assert len(tools) > 0, "No tools registered"

    for tool in tools:
        # Check that tool has required fields
        assert hasattr(tool, 'name'), f"Tool missing name: {tool}"
        assert hasattr(tool, 'inputSchema'), f"Tool {tool.name} missing inputSchema"

        # Validate schema structure
        schema = tool.inputSchema
        assert isinstance(schema, dict), f"Tool {tool.name} schema is not a dict"
        assert schema.get('type') == 'object', f"Tool {tool.name} schema type must be 'object'"


@pytest.mark.asyncio
async def test_array_parameters_have_items():
    """Test that all array-type parameters have 'items' property"""
    tools = await app.list_tools()

    errors = []

    for tool in tools:
        schema = tool.inputSchema
        properties = schema.get('properties', {})

        # Check each property recursively
        def check_array_has_items(obj, path=""):
            if isinstance(obj, dict):
                if obj.get('type') == 'array':
                    if 'items' not in obj:
                        errors.append(f"Tool {tool.name} at {path}: array type missing 'items' property")

                # Recurse into nested properties
                if 'properties' in obj:
                    for key, value in obj['properties'].items():
                        check_array_has_items(value, f"{path}.{key}" if path else key)

                # Check items definition itself
                if 'items' in obj:
                    check_array_has_items(obj['items'], f"{path}.items")

        check_array_has_items(schema, tool.name)

    if errors:
        pytest.fail(f"Schema validation errors:\n" + "\n".join(errors))


@pytest.mark.asyncio
async def test_create_context_file_schema():
    """Specifically test the create_context_file schema that was reported"""
    tools = await app.list_tools()

    create_context_tool = None
    for tool in tools:
        if tool.name == 'create_context_file':
            create_context_tool = tool
            break

    assert create_context_tool is not None, "create_context_file tool not found"

    schema = create_context_tool.inputSchema
    rules_properties = schema['properties']['rules']['properties']

    # Check that applies_to_tools has items
    assert 'applies_to_tools' in rules_properties, "applies_to_tools property not found"
    applies_to_tools = rules_properties['applies_to_tools']
    assert applies_to_tools['type'] == 'array', "applies_to_tools must be array type"
    assert 'items' in applies_to_tools, "applies_to_tools array must have 'items' property"
    assert applies_to_tools['items'] == {'type': 'string'}, "applies_to_tools items must be strings"


@pytest.mark.asyncio
async def test_schema_is_json_serializable():
    """Test that all schemas can be serialized to JSON"""
    tools = await app.list_tools()

    for tool in tools:
        try:
            json_schema = json.dumps(tool.inputSchema)
            # Also verify we can load it back
            loaded = json.loads(json_schema)
            assert loaded == tool.inputSchema, f"Tool {tool.name} schema not round-trip serializable"
        except (TypeError, ValueError) as e:
            pytest.fail(f"Tool {tool.name} schema is not JSON serializable: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
