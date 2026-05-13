import React, { useState, useEffect } from 'react';
import { 
  Layout, Code, Copy, Check, AlertTriangle, Send, Settings, Globe, 
  Image as ImageIcon, Link as LinkIcon, FileText, Target, Compass, 
  LayoutDashboard, Users, Database, DollarSign, BarChart3, 
  Menu, X, ChevronRight, ChevronLeft, Play, Pause, Save, Plus, Eye, Edit3,
  Calendar as CalendarIcon, Clock
} from 'lucide-react';

// --- TYPES & INTERFACES ---

interface ProductItem {
  id: string;
  url: string;
  title: string;
  price: string;
  image: string;
  rating: number;
  description?: string;
  cta_label?: string;
}

type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Mixed';

type ToneStyle = 
  | 'Neutral, Clear, Professional'
  | 'Friendly & Conversational'
  | 'Expert Authority'
  | 'Persuasive Marketing Copy'
  | 'Storytelling'
  | 'Technical & Academic'
  | 'Short, punchy, Gen-Z';

interface ArticleParams {
  topic: string;
  keyword: string;
  targetAudience: string; 
  searchIntent: SearchIntent;
  tone: ToneStyle; 
  language: string;
  location: string;
  visualStyle: string;
  textColor: string;
  backgroundColor: string;
  wordCount: number;
  imageCount: number;
  internalLinks: string;
  productWidgetHtml: string;
  productWidgetItems: ProductItem[];
}

interface GeneratedContent {
  htmlBody: string;
}

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

enum GenerationStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  SUCCESS = 'success',
  ERROR = 'error'
}

// --- GEMINI SERVICE LOGIC (REST API Version) ---

const VISUAL_THEMES: Record<string, any> = {
  'AsriStyle': {
    primary: '#0f172a', accent: '#0ea5e9', bg_box: '#f0f9ff', border: '#bae6fd',
    font_head: 'ui-sans-serif, system-ui, sans-serif', font_body: 'ui-sans-serif, system-ui, sans-serif'
  },
  'Warm': {
    primary: '#78350f', accent: '#d97706', bg_box: '#fffbeb', border: '#fcd34d',
    font_head: 'Georgia, serif', font_body: 'Georgia, serif'
  },
  'Corporate': {
    primary: '#1e3a8a', accent: '#2563eb', bg_box: '#eff6ff', border: '#bfdbfe',
    font_head: 'Arial, sans-serif', font_body: 'Arial, sans-serif'
  },
  'Vibrant': {
    primary: '#be123c', accent: '#f43f5e', bg_box: '#fff1f2', border: '#fecdd3',
    font_head: 'Verdana, sans-serif', font_body: 'Verdana, sans-serif'
  },
  'Minimalist': {
    primary: '#18181b', accent: '#52525b', bg_box: '#fafafa', border: '#e4e4e7',
    font_head: 'Courier New, monospace', font_body: 'Helvetica, sans-serif'
  }
};

