'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutCanvas } from '@/components/LayoutCanvas';
import type { StoreLayout } from '@/lib/types';

type AppState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export default function Home() {
  const [state, setState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState('');
  const [layout, setLayout] = useState<StoreLayout | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [note, setNote] = useState('');
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const noteRecognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检查浏览器是否支持语音识别
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // 初始化语音识别
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim += t;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onend = () => {
      setState('idle');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMsg('麦克风权限被拒绝。请点击浏览器地址栏左侧的锁形图标，将"麦克风"设置为"允许"，然后刷新页面重试');
      } else if (event.error === 'no-speech') {
        setErrorMsg('未检测到语音，请重试');
      } else if (event.error === 'service-not-allowed') {
        setErrorMsg('麦克风服务被禁止，请在浏览器设置中允许麦克风访问');
      } else {
        setErrorMsg(`语音识别错误: ${event.error}，您可以直接在下方文本框手动输入`);
      }
      setState('error');
    };

    return recognition;
  }, []);

  // 开始录音
  const startListening = useCallback(() => {
    setErrorMsg('');
    setTranscript('');

    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    if (!recognitionRef.current) {
      setErrorMsg('当前浏览器不支持语音识别，请使用Chrome浏览器或手动输入');
      setState('error');
      return;
    }

    try {
      recognitionRef.current.start();
      setState('listening');
    } catch (e) {
      console.warn('Recognition start failed:', e);
    }
  }, [initRecognition]);

  // 停止录音
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState('idle');
  }, []);

  // 生成布局图
  const generateLayout = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      setErrorMsg('请先输入或录制语音描述');
      setState('error');
      return;
    }

    setState('processing');
    setErrorMsg('');

    // 本地智能解析（根据关键词生成布局）
    const parseLayoutLocally = (text: string): StoreLayout => {
      // 提取尺寸
      const widthMatch = text.match(/宽\s*(\d+(?:\.\d+)?)\s*米/);
      const lengthMatch = text.match(/(?:长|进深|深度)\s*(\d+(?:\.\d+)?)\s*米/);
      const width = widthMatch ? parseFloat(widthMatch[1]) : 5.0;
      const length = lengthMatch ? parseFloat(lengthMatch[1]) : 8.0;

      // 提取门的位置
      let doorWall: 'north' | 'south' | 'east' | 'west' = 'south';
      let doorPosition = 0.5;
      
      if (text.includes('南墙') || text.includes('南边') || text.includes('前面')) {
        doorWall = 'south';
      } else if (text.includes('北墙') || text.includes('北边') || text.includes('后面')) {
        doorWall = 'north';
      } else if (text.includes('东墙') || text.includes('东边') || text.includes('右边')) {
        doorWall = 'east';
      } else if (text.includes('西墙') || text.includes('西边') || text.includes('左边')) {
        doorWall = 'west';
      }

      if (text.includes('中间') || text.includes('中央')) {
        doorPosition = 0.5;
      } else if (text.includes('左边') || text.includes('左侧')) {
        doorPosition = 0.25;
      } else if (text.includes('右边') || text.includes('右侧')) {
        doorPosition = 0.75;
      }

      // 提取物体
      const objects: Array<{
        id: string;
        name: string;
        type: 'counter' | 'storage' | 'showcase' | 'fridge' | 'other';
        x: number;
        y: number;
        width: number;
        length: number;
        rotation: number;
      }> = [];

      let objId = 1;

      // 柜台
      if (text.includes('柜台') || text.includes('收银')) {
        const counterX = text.includes('进门') && text.includes('右手边') ? 0.5 : 0;
        const counterY = text.includes('进门') ? 0 : length - 1;
        objects.push({
          id: `obj_${objId++}`,
          name: '柜台',
          type: 'counter',
          x: counterX,
          y: counterY,
          width: 2.0,
          length: 0.8,
          rotation: 0
        });
      }

      // 烟草展示柜
      if (text.includes('展示柜') || text.includes('烟草柜') || text.includes('烟柜')) {
        objects.push({
          id: `obj_${objId++}`,
          name: '烟草展示柜',
          type: 'showcase',
          x: text.includes('右手边') ? width - 1.5 : 0,
          y: text.includes('靠墙') ? 0 : 2,
          width: 1.5,
          length: 0.6,
          rotation: 0
        });
      }

      // 仓储区
      if (text.includes('仓储') || text.includes('仓库') || text.includes('储物')) {
        objects.push({
          id: `obj_${objId++}`,
          name: '仓储区',
          type: 'storage',
          x: 0,
          y: length - 2,
          width: 2.0,
          length: 2.0,
          rotation: 0
        });
      }

      // 冰箱
      if (text.includes('冰箱') || text.includes('冷柜')) {
        objects.push({
          id: `obj_${objId++}`,
          name: '冰箱',
          type: 'fridge',
          x: width - 1,
          y: length - 2,
          width: 0.8,
          length: 0.8,
          rotation: 0
        });
      }

      // 如果没有识别到任何物体，添加默认物体
      if (objects.length === 0) {
        objects.push({
          id: `obj_${objId++}`,
          name: '柜台',
          type: 'counter',
          x: 0.5,
          y: 0,
          width: 2.0,
          length: 0.8,
          rotation: 0
        });
        objects.push({
          id: `obj_${objId++}`,
          name: '烟草展示柜',
          type: 'showcase',
          x: 3.0,
          y: 0,
          width: 1.5,
          length: 0.6,
          rotation: 0
        });
      }

      // 楼梯
      let stairs = undefined;
      if (text.includes('二楼') || text.includes('楼上') || text.includes('夹层') || text.includes('复式')) {
        stairs = {
          x: width - 1,
          y: length - 2,
          width: 0.8,
          length: 1.5,
          direction: 'up-north' as const
        };
      }

      return {
        width,
        length,
        door: {
          wall: doorWall,
          position: doorPosition,
          width: 1.0
        },
        objects,
        stairs
      };
    };

    try {
      const res = await fetch('/api/parse-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (data.success && data.data && !data.message?.includes('演示模式')) {
        // 使用真实AI解析结果
        setLayout(data.data);
        setState('done');
        setShowAdjustPanel(true);
      } else {
        // API失败或演示模式，使用本地智能解析
        console.warn('使用本地智能解析');
        setLayout(parseLayoutLocally(text));
        setState('done');
        setShowAdjustPanel(true);
      }
    } catch (err) {
      console.error('Generate layout error:', err);
      // 网络错误，使用本地智能解析
      console.warn('网络请求失败，使用本地智能解析');
      setLayout(parseLayoutLocally(text));
      setState('done');
      setShowAdjustPanel(true);
    }
  }, [transcript]);

  // 重置
  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setLayout(null);
    setErrorMsg('');
    setShowAdjustPanel(false);
    setNote('');
    setIsEditingNote(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (noteRecognitionRef.current) {
      noteRecognitionRef.current.stop();
      noteRecognitionRef.current = null;
    }
  }, []);

  // 处理布局变更
  const handleLayoutChange = useCallback((newLayout: StoreLayout) => {
    setLayout(newLayout);
  }, []);

  // 语音备注
  const toggleNoteRecording = useCallback(() => {
    if (isRecordingNote) {
      // 停止录音
      if (noteRecognitionRef.current) {
        noteRecognitionRef.current.stop();
      }
      setIsRecordingNote(false);
    } else {
      // 开始录音
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalTranscript = '';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          } else {
            interim += t;
          }
        }
        setNote(finalTranscript + interim);
      };

      recognition.onerror = () => {
        setIsRecordingNote(false);
      };

      recognition.onend = () => {
        setIsRecordingNote(false);
      };

      noteRecognitionRef.current = recognition;
      recognition.start();
      setIsRecordingNote(true);
    }
  }, [isRecordingNote]);

  // 更新店面尺寸
  const updateStoreSize = useCallback((width: number, length: number) => {
    if (!layout) return;
    setLayout({
      ...layout,
      width: Math.max(1, width),
      length: Math.max(1, length),
    });
  }, [layout]);

  // 示例文本
  const fillExample = useCallback(() => {
    setTranscript('店面宽5米，长8米，总面积40平方米。门在南面墙中间位置，门宽1米。进门后左手边靠西墙有一个柜台，宽2米，长1米，距南墙2米。右手边靠东墙有一个烟草展示柜，宽1.5米，长1米，距南墙1.5米。店面最里面北墙中间有一个仓储，宽2米，长1.5米。');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">烟草许可证 · 实地核查</h1>
              <p className="text-xs text-gray-500">语音AI生成店面布局图</p>
            </div>
          </div>
          {layout && (
            <button
              onClick={reset}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重新开始
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 语音输入区域 */}
        {!layout && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              描述店面布局
            </h2>

            {/* 语音按钮 */}
            <div className="flex flex-col items-center gap-3">
              {state === 'listening' ? (
                <button
                  onClick={stopListening}
                  className="w-20 h-20 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center animate-pulse"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={startListening}
                  disabled={!speechSupported}
                  className="w-20 h-20 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
              <p className="text-sm text-gray-500">
                {state === 'listening' 
                  ? '正在录音... 点击停止' 
                  : speechSupported 
                    ? '点击开始语音输入' 
                    : '浏览器不支持语音识别，请手动输入'}
              </p>
            </div>

            {/* 文本输入 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">店面描述（语音输入或直接打字）</label>
                <button
                  onClick={fillExample}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  没有语音？填入示例
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="例如：店面宽5米长8米，门在南面墙中间。进门左手边有柜台，宽2米长1米。里面有仓储，宽2米长1.5米..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* 错误提示 */}
            {errorMsg && state === 'error' && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800 space-y-2">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium mb-1">语音输入提示</p>
                    <p className="leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 pl-7">💡 您也可以直接在下方文本框中手动输入店面描述</p>
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={generateLayout}
              disabled={state === 'processing' || !transcript.trim()}
              className="w-full py-3.5 bg-blue-600 text-white font-medium rounded-xl shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state === 'processing' ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI 正在解析中，请稍候（约10-30秒）...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  生成布局图
                </>
              )}
            </button>

            {/* 使用说明 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">语音描述要点：</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>1. 先说店面尺寸：&quot;宽5米，长8米&quot;</li>
                <li>2. 再说门的方位和位置：&quot;门在南面墙中间&quot;</li>
                <li>3. 说物体位置和尺寸：&quot;柜台在进门左手边，宽2米长1米&quot;</li>
                <li>4. 生成后可以拖拽调整物体位置、大小和方向</li>
              </ul>
            </div>
          </div>
        )}

        {/* 布局图展示 */}
        {layout && (
          <div className="space-y-4">
            {/* 布局信息摘要 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">尺寸:</span>
                  <span className="font-medium text-gray-900">{layout.width}m × {layout.length}m</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">面积:</span>
                  <span className="font-medium text-gray-900">{(layout.width * layout.length).toFixed(1)}m²</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">门:</span>
                  <span className="font-medium text-gray-900">{wallLabel(layout.door.wall)}墙</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">物体:</span>
                  <span className="font-medium text-gray-900">{layout.objects?.length || 0}个</span>
                </div>
              </div>
            </div>

            {/* 调整控制面板 */}
            {showAdjustPanel && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    调整布局
                  </h3>
                  <button
                    onClick={() => setShowAdjustPanel(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    收起
                  </button>
                </div>

                {/* 店面尺寸调整 */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">店面尺寸</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">宽度（米）</label>
                      <input
                        type="number"
                        value={layout.width}
                        onChange={(e) => updateStoreSize(parseFloat(e.target.value) || 1, layout.length)}
                        min="1"
                        step="0.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">长度（米）</label>
                      <input
                        type="number"
                        value={layout.length}
                        onChange={(e) => updateStoreSize(layout.width, parseFloat(e.target.value) || 1)}
                        min="1"
                        step="0.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 操作提示 */}
                <div className="bg-blue-50 rounded-xl p-3 space-y-1">
                  <p className="text-sm font-medium text-blue-900">在布局图上直接操作：</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 点击物体选中，拖拽移动位置</li>
                    <li>• 拖拽右下角红色方块调整大小</li>
                    <li>• 拖拽左上角绿色圆点旋转方向</li>
                    <li>• 选中后可点击上方按钮旋转90°或删除</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 收起状态时显示展开按钮 */}
            {!showAdjustPanel && (
              <button
                onClick={() => setShowAdjustPanel(true)}
                className="w-full py-3 bg-white border border-gray-200 rounded-2xl text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                调整布局
              </button>
            )}

            {/* 布局图 */}
            <LayoutCanvas layout={layout} onLayoutChange={handleLayoutChange} note={note} />

            {/* 语音备注 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  语音备注
                </h3>
                <div className="flex gap-2">
                  {!isEditingNote && note && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      编辑
                    </button>
                  )}
                  {isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(false)}
                      className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      完成
                    </button>
                  )}
                </div>
              </div>

              {isEditingNote ? (
                <div className="space-y-3">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="输入备注内容，或点击语音按钮录入..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={toggleNoteRecording}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        isRecordingNote
                          ? 'bg-red-500 text-white'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      {isRecordingNote ? (
                        <>
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          停止录音
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          语音录入
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {note ? (
                    <div className="bg-purple-50 rounded-xl p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note}</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <p className="text-sm">暂无备注</p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setIsEditingNote(true);
                      if (!note) {
                        toggleNoteRecording();
                      }
                    }}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      isRecordingNote
                        ? 'bg-red-500 text-white'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    {isRecordingNote ? (
                      <>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        停止录音
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {note ? '重新录入' : '语音录入'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                重新描述
              </button>
              <button
                onClick={() => {
                  setLayout(null);
                  setState('idle');
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                修改描述
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function wallLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: '北', south: '南', east: '东', west: '西',
  };
  return labels[dir] || dir;
}
