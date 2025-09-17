@echo off
setlocal enabledelayedexpansion

:: MCP Context Provider Installation Script for Windows
:: Supports Windows 10 and Windows 11

:: Configuration
set "PACKAGE_NAME=mcp-context-provider-1.2.1.dxt"
set "PACKAGE_URL=https://github.com/doobidoo/MCP-Context-Provider/raw/main/%PACKAGE_NAME%"
set "INSTALL_DIR=%USERPROFILE%\mcp-context-provider"
set "CLAUDE_CONFIG_DIR=%APPDATA%\Claude"
set "CLAUDE_CONFIG_FILE=%CLAUDE_CONFIG_DIR%\claude_desktop_config.json"

:: Colors (if supported)
set "INFO=[INFO]"
set "SUCCESS=[OK]"
set "WARNING=[WARN]"
set "ERROR=[ERROR]"

echo.
echo %INFO% Starting MCP Context Provider installation...
echo.

:: Check if Python is installed
echo %INFO% Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo %ERROR% Python is not installed or not in PATH.
    echo Please install Python 3.8+ from https://python.org and add it to PATH.
    pause
    exit /b 1
)

:: Check Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo %SUCCESS% Python %PYTHON_VERSION% found

:: Extract major.minor version for comparison
for /f "tokens=1,2 delims=." %%a in ("%PYTHON_VERSION%") do (
    set PYTHON_MAJOR=%%a
    set PYTHON_MINOR=%%b
)

:: Check if version is 3.8+
if %PYTHON_MAJOR% LSS 3 (
    echo %ERROR% Python 3.8+ is required. Found: %PYTHON_VERSION%
    pause
    exit /b 1
)
if %PYTHON_MAJOR% EQU 3 if %PYTHON_MINOR% LSS 8 (
    echo %ERROR% Python 3.8+ is required. Found: %PYTHON_VERSION%
    pause
    exit /b 1
)

