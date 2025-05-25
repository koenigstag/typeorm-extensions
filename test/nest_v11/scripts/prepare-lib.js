const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../../', 'dist');
const dest = path.resolve(__dirname, '../', 'node_modules/typeorm-extensions');
const packageJsonPath = path.resolve(__dirname, '../../../', 'package.json');

// Ensure the library is built before copying
if (process.env.IS_CI) {
  execSync('npm clean-install', { stdio: 'inherit', cwd: path.resolve(__dirname, '../../../') });
}

console.log('🔧 Building typeorm-extensions...');
execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '../../../') });

fs.existsSync(src) || (() => {
  console.error('❗️ dist directory does not exist. Please build the library first.');
  process.exit(1);
})();


// Clear the destination directory if it exists
if (fs.existsSync(dest)) {
  console.log(`🗑️  Removing existing node_modules/typeorm-extensions`);
  fs.rmSync(dest, { recursive: true });
}

console.log(`📦 Copying dist content and package.json into node_modules/typeorm-extensions`);

// Copy dist → node_modules/typeorm-extensions
fs.cpSync(src, dest, { recursive: true });

// Copy package.json → node_modules/typeorm-extensions
fs.copyFileSync(packageJsonPath, path.join(dest, 'package.json'));

console.log('✅ Library prepared successfully!');
