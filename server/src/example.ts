/**
 * Example usage of the Kiro Configuration System
 */

import { ConfigurationManager } from './config/manager.js';

async function main() {
  // Initialize configuration manager
  const configManager = new ConfigurationManager('.kiro');
  
  // Initialize the system (creates directories, loads configs)
  console.log('Initializing Kiro configuration system...');
  const initResult = await configManager.initialize();
  
  if (initResult.valid) {
    console.log('✓ Configuration system initialized successfully');
  } else {
    console.log('✗ Configuration system initialization failed:');
    initResult.errors.forEach(error => {
      console.log(`  - ${error.path}: ${error.message}`);
    });
  }

  if (initResult.warnings.length > 0) {
    console.log('Warnings:');
    initResult.warnings.forEach(warning => {
      console.log(`  - ${warning.path}: ${warning.message}`);
    });
  }

  // Validate the configuration
  console.log('\nValidating configuration...');
  const validation = await configManager.validateConfiguration();
  
  if (validation.valid) {
    console.log('✓ Configuration is valid');
  } else {
    console.log('✗ Configuration validation failed:');
    validation.errors.forEach(error => {
      console.log(`  - ${error.path}: ${error.message}`);
    });
  }

  // Show current configuration
  console.log('\nCurrent configuration:');
  const config = configManager.getConfig();
  console.log(JSON.stringify(config, null, 2));

  // Create a sample spec directory
  console.log('\nCreating sample spec directory...');
  const specPath = configManager.createSpecDirectory('sample-feature');
  console.log(`✓ Created spec directory: ${specPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}