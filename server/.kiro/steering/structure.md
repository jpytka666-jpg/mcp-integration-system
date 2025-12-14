# Project Structure

```
src/
├── index.ts              # Main entry point, public exports
├── config/               # Core configuration management
│   ├── manager.ts        # ConfigurationManager class
│   ├── validator.ts      # Configuration validation
│   ├── types.ts          # Core type definitions
│   ├── security.ts       # Security utilities
│   ├── response-style.ts # Response formatting
│   └── platform-adapter.ts # OS-specific adaptations
├── steering/             # Steering file system
│   ├── parser.ts         # Front-matter and content parsing
│   ├── validator.ts      # Steering file validation
│   ├── context-injector.ts # Context injection logic
│   └── types.ts          # Steering-specific types
├── mcp/                  # MCP server integration
│   ├── config-manager.ts # MCP config loading/merging
│   ├── server-integration.ts # Server lifecycle
│   ├── dependency-manager.ts # Dependency resolution
│   ├── testing-utils.ts  # MCP testing helpers
│   └── types.ts          # MCP-specific types
├── hooks/                # Agent hook system
│   ├── config-manager.ts # Hook configuration
│   ├── executor.ts       # Hook execution engine
│   └── types.ts          # Hook-specific types
├── spec/                 # Spec workflow system
│   ├── requirements-generator.ts
│   ├── design-generator.ts
│   ├── task-generator.ts
│   ├── task-tracker.ts
│   └── types.ts
└── codegen/              # Code generation utilities
    ├── syntax-checker.ts
    └── types.ts
```

## Patterns
- Each module has its own `types.ts` for domain types
- Test files are co-located: `foo.ts` → `foo.test.ts`
- Index files re-export public API from modules
- Validation returns `{ valid, errors, warnings }` objects
