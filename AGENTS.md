# 烟草许可证 · 实地核查布局图生成器

## 项目概览
基于语音AI的店面布局图快速生成工具，用于烟草许可证实地核查场景。用户通过语音描述店面布局，AI自动解析并生成按比例绘制的布局图，支持导出PNG图片。

## 技术栈
- **框架**: Next.js 16 (App Router)
- **核心**: React 19 + TypeScript 5
- **UI**: Tailwind CSS 4 + shadcn/ui
- **AI**: coze-coding-dev-sdk (LLM)
- **语音**: Web Speech API (浏览器原生)
- **绘图**: Canvas API (2D)

## 文件结构
```
src/
├── app/
│   ├── api/parse-layout/route.ts   # AI解析API（语音文本→结构化JSON）
│   ├── layout.tsx                   # 根布局
│   ├── page.tsx                     # 主页面（语音输入+布局展示）
│   └── globals.css                  # 全局样式
├── components/
│   └── LayoutCanvas.tsx             # Canvas布局图绘制引擎
├── lib/
│   └── types.ts                     # 类型定义
└── types/
    └── speech-recognition.d.ts      # Web Speech API类型声明
```

## 核心模块

### API: /api/parse-layout
- **输入**: `{ text: string }` 语音识别文本
- **输出**: `{ success: boolean, data: StoreLayout }` 结构化布局数据
- **模型**: doubao-seed-2-0-lite-260215
- **功能**: 从自然语言中提取店面朝向、尺寸、门位置、物体布局

### LayoutCanvas 绘制引擎
- 2000x2000高分辨率Canvas，确保导出图片清晰
- 按比例精确绘制店面轮廓、门、物体
- 尺寸标注线（带箭头）
- 物体名称+尺寸标注
- 指北针
- 支持PNG导出

### 数据模型 (StoreLayout)
```typescript
{
  orientation: 'north'|'south'|'east'|'west',  // 朝向
  width: number,     // 宽度（米）
  length: number,    // 长度（米）
  door: { wall, position, width },  // 门信息
  objects: [{ name, type, x, y, width, length }]  // 物体列表
}
```

## 使用流程
1. 点击麦克风按钮开始语音输入（或手动输入文本）
2. 描述店面布局（朝向、尺寸、门位置、物体位置）
3. 点击"生成布局图"，AI解析并绘制
4. 点击"导出图片"下载PNG

## 开发命令
- `pnpm dev` - 启动开发服务器
- `pnpm build` - 构建生产版本
- `pnpm ts-check` - TypeScript类型检查
- `pnpm lint` - ESLint检查
