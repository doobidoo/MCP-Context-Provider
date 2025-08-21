# Context Guide

Complete reference for creating and configuring context files in the MCP Context Provider.

## Overview

Context files are JSON documents that define tool-specific rules, preferences, and automatic corrections. Each file represents a category of tools and their associated context rules.

## File Structure

### Basic Template

```json
{
  "tool_category": "string",
  "description": "string", 
  "auto_convert": boolean,
  "syntax_rules": {},
  "preferences": {},
  "auto_corrections": {},
  "metadata": {}
}
```

## Field Definitions

### Core Fields

#### `tool_category` (required)
- **Type**: String
- **Description**: Identifier for the tool category
- **Examples**: `"dokuwiki"`, `"terraform"`, `"azure"`, `"git"`
- **Usage**: Used to match tool names and apply appropriate context

#### `description` (required)
- **Type**: String
- **Description**: Human-readable description of the context
- **Example**: `"DokuWiki-specific context rules and syntax preferences"`

#### `auto_convert` (optional)
- **Type**: Boolean
- **Default**: `false`
- **Description**: Whether to automatically apply corrections when tools are used
- **Example**: `true`

### Rule Sections

#### `syntax_rules` (optional)
Defines formatting and syntax conversion rules.

```json
{
  "syntax_rules": {
    "headers": {
      "format": "====== {} ======",
      "levels": {
        "1": "====== {} ======",
        "2": "===== {} ====="
      },
      "avoid": ["#", "##"]
    }
  }
}
```

**Common patterns**:
- `format`: Template string for conversions
- `levels`: Different formatting levels
- `avoid`: Patterns to avoid or convert from
- `examples`: Usage examples

#### `preferences` (optional)
User and tool preferences that affect behavior.

```json
{
  "preferences": {
    "date_format": "YYYY-MM-DD",
    "default_location": "westeurope",
    "security": {
      "enable_https_only": true
    }
  }
}
```

#### `auto_corrections` (optional)
Regex-based automatic text corrections.

```json
{
  "auto_corrections": {
    "fix_headers": {
      "pattern": "^(#{1,6})\\s*(.+)$",
      "replacement": "====== $2 ======"
    },
    "fix_links": {
      "pattern": "\\[([^\\]]+)\\]\\(([^)]+)\\)",
      "replacement": "[[$2|$1]]"
    }
  }
}
```

**Fields**:
- `pattern`: Regular expression pattern (JavaScript format)
- `replacement`: Replacement string (supports capture groups `$1`, `$2`)

#### `metadata` (recommended)
Information about the context file itself.

```json
{
  "metadata": {
    "version": "1.0.0",
    "last_updated": "2025-01-08",
    "applies_to_tools": [
      "dokuwiki:core_savePage",
      "dokuwiki:*"
    ],
    "priority": "high"
  }
}
```

## Advanced Patterns

### Tool Matching

The `applies_to_tools` array supports various patterns:

```json
{
  "applies_to_tools": [
    "exact:tool_name",           // Exact match
    "prefix:tool_*",             // Prefix match  
    "category:*",                // All tools in category
    "*"                          // All tools (use sparingly)
  ]
}
```

### Nested Rules

Complex rules can be nested:

```json
{
  "syntax_rules": {
    "code_blocks": {
      "languages": {
        "javascript": {
          "format": "<code js>\n{}\n</code>",
          "highlight": true
        },
        "python": {
          "format": "<code python>\n{}\n</code>",
          "highlight": true
        }
      },
      "default": {
        "format": "<code>\n{}\n</code>"
      }
    }
  }
}
```

### Conditional Rules

Rules can include conditions:

```json
{
  "auto_corrections": {
    "environment_specific": {
      "condition": "environment == 'production'",
      "pattern": "console\\.log\\(.*\\)",
      "replacement": "// Removed console.log for production"
    }
  }
}
```

## Best Practices

### File Organization

1. **One category per file**: Keep each tool category in its own file
2. **Descriptive names**: Use `{category}_context.json` naming
3. **Logical grouping**: Group related rules together

### Rule Design

1. **Start simple**: Begin with basic rules and expand
2. **Test patterns**: Validate regex patterns before deployment
3. **Document examples**: Include examples for complex rules
4. **Version control**: Track changes in metadata

