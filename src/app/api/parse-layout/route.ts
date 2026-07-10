import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import type { StoreLayout, ParseResponse } from '@/lib/types';

const SYSTEM_PROMPT = `你是一个烟草许可证实地核查助手，专门负责从语音描述中提取店面布局信息。

## 规则

1. **尺寸对应**：
   - 宽度 = 店面横向尺寸
   - 长度/进深 = 店面纵向尺寸
   - 总面积 = 宽度 × 长度，三者必须数学对应
   - 如果用户说的面积与宽×长不一致，以宽和长为准重新计算面积

2. **坐标系**：
   - 以店面左下角为原点 (0, 0)
   - X轴向右，Y轴向上
   - 所有物体坐标是其左下角的位置

3. **门的位置**：
   - wall: 门所在的墙面方向 (north/south/east/west)，默认 south
   - position: 门在该墙面上的中心位置，0=左端，0.5=中间，1=右端，默认 0.5
   - width: 门的宽度（米），默认1.0

4. **物体描述**：
   - 每个物体必须有明确的名称（如"柜台"、"仓储"、"烟草展示柜"）
   - 位置描述需要转换为坐标，如"进门右手边"需要根据门的位置推断
   - 如果只说了"靠墙"，则让物体紧贴对应墙面
   - 每个物体必须有唯一的 id（如 "obj_1", "obj_2"）
   - 每个物体的 rotation 默认为 0

5. **默认值**：
   - 门宽度默认1.0米
   - 门位置默认在墙面中间(0.5)
   - 门所在墙面默认 south
   - 如果用户没有明确说某个物体的尺寸，合理推断（柜台通常宽1-2米、长2-4米）

6. **楼梯识别**：
   - 如果用户提到"二楼"、"楼上"、"夹层"、"复式"等关键词，必须添加楼梯信息
   - 楼梯默认位置：靠墙角，通常在东北角或西北角
   - 楼梯默认尺寸：宽0.8米，长2米
   - 上楼方向默认：up-north（向北上楼）
   - 如果用户没有明确说楼梯位置，放在东北角（x = width - 0.8, y = length - 2）

## 输出格式

严格返回以下JSON格式，不要包含任何其他文字：

\`\`\`json
{
  "width": 5.0,
  "length": 8.0,
  "door": {
    "wall": "south",
    "position": 0.5,
    "width": 1.0
  },
  "objects": [
    {
      "id": "obj_1",
      "name": "柜台",
      "type": "counter",
      "x": 0.5,
      "y": 2.0,
      "width": 2.0,
      "length": 1.0,
      "rotation": 0
    },
    {
      "id": "obj_2",
      "name": "仓储",
      "type": "storage",
      "x": 3.5,
      "y": 6.0,
      "width": 1.5,
      "length": 2.0,
      "rotation": 0
    }
  ],
  "stairs": {
    "x": 4.2,
    "y": 6.0,
    "width": 0.8,
    "length": 2.0,
    "direction": "up-north"
  }
}
\`\`\`

注意：stairs 字段是可选的，只有当用户提到"二楼"、"楼上"等关键词时才添加。

## 物体类型映射
- 柜台、收银台 → "counter"
- 仓储、仓库、储物间 → "storage"  
- 展示柜、烟草柜、货架 → "showcase"
- 冰箱、冷柜 → "fridge"
- 其他 → "other"`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json<ParseResponse>(
        { success: false, error: '请提供语音识别文本' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请从以下语音描述中提取店面布局信息：\n\n${text}` },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.1,
    });

    // 解析 LLM 返回的 JSON
    let content = response.content.trim();
    
    // 移除可能的 markdown 代码块标记
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const layoutData = JSON.parse(content) as StoreLayout;

    // 验证关键字段
    if (!layoutData.width || !layoutData.length || !layoutData.door) {
      throw new Error('AI返回的数据缺少必要字段');
    }

    // 确保每个物体都有 id 和 rotation
    if (layoutData.objects) {
      layoutData.objects = layoutData.objects.map((obj, index) => ({
        ...obj,
        id: obj.id || `obj_${index + 1}`,
        rotation: obj.rotation ?? 0,
      }));
    }

    // 确保面积对应
    const expectedArea = layoutData.width * layoutData.length;
    console.log(`[Layout] 店面: ${layoutData.width}m × ${layoutData.length}m = ${expectedArea}m²`);
    console.log(`[Layout] 门: ${layoutData.door.wall}墙, 位置${layoutData.door.position}, 宽${layoutData.door.width}m`);
    console.log(`[Layout] 物体: ${layoutData.objects?.length || 0}个`);

    return NextResponse.json<ParseResponse>({
      success: true,
      data: layoutData,
    });
  } catch (error) {
    console.error('[ParseLayout] Error:', error);
    return NextResponse.json<ParseResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '解析失败，请重试' 
      },
      { status: 500 }
    );
  }
}
