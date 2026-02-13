import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  MessageSquarePlus, 
  CheckCircle2, 
  Check,
  ArrowRight, 
  Copy, 
  RotateCcw,
  PencilRuler,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Sun,
  Moon,
  Monitor,
  FastForward,
  Play
} from 'lucide-react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { LoadingDots } from './components/LoadingDots';
import { analyzePromptRequest, generateFinalPromptStructure } from './services/geminiService';
import { AppStatus, PromptState, Attachment, Theme } from './types';

// Helper to convert File to Base64 (raw)
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:mime/type;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [state, setState] = useState<PromptState>({
    originalRequest: '',
    attachments: [],
    analysisOutput: null,
    gapAnswers: [],
    finalPrompt: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const [isCopied, setIsCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Handling
  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load theme from local storage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (status === AppStatus.WAITING_FOR_CLARIFICATION) {
      setTimeout(() => scrollToRef(analysisRef), 100);
    } else if (status === AppStatus.COMPLETED) {
      setTimeout(() => scrollToRef(bottomRef), 100);
    }
  }, [status]);

  const isValidTextFile = (file: File) => {
    const validMimeTypes = [
      'text/plain', 'text/markdown', 'text/csv', 'text/html',
      'application/json', 'application/xml', 'text/xml', 'application/rtf',
      'application/x-subrip' // srt sometimes
    ];
    const validExtensions = [
      '.txt', '.md', '.rtf', '.csv', '.html', '.htm', 
      '.json', '.xml', '.tex', '.srt'
    ];
    
    if (file.type.startsWith('text/')) return true;
    if (validMimeTypes.includes(file.type)) return true;
    
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      let hasError = false;
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        
        if (file.type.startsWith('image/') || file.type === 'application/pdf' || isValidTextFile(file)) {
          try {
            const base64 = await fileToBase64(file);
            const mimeType = file.type || 'text/plain'; 
            
            newAttachments.push({
              name: file.name,
              mimeType: mimeType,
              data: base64
            });
          } catch (err) {
            console.error("Error reading file:", err);
            hasError = true;
          }
        } else {
          hasError = true;
        }
      }

      if (hasError) {
         setError("部分檔案格式不支援。支援格式：圖片, PDF, TXT, MD, RTF, CSV, HTML, JSON, XML, TeX, SRT");
      } else {
         setError(null);
      }

      if (newAttachments.length > 0) {
        setState(prev => ({
          ...prev,
          attachments: [...prev.attachments, ...newAttachments]
        }));
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleInitialSubmit = async () => {
    if (!state.originalRequest.trim() && state.attachments.length === 0) return;
    
    setStatus(AppStatus.ANALYZING);
    setError(null);
    
    try {
      const analysisData = await analyzePromptRequest(state.originalRequest, state.attachments);
      setState(prev => ({ 
        ...prev, 
        analysisOutput: analysisData,
        gapAnswers: new Array(analysisData.gaps.length).fill('') 
      }));
      setStatus(AppStatus.WAITING_FOR_CLARIFICATION);
    } catch (err: any) {
      console.error(err);
      setError("無法連接至 Gemini 架構師。請檢查您的 API 金鑰或網路連線。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGapAnswerChange = (index: number, value: string) => {
    const newAnswers = [...state.gapAnswers];
    newAnswers[index] = value;
    setState(prev => ({ ...prev, gapAnswers: newAnswers }));
  };

  const handleFinalSubmit = async (isSkipped: boolean = false) => {
    if (!state.analysisOutput) return;

    setStatus(AppStatus.GENERATING_FINAL);
    setError(null);

    try {
      const finalResult = await generateFinalPromptStructure(
        state.originalRequest, 
        state.attachments,
        state.analysisOutput, 
        state.gapAnswers,
        isSkipped
      );
      setState(prev => ({ ...prev, finalPrompt: finalResult }));
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError("生成最終提示詞時發生錯誤。請重試。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setState({
      originalRequest: '',
      attachments: [],
      analysisOutput: null,
      gapAnswers: [],
      finalPrompt: ''
    });
    setError(null);
    setIsCopied(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
               <PencilRuler className="text-primary-600 dark:text-primary-400" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                Gemini Prompt Architect
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">AI 提示詞工程架構師</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-full p-1 flex items-center border border-slate-200 dark:border-slate-700">
              <button onClick={() => setTheme('light')} className={`p-1.5 rounded-full transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-600 shadow-sm text-yellow-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><Sun size={14} /></button>
              <button onClick={() => setTheme('system')} className={`p-1.5 rounded-full transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><Monitor size={14} /></button>
              <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-full transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><Moon size={14} /></button>
            </div>
            {status !== AppStatus.IDLE && (
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <RotateCcw size={16} /><span className="hidden sm:inline">重置</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8 space-y-8">
        
        {/* Step 1: Initial Input */}
        <section className={`transition-all duration-500 ease-in-out ${status === AppStatus.IDLE ? 'translate-y-0 opacity-100' : 'opacity-100'}`}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-full ${status === AppStatus.IDLE ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  <Sparkles size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">您的任務目標</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm md:text-base">請描述您希望 AI 完成的任務。您可以上傳參考圖片、PDF 或文字文件。</p>
              
              <div className="relative space-y-4">
                <textarea
                  className="w-full h-32 md:h-40 px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:bg-white dark:focus:bg-slate-950 transition-all resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-60"
                  placeholder="例如：我需要一個能幫我撰寫 Python 程式碼註解的助手..."
                  value={state.originalRequest}
                  onChange={(e) => setState(prev => ({ ...prev, originalRequest: e.target.value }))}
                  disabled={status !== AppStatus.IDLE && status !== AppStatus.ERROR}
                />
                
                {status === AppStatus.IDLE && (
                  <div className="flex flex-col gap-3">
                    {state.attachments.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        {state.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0">
                            {file.mimeType.includes('image') ? <ImageIcon size={14} className="text-blue-500" /> : <FileText size={14} className="text-red-500" />}
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{file.name}</span>
                            <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500 ml-1"><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                       <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                         <Paperclip size={18} /><span>上傳參考檔案</span>
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,application/pdf,text/*,.md,.csv,.xml,.json,.rtf,.tex,.srt" />
                       <button onClick={handleInitialSubmit} disabled={(!state.originalRequest.trim() && state.attachments.length === 0)} className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 text-white p-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group">
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Dashboard Layout for Analysis & Gaps */}
        {(status === AppStatus.ANALYZING || status === AppStatus.WAITING_FOR_CLARIFICATION || status === AppStatus.GENERATING_FINAL || status === AppStatus.COMPLETED) && (
          <section ref={analysisRef} className="animate-fade-in-up">
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
              <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-white">架構分析報告</h2>
                </div>
                {status === AppStatus.ANALYZING ? (
                    <div className="flex items-center gap-2"><LoadingDots /><span className="text-slate-400 text-sm">分析需求中...</span></div>
                ) : (
                    <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 text-xs rounded-full border border-emerald-800">ANALYSIS PHASE COMPLETED</div>
                )}
              </div>

              {state.analysisOutput && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                    {/* Left Panel: Context (3 cols) */}
                    <div className="lg:col-span-3 p-6 md:p-8 bg-slate-800/50 border-r border-slate-700/50">
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 1. 理解與摘要
                                </h3>
                                <p className="text-slate-300 leading-relaxed text-sm md:text-base">{state.analysisOutput.understanding}</p>
                            </div>
                            <div>
                                <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 2. 思維鏈推理
                                </h3>
                                <div className="text-slate-300 leading-relaxed text-sm md:text-base bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                    {state.analysisOutput.reasoning}
                                </div>
                            </div>
                             <div>
                                <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 4. 擬定策略架構
                                </h3>
                                <div className="text-slate-300 leading-relaxed text-sm md:text-base">
                                    <MarkdownRenderer content={state.analysisOutput.strategy} className="prose-invert prose-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Gaps & Actions (2 cols) */}
                    <div className="lg:col-span-2 p-6 md:p-8 bg-slate-900 flex flex-col">
                         <h3 className="text-white text-lg font-bold mb-1">3. 確認缺口 (需要您的輸入)</h3>
                         <p className="text-slate-400 text-sm mb-6">為了產出最精準的提示詞，請協助補充以下資訊。若不確定，可留空，我將自行判斷。</p>

                         <div className="space-y-6 flex-grow">
                             {state.analysisOutput.gaps.map((gap, index) => (
                                 <div key={index} className="space-y-2 group">
                                     <label className="block text-sm text-emerald-100/90 font-medium leading-relaxed">
                                         {index + 1}. {gap}
                                     </label>
                                     <input 
                                        type="text" 
                                        placeholder="請輸入回答..."
                                        value={state.gapAnswers[index] || ''}
                                        onChange={(e) => handleGapAnswerChange(index, e.target.value)}
                                        disabled={status !== AppStatus.WAITING_FOR_CLARIFICATION}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-600 text-sm"
                                     />
                                 </div>
                             ))}
                         </div>

                         {status === AppStatus.WAITING_FOR_CLARIFICATION && (
                             <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row gap-4 justify-end items-center">
                                 <button 
                                    onClick={() => handleFinalSubmit(true)}
                                    className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                                 >
                                     <FastForward size={16} />
                                     略過 (AI 自動補全)
                                 </button>
                                 <button 
                                    onClick={() => handleFinalSubmit(false)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 font-medium w-full sm:w-auto justify-center"
                                 >
                                     <Play size={16} fill="currentColor" />
                                     生成正式提示詞
                                 </button>
                             </div>
                         )}
                    </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 3: Final Result */}
        {(status === AppStatus.GENERATING_FINAL || status === AppStatus.COMPLETED) && (
          <section ref={bottomRef} className="animate-fade-in-up">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-primary-100 dark:border-slate-700 overflow-hidden ring-1 ring-primary-50 dark:ring-slate-800 transition-colors duration-300">
              <div className="border-b border-primary-50 dark:border-slate-800 bg-primary-50/30 dark:bg-slate-800/30 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">最終優化提示詞</h2>
                </div>
                {status === AppStatus.GENERATING_FINAL ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <LoadingDots />
                    <span>撰寫中...</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => copyToClipboard(state.finalPrompt)} 
                    className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-all duration-200 ${
                        isCopied 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-700'
                      }`}
                  >
                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    {isCopied ? "已複製" : "複製全文"}
                  </button>
                )}
              </div>

              <div className="p-0">
                {status === AppStatus.GENERATING_FINAL && !state.finalPrompt ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500">
                     <div className="text-center">
                        <LoadingDots />
                        <p className="mt-2 text-sm">正在根據您的回覆優化提示詞結構...</p>
                     </div>
                  </div>
                ) : (
                   <div className="bg-[#1e1e1e] dark:bg-black text-slate-200 overflow-x-auto">
                     <div className="p-6 md:p-8">
                       <MarkdownRenderer content={state.finalPrompt} className="prose-invert" />
                     </div>
                   </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Error Message */}
        {status === AppStatus.ERROR && error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-2 animate-pulse">
             <div className="w-2 h-2 bg-red-500 rounded-full"></div>
             {error}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm border-t border-slate-200 dark:border-slate-800 mt-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <p>Powered by Gemini 3 Flash Preview & Tailwind CSS</p>
      </footer>
    </div>
  );
};

export default App;
