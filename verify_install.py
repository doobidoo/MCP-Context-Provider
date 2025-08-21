#!/usr/bin/env python3
"""
MCP Context Provider Installation Verification Script

This script checks if the MCP Context Provider is properly installed and configured.
Run this after installation to verify everything is working correctly.
"""

import os
import sys
import json
import platform
from pathlib import Path
import importlib.util

# Colors for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    PURPLE = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color

def print_info(message):
    print(f"{Colors.BLUE}ℹ{Colors.NC} {message}")

def print_success(message):
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠{Colors.NC} {message}")

def print_error(message):
    print(f"{Colors.RED}✗{Colors.NC} {message}")

def print_header(message):
    print(f"\n{Colors.PURPLE}=== {message} ==={Colors.NC}")

def check_python_version():
    """Check if Python version meets requirements"""
    print_header("Python Environment Check")
    
    python_version = sys.version_info
    version_str = f"{python_version.major}.{python_version.minor}.{python_version.micro}"
    
    print_info(f"Python version: {version_str}")
    
    if python_version >= (3, 8):
        print_success("Python version meets requirements (3.8+)")
        return True
    else:
        print_error(f"Python 3.8+ is required. Found: {version_str}")
        return False

def check_mcp_package():
    """Check if MCP package is installed"""
    print_header("MCP Package Check")
    
    try:
        import mcp
        print_success("MCP package is installed")
        
        # Try to get version if available
        try:
            version = getattr(mcp, '__version__', 'unknown')
            print_info(f"MCP version: {version}")
        except:
            print_info("MCP version: unknown")
        
        return True
    except ImportError:
        print_error("MCP package not found")
        print_info("Install with: pip install mcp>=1.9.4")
        return False

def find_installation_directory():
    """Find the MCP Context Provider installation directory"""
    possible_locations = [
        Path.home() / "mcp-context-provider",
        Path.cwd(),
        Path(__file__).parent,
    ]
    
    for location in possible_locations:
        if location.exists() and (location / "contexts").exists():
            return location
    
    return None

def check_installation_files():
    """Check if all required installation files exist"""
    print_header("Installation Files Check")
    
    install_dir = find_installation_directory()
    if not install_dir:
        print_error("MCP Context Provider installation directory not found")
        print_info("Expected locations:")
        print_info(f"  - {Path.home() / 'mcp-context-provider'}")
        print_info(f"  - {Path.cwd()}")
        return False, None
    
    print_success(f"Installation directory found: {install_dir}")
    
    required_items = [
        ("contexts", "directory", "Context files directory"),
        ("context_provider_server.py", "file", "Main server script"),
    ]
    
    # Check for server script in alternative location
    server_script = install_dir / "context_provider_server.py"
    if not server_script.exists():
        server_script = install_dir / "server" / "context_provider_server.py"
        if server_script.exists():
            required_items[1] = ("server/context_provider_server.py", "file", "Main server script")
    
    all_present = True
    for item_name, item_type, description in required_items:
        item_path = install_dir / item_name
        if item_path.exists():
            if item_type == "directory" and item_path.is_dir():
                print_success(f"{description}: {item_path}")
            elif item_type == "file" and item_path.is_file():
                print_success(f"{description}: {item_path}")
            else:
                print_error(f"{description}: Wrong type at {item_path}")
                all_present = False
        else:
            print_error(f"{description}: Missing at {item_path}")
            all_present = False
    
    return all_present, install_dir

def check_context_files(install_dir):
    """Check context JSON files for validity"""
    print_header("Context Files Check")
    
    contexts_dir = install_dir / "contexts"
    if not contexts_dir.exists():
        print_error("Contexts directory not found")
        return False
    
    json_files = list(contexts_dir.glob("*.json"))
    if not json_files:
        print_error("No JSON context files found")
        return False
    
    print_info(f"Found {len(json_files)} context files")
    
    valid_files = 0
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Basic validation
            required_fields = ['tool_category', 'description']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_warning(f"{json_file.name}: Missing fields: {missing_fields}")
            else:
                print_success(f"{json_file.name}: Valid JSON with required fields")
                valid_files += 1
                
        except json.JSONDecodeError as e:
            print_error(f"{json_file.name}: Invalid JSON - {e}")
        except Exception as e:
            print_error(f"{json_file.name}: Error reading file - {e}")
    
    if valid_files > 0:
        print_success(f"{valid_files} context files are valid")
        return True
    else:
        print_error("No valid context files found")
        return False

