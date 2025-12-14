/**
 * Basic tests for Cloud Services Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AWSCloudServicesIntegration } from './cloud-services.js';
import { CloudServiceConfig } from './types.js';

describe('Cloud Services Integration', () => {
  let cloudServices: AWSCloudServicesIntegration;
  let config: CloudServiceConfig;

  beforeEach(() => {
    config = {
      region: 'us-east-1',
      credentials: {
        profile: 'default'
      }
    };
    
    cloudServices = new AWSCloudServicesIntegration(config);
  });

  describe('Lambda Integration', () => {
    it('should invoke Lambda function successfully', async () => {
      const result = await cloudServices.invokeLambdaFunction('test-function', { test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata.functionName).toBe('test-function');
    });

    it('should deploy Lambda function', async () => {
      const functionConfig = {
        name: 'test-function',
        runtime: 'nodejs18.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: Buffer.from('exports.handler = async () => ({ statusCode: 200 });')
      };

      const arn = await cloudServices.deployLambdaFunction(functionConfig);
      expect(arn).toContain('arn:aws:lambda');
      expect(arn).toContain('test-function');
    });
  });

  describe('S3 Integration', () => {
    it('should upload data to S3', async () => {
      const data = Buffer.from('test data');
      const result = await cloudServices.uploadToS3('test-bucket', 'test-key', data);
      
      expect(result.success).toBe(true);
      expect(result.location).toBeDefined();
      expect(result.size).toBe(data.length);
    });

    it('should download data from S3', async () => {
      const data = await cloudServices.downloadFromS3('test-bucket', 'test-key');
      
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should create S3 bucket', async () => {
      const config = { versioning: true };
      
      await expect(cloudServices.createS3Bucket('new-bucket', config))
        .resolves.not.toThrow();
    });
  });

  describe('Bedrock Integration', () => {
    it('should analyze data with Bedrock', async () => {
      const result = await cloudServices.analyzeWithBedrock(
        'claude-v2',
        'Analyze this data',
        { elements: [{ id: '1', type: 'wall' }] }
      );
      
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should generate content', async () => {
      const content = await cloudServices.generateContent('claude-v2', {
        prompt: 'Generate a summary',
        maxTokens: 100
      });
      
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('CloudWatch Integration', () => {
    it('should publish metrics', async () => {
      const metrics = [
        { name: 'TestMetric', value: 100, unit: 'Count' },
        { name: 'AnotherMetric', value: 50, unit: 'Percent' }
      ];
      
      await expect(cloudServices.publishMetrics('TestNamespace', metrics))
        .resolves.not.toThrow();
    });

    it('should create alarm', async () => {
      const alarmConfig = {
        metricName: 'TestMetric',
        namespace: 'TestNamespace',
        threshold: 100,
        comparisonOperator: 'GreaterThanThreshold'
      };
      
      await expect(cloudServices.createAlarm('TestAlarm', alarmConfig))
        .resolves.not.toThrow();
    });

    it('should get metrics', async () => {
      const startTime = new Date(Date.now() - 3600000); // 1 hour ago
      const endTime = new Date();
      
      const metrics = await cloudServices.getMetrics(
        'TestNamespace',
        'TestMetric',
        startTime,
        endTime
      );
      
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should perform health check on all services', async () => {
      const results = await cloudServices.healthCheck();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const services = results.map(r => r.service);
      expect(services).toContain('Lambda');
      expect(services).toContain('S3');
      expect(services).toContain('Bedrock');
      expect(services).toContain('CloudWatch');
      
      for (const result of results) {
        expect(result.status).toMatch(/^(healthy|unhealthy)$/);
      }
    });
  });
});