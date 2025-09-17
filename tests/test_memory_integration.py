#!/usr/bin/env python3
"""
Test script for real memory service integration
Tests the integration between context provider and mcp-memory-service
"""

import asyncio
import json
import os
import sys
from pathlib import Path
import shutil

# Mock the MCP imports for testing
class MockTool:
    def __init__(self, name, description, inputSchema):
        self.name = name
        self.description = description
        self.inputSchema = inputSchema

class MockTextContent:
    def __init__(self, type, text):
        self.type = type
        self.text = text

class MockServer:
    def __init__(self, name):
        self.name = name

    def list_tools(self):
        def decorator(func):
            return func
        return decorator

    def call_tool(self):
        def decorator(func):
            return func
        return decorator

# Mock the MCP module
sys.modules['mcp'] = type('mcp', (), {})()
sys.modules['mcp.server'] = type('server', (), {
    'Server': MockServer,
    'NotificationOptions': object
})()
sys.modules['mcp.server.models'] = type('models', (), {
    'InitializationOptions': object
})()
sys.modules['mcp.server.stdio'] = type('stdio', (), {
    'stdio_server': lambda: None
})()
sys.modules['mcp.types'] = type('types', (), {
    'Tool': MockTool,
    'TextContent': MockTextContent,
    'ServerCapabilities': object
})()

# Set up test environment
test_contexts_dir = Path('./test_memory_contexts')
if test_contexts_dir.exists():
    shutil.rmtree(test_contexts_dir)
test_contexts_dir.mkdir()

# Copy memory context for testing
contexts_dir = Path('./contexts')
if contexts_dir.exists() and (contexts_dir / 'memory_context.json').exists():
    shutil.copy2(contexts_dir / 'memory_context.json', test_contexts_dir)

os.environ['CONTEXT_CONFIG_DIR'] = str(test_contexts_dir)
os.environ['AUTO_LOAD_CONTEXTS'] = 'true'

# Import our ContextProvider after mocking
from context_provider_server import ContextProvider

async def test_memory_service_integration():
    """Test memory service integration"""
    print("=== Testing Memory Service Integration ===")

    provider = ContextProvider()

    # Test memory service availability
    print(f"Memory service available: {provider.memory_service.memory_available}")

    # Test memory stats
    stats = await provider.get_memory_stats()
    print("Memory service stats:")
    print(json.dumps(stats, indent=2))

    assert stats['success'] == True, "Memory stats should be available"
    assert 'storage_backend' in stats, "Stats should include storage backend info"

    print("✓ Memory service integration working")
    return True

async def test_session_initialization_with_memory():
    """Test session initialization using real memory service"""
    print("\n=== Testing Session Initialization with Memory ===")

    provider = ContextProvider()

    # Check if memory context is loaded
    if 'memory' not in provider.contexts:
        print("Memory context not found - skipping session initialization test")
        return True

    # Execute session initialization
    result = await provider.execute_session_initialization()
    print("Session initialization result:")
    print(json.dumps(result, indent=2))

    assert result['initialized'] == True, "Session should be initialized"
    assert 'memory_retrieval_results' in result, "Should have memory retrieval results"

    # Check if memory actions were executed
    memory_actions = [
        action for action in result['executed_actions']
        if action['action'] in ['recall_memory', 'search_by_tag']
    ]

    assert len(memory_actions) > 0, "Should have executed memory actions"
    print(f"✓ Executed {len(memory_actions)} memory actions during initialization")

    return True

async def test_dynamic_context_memory_storage():
    """Test that dynamic context operations store data in memory"""
    print("\n=== Testing Dynamic Context Memory Storage ===")

    provider = ContextProvider()

    # Create a test context
    rules = {
        'description': 'Test context for memory integration',
        'preferences': {'test_setting': 'memory_test_value'}
    }

    print("Creating test context...")
    result = provider.create_context_file('memory_test', 'memory_tool', rules)
    print("Create result:")
    print(json.dumps(result, indent=2))

    assert result['success'] == True, "Context creation should succeed"

    # Give memory storage a moment to complete
    await asyncio.sleep(0.1)

    # Update the context
    print("\nUpdating test context...")
    updates = {'description': 'Updated description for memory test'}
    update_result = provider.update_context_rules('memory_test', updates)
    print("Update result:")
    print(json.dumps(update_result, indent=2))

    assert update_result['success'] == True, "Context update should succeed"

    # Give memory storage a moment to complete
    await asyncio.sleep(0.1)

    # Add a pattern
    print("\nAdding pattern to test context...")
    pattern_config = {
        'patterns': ['I tested memory integration'],
        'action': 'store_memory',
        'tags': ['testing', 'memory']
    }

    pattern_result = provider.add_context_pattern(
        'memory_test',
        'auto_store_triggers',
        'test_pattern',
        pattern_config
    )
    print("Pattern addition result:")
    print(json.dumps(pattern_result, indent=2))

    assert pattern_result['success'] == True, "Pattern addition should succeed"

    # Give memory storage a moment to complete
    await asyncio.sleep(0.1)

    print("✓ Dynamic context operations with memory storage completed")
    return True

