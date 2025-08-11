#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively get all .js files in a directory
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to fix path aliases in a file
function fixPathAliases(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Define path mappings based on file location relative to dist root
  const relativePath = path.relative(path.join(__dirname, 'dist'), path.dirname(filePath));
  const pathPrefix = relativePath ? '../'.repeat(relativePath.split(path.sep).length) : './';
  
  // Replace @/ with appropriate relative path
  const patterns = [
    { from: /require\("@\//g, to: `require("${pathPrefix}` },
    { from: /from "@\//g, to: `from "${pathPrefix}` },
    { from: /import.*from.*"@\//g, to: match => match.replace('"@/', `"${pathPrefix}`) }
  ];
  
  patterns.forEach(pattern => {
    const newContent = content.replace(pattern.from, pattern.to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
  }
}

// Main execution
try {
  const distDir = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  console.log('🔧 Fixing TypeScript path aliases in compiled files...');
  
  const jsFiles = getAllJsFiles(distDir);
  
  jsFiles.forEach(filePath => {
    try {
      fixPathAliases(filePath);
    } catch (err) {
      console.error(`❌ Error fixing ${filePath}:`, err.message);
    }
  });
  
  console.log(`\n✅ Path fix completed. Processed ${jsFiles.length} files.`);
  console.log('🚀 You can now start the server with: npm start');
  
} catch (err) {
  console.error('❌ Script failed:', err.message);
  process.exit(1);
}