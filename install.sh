#!/bin/bash

# MCP Context Provider Installation Script
# Supports Linux, macOS, and other Unix-like systems

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="mcp-context-provider-1.1.0.dxt"
PACKAGE_URL="https://github.com/doobidoo/MCP-Context-Provider/raw/main/${PACKAGE_NAME}"
INSTALL_DIR="$HOME/mcp-context-provider"
CLAUDE_CONFIG_DIR="$HOME/.config/claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Python version
check_python() {
    if ! command_exists python3; then
        if ! command_exists python; then
            print_error "Python is not installed. Please install Python 3.8+ and try again."
            exit 1
        else
            PYTHON_CMD="python"
        fi
    else
        PYTHON_CMD="python3"
    fi
    
    # Check Python version
    PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print('.'.join(map(str, sys.version_info[:2])))")
    REQUIRED_VERSION="3.8"
    
    if ! $PYTHON_CMD -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
        print_error "Python $REQUIRED_VERSION or higher is required. Found: $PYTHON_VERSION"
        exit 1
    fi
    
    print_success "Python $PYTHON_VERSION found"
}

# Function to install dxt if not present
install_dxt() {
    if ! command_exists dxt; then
        print_info "Installing DXT CLI..."
        if command_exists npm; then
            npm install -g @anthropic-ai/dxt
            print_success "DXT CLI installed"
        else
            print_error "npm is not installed. Please install Node.js and npm, then run: npm install -g @anthropic-ai/dxt"
            exit 1
        fi
    else
        print_success "DXT CLI found"
    fi
}

# Function to download DXT package
download_package() {
    print_info "Downloading MCP Context Provider package..."
    
    if command_exists wget; then
        wget -q --show-progress "$PACKAGE_URL" -O "$PACKAGE_NAME"
    elif command_exists curl; then
        curl -L -o "$PACKAGE_NAME" "$PACKAGE_URL"
    else
        print_error "Neither wget nor curl is available. Please install one of them."
        exit 1
    fi
    
    if [ -f "$PACKAGE_NAME" ]; then
        print_success "Package downloaded: $PACKAGE_NAME"
    else
        print_error "Failed to download package"
        exit 1
    fi
}

# Function to unpack DXT package
unpack_package() {
    print_info "Unpacking DXT package to $INSTALL_DIR..."
    
    # Remove existing installation
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Removing existing installation at $INSTALL_DIR"
        rm -rf "$INSTALL_DIR"
    fi
    
    dxt unpack "$PACKAGE_NAME" "$INSTALL_DIR"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_success "Package unpacked to $INSTALL_DIR"
    else
        print_error "Failed to unpack package"
        exit 1
    fi
}

# Function to set up Python virtual environment
setup_venv() {
    print_info "Creating Python virtual environment..."
    
    cd "$INSTALL_DIR"
    $PYTHON_CMD -m venv venv
    
    # Activate virtual environment
    source venv/bin/activate
    
    print_success "Virtual environment created"
    
    # Upgrade pip
    print_info "Upgrading pip..."
    pip install --upgrade pip
    
    # Install MCP package
    print_info "Installing MCP package..."
    pip install "mcp>=1.9.4"
    
    print_success "Dependencies installed"
}

# Function to update Claude Desktop configuration
update_claude_config() {
    print_info "Updating Claude Desktop configuration..."
    
    # Create config directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Python path for virtual environment
    VENV_PYTHON="$INSTALL_DIR/venv/bin/python"
    SERVER_SCRIPT="$INSTALL_DIR/server/context_provider_server.py"
    CONTEXTS_DIR="$INSTALL_DIR/contexts"
    
    # Check if server script exists
    if [ ! -f "$SERVER_SCRIPT" ]; then
        # Try alternative location
        SERVER_SCRIPT="$INSTALL_DIR/context_provider_server.py"
        if [ ! -f "$SERVER_SCRIPT" ]; then
            print_error "Server script not found. Package may be corrupted."
            exit 1
        fi
    fi
    
    # Create or update configuration
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        print_warning "Backing up existing Claude Desktop configuration"
        cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Create new configuration
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "context-provider": {
      "command": "$VENV_PYTHON",
      "args": ["$SERVER_SCRIPT"],
      "env": {
        "CONTEXT_CONFIG_DIR": "$CONTEXTS_DIR",
        "AUTO_LOAD_CONTEXTS": "true"
      }
    }
  }
}
EOF
    
    print_success "Claude Desktop configuration updated"
    print_info "Configuration file: $CLAUDE_CONFIG_FILE"
}

# Function to verify installation
verify_installation() {
    print_info "Verifying installation..."
    
    # Check if all required files exist
    local files_to_check=(
        "$INSTALL_DIR/venv/bin/python"
        "$INSTALL_DIR/contexts"
        "$CLAUDE_CONFIG_FILE"
    )
    
    for file in "${files_to_check[@]}"; do
        if [ ! -e "$file" ]; then
            print_error "Missing: $file"
            return 1
        fi
    done
    
    # Test Python environment
    cd "$INSTALL_DIR"
    source venv/bin/activate
    
    if ! python -c "import mcp; print('MCP package available')" 2>/dev/null; then
        print_error "MCP package not properly installed"
        return 1
    fi
    
    print_success "Installation verified successfully"
    return 0
}

# Function to cleanup temporary files
cleanup() {
    if [ -f "$PACKAGE_NAME" ]; then
        rm -f "$PACKAGE_NAME"
        print_info "Cleaned up temporary files"
    fi
}

# Main installation function
main() {
    echo
    print_info "Starting MCP Context Provider installation..."
    echo
    
    # Pre-installation checks
    check_python
    install_dxt
    
    # Download and install
    download_package
    unpack_package
    setup_venv
    update_claude_config
    
    # Verify and cleanup
    if verify_installation; then
        cleanup
        echo
        print_success "Installation completed successfully!"
        echo
        print_info "Next steps:"
        echo "  1. Restart Claude Desktop"
        echo "  2. The MCP Context Provider tools should now be available"
        echo "  3. Try using 'list_available_contexts' tool to verify"
        echo
        print_info "Installation location: $INSTALL_DIR"
        print_info "Configuration file: $CLAUDE_CONFIG_FILE"
        echo
    else
        print_error "Installation verification failed"
        exit 1
    fi
}

# Handle interruption
trap 'print_error "Installation interrupted"; cleanup; exit 1' INT TERM

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended. Consider running as a regular user."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run main installation
main