### Performance

1. **Efficient regex**: Use non-greedy matches and anchors
2. **Limit scope**: Target specific patterns, not broad matches
3. **Cache results**: Rules are loaded once at startup

## Examples

### Simple Syntax Rules

```json
{
  "tool_category": "markdown",
  "description": "Markdown formatting preferences",
  "auto_convert": true,
  "syntax_rules": {
    "emphasis": {
      "bold": "**{}**",
      "italic": "_{}_",
      "avoid": ["<b>", "<i>"]
    },
    "lists": {
      "unordered": "- {}",
      "ordered": "1. {}",
      "indent": "  "
    }
  },
  "metadata": {
    "version": "1.0.0",
    "applies_to_tools": ["markdown:*"]
  }
}
```

### Complex Auto-Corrections

```json
{
  "auto_corrections": {
    "standardize_dates": {
      "pattern": "(\\d{1,2})/(\\d{1,2})/(\\d{4})",
      "replacement": "$3-$1-$2"
    },
    "fix_spacing": {
      "pattern": "\\s{2,}",
      "replacement": " "
    },
    "remove_trailing_whitespace": {
      "pattern": "\\s+$",
      "replacement": ""
    }
  }
}
```

### Environment-Specific Preferences

```json
{
  "preferences": {
    "development": {
      "debug_mode": true,
      "verbose_logging": true,
      "auto_save": true
    },
    "production": {
      "debug_mode": false,
      "verbose_logging": false,
      "performance_monitoring": true
    }
  }
}
```

## Validation

### JSON Schema

Context files should validate against this schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["tool_category", "description"],
  "properties": {
    "tool_category": {"type": "string"},
    "description": {"type": "string"},
    "auto_convert": {"type": "boolean"},
    "syntax_rules": {"type": "object"},
    "preferences": {"type": "object"},
    "auto_corrections": {
      "type": "object",
      "patternProperties": {
        ".*": {
          "type": "object",
          "required": ["pattern", "replacement"],
          "properties": {
            "pattern": {"type": "string"},
            "replacement": {"type": "string"}
          }
        }
      }
    },
    "metadata": {"type": "object"}
  }
}
```

### Common Validation Errors

1. **Invalid JSON**: Use a JSON validator to check syntax
2. **Missing required fields**: Ensure `tool_category` and `description` are present
3. **Invalid regex**: Test patterns with online regex tools
4. **Circular references**: Avoid rules that reference themselves

## Testing Context Files

### Manual Testing

1. **Load test**: Add file and restart Claude Desktop
2. **Rule test**: Verify auto-corrections work as expected
3. **Performance test**: Check for slow regex patterns

### Automated Testing

Create test cases for your context rules:

```python
import json
import re

def test_context_file(file_path):
    with open(file_path) as f:
        context = json.load(f)
    
    # Test auto-corrections
    for name, rule in context.get('auto_corrections', {}).items():
        pattern = rule['pattern']
        replacement = rule['replacement']
        
        # Test with sample text
        test_text = "Sample text for testing"
        result = re.sub(pattern, replacement, test_text)
        
        print(f"Rule '{name}': '{test_text}' → '{result}'")
```

## Troubleshooting

### Common Issues

1. **Rules not applying**: Check `auto_convert` is `true`
2. **Regex errors**: Validate patterns with online tools
3. **File not loading**: Check JSON syntax and file placement
4. **Performance issues**: Optimize regex patterns

### Debug Output

Enable debug mode to see rule applications:

```json
{
  "env": {
    "DEBUG_MODE": "true"
  }
}
```

This will log context loading and rule applications to help with troubleshooting.

## Migration Guide

### From Version 0.x to 1.x

1. **Update structure**: Add `metadata` section
2. **Rename fields**: `rules` → `syntax_rules`
3. **Add versioning**: Include version in metadata
4. **Test thoroughly**: Verify all rules still work

### Adding New Fields

When extending context files:

1. **Maintain compatibility**: Keep existing fields working
2. **Use optional fields**: New features should be optional
3. **Document changes**: Update this guide with new patterns
4. **Version appropriately**: Increment version numbers

This completes the comprehensive context guide for creating and managing context files in the MCP Context Provider.