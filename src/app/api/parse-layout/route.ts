import { NextRequest, NextResponse } from 'next/server';
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

5. **楼梯识别**：
   - 如果语音中提到"二楼"、"楼上"、"夹层"、"复式"等，必须添加楼梯
   - 楼梯默认位置：东北角（除非用户指定了其他位置）
   - 楼梯默认尺寸：宽0.8米，长1.5米
   - 上楼方向默认：north

6. **默认值**：
   - 如果用户没有明确说明某些信息，使用合理的默认值
   - 宽度默认：5米
   - 长度默认：8米
   - 门默认：南墙中间（wall: south, position: 0.5）
   - 如果没有提到楼梯，stairs 为 null

## 输出格式

严格返回以下 JSON 格式，不要包含任何其他文字：

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
      "x": 0,
      "y": 0,
      "width": 2.0,
      "length": 0.8,
      "rotation": 0
    }
  ],
  "stairs": {
    "x": 3.5,
    "y": 6.0,
    "width": 0.8,
    "length": 1.5,
    "direction": "north"
  }
}
\`\`\`

如果用户没有提到楼梯，stairs 设为 null。`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供有效的文本内容' },
        { status: 400 }
      );
    }

    // 检查是否配置了豆包 API 密钥
    const apiKey = process.env.DOUBAO_API_KEY;
    
    // 如果没有配置 API 密钥，使用模拟数据
    if (!apiKey) {
      const mockLayout: StoreLayout = {
        width: 5.0,
        length: 8.0,
        door: {
          wall: 'south',
          position: 0.5,
          width: 1.0
        },
        objects: [
          {
            id: 'obj_1',
            name: '柜台',
            type: 'counter',
            x: 0.5,
            y: 0,
            width: 2.0,
            length: 0.8,
            rotation: 0
          },
          {
            id: 'obj_2',
            name: '烟草展示柜',
            type: 'showcase',
            x: 3.0,
            y: 0,
            width: 1.5,
            length: 0.6,
            rotation: 0
          },
          {
            id: 'obj_3',
            name: '仓储区',
            type: 'storage',
            x: 0,
            y: 6.0,
            width: 2.0,
            length: 2.0,
            rotation: 0
          }
        ],
        stairs: undefined
      };

      // 检查是否提到楼梯
      if (text.includes('二楼') || text.includes('楼上') || text.includes('夹层') || text.includes('复式')) {
        mockLayout.stairs = {
          x: 3.5,
          y: 6.0,
          width: 0.8,
          length: 1.5,
          direction: 'up-north'
        };
      }

      return NextResponse.json({
        success: true,
        data: mockLayout,
        message: '（演示模式）未配置API密钥，使用模拟数据。配置 DOUBAO_API_KEY 后可使用真实AI解析。'
      } as ParseResponse);
    }

    // 使用豆包 API
    const modelId = process.env.DOUBAO_MODEL_ID || 'doubao-pro-32k';
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('豆包 API error:', error);
      return NextResponse.json(
        { success: false, error: 'AI 解析失败，请重试', details: error },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'AI 返回内容为空' },
        { status: 500 }
      );
    }

    // 解析 JSON
    let layout: StoreLayout;
    try {
      // 移除 markdown 代码块标记
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      }
      
      const parsed = JSON.parse(cleanContent);
      layout = parsed as StoreLayout;
    } catch (e) {
      console.error('JSON parse error:', e, 'Content:', content);
      return NextResponse.json(
        { success: false, error: 'AI 返回格式错误' },
        { status: 500 }
      );
    }

    // 验证和补充默认值
    if (!layout.width || layout.width <= 0) layout.width = 5;
    if (!layout.length || layout.length <= 0) layout.length = 8;
    if (!layout.door) {
      layout.door = { wall: 'south', position: 0.5, width: 1.0 };
    }
    if (!layout.objects) layout.objects = [];

    // 为每个物体添加 id 和 rotation（如果没有）
    layout.objects = layout.objects.map((obj, index) => ({
      ...obj,
      id: obj.id || `obj_${index + 1}`,
      rotation: obj.rotation ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Parse layout error:', error);
    return NextResponse.json(
      { success: false, error: '解析失败，请重试' },
      { status: 500 }
    );
  }
}
