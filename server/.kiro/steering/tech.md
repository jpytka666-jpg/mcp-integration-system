# Tech Stack

## Language & Runtime
- TypeScript 5.x with strict mode
- ES2022 target, ESNext modules
- Node.js 20+

## Build System
- `tsc` for compilation
- Output to `dist/` directory
- Declaration files and source maps enabled

## Testing
- Vitest for unit testing
- Test files co-located with source (`*.test.ts`)

## MCP Integration Dependencies

### Required Tools
- **UV**: Python package manager for MCP servers (`uvx` command)
- **AWS CLI**: Configured with profile `125140434314` for AWS services
- **Playwright**: Browser automation (`@playwright/test` + browser binaries)
- **Python**: For Windows MCP server execution

### MCP Server Requirements
```bash
# Install Playwright for browser automation
npm install @playwright/test
npx playwright install

# Verify UV installation for Python MCP servers
uvx --version

# Verify AWS CLI configuration
aws configure list --profile 125140434314
```

## Common Commands
```bash
npm run build    # Compile TypeScript
npm test         # Run tests (single run)
npm run test:watch  # Run tests in watch mode
npm run dev      # Watch mode compilation

# MCP-specific commands
npm run mcp:health  # Check MCP server health
npm run mcp:test    # Run MCP integration tests
```

## Project Configuration
- `tsconfig.json` - TypeScript compiler options
- `package.json` - Dependencies and scripts
- ESM modules (`"type": "module"`)
- `.kiro/settings/mcp.json` - MCP server configuration
- `C:\Users\User\.kiro\settings\mcp.json` - User-level MCP config

## Key Conventions
- Use `.js` extension in imports (ESM requirement)
- No external runtime dependencies (zero-dependency library)
- Dev dependencies only: TypeScript, Vitest, @types/node, @playwright/test

## Environment Variables
Required for AWS MCP servers:
```bash
AWS_PROFILE=125140434314
AWS_REGION=eu-west-2
FASTMCP_LOG_LEVEL=ERROR
```

## MCP Server Architecture
- **User-level config**: Global MCP servers and Powers
- **Workspace-level config**: Project-specific MCP servers
- **Priority**: Workspace config overrides user config
- **Validation**: Automated health checks and configuration validation

## Performance Considerations
- MCP operations may have network latency
- Implement retry logic for transient failures
- Use connection pooling where available
- Monitor server response times and implement timeouts

## Security Requirements
- Never commit MCP credentials to version control
- Use environment variables for sensitive configuration
- Validate all inputs from external MCP servers
- Implement proper error handling to prevent information leakage