const generateBlogContent = async (params: ArticleParams, apiKey: string): Promise<GeneratedContent> => {
  if (!apiKey) throw new Error("API Key is missing. Please enter it in Settings.");

  const { 
    topic, location, tone, keyword, visualStyle, 
    textColor, productWidgetHtml,
    language, wordCount, imageCount, internalLinks,
    searchIntent, targetAudience 
  } = params;
  
  const theme = VISUAL_THEMES[visualStyle] || VISUAL_THEMES['AsriStyle'];

  const dynamicCss = `
    body { color: ${textColor}; font-family: ${theme.font_body}; line-height: 1.8; font-size: 16px; max-width: 100%; }
    h1, h2, h3, h4 { color: ${theme.primary}; font-family: ${theme.font_head}; font-weight: 800; line-height: 1.3; margin-top: 1.5em; }
    h1 { font-size: 2.2em; text-align: center; margin: 1em 0; }
    h2 { font-size: 1.6em; border-bottom: 2px solid ${theme.border}; padding-bottom: 10px; }
    a { color: ${theme.accent}; text-decoration: none; border-bottom: 1px dotted ${theme.accent}; }
    .seo-meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 30px; font-family: monospace; font-size: 0.85em; color: #334155; }
    .summary-box { background-color: ${theme.bg_box}; border: 1px solid ${theme.border}; border-left: 5px solid ${theme.accent}; padding: 20px; margin: 30px 0; border-radius: 8px; }
    .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
    .pros-cons .pros { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; }
    .pros-cons .cons { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; }
    @media (max-width: 600px) { .pros-cons { grid-template-columns: 1fr; } }
  `;

  let ethnicityKeyword = "DIVERSE / GENERAL";
  if (language === 'id') ethnicityKeyword = "INDONESIAN / SOUTHEAST ASIAN (Malay Look)";
  if (language === 'my') ethnicityKeyword = "MALAY / SOUTHEAST ASIAN (Malay Look)";

  const widgetInstruction = (productWidgetHtml && productWidgetHtml.length > 50) 
    ? `INSERT_WIDGET: Place "[[PRODUCT_WIDGET_HERE]]" naturally after the first major section.` 
    : "";

  const imageInstruction = imageCount > 0 
    ? `
      VISUALS: Include exactly ${imageCount} [[IMAGE_PROMPT: detailed description]] placeholders.
      PROTOCOL X - CONTENT SANITIZATION:
      1. FORBIDDEN: Pork, Alcohol, Gambling, Sexy/Revealing clothes.
      2. ETHNICITY: All human subjects MUST LOOK: **${ethnicityKeyword}**.
      3. RELIGIOUS HIERARCHY: Context ISLAMIC/HALAL -> Default to Hijab/Syari.
    `
    : "VISUALS: No image placeholders.";

  const getIntentRules = (intent: SearchIntent) => {
    switch (intent) {
      case 'Informational': return "Structure: How-to, definitions, guides. Focus on answering 'What', 'How', 'Why'.";
      case 'Commercial': return "Structure: Comparisons, pros/cons tables, Best X for Y lists. Focus on features and evaluation.";
      case 'Transactional': return "Structure: Clear CTAs, urgency, buying guides, discounts. Focus on conversion.";
      case 'Mixed': return "Structure: Educational intro -> Problem Agitation -> Solution (Product).";
      default: return "Structure: Comprehensive Guide.";
    }
  };

  const prompt = `
    Role: Expert SEO Content Strategist & Copywriter.
    Task: Write a High-Ranking SEO Article (Merged JagoSEO V1 + V2 Blueprint).
    
    Topic: "${topic}"
    Target Audience: "${targetAudience || 'General'}"
    Primary Keyword: "${keyword}"
    Search Intent: ${searchIntent}
    Desired Tone: ${tone}
    Language: ${language} (Write entirely in this language)
    Location: ${location}
    Length: ${wordCount} words
    Internal Links Context: ${internalLinks || 'None'}

    ${getIntentRules(searchIntent)}

    OUTPUT FORMAT (HTML only, no markdown blocks):
    <style>${dynamicCss}</style>
    
    <div class="seo-meta-box">
      <p><strong>Title Tag:</strong> [Max 60 chars, catchy, includes keyword]</p>
      <p><strong>Meta Description:</strong> [Max 160 chars, CTR focused]</p>
      <p><strong>Slug:</strong> [URL-friendly-slug]</p>
    </div>

    <article>
      <h1>[H1 Heading]</h1>
      <div class="summary-box"><strong>TL;DR:</strong> [Summary]</div>
      [Content based on Intent Framework]
      ${widgetInstruction}
      [FAQ Section]
      [Conclusion]
    </article>
    ${imageInstruction}
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85 }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Gemini API Error");
    }

    const data = await response.json();
    let htmlContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    htmlContent = htmlContent.replace(/```html|```/g, '').trim();

    if (widgetInstruction && productWidgetHtml.length > 50) {
      if (htmlContent.includes('[[PRODUCT_WIDGET_HERE]]')) {
        htmlContent = htmlContent.replace('[[PRODUCT_WIDGET_HERE]]', productWidgetHtml);
      } else {
        const firstH2 = htmlContent.indexOf('</h2>');
        if (firstH2 !== -1) {
          htmlContent = htmlContent.slice(0, firstH2 + 5) + productWidgetHtml + htmlContent.slice(firstH2 + 5);
        }
      }
    }

    htmlContent = htmlContent.replace(/\[\[IMAGE_PROMPT: (.*?)\]\]/g, 
      '<div style="background:#f1f5f9; padding:20px; text-align:center; border-radius:8px; border:2px dashed #cbd5e1; margin:20px 0; color:#64748b;">🖼️ <strong>Image Generation Queue</strong><br/><small>$1</small></div>'
    );

    return { htmlBody: htmlContent };

  } catch (error: any) {
    throw new Error(error.message || "Gemini Error");
  }
};

// --- COMPONENTS ---

const DashboardCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {trend && <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1"><Check size={10}/> {trend}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
      active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

// --- MAIN APP COMPONENT ---

const App = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'studio' | 'clients' | 'bulk' | 'schedule' | 'settings'>('studio');
  const [apiKey, setApiKey] = useState('');
  
  // Mobile UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobileStudioTab, setMobileStudioTab] = useState<'edit' | 'preview'>('edit');
  
  // Studio State
  const [params, setParams] = useState<ArticleParams>({
    topic: '',
    location: 'Indonesia',
    tone: 'Persuasive Marketing Copy',
    keyword: '',
    visualStyle: 'AsriStyle', 
    textColor: '#333333',
    backgroundColor: '#ffffff',
    language: 'id',
    wordCount: 1200, 
    imageCount: 2,
    internalLinks: '',
    searchIntent: 'Informational',
    targetAudience: 'General Reader',
    productWidgetHtml: '',
    productWidgetItems: [] 
  });
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: ToastMessage['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      showToast('error', 'API Key missing (Go to Settings)');
      setCurrentView('settings');
      setIsSidebarOpen(false); // Close sidebar on mobile
      return;
    }
    if (!params.topic) return showToast('error', 'Topic is required');
    
    setStatus(GenerationStatus.GENERATING);
    if (window.innerWidth < 1024) setMobileStudioTab('preview'); // Auto switch to preview on mobile
    
    try {
      const result = await generateBlogContent(params, apiKey);
      setGeneratedHtml(result.htmlBody);
      setStatus(GenerationStatus.SUCCESS);
      showToast('success', 'Content Generated!');
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      showToast('error', err.message);
    }
  };

  // Close sidebar when changing view
  const changeView = (view: any) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* MOBILE HEADER */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-blue-600">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">J</div>
            <span className="font-bold text-lg tracking-tight text-slate-900">JagoSEO</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <Menu size={24}/>
        </button>
      </div>

      {/* SIDEBAR BACKDROP (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center h-16 lg:h-auto">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold hidden lg:flex">J</div>
            <span className="font-bold text-xl tracking-tight text-slate-900 hidden lg:block">JagoSEO<span className="text-xs text-blue-500 align-top ml-1">Personal</span></span>
            <span className="font-bold text-xl tracking-tight text-slate-900 lg:hidden">Menu</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-700">
            <X size={20}/>
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-grow overflow-y-auto">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => changeView('dashboard')} />
          <SidebarItem icon={FileText} label="Content Studio" active={currentView === 'studio'} onClick={() => changeView('studio')} />
          <SidebarItem icon={CalendarIcon} label="Schedule & Calendar" active={currentView === 'schedule'} onClick={() => changeView('schedule')} />
          <SidebarItem icon={Users} label="Clients & Blogs" active={currentView === 'clients'} onClick={() => changeView('clients')} />
          <SidebarItem icon={Database} label="Bulk Queue" active={currentView === 'bulk'} onClick={() => changeView('bulk')} />
          <div className="pt-4 mt-4 border-t border-slate-100">
             <SidebarItem icon={Settings} label="Settings" active={currentView === 'settings'} onClick={() => changeView('settings')} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600">ME</div>
            <div>
              <p className="text-sm font-semibold">Owner Admin</p>
              <p className="text-xs text-slate-500">Plan: Unlimited</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative flex flex-col pt-16 lg:pt-0">
        
        {/* TOAST */}
        {toast && (
          <div className={`fixed top-20 right-6 lg:top-6 z-[100] px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 text-sm font-medium animate-bounce ${
            toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'
          }`}>
            {toast.text}
          </div>
        )}

        {/* --- VIEW: DASHBOARD --- */}
        {currentView === 'dashboard' && (
          <div className="p-4 lg:p-8 overflow-y-auto h-full">
            <h1 className="text-xl lg:text-2xl font-bold mb-6">Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
              <DashboardCard title="Total Articles" value="128" icon={FileText} color="bg-blue-500" trend="+12 this week" />
              <DashboardCard title="Est. Cost (MTD)" value="$4.20" icon={DollarSign} color="bg-emerald-500" trend="Low usage" />
              <DashboardCard title="Clients Managed" value="5" icon={Users} color="bg-purple-500" />
              <DashboardCard title="API Requests" value="1.2k" icon={BarChart3} color="bg-orange-500" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold mb-4 text-slate-700">Recent Generations</h3>
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                      <span className="font-medium text-slate-700 truncate max-w-[150px] lg:max-w-none">Review Skincare Viral {i}</span>
                      <span className="text-slate-400 text-xs flex-shrink-0">2 mins ago</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: SETTINGS --- */}
        {currentView === 'settings' && (
          <div className="p-4 lg:p-8 max-w-2xl overflow-y-auto">
            <h1 className="text-xl lg:text-2xl font-bold mb-6">Configuration</h1>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your AI Studio Key here..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2">Key is stored in session memory only for this demo.</p>
            </div>
          </div>
        )}

        {/* --- VIEW: SCHEDULE & CALENDAR --- */}
        {currentView === 'schedule' && (
          <div className="p-4 lg:p-8 h-full overflow-y-auto">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h1 className="text-xl lg:text-2xl font-bold">Content Calendar</h1>
              <div className="flex gap-2 w-full sm:w-auto">
                 <button className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700"><Plus size={16}/> New Schedule</button>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-8 pb-20">
               {/* Calendar Widget */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-grow">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-bold text-lg text-slate-700 flex items-center gap-2"><CalendarIcon size={20}/> December 2024</h2>
                    <div className="flex gap-2">
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={20}/></button>
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={20}/></button>
                    </div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                     <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                      {/* Blank days for offset */}
                      <div className="h-24 lg:h-32 bg-slate-50 rounded-lg"></div>
                      <div className="h-24 lg:h-32 bg-slate-50 rounded-lg"></div>
                      
                      {/* Days 1-31 Mock */}
                      {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                        <div key={day} className={`h-24 lg:h-32 p-2 border border-slate-100 rounded-lg relative ${day === 12 ? 'bg-blue-50 border-blue-200' : 'bg-white hover:border-blue-300'}`}>
                           <span className={`text-sm font-semibold ${day === 12 ? 'text-blue-600' : 'text-slate-700'}`}>{day}</span>
                           
                           {/* Mock Events */}
                           {day === 5 && (
                             <div className="mt-2 p-1.5 bg-emerald-100 border border-emerald-200 rounded text-[10px] text-emerald-800 font-medium truncate leading-tight">
                               ✅ Review HP
                             </div>
                           )}
                           {day === 12 && (
                             <div className="mt-2 p-1.5 bg-blue-600 rounded text-[10px] text-white font-medium truncate leading-tight shadow-sm">
                               🚀 Tips SEO 2025
                             </div>
                           )}
                           {day === 15 && (
                             <div className="mt-2 p-1.5 bg-orange-100 border border-orange-200 rounded text-[10px] text-orange-800 font-medium truncate leading-tight">
                               ⏳ Wisata Bali
                             </div>
                           )}
                        </div>
                      ))}
                  </div>
               </div>

               {/* Upcoming List */}
               <div className="w-full xl:w-96 flex-shrink-0">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                      <div className="p-4 border-b border-slate-100 font-bold text-slate-700 flex justify-between items-center bg-slate-50">
                          <span className="flex items-center gap-2"><Clock size={16}/> Upcoming Queue</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">2 Pending</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                           {/* Item 1 */}
                           <div className="p-4 hover:bg-slate-50 transition">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-blue-600">Today, 14:00</span>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Wordpress</span>
                              </div>
                              <h4 className="font-semibold text-sm text-slate-800 mb-1 line-clamp-2">Tips SEO 2025: Strategi Jitu Page One</h4>
                              <p className="text-xs text-slate-500 mb-2">Target: Tech Review ID</p>
                              <div className="flex gap-2">
                                <button className="flex-1 text-xs bg-slate-800 text-white py-1.5 rounded font-medium hover:bg-slate-700">Edit</button>
                                <button className="flex-1 text-xs border border-slate-200 text-slate-600 py-1.5 rounded font-medium hover:bg-slate-50">Reschedule</button>
                              </div>
                           </div>

                            {/* Item 2 */}
                           <div className="p-4 hover:bg-slate-50 transition">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-orange-600">Dec 15, 09:00</span>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Blogger</span>
                              </div>
                              <h4 className="font-semibold text-sm text-slate-800 mb-1 line-clamp-2">10 Destinasi Wisata Bali Tersembunyi</h4>
                              <p className="text-xs text-slate-500 mb-2">Target: Travel Blog</p>
                              <div className="flex gap-2">
                                <button className="flex-1 text-xs bg-slate-800 text-white py-1.5 rounded font-medium hover:bg-slate-700">Edit</button>
                                <button className="flex-1 text-xs border border-slate-200 text-slate-600 py-1.5 rounded font-medium hover:bg-slate-50">Reschedule</button>
                              </div>
                           </div>
                      </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW: STUDIO (GENERATOR) --- */}
        {currentView === 'studio' && (
          <div className="flex flex-col h-full">
            {/* Studio Header (Responsive) */}
            <header className="px-4 lg:px-6 py-3 border-b border-slate-200 bg-white flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 shadow-sm z-10">
              <div className="flex items-center justify-between w-full lg:w-auto">
                <h2 className="font-bold text-lg flex items-center gap-2"><Settings size={18} className="text-blue-600"/> <span className="hidden lg:inline">Content Studio</span><span className="lg:hidden">Studio</span></h2>
                
                {/* Mobile Generate Button (Visible on Header) */}
                <button 
                  onClick={handleGenerate}
                  disabled={status === GenerationStatus.GENERATING}
                  className="lg:hidden px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {status === GenerationStatus.GENERATING ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : <Send size={14} />}
                  Run
                </button>
              </div>

              {/* Desktop Generate Button */}
              <button 
                onClick={handleGenerate}
                disabled={status === GenerationStatus.GENERATING}
                className="hidden lg:flex px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 items-center gap-2 disabled:opacity-50"
              >
                {status === GenerationStatus.GENERATING ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : <Send size={16} />}
                Generate Content
              </button>
            </header>
            
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex border-b border-slate-200 bg-slate-50">
              <button 
                onClick={() => setMobileStudioTab('edit')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${mobileStudioTab === 'edit' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500'}`}
              >
                <Edit3 size={16}/> Editor
              </button>
              <button 
                onClick={() => setMobileStudioTab('preview')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${mobileStudioTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500'}`}
              >
                <Eye size={16}/> Preview
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
              {/* Inputs Column */}
              <div className={`
                w-full lg:w-1/3 min-w-0 lg:min-w-[320px] border-r border-slate-200 bg-white overflow-y-auto p-4 lg:p-6 space-y-6
                ${mobileStudioTab === 'edit' ? 'block' : 'hidden lg:block'}
              `}>
                
                {/* Topic & Keyword */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Main Topic</label>
                    <input 
                      className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Tips SEO 2025"
                      value={params.topic}
                      onChange={(e) => setParams({...params, topic: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Primary Keyword</label>
                    <input 
                      className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. cara optimasi seo"
                      value={params.keyword}
                      onChange={(e) => setParams({...params, keyword: e.target.value})}
                    />
                  </div>
                </div>

                {/* V2 Strategy */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Compass size={14}/> Strategy V2</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Search Intent</label>
                      <select 
                        value={params.searchIntent}
                        onChange={(e) => setParams({...params, searchIntent: e.target.value as SearchIntent})}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                      >
                        <option value="Informational">Informational (Guide)</option>
                        <option value="Commercial">Commercial (Review)</option>
                        <option value="Transactional">Transactional (Buy)</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Tone</label>
                      <select 
                        value={params.tone}
                        onChange={(e) => setParams({...params, tone: e.target.value as ToneStyle})}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                      >
                        <option value="Persuasive Marketing Copy">Persuasive Marketing</option>
                        <option value="Friendly & Conversational">Friendly (Blogger)</option>
                        <option value="Expert Authority">Expert Authority</option>
                        <option value="Short, punchy, Gen-Z">Short & Punchy</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Target Audience</label>
                      <input 
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                        placeholder="e.g. Ibu Rumah Tangga"
                        value={params.targetAudience}
                        onChange={(e) => setParams({...params, targetAudience: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                 {/* Visuals */}
                <div className="space-y-4 pb-20 lg:pb-0"> {/* Extra padding for mobile scroll */}
                   <div className="flex justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Images</label>
                      <span className="text-xs font-bold text-blue-600">{params.imageCount}</span>
                   </div>
                   <input 
                    type="range" min="0" max="5" 
                    value={params.imageCount}
                    onChange={(e) => setParams({...params, imageCount: parseInt(e.target.value)})}
                    className="w-full accent-blue-600"
                   />
                </div>
              </div>

              {/* Preview Area */}
              <div className={`
                flex-1 bg-slate-100 p-0 lg:p-8 overflow-hidden relative
                ${mobileStudioTab === 'preview' ? 'block' : 'hidden lg:block'}
              `}>
                <div className="h-full bg-white lg:rounded-xl shadow-sm border-x lg:border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2">Live Preview</span>
                    <div className="flex gap-2">
                       {generatedHtml && <button onClick={() => navigator.clipboard.writeText(generatedHtml)} className="p-1.5 hover:bg-white rounded text-slate-500 flex items-center gap-1 text-xs"><Copy size={14}/> <span className="hidden sm:inline">Copy</span></button>}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar pb-24 lg:pb-8">
                    {status === GenerationStatus.IDLE && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-6">
                        <LayoutDashboard size={48} className="mb-4 opacity-50"/>
                        <p>Fill the form & click Generate</p>
                      </div>
                    )}
                    {status === GenerationStatus.GENERATING && (
                       <div className="h-full flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"/>
                        <p className="text-slate-500 animate-pulse text-sm">Thinking like an expert...</p>
                      </div>
                    )}
                    {status === GenerationStatus.SUCCESS && (
                      <div className="prose prose-sm lg:prose-base max-w-none" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
                    )}
                    {status === GenerationStatus.ERROR && (
                      <div className="h-full flex flex-col items-center justify-center text-red-500">
                        <AlertTriangle size={32} className="mb-2"/>
                        <p>Generation Failed</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: CLIENTS (MOCK) --- */}
        {currentView === 'clients' && (
          <div className="p-4 lg:p-8 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl lg:text-2xl font-bold">Clients & Blogs</h1>
              <button className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800"><Plus size={16}/> <span className="hidden sm:inline">New Client</span></button>
            </div>

            <div className="grid gap-4 lg:gap-6 pb-20">
              {[1, 2].map((client) => (
                <div key={client} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700">CL</div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm lg:text-base">Client {client} Official</h3>
                        <p className="text-xs text-slate-500">Managed since Nov 2024</p>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-blue-600"><Settings size={16}/></button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm min-w-[300px]">
                      <thead>
                        <tr className="text-left text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                          <th className="pb-2">Blog Name</th>
                          <th className="pb-2">Platform</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600">
                        <tr>
                          <td className="py-3 font-medium text-slate-800">Tips Sehat Alami</td>
                          <td><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">Wordpress</span></td>
                          <td><span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><Check size={10}/> Active</span></td>
                        </tr>
                        <tr>
                          <td className="py-3 font-medium text-slate-800">Tech Review ID</td>
                          <td><span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">Blogger</span></td>
                          <td><span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><Check size={10}/> Active</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VIEW: BULK (MOCK) --- */}
        {currentView === 'bulk' && (
          <div className="p-4 lg:p-8 h-full overflow-y-auto">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h1 className="text-xl lg:text-2xl font-bold">Bulk Content Queue</h1>
              <div className="flex gap-2 w-full sm:w-auto">
                 <button className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">Upload CSV</button>
                 <button className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700"><Play size={16}/> Start</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden pb-20 lg:pb-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left min-w-[600px]">
                   <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                     <tr>
                       <th className="p-4">Keyword / Topic</th>
                       <th className="p-4">Target Blog</th>
                       <th className="p-4">Status</th>
                       <th className="p-4">Cost</th>
                       <th className="p-4">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {[1,2,3,4,5].map(i => (
                       <tr key={i} className="hover:bg-slate-50 transition">
                         <td className="p-4 font-medium text-slate-800">Best Laptop for Coding 2025 #{i}</td>
                         <td className="p-4 text-slate-500">Tech Review ID</td>
                         <td className="p-4">
                           {i < 3 ? (
                             <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Done</span>
                           ) : i === 3 ? (
                             <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">Generating...</span>
                           ) : (
                             <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-bold">Pending</span>
                           )}
                         </td>
                         <td className="p-4 text-slate-500 text-xs">$0.02</td>
                         <td className="p-4">
                           <button className="text-slate-400 hover:text-blue-600"><Settings size={16}/></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;