# Examples

Real-world usage examples and use cases for the MCP Context Provider.

## Table of Contents

- [DokuWiki Syntax Conversion](#dokuwiki-syntax-conversion)
- [Azure Resource Naming](#azure-resource-naming)
- [Terraform Best Practices](#terraform-best-practices)
- [Git Workflow Integration](#git-workflow-integration)
- [Cross-Tool Scenarios](#cross-tool-scenarios)
- [Enterprise Use Cases](#enterprise-use-cases)

## DokuWiki Syntax Conversion

### Basic Markdown to DokuWiki

**Input (Markdown)**:
```markdown
# Project Documentation

This is a sample document with various formatting.

## Features

- Feature 1: Basic functionality
- Feature 2: Advanced options
- Feature 3: Integration support

### Code Example

```javascript
function greet(name) {
    return `Hello, ${name}!`;
}
```

> **Note**: This is important information.

For more details, see [our website](https://example.com).
```

**Auto-converted to DokuWiki**:
```
====== Project Documentation ======

This is a sample document with various formatting.

===== Features =====

  * Feature 1: Basic functionality
  * Feature 2: Advanced options  
  * Feature 3: Integration support

==== Code Example ====

<code javascript>
function greet(name) {
    return `Hello, ${name}!`;
}
</code>

<note important>This is important information.</note>

For more details, see [[https://example.com|our website]].
```

### Advanced DokuWiki Features

**Input**:
```markdown
### Installation Steps

1. Download the package
2. Extract to `/var/www/html`
3. Run configuration wizard

#### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| debug | false | Enable debug mode |
| timeout | 30 | Connection timeout |

<div class="warning">
⚠️ Always backup before upgrading!
</div>
```

**Auto-converted**:
```
==== Installation Steps ====

  - Download the package
  - Extract to ''/var/www/html''
  - Run configuration wizard

=== Configuration Options ===

^ Setting ^ Default ^ Description ^
| debug | false | Enable debug mode |
| timeout | 30 | Connection timeout |

<note warning>Always backup before upgrading!</note>
```

## Azure Resource Naming

### Storage Account Creation

**Input (Inconsistent naming)**:
```bash
# Create storage account for logs in production
az storage account create \
    --name "Storage_Account_Logs_Prod_WestEurope" \
    --resource-group "ResourceGroup-Web-Production" \
    --location "West Europe" \
    --sku "Standard_LRS"
```

**Auto-corrected**:
```bash
# Create storage account for logs in production
az storage account create \
    --name "stlogsprodwe01" \
    --resource-group "rg-web-prod-westeurope" \
    --location "westeurope" \
    --sku "Standard_LRS"
```

### Resource Group Naming

**Input**:
```json
{
  "resourceGroups": [
    "web_app_development",
    "DatabaseResourceGroup_Prod",
    "monitoring resources staging"
  ]
}
```

**Auto-corrected**:
```json
{
  "resourceGroups": [
    "rg-webapp-dev-westeurope",
    "rg-database-prod-westeurope", 
    "rg-monitoring-staging-westeurope"
  ]
}
```

### Terraform Azure Resources

**Input**:
```hcl
resource "azurerm_storage_account" "example_storage" {
  name                = "mystorageaccount123"
  resource_group_name = "my-resource-group"
  location           = "West Europe"
  account_tier       = "Standard"
  account_replication_type = "LRS"
}
```

**Auto-corrected with context**:
```hcl
resource "azurerm_storage_account" "example_storage" {
  name                = "stexampleprodwe01"
  resource_group_name = azurerm_resource_group.example.name
  location           = "westeurope"
  account_tier       = "Standard"
  account_replication_type = "LRS"
  
  min_tls_version          = "TLS1_2"
  enable_https_traffic_only = true
  
  tags = var.common_tags
}
```

## Terraform Best Practices

### Variable Naming and Documentation

**Input (Poor practices)**:
```hcl
variable "rg" {
  type = string
}

variable "loc" {
  type = string
  default = "westeurope"
}

variable "webAppSku" {
  type = string
}
```

**Auto-corrected**:
```hcl
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for resource deployment"
  type        = string
  default     = "westeurope"
}

variable "web_app_sku" {
  description = "SKU for the web app service plan"
  type        = string
  
  validation {
    condition = contains(["B1", "B2", "S1", "P1v2"], var.web_app_sku)
    error_message = "SKU must be a valid App Service plan SKU."
  }
}
```

### Resource Naming and Tagging

**Input**:
```hcl
resource "azurerm_resource_group" "main" {
  name     = var.rg
  location = var.loc
}

resource "azurerm_app_service_plan" "plan" {
  name                = "my-app-plan"
  location            = var.loc
  resource_group_name = azurerm_resource_group.main.name
  
  sku {
    tier = "Standard"
    size = "S1"
  }
}
```

**Auto-corrected**:
```hcl
resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  
  tags = var.common_tags
}

resource "azurerm_service_plan" "plan" {
  name                = "asp-${var.project}-${var.environment}-${var.location_short}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "S1"
  
  tags = var.common_tags
}
```

## Git Workflow Integration

### Commit Message Standardization

**Input (Poor commit messages)**:
```
Fixed bug
Updated code
Added new stuff
```

**Auto-corrected**:
```
fix: resolve null pointer exception in user authentication

feat: implement OAuth2 integration with Azure AD

chore: update dependencies to latest stable versions
```

### Branch Naming

**Input**:
```bash
git checkout -b "Fix Login Bug"
git checkout -b "new_feature_user_management"  
git checkout -b "HOTFIX_Critical_Security_Issue"
```

**Auto-corrected**:
```bash
git checkout -b "bugfix/fix-login-authentication"
git checkout -b "feature/user-management-system"
git checkout -b "hotfix/critical-security-patch"
```

### Pull Request Templates

**Input**:
```markdown
## Changes
- Fixed some stuff
- Updated files
- Made improvements

## Testing
- Tested locally
```

**Auto-corrected with context**:
```markdown
## Summary
Brief description of changes and motivation.

## Changes Made
- fix(auth): resolve session timeout issues
- feat(api): add rate limiting middleware  
- docs(readme): update installation instructions

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Breaking Changes
None

## Additional Notes
Any deployment considerations or follow-up tasks.
```

## Cross-Tool Scenarios

### Infrastructure Documentation

Combining Terraform, Azure, and DokuWiki contexts:

**Input**:
```markdown
# Azure Infrastructure Setup

## Resource Groups

We need to create resource groups for:
- Web applications (development)
- Databases (production) 
- Monitoring (staging)

## Storage Accounts

```terraform
resource "azurerm_storage_account" "logs" {
  name = "logsstorageaccount"
  location = "West Europe"
}
```

See [Azure Documentation](https://docs.microsoft.com) for more details.
```

**Auto-converted (Multi-context)**:
```
====== Azure Infrastructure Setup ======

===== Resource Groups =====

We need to create resource groups for:
  * Web applications (development): ''rg-webapp-dev-westeurope''
  * Databases (production): ''rg-database-prod-westeurope''
  * Monitoring (staging): ''rg-monitoring-staging-westeurope''

===== Storage Accounts =====

<code terraform>
resource "azurerm_storage_account" "logs" {
  name                = "stlogsprodwe01"
  location           = "westeurope"
  resource_group_name = azurerm_resource_group.logs.name
  account_tier       = "Standard"
  account_replication_type = "LRS"
  
  min_tls_version          = "TLS1_2"
  enable_https_traffic_only = true
  
  tags = var.common_tags
}
</code>

See [[https://docs.microsoft.com|Azure Documentation]] for more details.
```

### DevOps Pipeline Configuration

**Input (Multiple contexts applied)**:
```yaml
# CI/CD Pipeline
name: Deploy to Azure

on:
  push:
    branches: [ main, develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
        
      - name: Deploy Infrastructure  
        run: |
          terraform init
          terraform plan -var="rg_name=my-resources"
          terraform apply -auto-approve
```

**Auto-corrected**:
```yaml
# CI/CD Pipeline
name: Deploy to Azure

on:
  push:
    branches: [ main, develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Deploy infrastructure
        run: |
          terraform init
          terraform plan -var="resource_group_name=rg-webapp-prod-westeurope"
          terraform apply -auto-approve
          
      - name: Commit changes
        run: |
          git add .
          git commit -m "chore(infrastructure): deploy production infrastructure updates"
```

## Enterprise Use Cases

### Multi-Environment Configuration

**Scenario**: Large organization with multiple environments and strict naming conventions.

**Context Configuration**:
```json
{
  "preferences": {
    "environments": {
      "dev": {
        "resource_prefix": "dev",
        "location": "northeurope",
        "cost_center": "DEV001"
      },
      "staging": {
        "resource_prefix": "stg", 
        "location": "westeurope",
        "cost_center": "STG001"
      },
      "prod": {
        "resource_prefix": "prd",
        "location": "westeurope", 
        "cost_center": "PRD001"
      }
    }
  }
}
```

**Usage Result**:
- Development: `rg-webapp-dev-northeurope`
- Staging: `rg-webapp-stg-westeurope`
- Production: `rg-webapp-prd-westeurope`

### Compliance and Governance

**Scenario**: Financial services company with strict compliance requirements.

**Auto-Applied Rules**:
```json
{
  "compliance": {
    "required_tags": [
      "Environment",
      "Owner", 
      "CostCenter",
      "DataClassification",
      "BackupRequired"
    ],
    "naming_validation": {
      "enforce_lowercase": true,
      "max_length_storage": 24,
      "required_prefixes": ["st", "rg", "kv"]
    },
    "security": {
      "require_https": true,
      "min_tls_version": "1.2",
      "disable_public_access": true
    }
  }
}
```

**Input**:
```terraform
resource "azurerm_storage_account" "CustomerData" {
  name = "CustomerstoragePROD"
}
```

**Auto-corrected**:
```terraform
resource "azurerm_storage_account" "customer_data" {
  name                = "stcustomerprod01"
  resource_group_name = azurerm_resource_group.main.name
  location           = var.location
  
  # Compliance requirements
  min_tls_version          = "TLS1_2"
  enable_https_traffic_only = true
  public_network_access_enabled = false
  
  tags = {
    Environment        = var.environment
    Owner             = var.owner_email
    CostCenter        = var.cost_center
    DataClassification = "Confidential"
    BackupRequired    = "true"
  }
}
```

### Team Collaboration

**Scenario**: Development team with different tool preferences but shared standards.

**Team Member A** (Prefers Markdown):
```markdown
# API Documentation

## Endpoints

### User Authentication
- POST /api/auth/login
- POST /api/auth/logout
```

**Team Member B** (DokuWiki environment):
Sees the same content auto-converted:
```
====== API Documentation ======

===== Endpoints =====

==== User Authentication ====
  * POST ''/api/auth/login''
  * POST ''/api/auth/logout''
```

Both team members work in their preferred format, but the content remains consistent.

### Migration Scenarios

**Legacy Documentation Migration**:

**Input (Legacy format)**:
```html
<h1>System Requirements</h1>
<p>The following are required:</p>
<ul>
  <li>Python 3.8+</li>
  <li>Node.js 16+</li>
  <li>Docker</li>
</ul>

<div class="note">
  <strong>Important:</strong> Ensure all dependencies are installed.
</div>

<pre><code class="bash">
pip install -r requirements.txt
npm install
</code></pre>
```

**Auto-converted to DokuWiki**:
```
====== System Requirements ======

The following are required:
  * Python 3.8+
  * Node.js 16+
  * Docker

<note important>Ensure all dependencies are installed.</note>

<code bash>
pip install -r requirements.txt
npm install
</code>
```

## Interactive Examples

### Using Context Tools in Claude

**Example conversation**:

**User**: "I need to create Azure storage for application logs"

**Claude** (with context): 
```bash
# Creating Azure storage account for application logs
az storage account create \
  --name "stapplogsprodwe01" \
  --resource-group "rg-app-prod-westeurope" \
  --location "westeurope" \
  --sku "Standard_LRS" \
  --min-tls-version "TLS1_2" \
  --https-only true \
  --tags Environment=prod Project=webapp Owner=team@company.com
```

**Context applied automatically**:
- Azure naming conventions
- Security best practices
- Required tags
- Standard location

### Context-Aware Code Reviews

**Pull Request**:
```terraform
resource "azurerm_storage_account" "main" {
  name = "mystorageaccount"
  location = "West Europe"
}
```

**Claude with Context Provider**:
"I notice several issues with this Terraform code based on our context rules:

1. **Naming Convention**: Storage account name should follow pattern `st{purpose}{env}{location}{instance}`
2. **Location**: Should use short form `westeurope` instead of `West Europe`  
3. **Security**: Missing required security settings
4. **Tags**: Missing required tags

Here's the corrected version:

```terraform
resource "azurerm_storage_account" "main" {
  name                = "stmainprodwe01"
  location           = "westeurope"
  resource_group_name = azurerm_resource_group.main.name
  
  min_tls_version          = "TLS1_2"
  enable_https_traffic_only = true
  
  tags = var.common_tags
}
```

This demonstrates how the Context Provider enables Claude to provide consistent, context-aware feedback across all interactions.