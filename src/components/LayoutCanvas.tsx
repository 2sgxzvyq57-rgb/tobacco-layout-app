'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { StoreLayout, StoreObject } from '@/lib/types';

interface LayoutCanvasProps {
  layout: StoreLayout | null;
  onLayoutChange?: (layout: StoreLayout) => void;
  className?: string;
  note?: string;
}

/** 物体类型对应的颜色 */
const TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  counter:  { fill: '#DBEAFE', stroke: '#2563EB' },  // 蓝色 - 柜台
  storage:  { fill: '#FEF3C7', stroke: '#D97706' },  // 橙色 - 仓储
  showcase: { fill: '#D1FAE5', stroke: '#059669' },  // 绿色 - 展示柜
  fridge:   { fill: '#E0E7FF', stroke: '#4F46E5' },  // 靛蓝 - 冰箱
  other:    { fill: '#F3E8FF', stroke: '#7C3AED' },  // 紫色 - 其他
};

/** 交互模式 */
type InteractionMode = 'none' | 'drag' | 'resize' | 'rotate';

export function LayoutCanvas({ layout, onLayoutChange, className = '', note = '' }: LayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [objectStart, setObjectStart] = useState<{ x: number; y: number; width: number; length: number; rotation: number } | null>(null);

  // 计算画布参数
  const getCanvasParams = useCallback(() => {
    if (!layout) return null;
    
    const W = 2000;
    const H = 2000;
    const padding = 280;
    const drawW = W - padding * 2;
    const drawH = H - padding * 2;

    const scaleX = drawW / layout.width;
    const scaleY = drawH / layout.length;
    const scale = Math.min(scaleX, scaleY);

    const storePixelW = layout.width * scale;
    const storePixelH = layout.length * scale;

    const offsetX = (W - storePixelW) / 2;
    const offsetY = (H - storePixelH) / 2;

    const toPixelX = (mx: number) => offsetX + mx * scale;
    const toPixelY = (my: number) => offsetY + storePixelH - my * scale;
    const toMeterX = (px: number) => (px - offsetX) / scale;
    const toMeterY = (py: number) => (offsetY + storePixelH - py) / scale;

    return { W, H, scale, offsetX, offsetY, storePixelW, storePixelH, toPixelX, toPixelY, toMeterX, toMeterY };
  }, [layout]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const params = getCanvasParams();
    if (!params) return;

    const { W, H, toPixelX, toPixelY, scale } = params;
    
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    ctx.fillText(`${layout.width}m × ${layout.length}m = ${area.toFixed(1)}m²`, W / 2, 130);

    // ===== 绘制店面轮廓 =====
    const sx = toPixelX(0);
    const sy = toPixelY(layout.length);
    const sw = params.storePixelW;
    const sh = params.storePixelH;

    // 填充浅色背景
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(sx, sy, sw, sh);

    // 画墙（考虑门的开口）
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 6;
    drawWalls(ctx, layout, toPixelX, toPixelY);

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
        const isSelected = obj.id === selectedObjectId;
        drawObject(ctx, obj, toPixelX, toPixelY, scale, isSelected);
      }
    }

    // ===== 绘制指北针 =====
    drawCompass(ctx, 140, H - 140);

    // ===== 绘制备注 =====
    if (note) {
      drawNote(ctx, note, W, H);
    }

  }, [layout, selectedObjectId, getCanvasParams, note]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 鼠标/触摸事件处理
  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const findObjectAtPoint = useCallback((px: number, py: number): StoreObject | null => {
    if (!layout) return null;
    const params = getCanvasParams();
    if (!params) return null;

    const { toPixelX, toPixelY, scale } = params;

    // 从后往前遍历，后绘制的物体在上面
    for (let i = layout.objects.length - 1; i >= 0; i--) {
      const obj = layout.objects[i];
      const objPx = toPixelX(obj.x);
      const objPy = toPixelY(obj.y + obj.length);
      const objW = obj.width * scale;
      const objH = obj.length * scale;

      if (px >= objPx && px <= objPx + objW && py >= objPy && py <= objPy + objH) {
        return obj;
      }
    }
    return null;
  }, [layout, getCanvasParams]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoords(e);
    if (!coords || !layout) return;

    const obj = findObjectAtPoint(coords.x, coords.y);
    
    if (obj) {
      setSelectedObjectId(obj.id);
      setDragStart({ x: coords.x, y: coords.y });
      setObjectStart({ x: obj.x, y: obj.y, width: obj.width, length: obj.length, rotation: obj.rotation });
      
      // 检测是否在边缘（调整大小）或角落（旋转）
      const params = getCanvasParams();
      if (!params) return;
      
      const { toPixelX, toPixelY, scale } = params;
      const objPx = toPixelX(obj.x);
      const objPy = toPixelY(obj.y + obj.length);
      const objW = obj.width * scale;
      const objH = obj.length * scale;
      
      const edgeThreshold = 50; // 增大检测区域，便于点击
      
      // 检测是否在右下角（调整大小）
      if (Math.abs(coords.x - (objPx + objW)) < edgeThreshold && 
          Math.abs(coords.y - (objPy + objH)) < edgeThreshold) {
        setMode('resize');
      } 
      // 检测是否在左上角（旋转）
      else if (Math.abs(coords.x - objPx) < edgeThreshold && 
               Math.abs(coords.y - objPy) < edgeThreshold) {
        setMode('rotate');
      } 
      // 否则是拖拽
      else {
        setMode('drag');
      }
    } else {
      setSelectedObjectId(null);
      setMode('none');
    }
  }, [layout, getCanvasCoords, findObjectAtPoint, getCanvasParams]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'none' || !dragStart || !objectStart || !selectedObjectId || !layout) return;
    
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const params = getCanvasParams();
    if (!params) return;

    const { scale } = params;
    const dx = (coords.x - dragStart.x) / scale;
    const dy = -(coords.y - dragStart.y) / scale; // Y轴翻转

    const updatedObjects = layout.objects.map(obj => {
      if (obj.id !== selectedObjectId) return obj;

      if (mode === 'drag') {
        return {
          ...obj,
          x: Math.max(0, Math.min(layout.width - obj.width, objectStart.x + dx)),
          y: Math.max(0, Math.min(layout.length - obj.length, objectStart.y + dy)),
        };
      } else if (mode === 'resize') {
        const newWidth = Math.max(0.5, objectStart.width + dx);
        const newLength = Math.max(0.5, objectStart.length + dy);
        return {
          ...obj,
          width: Math.round(newWidth * 10) / 10,
          length: Math.round(newLength * 10) / 10,
        };
      } else if (mode === 'rotate') {
        // 计算旋转角度
        const centerX = objectStart.x + objectStart.width / 2;
        const centerY = objectStart.y + objectStart.length / 2;
        const angle = Math.atan2(coords.y - (params.offsetY + params.storePixelH - centerY * scale), 
                                  coords.x - (params.offsetX + centerX * scale));
        let degrees = Math.round(angle * 180 / Math.PI);
        degrees = ((degrees % 360) + 360) % 360;
        return {
          ...obj,
          rotation: degrees,
        };
      }
      return obj;
    });

    const newLayout = { ...layout, objects: updatedObjects };
    onLayoutChange?.(newLayout);
  }, [mode, dragStart, objectStart, selectedObjectId, layout, getCanvasCoords, getCanvasParams, onLayoutChange]);

  const handlePointerUp = useCallback(() => {
    setMode('none');
    setDragStart(null);
    setObjectStart(null);
  }, []);

  /** 导出为PNG */
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 临时取消选中状态
    const prevSelected = selectedObjectId;
    setSelectedObjectId(null);
    
    setTimeout(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        a.download = `店面布局图_${timestamp}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setSelectedObjectId(prevSelected);
      }, 'image/png');
    }, 100);
  }, [selectedObjectId]);

  /** 删除选中物体 */
  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId || !layout) return;
    const newLayout = {
      ...layout,
      objects: layout.objects.filter(obj => obj.id !== selectedObjectId),
    };
    onLayoutChange?.(newLayout);
    setSelectedObjectId(null);
  }, [selectedObjectId, layout, onLayoutChange]);

  /** 旋转选中物体90度 */
  const rotateSelectedObject = useCallback(() => {
    if (!selectedObjectId || !layout) return;
    const newLayout = {
      ...layout,
      objects: layout.objects.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        return {
          ...obj,
          rotation: (obj.rotation + 90) % 360,
        };
      }),
    };
    onLayoutChange?.(newLayout);
  }, [selectedObjectId, layout, onLayoutChange]);

  /** 获取选中的物体 */
  const selectedObject = layout?.objects.find(obj => obj.id === selectedObjectId) || null;

  /** 更新选中物体的尺寸 */
  const updateSelectedObjectSize = useCallback((width: number, length: number) => {
    if (!selectedObjectId || !layout) return;
    const newLayout = {
      ...layout,
      objects: layout.objects.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        return {
          ...obj,
          width: Math.max(0.1, width),
          length: Math.max(0.1, length),
        };
      }),
    };
    onLayoutChange?.(newLayout);
  }, [selectedObjectId, layout, onLayoutChange]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-[70vh] border border-gray-200 rounded-lg shadow-sm bg-white cursor-pointer"
        style={{ aspectRatio: '1 / 1' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      
      {/* 选中物体的尺寸调整面板 */}
      {selectedObject && (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              调整 {selectedObject.name} 尺寸
            </h4>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* 宽度调整 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">宽度（米）</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSelectedObjectSize(selectedObject.width - 0.1, selectedObject.length)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={selectedObject.width}
                  onChange={(e) => updateSelectedObjectSize(parseFloat(e.target.value) || 0.1, selectedObject.length)}
                  min="0.1"
                  step="0.1"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => updateSelectedObjectSize(selectedObject.width + 0.1, selectedObject.length)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            
            {/* 长度调整 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">长度（米）</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSelectedObjectSize(selectedObject.width, selectedObject.length - 0.1)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={selectedObject.length}
                  onChange={(e) => updateSelectedObjectSize(selectedObject.width, parseFloat(e.target.value) || 0.1)}
                  min="0.1"
                  step="0.1"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => updateSelectedObjectSize(selectedObject.width, selectedObject.length + 0.1)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          
          {/* 快捷调整按钮 */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => updateSelectedObjectSize(selectedObject.width * 1.1, selectedObject.length * 1.1)}
              className="flex-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors"
            >
              放大10%
            </button>
            <button
              onClick={() => updateSelectedObjectSize(selectedObject.width * 0.9, selectedObject.length * 0.9)}
              className="flex-1 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-medium rounded-lg transition-colors"
            >
              缩小10%
            </button>
            <button
              onClick={() => updateSelectedObjectSize(selectedObject.length, selectedObject.width)}
              className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg transition-colors"
            >
              交换宽高
            </button>
          </div>
        </div>
      )}
      
      {/* 操作按钮 */}
      {layout && (
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={exportPNG}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" />
            </svg>
            导出图片
          </button>
          
          {selectedObjectId && (
            <>
              <button
                onClick={rotateSelectedObject}
                className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 active:scale-95 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                旋转90°
              </button>
              <button
                onClick={deleteSelectedObject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 active:scale-95 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </button>
            </>
          )}
        </div>
      )}

      {/* 操作提示 */}
      {layout && selectedObjectId && (
        <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
          已选中物体 | 拖拽移动 | 右下角拖拽调整大小 | 左上角拖拽旋转
        </div>
      )}
    </div>
  );
}

// ===== 辅助绘制函数 =====

/** 绘制带门的墙壁 */
function drawWalls(
  ctx: CanvasRenderingContext2D,
  layout: StoreLayout,
  toPixelX: (m: number) => number,
  toPixelY: (m: number) => number
) {
  const { width, length, door } = layout;
  const x0 = toPixelX(0);
  const y0 = toPixelY(0);
  const x1 = toPixelX(width);
  const y1 = toPixelY(length);
  const w = x1 - x0;
  const h = y0 - y1;

  let doorStart: number, doorEnd: number;
  
  if (door.wall === 'south' || door.wall === 'north') {
    const centerPx = x0 + door.position * w;
    const halfDoorPx = (door.width * (w / width)) / 2;
    doorStart = centerPx - halfDoorPx;
    doorEnd = centerPx + halfDoorPx;

    ctx.beginPath();
    if (door.wall === 'south') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(doorStart, y0);
      ctx.moveTo(doorEnd, y0);
      ctx.lineTo(x1, y0);
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y0);
    } else {
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
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, doorStart);
      ctx.moveTo(x1, doorEnd);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y0);
    } else {
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
    ctx.beginPath();
    ctx.arc(cx - doorWidthPx / 2, cy, doorWidthPx, -Math.PI / 2, 0);
    ctx.stroke();
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

/** 绘制物体（矩形 + 名称 + 尺寸 + 选中高亮） */
function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: StoreObject,
  toPixelX: (m: number) => number,
  toPixelY: (m: number) => number,
  scale: number,
  isSelected: boolean
) {
  const colors = TYPE_COLORS[obj.type] || TYPE_COLORS.other;
  const px = toPixelX(obj.x);
  const py = toPixelY(obj.y + obj.length);
  const pw = obj.width * scale;
  const ph = obj.length * scale;

  // 选中高亮
  if (isSelected) {
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 6;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(px - 5, py - 5, pw + 10, ph + 10);
    ctx.setLineDash([]);
  }

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

  // 调整大小手柄（右下角）- 增大尺寸便于点击
  if (isSelected) {
    const handleSize = 32;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(px + pw - handleSize / 2, py + ph - handleSize / 2, handleSize, handleSize);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + pw - handleSize / 2, py + ph - handleSize / 2, handleSize, handleSize);
    
    // 旋转手柄（左上角）- 增大尺寸便于点击
    const rotateHandleSize = 16;
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(px + rotateHandleSize, py + rotateHandleSize, rotateHandleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
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

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (side === 'bottom') {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 20);
    ctx.lineTo(x1, y1 + 20);
    ctx.moveTo(x2, y2 - 20);
    ctx.lineTo(x2, y2 + 20);
    ctx.stroke();

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
  cx: number, cy: number
) {
  const r = 60;

  // 外圆
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 北向箭头（红色，指向上方）
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 10);
  ctx.lineTo(cx - 12, cy - 10);
  ctx.lineTo(cx + 12, cy - 10);
  ctx.closePath();
  ctx.fill();

  // 南向（灰色）
  ctx.fillStyle = '#9CA3AF';
  ctx.beginPath();
  ctx.moveTo(cx, cy + r - 10);
  ctx.lineTo(cx - 12, cy + 10);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.closePath();
  ctx.fill();

  // 标签
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#DC2626';
  ctx.fillText('N', cx, cy - r - 20);
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText('S', cx, cy + r + 20);
}

/** 绘制备注文字 */
function drawNote(
  ctx: CanvasRenderingContext2D,
  note: string,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!note) return;

  const padding = 40;
  const maxWidth = canvasWidth - padding * 2;
  const lineHeight = 36;
  const fontSize = 28;

  ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 计算文字换行
  const lines: string[] = [];
  const paragraphs = note.split('\n');
  
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    
    let currentLine = '';
    for (const char of paragraph) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  // 计算备注区域位置（底部）
  const noteHeight = lines.length * lineHeight + padding;
  const noteY = canvasHeight - noteHeight - 20;

  // 绘制背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(padding - 10, noteY - 10, canvasWidth - padding * 2 + 20, noteHeight + 20);
  
  // 绘制边框
  ctx.strokeStyle = '#9333EA';
  ctx.lineWidth = 2;
  ctx.strokeRect(padding - 10, noteY - 10, canvasWidth - padding * 2 + 20, noteHeight + 20);

  // 绘制标题
  ctx.fillStyle = '#9333EA';
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText('备注：', padding, noteY);

  // 绘制内容
  ctx.fillStyle = '#1F2937';
  ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  let y = noteY + lineHeight;
  for (const line of lines) {
    ctx.fillText(line, padding, y);
    y += lineHeight;
  }
}
