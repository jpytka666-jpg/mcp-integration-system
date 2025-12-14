---
inclusion: conditional
condition: aws
---

# AWS Integration Standards

## Verified AWS Configuration
**Profile**: `125140434314`  
**Region**: `eu-west-2` (London)  
**Log Level**: `ERROR` (production)

## Available MCP Services

### AWS AgentCore Power ✅
- **Server**: `agentcore-mcp-server`
- **Capabilities**: AgentCore documentation, runtime management, memory operations, gateway configuration
- **Status**: Fully operational with verified credentials

### SaaS Builder AWS Services ✅
- **AWS Knowledge Server**: Documentation and best practices
- **DynamoDB Server**: Data modeling and operations with tenant isolation
- **Serverless Server**: Lambda deployment with SAM/CDK
- **Status**: All servers operational with AWS credentials

### Additional AWS Services ✅
- **AWS Documentation Server**: Direct AWS docs access
- **Aurora DSQL Server**: Distributed SQL database operations

## Authentication & Credentials
**Environment Variables Required**:
```json
{
  "AWS_PROFILE": "125140434314",
  "AWS_REGION": "eu-west-2", 
  "FASTMCP_LOG_LEVEL": "ERROR"
}
```

**Configuration Locations**:
- User Level: `C:\Users\User\.kiro\settings\mcp.json`
- Workspace Level: `.kiro/settings/mcp.json`

## Verified Usage Patterns

### AgentCore Integration
```typescript
// Search AgentCore documentation
await kiroPowers("use", "aws-agentcore", "agentcore-mcp-server", 
  "search_agentcore_docs", {
    "query": "memory integration",
    "k": 5
  });

// Get runtime deployment guidance
await kiroPowers("use", "aws-agentcore", "agentcore-mcp-server",
  "manage_agentcore_runtime", {});
```

### DynamoDB Operations
```typescript
// Get data modeling expert guidance
await kiroPowers("use", "saas-builder", "awslabs.dynamodb-mcp-server",
  "dynamodb_data_modeling", {});

// Execute DynamoDB commands
await kiroPowers("use", "saas-builder", "awslabs.dynamodb-mcp-server",
  "execute_dynamodb_command", {
    "command": "aws dynamodb list-tables"
  });
```

### Serverless Deployment
```typescript
// Initialize SAM project
await kiroPowers("use", "saas-builder", "awslabs.aws-serverless-mcp",
  "sam_init", {
    "project_name": "my-app",
    "runtime": "nodejs20.x",
    "project_directory": "/absolute/path",
    "dependency_manager": "npm"
  });

// Build and deploy
await kiroPowers("use", "saas-builder", "awslabs.aws-serverless-mcp",
  "sam_build", { "project_directory": "/absolute/path" });

await kiroPowers("use", "saas-builder", "awslabs.aws-serverless-mcp",
  "sam_deploy", {
    "application_name": "my-app",
    "project_directory": "/absolute/path"
  });
```

### AWS Documentation Search
```typescript
// Search AWS documentation
await kiroPowers("use", "saas-builder", "aws-knowledge-mcp-server",
  "aws___search_documentation", {
    "search_phrase": "Lambda DynamoDB integration",
    "topics": ["reference_documentation", "cdk_constructs"]
  });

// Get regional availability
await kiroPowers("use", "saas-builder", "aws-knowledge-mcp-server",
  "aws___get_regional_availability", {
    "region": "eu-west-2",
    "resource_type": "product",
    "filters": ["AWS Lambda", "Amazon DynamoDB"]
  });
```

## Multi-Tenant SaaS Patterns

### Tenant Isolation
- Prefix all DynamoDB keys with tenant ID: `${tenantId}#${entityType}#${id}`
- Use Lambda authorizer to inject tenant context from JWT
- Implement tenant-scoped queries only
- No cross-tenant data access

### Cost Optimization
- Pay-per-use serverless components (Lambda, DynamoDB on-demand)
- Zero cost when idle
- Linear scaling economics per tenant

### Security Best Practices
- Managed authentication (Cognito/Auth0)
- JWT tokens with tenant claims
- Role-based access control (RBAC)
- Encryption at rest and in transit

## Infrastructure as Code

### SAM Templates
Use AWS Serverless MCP server for SAM operations:
- Project initialization with templates
- Local testing with `sam local invoke`
- Deployment with CloudFormation
- Log monitoring with CloudWatch integration

### CDK Integration
Leverage AWS Knowledge server for CDK guidance:
- Search CDK documentation and examples
- Get construct references and patterns
- Find best practices for TypeScript/Python CDK

## Monitoring & Observability

### CloudWatch Integration
```typescript
// Get application metrics
await kiroPowers("use", "saas-builder", "awslabs.aws-serverless-mcp",
  "get_metrics", {
    "project_name": "my-saas-app",
    "resources": ["lambda", "dynamodb", "apigateway"],
    "start_time": "2025-12-14T00:00:00Z",
    "end_time": "2025-12-14T23:59:59Z"
  });
```

### Performance Monitoring
- Monitor per-tenant costs and usage
- Track Lambda cold starts and execution duration
- Monitor DynamoDB read/write capacity utilization
- Set up CloudWatch alarms for error rates

## Regional Considerations

### EU West 2 (London) Services
All AWS services configured for `eu-west-2` region:
- Bedrock AgentCore services
- Lambda functions and layers
- DynamoDB tables and GSIs
- API Gateway endpoints
- CloudWatch logs and metrics

### Data Residency
- All data stored in London region
- Compliant with UK/EU data protection requirements
- Cross-region replication available if needed

## Error Handling & Resilience

### Retry Patterns
```typescript
// Implement exponential backoff for AWS operations
const result = await withRetry(() => 
  kiroPowers("use", "saas-builder", "awslabs.dynamodb-mcp-server",
    "execute_dynamodb_command", { "command": "aws dynamodb scan --table-name MyTable" })
);
```

### Fallback Strategies
- Multiple documentation sources (AgentCore → AWS Knowledge)
- Graceful degradation for non-critical operations
- Circuit breaker patterns for external dependencies

## Compliance & Security

### Audit Logging
- All AWS operations logged through CloudTrail
- MCP server interactions logged with tenant context
- Sensitive data handling with encryption

### Access Control
- IAM roles with least privilege principles
- MCP server authentication through AWS credentials
- Tenant-based authorization in application layer

Reference: #[[file:src/mcp-integration/cloud-services.ts]]