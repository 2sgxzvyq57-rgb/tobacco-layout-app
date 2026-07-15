const fs = require('fs');
const path = require('path');

// 软件名称和版本
const SOFTWARE_NAME = '烟草许可证实地核查布局图生成软件';
const VERSION = 'V1.0';

// 核心源代码文件（按重要性排序）
const coreFiles = [
  'src/app/page.tsx',
  'src/components/LayoutCanvas.tsx',
  'src/app/api/parse-layout/route.ts',
  'src/lib/types.ts',
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/lib/utils.ts',
  'src/types/speech-recognition.d.ts',
];

// 读取文件内容
function readFileContent(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  return null;
}

// 生成源代码文档
function generateSourceCodeDoc() {
  let allCode = '';
  
  // 添加核心文件
  for (const file of coreFiles) {
    const content = readFileContent(file);
    if (content) {
      allCode += `\n\n// ============================================\n`;
      allCode += `// 文件: ${file}\n`;
      allCode += `// ============================================\n\n`;
      allCode += content;
    }
  }
  
  // 按每页50行分割
  const lines = allCode.split('\n');
  const linesPerPage = 50;
  const pages = [];
  
  for (let i = 0; i < lines.length; i += linesPerPage) {
    const pageLines = lines.slice(i, i + linesPerPage);
    pages.push(pageLines.join('\n'));
  }
  
  // 生成文档
  let doc = '';
  doc += `${SOFTWARE_NAME} ${VERSION}\n`;
  doc += `源代码文档\n`;
  doc += `=`.repeat(60) + '\n\n';
  
  // 前30页
  doc += `【前30页】\n\n`;
  for (let i = 0; i < Math.min(30, pages.length); i++) {
    doc += `第 ${i + 1} 页\n`;
    doc += `-`.repeat(60) + '\n';
    doc += pages[i] + '\n\n';
  }
  
  // 后30页
  if (pages.length > 30) {
    doc += `\n【后30页】\n\n`;
    const startPage = Math.max(0, pages.length - 30);
    for (let i = startPage; i < pages.length; i++) {
      doc += `第 ${i + 1} 页\n`;
      doc += `-`.repeat(60) + '\n';
      doc += pages[i] + '\n\n';
    }
  }
  
  return doc;
}

// 生成软件说明书
function generateManual() {
  let manual = '';
  
  manual += `${SOFTWARE_NAME} ${VERSION}\n`;
  manual += `软件说明书\n`;
  manual += `=`.repeat(60) + '\n\n';
  
  manual += `一、软件概述\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `${SOFTWARE_NAME}是一款基于语音AI的店面布局图快速生成工具，\n`;
  manual += `专为烟草许可证实地核查场景设计。用户通过语音描述店面布局，\n`;
  manual += `AI自动解析并生成按比例绘制的布局图，支持导出PNG图片。\n\n`;
  
  manual += `二、功能特点\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `1. 语音输入：支持语音识别，快速输入店面描述\n`;
  manual += `2. AI智能解析：自动提取店面尺寸、门位置、物体布局\n`;
  manual += `3. 布局图生成：按比例精确绘制店面平面图\n`;
  manual += `4. 交互编辑：支持拖拽、旋转、调整物体大小\n`;
  manual += `5. 语音备注：支持语音添加备注信息\n`;
  manual += `6. 楼梯识别：自动识别并显示楼梯位置\n`;
  manual += `7. 图片导出：支持导出高清PNG图片\n`;
  manual += `8. PWA支持：可添加到手机主屏幕，像App一样使用\n\n`;
  
  manual += `三、技术架构\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `1. 前端框架：Next.js 16 (App Router)\n`;
  manual += `2. 核心语言：TypeScript 5 + React 19\n`;
  manual += `3. UI组件：Tailwind CSS 4 + shadcn/ui\n`;
  manual += `4. AI服务：豆包大语言模型API\n`;
  manual += `5. 语音识别：Web Speech API\n`;
  manual += `6. 图形绘制：Canvas API 2D\n\n`;
  
  manual += `四、使用说明\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `1. 打开应用，点击麦克风按钮开始语音输入\n`;
  manual += `2. 描述店面布局（朝向、尺寸、门位置、物体位置）\n`;
  manual += `3. 点击"生成布局图"，AI解析并绘制\n`;
  manual += `4. 拖拽物体调整位置，使用控制面板调整大小和方向\n`;
  manual += `5. 点击"导出图片"下载PNG\n\n`;
  
  manual += `五、运行环境\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `- 操作系统：Windows / macOS / Linux / Android / iOS\n`;
  manual += `- 浏览器：Chrome 90+ / Safari 14+ / Edge 90+\n`;
  manual += `- 网络：需要互联网连接（AI解析需要）\n`;
  manual += `- 存储：本地存储布局数据\n\n`;
  
  manual += `六、版本信息\n`;
  manual += `-`.repeat(60) + '\n';
  manual += `软件名称：${SOFTWARE_NAME}\n`;
  manual += `版本号：${VERSION}\n`;
  manual += `开发完成日期：2026年7月\n`;
  manual += `首次发表日期：2026年7月\n`;
  
  return manual;
}

// 生成文件
const sourceCodeDoc = generateSourceCodeDoc();
const manual = generateManual();

fs.writeFileSync('copyright-source-code.txt', sourceCodeDoc, 'utf-8');
fs.writeFileSync('copyright-manual.txt', manual, 'utf-8');

console.log('软著申请文档已生成：');
console.log('- copyright-source-code.txt (源代码文档)');
console.log('- copyright-manual.txt (软件说明书)');
