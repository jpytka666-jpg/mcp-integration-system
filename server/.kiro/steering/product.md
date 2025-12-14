# Product Overview

Kiro Configuration System is a TypeScript library for managing configuration in the Kiro IDE.

## Purpose
Provides programmatic management of:
- MCP (Model Context Protocol) server configurations
- Steering files for AI context injection
- Agent hooks for automated workflows
- Spec-driven feature development

## Core Capabilities
- Directory structure management (`.kiro/` hierarchy)
- Configuration validation with detailed error reporting
- Multi-level config merging (user → workspace priority)
- Steering file parsing with file reference resolution
- Hook lifecycle management and execution

## Verified MCP Integration

### Operational Powers ✅
1. **AWS AgentCore Power** - Bedrock AgentCore development and deployment
2. **SaaS Builder Power** - Multi-tenant SaaS application development
   - DynamoDB data modeling and operations
   - Serverless deployment with SAM/CDK
   - Browser automation testing with Playwright
   - External API integration
   - AWS documentation and best practices
3. **Windows MCP Server** - Windows system automation and control

### Configuration Management
- **AWS Profile**: `125140434314` (verified working)
- **AWS Region**: `eu-west-2` (London region)
- **Multi-level Configuration**: User-level and workspace-level MCP configs
- **Credential Management**: Automated AWS credential injection
- **Server Health Monitoring**: Automated validation and testing

### Integration Patterns
- Power activation and tool execution workflows
- Error handling and retry mechanisms
- Performance monitoring and optimization
- Fallback strategies for resilient operations
- Automated testing and validation frameworks