:: Check if npm/dxt is available
echo %INFO% Checking DXT CLI...
dxt --version >nul 2>&1
if errorlevel 1 (
    echo %INFO% DXT CLI not found. Installing...
    npm --version >nul 2>&1
    if errorlevel 1 (
        echo %ERROR% npm is not installed. Please install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
    
    echo %INFO% Installing DXT CLI via npm...
    npm install -g @anthropic-ai/dxt
    if errorlevel 1 (
        echo %ERROR% Failed to install DXT CLI
        pause
        exit /b 1
    )
    echo %SUCCESS% DXT CLI installed
) else (
    echo %SUCCESS% DXT CLI found
)

:: Download the package
echo %INFO% Downloading MCP Context Provider package...
powershell -Command "& {Invoke-WebRequest -Uri '%PACKAGE_URL%' -OutFile '%PACKAGE_NAME%' -UseBasicParsing}"
if errorlevel 1 (
    echo %ERROR% Failed to download package
    pause
    exit /b 1
)

if not exist "%PACKAGE_NAME%" (
    echo %ERROR% Package file not found after download
    pause
    exit /b 1
)
echo %SUCCESS% Package downloaded: %PACKAGE_NAME%

:: Remove existing installation
if exist "%INSTALL_DIR%" (
    echo %WARNING% Removing existing installation at %INSTALL_DIR%
    rmdir /s /q "%INSTALL_DIR%"
)

:: Unpack the package
echo %INFO% Unpacking DXT package to %INSTALL_DIR%...
dxt unpack "%PACKAGE_NAME%" "%INSTALL_DIR%"
if errorlevel 1 (
    echo %ERROR% Failed to unpack package
    pause
    exit /b 1
)

if not exist "%INSTALL_DIR%" (
    echo %ERROR% Installation directory not created
    pause
    exit /b 1
)
echo %SUCCESS% Package unpacked to %INSTALL_DIR%

:: Create Python virtual environment
echo %INFO% Creating Python virtual environment...
cd /d "%INSTALL_DIR%"
python -m venv venv
if errorlevel 1 (
    echo %ERROR% Failed to create virtual environment
    pause
    exit /b 1
)
echo %SUCCESS% Virtual environment created

:: Activate virtual environment and install dependencies
echo %INFO% Installing dependencies...
call venv\Scripts\activate.bat

:: Upgrade pip
echo %INFO% Upgrading pip...
python -m pip install --upgrade pip

:: Install MCP package
echo %INFO% Installing MCP package...
pip install "mcp>=1.9.4"
if errorlevel 1 (
    echo %ERROR% Failed to install MCP package
    pause
    exit /b 1
)
echo %SUCCESS% Dependencies installed

:: Update Claude Desktop configuration
echo %INFO% Updating Claude Desktop configuration...

:: Create config directory if it doesn't exist
if not exist "%CLAUDE_CONFIG_DIR%" (
    mkdir "%CLAUDE_CONFIG_DIR%"
)

:: Set paths for configuration
set "VENV_PYTHON=%INSTALL_DIR%\venv\Scripts\python.exe"
set "SERVER_SCRIPT=%INSTALL_DIR%\server\context_provider_server.py"
set "CONTEXTS_DIR=%INSTALL_DIR%\contexts"

:: Check if server script exists in server subdirectory
if not exist "%SERVER_SCRIPT%" (
    set "SERVER_SCRIPT=%INSTALL_DIR%\context_provider_server.py"
    if not exist "!SERVER_SCRIPT!" (
        echo %ERROR% Server script not found. Package may be corrupted.
        pause
        exit /b 1
    )
)

:: Backup existing configuration
if exist "%CLAUDE_CONFIG_FILE%" (
    echo %WARNING% Backing up existing Claude Desktop configuration
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set DATE=%%c%%a%%b
    for /f "tokens=1-2 delims=/: " %%a in ("%time%") do set TIME=%%a%%b
    copy "%CLAUDE_CONFIG_FILE%" "%CLAUDE_CONFIG_FILE%.backup.%DATE%_%TIME%"
)

:: Convert Windows paths to use forward slashes for JSON
set "VENV_PYTHON_JSON=%VENV_PYTHON:\=/%"
set "SERVER_SCRIPT_JSON=%SERVER_SCRIPT:\=/%"
set "CONTEXTS_DIR_JSON=%CONTEXTS_DIR:\=/%"

:: Create new configuration
(
echo {
echo   "mcpServers": {
echo     "context-provider": {
echo       "command": "%VENV_PYTHON_JSON%",
echo       "args": ["%SERVER_SCRIPT_JSON%"],
echo       "env": {
echo         "CONTEXT_CONFIG_DIR": "%CONTEXTS_DIR_JSON%",
echo         "AUTO_LOAD_CONTEXTS": "true"
echo       }
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG_FILE%"

echo %SUCCESS% Claude Desktop configuration updated
echo %INFO% Configuration file: %CLAUDE_CONFIG_FILE%

:: Verify installation
echo %INFO% Verifying installation...

:: Check if required files exist
if not exist "%VENV_PYTHON%" (
    echo %ERROR% Missing: %VENV_PYTHON%
    goto :verification_failed
)

if not exist "%CONTEXTS_DIR%" (
    echo %ERROR% Missing: %CONTEXTS_DIR%
    goto :verification_failed
)

if not exist "%CLAUDE_CONFIG_FILE%" (
    echo %ERROR% Missing: %CLAUDE_CONFIG_FILE%
    goto :verification_failed
)

:: Test Python environment
cd /d "%INSTALL_DIR%"
call venv\Scripts\activate.bat
python -c "import mcp; print('MCP package available')" >nul 2>&1
if errorlevel 1 (
    echo %ERROR% MCP package not properly installed
    goto :verification_failed
)

echo %SUCCESS% Installation verified successfully

:: Cleanup
if exist "%PACKAGE_NAME%" (
    del "%PACKAGE_NAME%"
    echo %INFO% Cleaned up temporary files
)

echo.
echo %SUCCESS% Installation completed successfully!
echo.
echo %INFO% Next steps:
echo   1. Restart Claude Desktop
echo   2. The MCP Context Provider tools should now be available
echo   3. Try using 'list_available_contexts' tool to verify
echo.
echo %INFO% Installation location: %INSTALL_DIR%
echo %INFO% Configuration file: %CLAUDE_CONFIG_FILE%
echo.
pause
exit /b 0

:verification_failed
echo %ERROR% Installation verification failed
pause
exit /b 1