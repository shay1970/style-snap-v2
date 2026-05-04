import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, ShoppingBag, ExternalLink, X } from 'lucide-react';
import type { Product } from '../types';
import { checkScanLimit, incrementScanCount, DEMO_PRODUCTS } from '../types';

type Step = 'upload' | 'loading' | 'results';

const BUDGETS = [
  { label: 'חסכוני',  range: 'עד ₪200',    color: '#7A9E7E', textColor: 'white'   },
  { label: 'מאוזן',   range: '₪200–₪600',  color: '#C17B5C', textColor: 'white'   },
  { label: 'פרמיום',  range: '₪600+',       color: '#2C2C2C', textColor: '#E8A84C' },
];

function classifyByBudget(products: Product[]): [Product[], Product[], Product[]] {
  const toNum = (p: string) => parseInt(p.replace(/[^0-9]/g, '')) || 0;
  const low  = products.filter(p => toNum(p.price) <= 200);
  const mid  = products.filter(p => { const n = toNum(p.price); return n > 200 && n <= 600; });
  const high = products.filter(p => toNum(p.price) > 600);
  return [
    low.length  > 0 ? low  : DEMO_PRODUCTS.slice(0, 2),
    mid.length  > 0 ? mid  : DEMO_PRODUCTS.slice(2, 4),
    high.length > 0 ? high : DEMO_PRODUCTS.slice(4, 6),
  ];
}

export function TwinScreen() {
  const [step, setStep]               = useState<Step>('upload');
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [budgetProds, setBudgetProds] = useState<[Product[], Product[], Product[]]>([[], [], []]);
  const [error, setError]             = useState<string | null>(null);
  const [activeTab, setActiveTabLocal]= useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    if (!checkScanLimit()) { setError('הגעת למגבלת 5 סריקות ליום.'); return; }
    setStep('loading');
    incrementScanCount();

    let label = 'outfit';
    let prods: Product[] = [];

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const r = await fetch('/api/analyze', { method: 'POST', body: fd });
      if (r.ok) { const d = await r.json(); label = d.label || label; }
    } catch {}

    try {
      const r = await fetch(`/api/products?q=${encodeURIComponent(label)}`);
      if (r.ok) { const d = await r.json(); prods = Array.isArray(d) ? d : []; }
    } catch {}

    if (prods.length === 0) prods = DEMO_PRODUCTS;
    setBudgetProds(classifyByBudget(prods));
    setStep('results');
  };

  const reset = () => {
    setStep('upload');
    setPreviewUrl(null);
    setImageFile(null);
    setBudgetProds([[], [], []]);
    setError(null);
    setActiveTabLocal(0);
  };

  return (
    <div className="absolute inset-0 bg-cream">
      <AnimatePresence mode="wait">

        {/* Upload */}
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="absolute inset-0 flex flex-col">
            <div className="flex items-center gap-3 px-5 pt-10 pb-4">
              <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center">
                <Users size={16} className="text-terracotta" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-charcoal font-serif">Style Twin</h2>
                <p className="text-[11px] text-charcoal/45">לוק דומה ב-3 תקציבים</p>
              </div>
            </div>

            <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
              {!previewUrl ? (
                <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-[#C17B5C]/30 bg-[#FFF5EE] flex flex-col items-center justify-center gap-4">
                  <div className="flex gap-2">
                    {BUDGETS.map(b => (
                      <div key={b.label} className="w-14 h-20 rounded-2xl flex items-end p-2" style={{ backgroundColor: b.color }}>
                        <span className="text-[10px] font-semibold" style={{ color: b.textColor }}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-charcoal mb-1">העלה תמונת סטייל</p>
                    <p className="text-[12px] text-charcoal/45">נמצא לוק דומה בכל תקציב</p>
                  </div>
                </button>
              ) : (
                <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-[#F4F4F4]">
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                  <button onClick={reset} className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                    <X size={14} className="text-white" />
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <p className="text-[13px] text-red-600 text-center">{error}</p>
                </div>
              )}

              {previewUrl && (
                <button onClick={handleAnalyze} className="w-full bg-terracotta text-cream rounded-2xl py-4 text-[16px] font-semibold shadow-lg">
                  👯 מצא לוק דומה
                </button>
              )}

              {!previewUrl && (
                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-[#EDE5D8] rounded-2xl py-3.5 text-[14px] font-semibold text-charcoal/60">
                  בחר תמונה מהגלריה
                </button>
              )}
            </div>

            <div className="h-16" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </motion.div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-cream">
            <div className="flex gap-2">
              {BUDGETS.map((b, i) => (
                <motion.div key={b.label} animate={{ y: [0, -10, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} className="w-14 h-20 rounded-2xl flex items-end p-2" style={{ backgroundColor: b.color }}>
                  <span className="text-[10px] font-semibold" style={{ color: b.textColor }}>{b.label}</span>
                </motion.div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-charcoal mb-1">מחפש לוק דומה...</p>
              <p className="text-[12px] text-charcoal/45">בכל טווחי המחיר</p>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {step === 'results' && (
          <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 flex flex-col">
            <div className="flex items-center gap-3 px-5 pt-10 pb-3 bg-cream">
              <button onClick={reset}><ArrowLeft size={20} className="text-charcoal" /></button>
              <h2 className="text-[17px] font-bold text-charcoal font-serif flex-1">לוקים דומים</h2>
            </div>

            {/* Budget tabs */}
            <div className="flex px-5 gap-2 pb-3">
              {BUDGETS.map((b, i) => (
                <button key={b.label} onClick={() => setActiveTabLocal(i)} className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all" style={{ backgroundColor: activeTab === i ? b.color : '#EDE5D8', color: activeTab === i ? b.textColor : '#2C2C2C99' }}>
                  {b.label}
                  <span className="block text-[10px] opacity-70">{b.range}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-20">
              <div className="grid grid-cols-2 gap-3">
                {budgetProds[activeTab].map((p: Product, i: number) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#EDE5D8]">
                    <div className="bg-[#F4F4F4] aspect-square flex items-center justify-center overflow-hidden">
                      {p.image
                        ? <img src={p.image} alt={p.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <ShoppingBag size={28} className="text-charcoal/20" />
                      }
                    </div>
                    <div className="p-2.5">
                      <p className="text-[10px] font-semibold text-charcoal/50 uppercase mb-0.5">{p.store}</p>
                      <p className="text-[11px] font-medium text-charcoal leading-tight line-clamp-2 mb-1.5">{p.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-terracotta">{p.price}</span>
                        <a href={p.link} target="_blank" rel="noopener noreferrer" className="w-6 h-6 bg-terracotta/10 rounded-full flex items-center justify-center">
                          <ExternalLink size={11} className="text-terracotta" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={reset} className="w-full mt-5 border-2 border-[#EDE5D8] rounded-2xl py-3.5 text-[14px] font-semibold text-charcoal/60">
                + נסה שוב
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