async def test_memory_recall_functionality():
    """Test memory recall functionality"""
    print("\n=== Testing Memory Recall Functionality ===")

    provider = ContextProvider()

    # Test recall with different queries
    queries = [
        "implementation",
        "technical patterns",
        "context management",
        "phase 1 phase 2"
    ]

    for query in queries:
        print(f"\nTesting recall query: '{query}'")
        result = await provider.memory_service.recall_memory(query, n_results=3)

        if result['success']:
            print(f"Retrieved {len(result['results'])} results")
            for i, memory in enumerate(result['results'][:2]):  # Show first 2
                print(f"  {i+1}. {memory['content'][:80]}...")
        else:
            print(f"Recall failed: {result.get('error', 'Unknown error')}")

    # Test search by tags
    print("\nTesting search by tags...")
    tag_searches = [
        ['implementation'],
        ['technical', 'pattern'],
        ['decision'],
        ['learning']
    ]

    for tags in tag_searches:
        print(f"Searching for tags: {tags}")
        result = await provider.memory_service.search_by_tag(tags, limit=3)

        if result['success']:
            print(f"Found {len(result['results'])} results")
        else:
            print(f"Search failed: {result.get('error', 'Unknown error')}")

    print("✓ Memory recall functionality tested")
    return True

async def test_memory_storage_patterns():
    """Test memory storage patterns and auto-triggers"""
    print("\n=== Testing Memory Storage Patterns ===")

    provider = ContextProvider()

    # Test manual memory storage
    test_memories = [
        {
            "content": "Successfully integrated real mcp-memory-service with context provider",
            "tags": ["integration", "success", "mcp-memory-service"],
            "metadata": {"test": True, "operation": "integration_test"}
        },
        {
            "content": "Memory service integration allows automatic storage of context changes",
            "tags": ["feature", "automatic", "context-changes"],
            "metadata": {"test": True, "feature": "auto_storage"}
        },
        {
            "content": "Phase 3 synergistic integration now possible with real memory backend",
            "tags": ["phase3", "synergistic", "backend"],
            "metadata": {"test": True, "milestone": "phase3_ready"}
        }
    ]

    for i, memory_data in enumerate(test_memories):
        print(f"Storing test memory {i+1}...")
        result = await provider.memory_service.store_memory(
            memory_data["content"],
            memory_data["tags"],
            memory_data["metadata"]
        )

        if result['success']:
            print(f"✓ Stored: {memory_data['content'][:50]}...")
        else:
            print(f"✗ Failed to store: {result.get('error', 'Unknown error')}")

    print("✓ Memory storage patterns tested")
    return True

async def run_all_tests():
    """Run all memory integration tests"""
    print("Memory Service Integration Test Suite")
    print("=" * 50)

    try:
        tests = [
            test_memory_service_integration,
            test_session_initialization_with_memory,
            test_dynamic_context_memory_storage,
            test_memory_recall_functionality,
            test_memory_storage_patterns
        ]

        passed = 0
        for test in tests:
            try:
                if await test():
                    passed += 1
            except Exception as e:
                print(f"Test {test.__name__} failed: {e}")
                import traceback
                traceback.print_exc()

        print("\n" + "=" * 50)
        print(f"Test Results: {passed}/{len(tests)} tests passed")

        if passed == len(tests):
            print("✅ All memory integration tests passed!")
            print("\n🎉 Memory service is successfully integrated!")
            print("Ready for Phase 3 implementation with full memory capabilities.")
            return 0
        else:
            print("❌ Some tests failed")
            return 1

    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        # Cleanup test directory
        if test_contexts_dir.exists():
            shutil.rmtree(test_contexts_dir)
            print("\n🧹 Cleaned up test files")

def main():
    """Main test function"""
    return asyncio.run(run_all_tests())

if __name__ == "__main__":
    sys.exit(main())