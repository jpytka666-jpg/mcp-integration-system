# Global Kiro Configuration

**Location**: E:\\.kiro\\  
**Purpose**: Centralized configuration for all Kiro workspaces  
**Created**: December 2024

---

## 📋 STRUCTURE

```
E:\.kiro\
├── settings/
│   ├── mcp.json          # Global MCP server configuration
│   └── global-config.md  # This file
└── steering/
    └── global/           # Shared steering rules across all projects
        ├── aions-context-priority.md
        ├── development-standards.md
        ├── security-best-practices.md
        ├── git-best-practices.md
        ├── vscode-extensions-awareness.md
        ├── aws-cli-best-practices.md
        ├── cdk-best-practices.md
        ├── mcp-best-practices.md
        ├── testing-best-practices.md
        ├── docker-best-practices.md
        ├── python-best-practices.md
        ├── react-best-practices.md
        └── typescript-best-practices.md
```

---

## 🔧 MCP SERVERS

### Configured Servers (3)

1. **aions-context** - AIONS Context & Memory Management
   - Tools: context_*, memory_*, cbms_*, fast_search, browser_*, git_*, docker_*
   - Data: E:\\server wiedzy\\data\\chroma
   - Priority: HIGHEST

2. **context7** - Library Dependency Resolver
   - Tools: resolve-library-id
   - Priority: MEDIUM

3. **aws-docs** - AWS Documentation
   - Tools: AWS documentation search
   - Priority: MEDIUM

---

## 📁 PROJECT CONFIGURATION

### How Projects Use Global Config

Projects can extend global configuration:

```json
// Project: E:\fresh start\.kiro\settings\mcp.json
{
  "extends": "E:\\.kiro\\settings\\mcp.json",
  "mcpServers": {
    // Project-specific overrides or additions
  }
}
```

### Steering Rules Inheritance

Projects automatically inherit global steering rules from:
- `E:\.kiro\steering\global\*.md`

Projects can add project-specific rules in:
- `<project>\.kiro\steering\*.md`

---

## 🎯 USAGE

### For Kiro

Kiro automatically loads:
1. Global MCP servers from `E:\.kiro\settings\mcp.json`
2. Global steering rules from `E:\.kiro\steering\global\`
3. Project-specific overrides from workspace `.kiro\`

### For Developers

1. **Add new MCP server globally**:
   - Edit `E:\.kiro\settings\mcp.json`
   - All projects get access automatically

2. **Add project-specific MCP server**:
   - Edit `<project>\.kiro\settings\mcp.json`
   - Only that project gets access

3. **Update steering rules**:
   - Global rules: `E:\.kiro\steering\global\`
   - Project rules: `<project>\.kiro\steering\`

---

## 🔄 SYNCHRONIZATION

### Active Projects

| Project | Location | Config Type |
|---------|----------|-------------|
| Fresh Start | E:\\fresh start\\.kiro | Extends global |
| Server Wiedzy | E:\\server wiedzy\\.kiro | Independent |

### Backup Strategy

All global configuration backed up to:
- `E:\BACKUPS\PHASE1_BACKUP_<timestamp>\`

---

## ⚠️ IMPORTANT NOTES

1. **Global config takes precedence** for MCP servers
2. **Project configs can override** specific settings
3. **Steering rules are additive** (global + project)
4. **Always backup** before modifying global config

---

## 📊 STATISTICS

- **MCP Servers**: 3 (aions-context, context7, aws-docs)
- **Steering Rules**: 13 global rules
- **Active Projects**: 2
- **Total Tools**: 40+ (from aions-context)

---

## 🔗 RELATED FILES

- MCP Configuration: `E:\.kiro\settings\mcp.json`
- Optimization Plan: `E:\MASTER_OPTIMIZATION_PLAN.md`
- Project Config: `E:\fresh start\.kiro\CONFIGURATION-ANALYSIS.md`

---

**Status**: ✅ ACTIVE - Phase 1 Complete
