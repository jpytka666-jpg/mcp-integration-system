---
inclusion: always
---

# Project Standards

This steering file contains the coding standards and practices for this project.

## Code Quality
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write comprehensive tests for all functionality
- Use meaningful variable and function names

## Architecture Principles
- Follow SOLID principles
- Use dependency injection where appropriate
- Implement proper error handling
- Create modular, reusable components

## MCP Integration Standards

### Configuration Management
- Always use verified AWS credentials: Profile `125140434314`, Region `eu-west-2`
- Maintain consistent environment variables across all AWS MCP servers
- Use workspace-level configs to override user-level settings when needed
- Keep log levels at `ERROR` for production to reduce noise

### Power Usage Patterns
- Always activate powers before using tools: `kiroPowers("activate", powerName)`
- Use proper server names from activation response
- Implement retry logic with exponential backoff for network operations
- Handle errors gracefully with fallback strategies

### Testing Requirements
- Test all MCP server integrations in CI/CD pipeline
- Validate configuration changes before deployment
- Monitor server health with automated checks
- Include performance benchmarks for critical operations

### Security Practices
- Never hardcode credentials in source code
- Use environment variables for sensitive configuration
- Implement proper error handling to avoid credential leakage
- Validate all external inputs from MCP servers

### Documentation Standards
- Document all MCP server configurations in steering files
- Maintain usage examples for all verified tools
- Update configuration guides when adding new servers
- Include troubleshooting steps for common issues

## File References
Configuration types are defined in: #[[file:src/config/types.ts]]
MCP integration patterns: #[[file:kiro/steering/mcp-configuration.md]]
Power usage examples: #[[file:kiro/steering/power-usage-patterns.md]]