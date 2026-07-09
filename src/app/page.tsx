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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
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
      // 可能已经在运行
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

    try {
      const res = await fetch('/api/parse-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        setLayout(data.data);
        setState('done');
      } else {
        setErrorMsg(data.error || '解析失败，请重试');
        setState('error');
      }
    } catch (err) {
      console.error('Generate layout error:', err);
      setErrorMsg('网络请求失败，请检查网络连接');
      setState('error');
    }
  }, [transcript]);

  // 重置
  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setLayout(null);
    setErrorMsg('');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // 示例文本
  const fillExample = useCallback(() => {
    setTranscript('店面坐北朝南，门在南面墙中间位置，门宽1米。店面宽5米，长8米，总面积40平方米。进门后左手边靠西墙有一个柜台，宽2米，长1米，距南墙2米。右手边靠东墙有一个烟草展示柜，宽1.5米，长1米，距南墙1.5米。店面最里面北墙中间有一个仓储，宽2米，长1.5米。');
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
                placeholder="例如：店面坐北朝南，门在南面墙中间，宽5米长8米。进门左手边有柜台，宽2米长1米。里面有仓储，宽2米长1.5米..."
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
                  AI 正在解析...
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
                <li>1. 先说朝向：&quot;坐北朝南&quot;、&quot;坐西朝东&quot;</li>
                <li>2. 再说门的方位和位置：&quot;门在南面墙中间&quot;</li>
                <li>3. 说店面尺寸：&quot;宽5米，长8米&quot;</li>
                <li>4. 说物体位置和尺寸：&quot;柜台在进门左手边，宽2米长1米&quot;</li>
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
                  <span className="text-gray-500">朝向:</span>
                  <span className="font-medium text-gray-900">{orientationLabel(layout.orientation)}</span>
                </div>
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

            {/* 布局图 */}
            <LayoutCanvas layout={layout} />

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

function orientationLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: '坐南朝北', south: '坐北朝南', east: '坐西朝东', west: '坐东朝西',
  };
  return labels[dir] || dir;
}

function wallLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: '北', south: '南', east: '东', west: '西',
  };
  return labels[dir] || dir;
}
