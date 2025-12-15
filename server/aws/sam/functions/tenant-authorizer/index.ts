/**
 * Lambda Authorizer for Tenant Context
 * Validates JWT tokens and extracts tenant context for multi-tenant isolation
 */

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';

interface JWTPayload {
  sub: string;
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
}

interface AuthorizerContext {
  tenantId: string;
  userId: string;
  roles: string;
  permissions: string;
}

const TOKEN_CACHE = new Map<string, { result: APIGatewayAuthorizerResult; expires: number }>();
const CACHE_TTL_MS = 300000; // 5 minutes

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> {
  console.log('Authorizer invoked', {
    requestId: context.awsRequestId,
    methodArn: event.methodArn
  });

  try {
    const token = extractToken(event.authorizationToken);

    // Check cache
    const cached = TOKEN_CACHE.get(token);
    if (cached && cached.expires > Date.now()) {
      console.log('Using cached authorization');
      return cached.result;
    }

    // Validate token
    const payload = await validateToken(token);

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      return generateDeny('expired', event.methodArn);
    }

    // Generate policy
    const result = generateAllow(payload.sub, event.methodArn, {
      tenantId: payload.tenantId,
      userId: payload.userId,
      roles: JSON.stringify(payload.roles),
      permissions: JSON.stringify(payload.permissions)
    });

    // Cache result
    TOKEN_CACHE.set(token, {
      result,
      expires: Date.now() + CACHE_TTL_MS
    });

    return result;
  } catch (error) {
    console.error('Authorization failed', error);
    return generateDeny('unauthorized', event.methodArn);
  }
}

function extractToken(authorizationToken: string): string {
  if (!authorizationToken) {
    throw new Error('No authorization token');
  }

  if (authorizationToken.startsWith('Bearer ')) {
    return authorizationToken.slice(7);
  }

  return authorizationToken;
}

async function validateToken(token: string): Promise<JWTPayload> {
  // In production, validate JWT signature with secret from Secrets Manager
  // For now, decode and validate structure
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Validate required fields
    if (!payload.tenantId || !payload.userId || !payload.sub) {
      throw new Error('Missing required claims');
    }

    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      userId: payload.userId,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      exp: payload.exp || Math.floor(Date.now() / 1000) + 3600,
      iat: payload.iat || Math.floor(Date.now() / 1000)
    };
  } catch {
    throw new Error('Invalid token payload');
  }
}

function generateAllow(
  principalId: string,
  methodArn: string,
  context: AuthorizerContext
): APIGatewayAuthorizerResult {
  const arnParts = methodArn.split(':');
  const apiGatewayArnParts = arnParts[5].split('/');
  const awsAccountId = arnParts[4];
  const region = arnParts[3];
  const restApiId = apiGatewayArnParts[0];
  const stage = apiGatewayArnParts[1];

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: `arn:aws:execute-api:${region}:${awsAccountId}:${restApiId}/${stage}/*`
        }
      ]
    },
    context
  };
}

function generateDeny(
  principalId: string,
  methodArn: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: methodArn
        }
      ]
    }
  };
}