def check_server_loading(install_dir):
    """Test if the context provider server loads correctly"""
    print_header("Server Loading Check")
    
    # Find server script
    server_script = install_dir / "context_provider_server.py"
    if not server_script.exists():
        server_script = install_dir / "server" / "context_provider_server.py"
    
    if not server_script.exists():
        print_error("Server script not found")
        return False
    
    try:
        # Add install directory to Python path
        original_path = sys.path.copy()
        sys.path.insert(0, str(install_dir))
        
        # Set environment variables
        os.environ['CONTEXT_CONFIG_DIR'] = str(install_dir / "contexts")
        
        # Try to import and create ContextProvider
        spec = importlib.util.spec_from_file_location("context_provider_server", server_script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Try to create provider instance
        provider = module.ContextProvider()
        context_count = len(provider.contexts)
        
        print_success(f"Server loads successfully")
        print_success(f"Loaded {context_count} contexts")
        
        # List loaded contexts
        if context_count > 0:
            context_names = list(provider.contexts.keys())
            print_info(f"Available contexts: {', '.join(context_names)}")
        
        return True
        
    except Exception as e:
        print_error(f"Server loading failed: {e}")
        return False
    finally:
        # Restore original path
        sys.path = original_path

def find_claude_config():
    """Find Claude Desktop configuration file"""
    system = platform.system()
    
    if system == "Windows":
        config_path = Path(os.environ['APPDATA']) / "Claude" / "claude_desktop_config.json"
    elif system == "Darwin":  # macOS
        config_path = Path.home() / ".config" / "claude" / "claude_desktop_config.json"
    else:  # Linux and others
        config_path = Path.home() / ".config" / "claude" / "claude_desktop_config.json"
    
    return config_path if config_path.exists() else None

def check_claude_configuration():
    """Check Claude Desktop configuration"""
    print_header("Claude Desktop Configuration Check")
    
    config_path = find_claude_config()
    if not config_path:
        print_error("Claude Desktop configuration file not found")
        print_info("Expected locations:")
        if platform.system() == "Windows":
            print_info(f"  - {Path(os.environ['APPDATA']) / 'Claude' / 'claude_desktop_config.json'}")
        else:
            print_info(f"  - {Path.home() / '.config' / 'claude' / 'claude_desktop_config.json'}")
        return False
    
    print_success(f"Configuration file found: {config_path}")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print_success("Configuration file is valid JSON")
        
        # Check for MCP servers
        if 'mcpServers' not in config:
            print_warning("No 'mcpServers' section in configuration")
            return False
        
        mcp_servers = config['mcpServers']
        context_provider_configs = [
            name for name in mcp_servers.keys() 
            if 'context' in name.lower() or 'provider' in name.lower()
        ]
        
        if not context_provider_configs:
            print_warning("No context provider server found in configuration")
            print_info("Expected server name containing 'context' or 'provider'")
            return False
        
        # Check each context provider configuration
        for server_name in context_provider_configs:
            server_config = mcp_servers[server_name]
            print_success(f"Found MCP server configuration: {server_name}")
            
            # Check required fields
            if 'command' in server_config:
                command = server_config['command']
                print_info(f"Command: {command}")
                
                # Check if command path exists
                command_path = Path(command)
                if command_path.exists():
                    print_success(f"Command executable exists: {command}")
                else:
                    print_warning(f"Command executable not found: {command}")
            
            if 'args' in server_config:
                args = server_config['args']
                print_info(f"Arguments: {args}")
                
                # Check if server script exists
                if args and len(args) > 0:
                    script_path = Path(args[0])
                    if script_path.exists():
                        print_success(f"Server script exists: {args[0]}")
                    else:
                        print_warning(f"Server script not found: {args[0]}")
        
        return True
        
    except json.JSONDecodeError as e:
        print_error(f"Configuration file has invalid JSON: {e}")
        return False
    except Exception as e:
        print_error(f"Error reading configuration: {e}")
        return False

def run_comprehensive_check():
    """Run all verification checks"""
    print_info("MCP Context Provider Installation Verification")
    print_info("=" * 50)
    
    checks = [
        ("Python Environment", check_python_version),
        ("MCP Package", check_mcp_package),
        ("Installation Files", lambda: check_installation_files()[0]),
        ("Context Files", lambda: check_context_files(find_installation_directory()) if find_installation_directory() else False),
        ("Server Loading", lambda: check_server_loading(find_installation_directory()) if find_installation_directory() else False),
        ("Claude Configuration", check_claude_configuration),
    ]
    
    results = []
    for check_name, check_func in checks:
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print_error(f"Error during {check_name} check: {e}")
            results.append((check_name, False))
    
    # Summary
    print_header("Verification Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        if result:
            print_success(f"{check_name}: PASSED")
        else:
            print_error(f"{check_name}: FAILED")
    
    print()
    if passed == total:
        print_success(f"All checks passed ({passed}/{total})!")
        print_success("MCP Context Provider is properly installed and configured.")
        print()
        print_info("Next steps:")
        print_info("1. Restart Claude Desktop")
        print_info("2. Start a new chat session")
        print_info("3. Try asking Claude to list available contexts")
        return True
    else:
        print_error(f"Some checks failed ({passed}/{total})")
        print_error("Please review the errors above and fix the issues.")
        return False

def show_installation_info():
    """Show information about the current installation"""
    install_dir = find_installation_directory()
    if install_dir:
        print_header("Installation Information")
        print_info(f"Installation directory: {install_dir}")
        
        contexts_dir = install_dir / "contexts"
        if contexts_dir.exists():
            json_files = list(contexts_dir.glob("*.json"))
            print_info(f"Context files: {len(json_files)}")
            for json_file in sorted(json_files):
                print_info(f"  - {json_file.name}")
        
        config_path = find_claude_config()
        if config_path:
            print_info(f"Claude config: {config_path}")

def main():
    """Main verification function"""
    if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h']:
        print("MCP Context Provider Installation Verification")
        print()
        print("Usage:")
        print("  python verify_install.py        # Run all verification checks")
        print("  python verify_install.py --info # Show installation information")
        print("  python verify_install.py --help # Show this help")
        return
    
    if len(sys.argv) > 1 and sys.argv[1] == '--info':
        show_installation_info()
        return
    
    success = run_comprehensive_check()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()