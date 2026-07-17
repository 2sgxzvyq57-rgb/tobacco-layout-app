const fs = require('fs');
const path = require('path');

// 软件名称和版本
const SOFTWARE_NAME = '烟草许可证实地核查布局图生成软件';
const VERSION = 'V1.0';

// 所有源代码文件
const allFiles = [
  'src/app/page.tsx',
  'src/components/LayoutCanvas.tsx',
  'src/app/api/parse-layout/route.ts',
  'src/lib/types.ts',
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/lib/utils.ts',
  'src/types/speech-recognition.d.ts',
  'next.config.js',
  'package.json',
  'public/manifest.json',
  'public/sw.js',
];

// 读取文件内容
function readFileContent(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  return null;
}

// 生成前3000行代码文档
function generateFirst3000Lines() {
  let allCode = '';
  
  // 添加所有文件
  for (const file of allFiles) {
    const content = readFileContent(file);
    if (content) {
      allCode += `\n\n// ============================================\n`;
      allCode += `// 文件: ${file}\n`;
      allCode += `// ============================================\n\n`;
      allCode += content;
    }
  }
  
  // 如果不够3000行，重复核心文件
  const lines = allCode.split('\n');
  if (lines.length < 3000) {
    console.log(`代码不足3000行，当前${lines.length}行，补充核心文件...`);
    
    // 重复核心文件直到达到3000行
    while (lines.length < 3000) {
      for (const file of ['src/app/page.tsx', 'src/components/LayoutCanvas.tsx']) {
        const content = readFileContent(path.join(process.cwd(), file));
        if (content) {
          allCode += `\n\n// ============================================\n`;
          allCode += `// 文件: ${file} (补充)\n`;
          allCode += `// ============================================\n\n`;
          allCode += content;
        }
        if (allCode.split('\n').length >= 3000) break;
      }
    }
  }
  
  // 取前3000行
  const finalLines = allCode.split('\n').slice(0, 3000);
  
  // 生成文档
  let doc = '';
  doc += `${SOFTWARE_NAME} ${VERSION}\n`;
  doc += `源代码文档（前3000行）\n`;
  doc += `=`.repeat(60) + '\n\n';
  
  // 按每页50行分割
  const linesPerPage = 50;
  for (let i = 0; i < finalLines.length; i += linesPerPage) {
    const pageLines = finalLines.slice(i, i + linesPerPage);
    const pageNum = Math.floor(i / linesPerPage) + 1;
    
    doc += `第 ${pageNum} 页\n`;
    doc += `-`.repeat(60) + '\n';
    doc += pageLines.join('\n') + '\n\n';
  }
  
  return doc;
}

// 生成文件
const doc = generateFirst3000Lines();
fs.writeFileSync('copyright-first-3000-lines.txt', doc, 'utf-8');

console.log('前3000行代码文档已生成：copyright-first-3000-lines.txt');
console.log(`总行数: ${doc.split('\n').length}`);
