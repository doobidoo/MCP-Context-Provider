# Phase 3: Learning System Examples and Use Cases

## Overview

This document provides practical examples and real-world use cases for the Phase 3 Intelligent Learning System. These examples demonstrate how to leverage the learning engine for context optimization, proactive suggestions, and continuous improvement.

## Table of Contents

1. [Getting Started Examples](#getting-started-examples)
2. [Context Effectiveness Analysis](#context-effectiveness-analysis)
3. [Automatic Context Optimization](#automatic-context-optimization)
4. [Proactive Context Suggestions](#proactive-context-suggestions)
5. [Session Learning Integration](#session-learning-integration)
6. [Team Workflow Examples](#team-workflow-examples)
7. [Enterprise Use Cases](#enterprise-use-cases)
8. [Troubleshooting Examples](#troubleshooting-examples)

## Getting Started Examples

### Example 1: Basic Learning Engine Setup

```python
#!/usr/bin/env python3
"""
Basic example of using the Phase 3 learning engine
"""
import asyncio
from context_provider_server import ContextProvider

async def basic_learning_example():
    # Initialize context provider with learning engine
    provider = ContextProvider()

    # Check if learning engine is available
    print(f"Learning engine available: {provider.learning_engine is not None}")
    print(f"Memory service available: {provider.memory_service.memory_available}")

    # Get current contexts
    contexts = list(provider.contexts.keys())
    print(f"Loaded contexts: {contexts}")

    return provider

# Run the example
provider = asyncio.run(basic_learning_example())
```

### Example 2: Memory Service Health Check

```python
async def memory_health_check():
    provider = ContextProvider()

    # Get memory service statistics
    stats = await provider.memory_service.get_memory_stats()
    print("Memory Service Stats:")
    print(f"  Status: {stats.get('service_status', 'unknown')}")
    print(f"  Total memories: {stats.get('total_memories', 0)}")
    print(f"  Storage backend: {stats.get('storage_backend', 'unknown')}")
    print(f"  Available tags: {stats.get('tags_available', [])}")

    return stats['success']

# Check memory service health
memory_healthy = asyncio.run(memory_health_check())
```

## Context Effectiveness Analysis

### Example 3: Analyzing All Contexts

```python
async def analyze_all_contexts():
    provider = ContextProvider()

    print("Context Effectiveness Analysis")
    print("=" * 50)

    for context_name in provider.contexts.keys():
        result = await provider.learning_engine.analyze_context_effectiveness(context_name)

        if result['success']:
            score = result['effectiveness_score']
            stats = result['usage_stats']
            recommendations = result['recommendations']

            print(f"\n{context_name.upper()} Context:")
            print(f"  Effectiveness Score: {score:.2f}/1.0")
            print(f"  Total Interactions: {stats['total_interactions']}")
            print(f"  Updates: {stats['update_count']}")
            print(f"  Pattern Additions: {stats['pattern_additions']}")
            print(f"  Recommendations:")
            for rec in recommendations:
                print(f"    • {rec}")
        else:
            print(f"\n{context_name}: Analysis failed - {result['error']}")

# Analyze all contexts
asyncio.run(analyze_all_contexts())
```

### Example 4: Tracking Context Performance Over Time

```python
async def track_context_performance():
    provider = ContextProvider()

    # Analyze context effectiveness
    context_name = "terraform"
    result = await provider.learning_engine.analyze_context_effectiveness(context_name)

    if result['success']:
        # Store performance tracking data
        performance_data = {
            "context_name": context_name,
            "effectiveness_score": result['effectiveness_score'],
            "analysis_date": datetime.now().isoformat(),
            "usage_stats": result['usage_stats']
        }

        # Store in memory for trend analysis
        await provider.memory_service.store_memory(
            f"Performance tracking: {context_name} scored {result['effectiveness_score']:.2f}",
            ["performance_tracking", context_name, "effectiveness"],
            performance_data
        )

        print(f"Performance data stored for {context_name}")
        return performance_data
    else:
        print(f"Failed to analyze {context_name}: {result['error']}")
        return None

# Track performance
performance = asyncio.run(track_context_performance())
```

## Automatic Context Optimization

### Example 5: Preference Tuning Optimization

```python
async def optimize_terraform_preferences():
    provider = ContextProvider()

    # Define optimization for Terraform context
    optimization_data = {
        "type": "preference_tuning",
        "preferences": {
            "default_provider": "aws",
            "enable_validation": True,
            "auto_format": True,
            "workspace_strategy": "remote"
        },
        "effectiveness_data": {
            "usage_frequency": "high",
            "user_feedback": "positive",
            "performance_impact": "minimal"
        }
    }

    # Apply optimization
    result = await provider.auto_optimize_context("terraform", optimization_data)

    if result['success']:
        print("Terraform Context Optimization Successful!")
        print(f"  Optimization Type: {result['optimization_type']}")
        print(f"  Changes Applied: {len(result['optimizations_applied'])}")
        for change in result['optimizations_applied']:
            print(f"    • {change}")
        print(f"  Backup Created: {result['backup_file']}")
    else:
        print(f"Optimization failed: {result['error']}")

    return result

# Optimize Terraform preferences
result = asyncio.run(optimize_terraform_preferences())
```

### Example 6: Pattern Improvement Optimization

```python
async def optimize_git_patterns():
    provider = ContextProvider()

    # Add new patterns based on learning insights
    optimization_data = {
        "type": "pattern_improvement",
        "patterns": {
            "auto_corrections": [
                {
                    "pattern": r"git commit -m (.+)",
                    "replacement": r"git commit -m '\1' --signoff",
                    "description": "Auto-add signoff to commit messages"
                },
                {
                    "pattern": r"git push origin (\w+)",
                    "replacement": r"git push --set-upstream origin \1",
                    "description": "Auto-set upstream for new branches"
                }
            ]
        },
        "effectiveness_data": {
            "pattern_success_rate": 0.95,
            "user_adoption": "high"
        }
    }

    # Apply pattern improvements
    result = await provider.auto_optimize_context("git", optimization_data)

    if result['success']:
        print("Git Pattern Optimization Successful!")
        for change in result['optimizations_applied']:
            print(f"  • {change}")

    return result

# Optimize Git patterns
result = asyncio.run(optimize_git_patterns())
```

### Example 7: Rule Refinement Optimization

```python
async def optimize_azure_rules():
    provider = ContextProvider()

    # Refine Azure naming rules based on usage patterns
    optimization_data = {
        "type": "rule_refinement",
        "syntax_rules": {
            "resource_naming": {
                "patterns": [
                    r"^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$"
                ],
                "description": "Azure resource names: lowercase, hyphens, 3-63 chars"
            },
            "tag_validation": {
                "patterns": [
                    r"^(Environment|Project|Owner|CostCenter):.+$"
                ],
                "description": "Required tags with proper format"
            }
        },
        "effectiveness_data": {
            "compliance_improvement": 0.35,
            "error_reduction": 0.60
        }
    }

    # Apply rule refinements
    result = await provider.auto_optimize_context("azure", optimization_data)

    if result['success']:
        print("Azure Rules Optimization Successful!")
        for change in result['optimizations_applied']:
            print(f"  • {change}")

    return result

# Optimize Azure rules
result = asyncio.run(optimize_azure_rules())
```

## Proactive Context Suggestions

### Example 8: Getting Proactive Suggestions

```python
async def get_proactive_suggestions():
    provider = ContextProvider()

    # Get current contexts
    current_contexts = list(provider.contexts.keys())
    print(f"Current contexts: {current_contexts}")

    # Get proactive suggestions
    suggestions = await provider.learning_engine.proactive_context_suggestions(current_contexts)

    print(f"\nProactive Suggestions ({len(suggestions)} found):")
    print("=" * 50)

    for i, suggestion in enumerate(suggestions, 1):
        print(f"{i}. {suggestion['suggested_context']}")
        print(f"   Reason: {suggestion['reason']}")
        print(f"   Confidence: {suggestion['confidence']:.1%}")
        print(f"   Priority: {suggestion['priority']}")
        print(f"   Type: {suggestion['type']}")
        print()

    return suggestions

# Get suggestions
suggestions = asyncio.run(get_proactive_suggestions())
```

### Example 9: Implementing Suggested Contexts

```python
async def implement_docker_suggestion():
    provider = ContextProvider()

    # Create Docker context based on proactive suggestion
    docker_rules = {
        "description": "Docker development context with best practices",
        "preferences": {
            "default_base_image": "alpine:latest",
            "enable_multi_stage": True,
            "optimize_layers": True,
            "security_scanning": True
        },
        "syntax_rules": {
            "dockerfile_best_practices": {
                "patterns": [
                    r"FROM .+ AS \w+",  # Multi-stage builds
                    r"RUN apt-get update && apt-get install",  # Package management
                    r"COPY --from=\w+ . ."  # Copy from previous stages
                ],
                "transformations": [
                    {
                        "pattern": r"RUN apt-get update\nRUN apt-get install",
                        "replacement": r"RUN apt-get update && apt-get install",
                        "description": "Combine apt-get commands to reduce layers"
                    }
                ]
            }
        },
        "auto_corrections": {
            "docker_commands": {
                "patterns": [
                    {
                        "pattern": r"docker run -it (.+)",
                        "replacement": r"docker run --rm -it \1",
                        "description": "Auto-add --rm flag for cleanup"
                    }
                ]
            }
        }
    }

    # Create the context
    result = provider.create_context_file("docker", "containerization", docker_rules)

    if result['success']:
        print("Docker context created successfully!")
        print(f"  File: {result['file_path']}")
        print(f"  Sections: {result['sections_created']}")

        # Store implementation in memory
        await provider.memory_service.store_memory(
            "Implemented proactive suggestion: Docker context created",
            ["implementation", "proactive_suggestion", "docker"],
            {"suggestion_type": "missing_tool_context", "implementation_success": True}
        )
    else:
        print(f"Failed to create Docker context: {result['error']}")

    return result

# Implement Docker suggestion
result = asyncio.run(implement_docker_suggestion())
```

## Session Learning Integration

### Example 10: Session Performance Monitoring

```python
async def monitor_session_performance():
    provider = ContextProvider()

    # Execute session initialization
    session_result = await provider.execute_session_initialization()

    print("Session Performance Report:")
    print("=" * 40)
    print(f"Initialization Success: {session_result['initialized']}")
    print(f"Execution Time: {session_result['execution_time_seconds']:.4f}s")
    print(f"Actions Executed: {len(session_result['executed_actions'])}")
    print(f"Errors: {len(session_result['errors'])}")

    if 'learning_insights' in session_result:
        print(f"Learning Insights: {len(session_result['learning_insights'])}")
        for insight in session_result['learning_insights']:
            print(f"  • {insight}")

    # Analyze performance trends
    performance_memories = await provider.memory_service.search_by_tag(
        ["session_learning", "performance"],
        limit=10
    )

    if performance_memories['success']:
        print(f"\nHistorical Performance ({len(performance_memories['results'])} records):")
        for memory in performance_memories['results'][:3]:
            print(f"  • {memory['content']}")

    return session_result

# Monitor session performance
session_result = asyncio.run(monitor_session_performance())
```

### Example 11: Custom Session Learning

```python
async def custom_session_learning():
    provider = ContextProvider()

    # Simulate custom session data
    custom_session_data = {
        "initialized": True,
        "execution_time_seconds": 0.125,  # Slower than optimal
        "executed_actions": [
            {"action": "recall_memory", "query": "terraform patterns", "duration": 0.08},
            {"action": "search_by_tag", "tags": ["best_practices"], "duration": 0.045}
        ],
        "errors": ["Memory service timeout on first attempt"],
        "memory_retrieval_results": {
            "total_memories": 25,
            "relevant_memories": 8
        }
    }

    # Learn from custom session
    learning_result = await provider.learning_engine.learn_from_session_patterns(custom_session_data)

    if learning_result['success']:
        print("Custom Session Learning Results:")
        print(f"  Patterns Learned: {learning_result['patterns_learned']}")
        print(f"  Insights Generated: {len(learning_result['insights_gained'])}")
        print(f"  Memory Stored: {learning_result['memory_stored']}")

        print("\nGenerated Insights:")
        for insight in learning_result['insights_gained']:
            print(f"  • {insight}")

    return learning_result

# Custom session learning
learning_result = asyncio.run(custom_session_learning())
```

## Team Workflow Examples

### Example 12: Team Context Sharing

```python
async def export_optimized_contexts():
    """Export optimized contexts for team sharing"""
    provider = ContextProvider()

    # Analyze all contexts and get optimization suggestions
    optimization_suggestions = await provider.learning_engine.suggest_context_optimizations()

    team_export = {
        "export_timestamp": datetime.now().isoformat(),
        "contexts": {},
        "optimization_suggestions": optimization_suggestions,
        "team_recommendations": []
    }

    # Export each context with effectiveness data
    for context_name in provider.contexts.keys():
        effectiveness = await provider.learning_engine.analyze_context_effectiveness(context_name)

        if effectiveness['success'] and effectiveness['effectiveness_score'] > 0.5:
            team_export["contexts"][context_name] = {
                "context_data": provider.contexts[context_name],
                "effectiveness_score": effectiveness['effectiveness_score'],
                "recommendations": effectiveness['recommendations'],
                "suitable_for_sharing": True
            }

            team_export["team_recommendations"].append(
                f"Share {context_name} context (score: {effectiveness['effectiveness_score']:.2f})"
            )

    # Save team export
    export_file = f"team_contexts_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(export_file, 'w') as f:
        json.dump(team_export, f, indent=2)

    print(f"Team export saved to: {export_file}")
    print(f"Contexts ready for sharing: {len(team_export['contexts'])}")

    return team_export

# Export for team sharing
team_export = asyncio.run(export_optimized_contexts())
```

### Example 13: Team Learning Aggregation

```python
async def aggregate_team_learning():
    """Aggregate learning insights across team members"""
    provider = ContextProvider()

    # Simulate team learning data collection
    team_insights = []

    # Collect optimization suggestions
    suggestions = await provider.learning_engine.suggest_context_optimizations()
    team_insights.extend(suggestions)

    # Collect effectiveness data
    for context_name in provider.contexts.keys():
        effectiveness = await provider.learning_engine.analyze_context_effectiveness(context_name)
        if effectiveness['success']:
            team_insights.append({
                "type": "effectiveness_analysis",
                "context_name": context_name,
                "score": effectiveness['effectiveness_score'],
                "recommendations": effectiveness['recommendations']
            })

    # Generate team report
    report = {
        "team_learning_summary": {
            "total_insights": len(team_insights),
            "high_performing_contexts": [
                insight['context_name'] for insight in team_insights
                if insight.get('score', 0) > 0.7
            ],
            "optimization_opportunities": len([
                insight for insight in team_insights
                if insight.get('optimization_type') == 'global_analysis'
            ])
        },
        "detailed_insights": team_insights
    }

    # Store team learning aggregation
    await provider.memory_service.store_memory(
        f"Team learning aggregation: {len(team_insights)} insights collected",
        ["team_learning", "aggregation", "insights"],
        report
    )

    print("Team Learning Aggregation:")
    print(f"  Total Insights: {report['team_learning_summary']['total_insights']}")
    print(f"  High Performers: {len(report['team_learning_summary']['high_performing_contexts'])}")
    print(f"  Optimization Ops: {report['team_learning_summary']['optimization_opportunities']}")

    return report

# Aggregate team learning
team_report = asyncio.run(aggregate_team_learning())
```

## Enterprise Use Cases

### Example 14: Compliance Monitoring

```python
async def monitor_compliance_contexts():
    """Monitor contexts for compliance with enterprise standards"""
    provider = ContextProvider()

    # Define enterprise compliance requirements
    compliance_requirements = {
        "required_tags": ["Environment", "Project", "Owner"],
        "naming_conventions": {
            "azure": r"^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
            "aws": r"^[a-zA-Z0-9][a-zA-Z0-9-._]{0,126}[a-zA-Z0-9]$"
        },
        "security_patterns": [
            "enable_encryption",
            "access_logging",
            "security_scanning"
        ]
    }

    compliance_report = {
        "compliant_contexts": [],
        "non_compliant_contexts": [],
        "recommendations": []
    }

    # Check each context for compliance
    for context_name, context_data in provider.contexts.items():
        compliance_score = 0
        issues = []

        # Check preferences for security settings
        preferences = context_data.get('preferences', {})
        for security_pattern in compliance_requirements['security_patterns']:
            if any(security_pattern in str(value).lower() for value in preferences.values()):
                compliance_score += 1
            else:
                issues.append(f"Missing security pattern: {security_pattern}")

        # Check naming conventions if applicable
        if context_name in compliance_requirements['naming_conventions']:
            pattern = compliance_requirements['naming_conventions'][context_name]
            # This would check actual resource names in context rules
            compliance_score += 1

        # Determine compliance status
        if compliance_score >= 2 and len(issues) <= 1:
            compliance_report['compliant_contexts'].append({
                "context_name": context_name,
                "score": compliance_score,
                "issues": issues
            })
        else:
            compliance_report['non_compliant_contexts'].append({
                "context_name": context_name,
                "score": compliance_score,
                "issues": issues
            })

            compliance_report['recommendations'].append(
                f"Review {context_name} context for compliance: {len(issues)} issues found"
            )

    # Store compliance report
    await provider.memory_service.store_memory(
        f"Enterprise compliance check: {len(compliance_report['compliant_contexts'])} compliant, "
        f"{len(compliance_report['non_compliant_contexts'])} non-compliant",
        ["compliance", "enterprise", "monitoring"],
        compliance_report
    )

    print("Enterprise Compliance Report:")
    print(f"  Compliant Contexts: {len(compliance_report['compliant_contexts'])}")
    print(f"  Non-Compliant: {len(compliance_report['non_compliant_contexts'])}")
    print(f"  Recommendations: {len(compliance_report['recommendations'])}")

    return compliance_report

# Monitor compliance
compliance_report = asyncio.run(monitor_compliance_contexts())
```

### Example 15: Context Usage Analytics

```python
async def generate_usage_analytics():
    """Generate comprehensive usage analytics for enterprise reporting"""
    provider = ContextProvider()

    analytics_report = {
        "analysis_period": f"{datetime.now().strftime('%Y-%m')}",
        "context_metrics": {},
        "optimization_metrics": {},
        "learning_metrics": {}
    }

    # Analyze each context
    total_effectiveness = 0
    context_count = 0

    for context_name in provider.contexts.keys():
        effectiveness = await provider.learning_engine.analyze_context_effectiveness(context_name)

        if effectiveness['success']:
            context_count += 1
            score = effectiveness['effectiveness_score']
            total_effectiveness += score

            analytics_report['context_metrics'][context_name] = {
                "effectiveness_score": score,
                "usage_stats": effectiveness['usage_stats'],
                "recommendations_count": len(effectiveness['recommendations']),
                "health_status": "excellent" if score > 0.8 else "good" if score > 0.5 else "needs_attention"
            }

    # Calculate optimization metrics
    suggestions = await provider.learning_engine.suggest_context_optimizations()
    analytics_report['optimization_metrics'] = {
        "total_suggestions": len(suggestions),
        "average_effectiveness": total_effectiveness / context_count if context_count > 0 else 0,
        "optimization_opportunities": len([s for s in suggestions if s.get('priority') == 'high'])
    }

    # Get learning metrics from memory
    learning_memories = await provider.memory_service.search_by_tag(
        ["session_learning", "optimization"],
        limit=50
    )

    if learning_memories['success']:
        analytics_report['learning_metrics'] = {
            "total_learning_events": len(learning_memories['results']),
            "recent_optimizations": len([
                m for m in learning_memories['results']
                if 'optimization' in m.get('content', '').lower()
            ])
        }

    # Store analytics report
    await provider.memory_service.store_memory(
        f"Usage analytics generated: {context_count} contexts analyzed, "
        f"avg effectiveness {analytics_report['optimization_metrics']['average_effectiveness']:.2f}",
        ["analytics", "usage", "enterprise"],
        analytics_report
    )

    print("Enterprise Usage Analytics:")
    print(f"  Contexts Analyzed: {context_count}")
    print(f"  Average Effectiveness: {analytics_report['optimization_metrics']['average_effectiveness']:.2f}")
    print(f"  Optimization Opportunities: {analytics_report['optimization_metrics']['optimization_opportunities']}")
    print(f"  Learning Events: {analytics_report['learning_metrics'].get('total_learning_events', 0)}")

    return analytics_report

# Generate analytics
analytics = asyncio.run(generate_usage_analytics())
```

## Troubleshooting Examples

### Example 16: Diagnosing Learning Issues

```python
async def diagnose_learning_issues():
    """Diagnose common learning system issues"""
    provider = ContextProvider()

    diagnostic_report = {
        "memory_service": {"status": "unknown", "issues": []},
        "learning_engine": {"status": "unknown", "issues": []},
        "contexts": {"status": "unknown", "issues": []},
        "recommendations": []
    }

    # Check memory service
    try:
        stats = await provider.memory_service.get_memory_stats()
        if stats['success']:
            diagnostic_report['memory_service']['status'] = "healthy"
            print("✅ Memory service is healthy")
        else:
            diagnostic_report['memory_service']['status'] = "error"
            diagnostic_report['memory_service']['issues'].append(stats.get('error', 'Unknown error'))
            print("❌ Memory service has issues")
    except Exception as e:
        diagnostic_report['memory_service']['status'] = "error"
        diagnostic_report['memory_service']['issues'].append(str(e))
        print(f"❌ Memory service error: {e}")

    # Check learning engine
    try:
        if provider.learning_engine:
            # Test with a simple analysis
            test_contexts = list(provider.contexts.keys())
            if test_contexts:
                test_result = await provider.learning_engine.analyze_context_effectiveness(test_contexts[0])
                if test_result.get('success'):
                    diagnostic_report['learning_engine']['status'] = "healthy"
                    print("✅ Learning engine is functional")
                else:
                    diagnostic_report['learning_engine']['status'] = "error"
                    diagnostic_report['learning_engine']['issues'].append(test_result.get('error', 'Analysis failed'))
                    print("❌ Learning engine has analysis issues")
            else:
                diagnostic_report['learning_engine']['status'] = "warning"
                diagnostic_report['learning_engine']['issues'].append("No contexts available for testing")
                print("⚠️ No contexts available for learning engine testing")
        else:
            diagnostic_report['learning_engine']['status'] = "error"
            diagnostic_report['learning_engine']['issues'].append("Learning engine not initialized")
            print("❌ Learning engine not initialized")
    except Exception as e:
        diagnostic_report['learning_engine']['status'] = "error"
        diagnostic_report['learning_engine']['issues'].append(str(e))
        print(f"❌ Learning engine error: {e}")

    # Check contexts
    try:
        context_count = len(provider.contexts)
        if context_count > 0:
            diagnostic_report['contexts']['status'] = "healthy"
            print(f"✅ {context_count} contexts loaded successfully")
        else:
            diagnostic_report['contexts']['status'] = "warning"
            diagnostic_report['contexts']['issues'].append("No contexts loaded")
            print("⚠️ No contexts loaded")
    except Exception as e:
        diagnostic_report['contexts']['status'] = "error"
        diagnostic_report['contexts']['issues'].append(str(e))
        print(f"❌ Context loading error: {e}")

    # Generate recommendations
    if diagnostic_report['memory_service']['status'] == "error":
        diagnostic_report['recommendations'].append("Check mcp-memory-service configuration in .mcp.json")
        diagnostic_report['recommendations'].append("Verify memory service is running and accessible")

    if diagnostic_report['learning_engine']['status'] == "error":
        diagnostic_report['recommendations'].append("Restart context provider to reinitialize learning engine")
        diagnostic_report['recommendations'].append("Check memory service dependency")

    if diagnostic_report['contexts']['status'] != "healthy":
        diagnostic_report['recommendations'].append("Check CONTEXT_CONFIG_DIR environment variable")
        diagnostic_report['recommendations'].append("Verify context files exist and are valid JSON")

    print(f"\nDiagnostic Summary:")
    print(f"  Memory Service: {diagnostic_report['memory_service']['status']}")
    print(f"  Learning Engine: {diagnostic_report['learning_engine']['status']}")
    print(f"  Contexts: {diagnostic_report['contexts']['status']}")

    if diagnostic_report['recommendations']:
        print(f"\nRecommendations:")
        for rec in diagnostic_report['recommendations']:
            print(f"  • {rec}")

    return diagnostic_report

# Run diagnostics
diagnostic_report = asyncio.run(diagnose_learning_issues())
```

### Example 17: Performance Optimization

```python
async def optimize_learning_performance():
    """Optimize learning system performance"""
    provider = ContextProvider()

    performance_report = {
        "baseline_metrics": {},
        "optimizations_applied": [],
        "performance_improvement": {}
    }

    # Measure baseline performance
    start_time = time.time()

    # Test session initialization performance
    session_start = time.time()
    session_result = await provider.execute_session_initialization()
    session_time = time.time() - session_start

    # Test context analysis performance
    analysis_times = []
    for context_name in list(provider.contexts.keys())[:3]:  # Test first 3 contexts
        analysis_start = time.time()
        await provider.learning_engine.analyze_context_effectiveness(context_name)
        analysis_times.append(time.time() - analysis_start)

    baseline_time = time.time() - start_time

    performance_report['baseline_metrics'] = {
        "total_baseline_time": baseline_time,
        "session_init_time": session_time,
        "average_analysis_time": sum(analysis_times) / len(analysis_times) if analysis_times else 0,
        "contexts_tested": len(analysis_times)
    }

    # Apply performance optimizations
    optimizations = []

    # 1. Reduce memory query frequency
    if session_time > 0.1:
        optimizations.append("Reduce memory query frequency in session initialization")
        performance_report['optimizations_applied'].append("memory_query_optimization")

    # 2. Cache effectiveness scores
    if any(t > 0.05 for t in analysis_times):
        optimizations.append("Implement effectiveness score caching")
        performance_report['optimizations_applied'].append("effectiveness_caching")

    # 3. Batch memory operations
    optimizations.append("Batch memory operations for better performance")
    performance_report['optimizations_applied'].append("batch_operations")

    # Store performance optimization recommendations
    await provider.memory_service.store_memory(
        f"Performance optimization analysis: {len(optimizations)} optimizations recommended",
        ["performance", "optimization", "analysis"],
        performance_report
    )

    print("Performance Optimization Report:")
    print(f"  Baseline Total Time: {baseline_time:.4f}s")
    print(f"  Session Init Time: {session_time:.4f}s")
    print(f"  Average Analysis Time: {performance_report['baseline_metrics']['average_analysis_time']:.4f}s")
    print(f"  Optimizations Recommended: {len(optimizations)}")

    for opt in optimizations:
        print(f"    • {opt}")

    return performance_report

# Optimize performance
perf_report = asyncio.run(optimize_learning_performance())
```

These examples demonstrate the full range of Phase 3 capabilities, from basic learning engine usage to enterprise-level analytics and optimization. They provide practical templates for implementing intelligent context management in real-world scenarios.