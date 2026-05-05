#!/usr/bin/env node

/**
 * Post-build script to ensure all required dependencies are in the generated package.json
 * This fixes the issue where webpack's generatePackageJson doesn't include all dependencies
 */

const fs = require('fs');
const path = require('path');

const distPackageJsonPath = path.join(__dirname, '../dist/api/package.json');

// Required dependencies that must be in package.json (even if webpack doesn't detect them)
const requiredDependencies = {
  '@nestjs/config': '^4.0.2',
  '@nestjs/mapped-types': '^2.1.0',
  '@nestjs/sequelize': '^11.0.1',
  'dotenv': '^17.2.3',
  'node-cron': '^4.2.1',
  'pg': '^8.16.3',
  'pg-hstore': '^2.3.4',
  'sequelize': '^6.37.7',
  'sequelize-typescript': '^2.1.6',
};

if (!fs.existsSync(distPackageJsonPath)) {
  console.error(`❌ Generated package.json not found at ${distPackageJsonPath}`);
  console.error('   Make sure to run the build first: npm run build:api');
  process.exit(1);
}

// Read the generated package.json
const packageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, 'utf8'));

// Ensure required dependencies are present
let updated = false;
if (!packageJson.dependencies) {
  packageJson.dependencies = {};
}

for (const [dep, version] of Object.entries(requiredDependencies)) {
  if (!packageJson.dependencies[dep]) {
    console.log(`➕ Adding missing dependency: ${dep}@${version}`);
    packageJson.dependencies[dep] = version;
    updated = true;
  }
}

// Write back the updated package.json
if (updated) {
  fs.writeFileSync(distPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ Updated package.json with missing dependencies');
} else {
  console.log('✅ All required dependencies are present in package.json');
}

