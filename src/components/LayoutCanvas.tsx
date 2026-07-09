'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { StoreLayout, StoreObject } from '@/lib/types';

interface LayoutCanvasProps {
  layout: StoreLayout | null;
  className?: string;
}

/** 物体类型对应的颜色 */
const TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  counter:  { fill: '#DBEAFE', stroke: '#2563EB' },  // 蓝色 - 柜台
  storage:  { fill: '#FEF3C7', stroke: '#D97706' },  // 橙色 - 仓储
  showcase: { fill: '#D1FAE5', stroke: '#059669' },  // 绿色 - 展示柜
  fridge:   { fill: '#E0E7FF', stroke: '#4F46E5' },  // 靛蓝 - 冰箱
  other:    { fill: '#F3E8FF', stroke: '#7C3AED' },  // 紫色 - 其他
};

/** 方向角度映射（用于指北针） */
const DIR_ANGLES: Record<string, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

export function LayoutCanvas({ layout, className = '' }: LayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 画布尺寸（内部高分辨率）
    const W = 2000;
    const H = 2000;
    canvas.width = W;
    canvas.height = H;

    const padding = 280; // 留给标注线的空间
    const drawW = W - padding * 2;
    const drawH = H - padding * 2;

    // 计算比例尺（米 -> 像素）
    const scaleX = drawW / layout.width;
    const scaleY = drawH / layout.length;
    const scale = Math.min(scaleX, scaleY);

    // 实际绘制区域
    const storePixelW = layout.width * scale;
    const storePixelH = layout.length * scale;

    // 居中偏移
    const offsetX = (W - storePixelW) / 2;
    const offsetY = (H - storePixelH) / 2;

    // 坐标转换：米 -> 像素（Y轴翻转，因为canvas Y向下）
    const toPixelX = (mx: number) => offsetX + mx * scale;
    const toPixelY = (my: number) => offsetY + storePixelH - my * scale;

    // 清空画布
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // ===== 绘制标题 =====
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 56px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('店面布局图', W / 2, 80);

    // 副标题 - 面积信息
    const area = layout.width * layout.length;
    ctx.font = '36px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(
      `${layout.width}m × ${layout.length}m = ${area.toFixed(1)}m²  |  朝向: ${orientationLabel(layout.orientation)}`,
      W / 2, 130
    );

    // ===== 绘制店面轮廓 =====
    const sx = toPixelX(0);
    const sy = toPixelY(layout.length);
    const sw = storePixelW;
    const sh = storePixelH;

    // 填充浅色背景
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(sx, sy, sw, sh);

    // 画墙（考虑门的开口）
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 6;
    drawWalls(ctx, layout, toPixelX, toPixelY, scale);

    // ===== 绘制尺寸标注线 =====
    drawDimensionLine(ctx, 
      toPixelX(0), toPixelY(0) + 80,
      toPixelX(layout.width), toPixelY(0) + 80,
      `${layout.width}m`, 'bottom'
    );
    drawDimensionLine(ctx,
      toPixelX(layout.width) + 80, toPixelY(0),
      toPixelX(layout.width) + 80, toPixelY(layout.length),
      `${layout.length}m`, 'right'
    );

    // ===== 绘制门 =====
    drawDoor(ctx, layout, toPixelX, toPixelY, scale);

    // ===== 绘制物体 =====
    if (layout.objects) {
      for (const obj of layout.objects) {
        drawObject(ctx, obj, toPixelX, toPixelY, scale);
      }
    }

    // ===== 绘制指北针 =====
    drawCompass(ctx, 140, H - 140, layout.orientation);

  }, [layout]);

  useEffect(() => {
    draw();
  }, [draw]);

  /** 导出为PNG */
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `店面布局图_${timestamp}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-[70vh] border border-gray-200 rounded-lg shadow-sm bg-white"
        style={{ aspectRatio: '1 / 1' }}
      />
      {layout && (
        <button
          onClick={exportPNG}
          className="absolute top-3 right-3 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出图片
        </button>
      )}
    </div>
  );
}

// ===== 辅助绘制函数 =====

function orientationLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: '坐南朝北', south: '坐北朝南', east: '坐西朝东', west: '坐东朝西',
  };
  return labels[dir] || dir;
}

/** 绘制带门的墙壁 */
function drawWalls(
  ctx: CanvasRenderingContext2D,
  layout: StoreLayout,
  toPixelX: (m: number) => number,
  toPixelY: (m: number) => number,
  _scale: number
) {
  const { width, length, door } = layout;
  const x0 = toPixelX(0);
  const y0 = toPixelY(0);
  const x1 = toPixelX(width);
  const y1 = toPixelY(length);
  const w = x1 - x0;
  const h = y0 - y1;

  // 计算门的开口位置（像素坐标）
  let doorStart: number, doorEnd: number;
  
  if (door.wall === 'south' || door.wall === 'north') {
    const wallY = door.wall === 'south' ? y0 : y1;
    const centerPx = x0 + door.position * w;
    const halfDoorPx = (door.width * (w / width)) / 2;
    doorStart = centerPx - halfDoorPx;
    doorEnd = centerPx + halfDoorPx;

    // 画有门开口的墙
    ctx.beginPath();
    if (door.wall === 'south') {
      // 南墙（底部）- 分两段
      ctx.moveTo(x0, y0);
      ctx.lineTo(doorStart, y0);
      ctx.moveTo(doorEnd, y0);
      ctx.lineTo(x1, y0);
      // 其他三面完整的墙
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y0);
    } else {
      // 北墙（顶部）
      ctx.moveTo(x0, y1);
      ctx.lineTo(doorStart, y1);
      ctx.moveTo(doorEnd, y1);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0, y1);
    }
    ctx.stroke();
  } else {
    const centerPx = y0 - door.position * h;
    const halfDoorPx = (door.width * (h / length)) / 2;
    doorStart = centerPx - halfDoorPx;
    doorEnd = centerPx + halfDoorPx;

    ctx.beginPath();
    if (door.wall === 'east') {
      // 东墙（右侧）
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, doorStart);
      ctx.moveTo(x1, doorEnd);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y0);
    } else {
      // 西墙（左侧）
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, doorStart);
      ctx.moveTo(x0, doorEnd);
      ctx.lineTo(x0, y1);
      ctx.moveTo(x0, y1);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x0, y0);
    }
    ctx.stroke();
  }
}

/** 绘制门符号 */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  layout: StoreLayout,
  toPixelX: (m: number) => number,
  toPixelY: (m: number) => number,
  scale: number
) {
  const { width, length, door } = layout;
  const x0 = toPixelX(0);
  const y0 = toPixelY(0);
  const x1 = toPixelX(width);
  const y1 = toPixelY(length);
  const w = x1 - x0;
  const h = y0 - y1;

  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  let cx: number, cy: number;
  const doorWidthPx = door.width * scale;

  if (door.wall === 'south') {
    cx = x0 + door.position * w;
    cy = y0;
    // 门弧线（向内开）
    ctx.beginPath();
    ctx.arc(cx - doorWidthPx / 2, cy, doorWidthPx, -Math.PI / 2, 0);
    ctx.stroke();
    // 门标签
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('门', cx, cy + 50);
  } else if (door.wall === 'north') {
    cx = x0 + door.position * w;
    cy = y1;
    ctx.beginPath();
    ctx.arc(cx - doorWidthPx / 2, cy, doorWidthPx, 0, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('门', cx, cy - 30);
  } else if (door.wall === 'east') {
    cx = x1;
    cy = y0 - door.position * h;
    ctx.beginPath();
    ctx.arc(cx, cy + doorWidthPx / 2, doorWidthPx, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('门', cx + 50, cy + 10);
  } else {
    cx = x0;
    cy = y0 - door.position * h;
    ctx.beginPath();
    ctx.arc(cx, cy + doorWidthPx / 2, doorWidthPx, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('门', cx - 50, cy + 10);
  }
}

/** 绘制物体（矩形 + 名称 + 尺寸） */
function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: StoreObject,
  toPixelX: (m: number) => number,
  toPixelY: (m: number) => number,
  scale: number
) {
  const colors = TYPE_COLORS[obj.type] || TYPE_COLORS.other;
  const px = toPixelX(obj.x);
  const py = toPixelY(obj.y + obj.length);
  const pw = obj.width * scale;
  const ph = obj.length * scale;

  // 填充
  ctx.fillStyle = colors.fill;
  ctx.fillRect(px, py, pw, ph);

  // 边框
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(px, py, pw, ph);

  // 名称标签
  ctx.fillStyle = '#1F2937';
  const fontSize = Math.max(24, Math.min(36, pw / obj.name.length * 1.2));
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(obj.name, px + pw / 2, py + ph / 2 - 14);

  // 尺寸标注
  ctx.fillStyle = '#6B7280';
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(
    `${obj.width}m × ${obj.length}m`,
    px + pw / 2,
    py + ph / 2 + 18
  );
  ctx.textBaseline = 'alphabetic';
}

/** 绘制尺寸标注线 */
function drawDimensionLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string,
  side: 'bottom' | 'right'
) {
  const arrowSize = 16;
  
  ctx.strokeStyle = '#6B7280';
  ctx.fillStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  // 主线
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 端点引线
  if (side === 'bottom') {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 20);
    ctx.lineTo(x1, y1 + 20);
    ctx.moveTo(x2, y2 - 20);
    ctx.lineTo(x2, y2 + 20);
    ctx.stroke();

    // 箭头
    drawArrow(ctx, x1, y1, 'right', arrowSize);
    drawArrow(ctx, x2, y2, 'left', arrowSize);
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 - 20, y1);
    ctx.lineTo(x1 + 20, y1);
    ctx.moveTo(x2 - 20, y2);
    ctx.lineTo(x2 + 20, y2);
    ctx.stroke();

    drawArrow(ctx, x1, y1, 'down', arrowSize);
    drawArrow(ctx, x2, y2, 'up', arrowSize);
  }

  // 标签
  ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (side === 'bottom') {
    ctx.fillText(label, (x1 + x2) / 2, y1 + 40);
  } else {
    ctx.save();
    ctx.translate(x1 + 50, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}

/** 绘制箭头 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  dir: 'left' | 'right' | 'up' | 'down',
  size: number
) {
  ctx.fillStyle = '#6B7280';
  ctx.beginPath();
  switch (dir) {
    case 'right':
      ctx.moveTo(x, y);
      ctx.lineTo(x + size, y - size / 2);
      ctx.lineTo(x + size, y + size / 2);
      break;
    case 'left':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y - size / 2);
      ctx.lineTo(x - size, y + size / 2);
      break;
    case 'up':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size / 2, y - size);
      ctx.lineTo(x + size / 2, y - size);
      break;
    case 'down':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size / 2, y + size);
      ctx.lineTo(x + size / 2, y + size);
      break;
  }
  ctx.closePath();
  ctx.fill();
}

/** 绘制指北针 */
function drawCompass(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  orientation: string
) {
  const r = 60;

  // 外圆
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 北向箭头（始终指向上方，因为我们的布局图就是上北下南）
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 10);
  ctx.lineTo(cx - 12, cy - 10);
  ctx.lineTo(cx + 12, cy - 10);
  ctx.closePath();
  ctx.fill();

  // 南向
  ctx.fillStyle = '#9CA3AF';
  ctx.beginPath();
  ctx.moveTo(cx, cy + r - 10);
  ctx.lineTo(cx - 12, cy + 10);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.closePath();
  ctx.fill();

  // N 标签
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - r - 12);

  // 方向标注
  ctx.fillStyle = '#6B7280';
  ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('S', cx, cy + r + 28);
  ctx.fillText('E', cx + r + 20, cy + 8);
  ctx.fillText('W', cx - r - 20, cy + 8);
}
