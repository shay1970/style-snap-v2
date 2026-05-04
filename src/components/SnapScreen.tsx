import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, ArrowLeft, Heart, ExternalLink, ShoppingBag, X } from 'lucide-react';
import type { Product } from '../types';
import { checkScanLimit, incrementScanCount, saveToWardrobe, DEMO_PRODUCTS } from '../types';

interface SnapScreenProps {
  setActiveTab: (tab: string) => void;
}

type Step = 'upload' | 'loading' | 'results';

const FASHION_TERMS = [
  'מינימליסטי...', 'בוהמייני...', 'קז\'ואל...', 'פורמל...',
  'ספורטי...', 'וינטאג\'...', 'אורבני...', 'לוקסורי...',
];

export function SnapScreen({ setActiveTab }: SnapScreenProps) {
  const [step, setStep] = useState<Step>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productLabel, setProductLabel] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fashionIdx, setFashionIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'loading') return;
    const id = setInterval(() => {
      setFashionIdx((i: number) => (i + 1) % FASHION_TERMS.length);
    }, 1200);
    return () => clearInterval(id);
  }, [step]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleAnalyze = async () => {
    if (!imageFile) return;
    if (!checkScanLimit()) {
      setError('הגעת למגבלת 5 סריקות ליום. נסה מחר!');
      return;
    }
    setStep('loading');
    incrementScanCount();

    try {
      let label = 'ג\'קט עור שחור';
      try {
        const formData = new FormData();
        formData.append('image', imageFile);
        const res = await fetch('/api/analyze', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          label = data.label || label;
        }
      } catch {
        // API לא זמין — ממשיכים עם demo
      }
      setProductLabel(label);

      let prods: Product[] = [];
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(label)}`);
        if (res.ok) {
          const data = await res.json();
          prods = Array.isArray(data) ? data : [];
        }
      } catch {
        // API לא זמין
      }

      setProducts(prods.length > 0 ? prods : DEMO_PRODUCTS);
      setStep('results');
    } catch {
      setError('שגיאה בניתוח. אנא נסה שוב.');
      setStep('upload');
    }
  };

  const handleSave = (product: Product) => {
    saveToWardrobe(product);
    setSaved((prev: Set<string>) => new Set([...prev, product.link]));
  };

  const reset = () => {
    setStep('upload');
    setPreviewUrl(null);
    setImageFile(null);
    setProductLabel('');
    setProducts([]);
    setError(null);
  };

  return (
    <div className="absolute inset-0 bg-cream">
      <AnimatePresence mode="wait">

        {/* ===== מסך העלאה ===== */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="flex items-center gap-3 px-5 pt-10 pb-4">
              <button onClick={() => setActiveTab('home')} className="w-8 h-8 flex items-center justify-center">
                <ArrowLeft size={20} className="text-charcoal" />
              </button>
              <h2 className="text-[17px] font-bold text-charcoal font-serif flex-1">Outfit Snap</h2>
            </div>

            <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
              {!previewUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-[#C17B5C]/30 bg-[#FFF5EE] flex flex-col items-center justify-center gap-4 active:bg-[#EDE5D8] transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center">
                    <Camera size={28} className="text-terracotta" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-charcoal mb-1">צלם / העלה בגד</p>
                    <p className="text-[12px] text-charcoal/45">לחץ לבחירת תמונה</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-terracotta/10">
                    <Upload size={13} className="text-terracotta" />
                    <span className="text-[12px] font-medium text-terracotta">בחר תמונה</span>
                  </div>
                </button>
              ) : (
                <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-[#F4F4F4]">
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    onClick={reset}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                  >
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
                <button
                  onClick={handleAnalyze}
                  className="w-full bg-terracotta text-cream rounded-2xl py-4 text-[16px] font-semibold shadow-lg active:scale-[0.98] transition-transform"
                >
                  🔍 נתח את הבגד
                </button>
              )}

              <p className="text-center text-[11px] text-charcoal/35">5 סריקות חינם ליום</p>
            </div>

            <div className="h-16" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </motion.div>
        )}

        {/* ===== מסך טעינה ===== */}
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-cream"
          >
            <div className="relative w-20 h-20">
              <svg className="animate-spin w-20 h-20" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#EDE5D8" strokeWidth="4" />
                <circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke="#C17B5C" strokeWidth="4"
                  strokeDasharray="226" strokeDashoffset="170"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShoppingBag size={22} className="text-terracotta" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-[15px] font-semibold text-charcoal mb-3">מנתח את הבגד...</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={fashionIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="text-[22px] font-bold text-terracotta font-serif"
                >
                  {FASHION_TERMS[fashionIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-[12px] text-charcoal/40">מחפש בחנויות ברחבי הרשת</p>
          </motion.div>
        )}

        {/* ===== מסך תוצאות ===== */}
        {step === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 pt-10 pb-3 bg-cream">
              <button onClick={reset} className="w-8 h-8 flex items-center justify-center">
                <ArrowLeft size={20} className="text-charcoal" />
              </button>
              <h2 className="text-[17px] font-bold text-charcoal font-serif flex-1">תוצאות</h2>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-20">
              <div className="flex items-center gap-3 mb-5 p-3 bg-white rounded-2xl border border-[#EDE5D8]">
                {previewUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F4F4F4] flex-shrink-0">
                    <img src={previewUrl} alt="uploaded" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1 bg-terracotta/10 rounded-full px-2 py-0.5 mb-1">
                    <span className="text-[10px] font-semibold text-terracotta">זוהה ✓</span>
                  </div>
                  <p className="text-[14px] font-semibold text-charcoal truncate">{productLabel}</p>
                  <p className="text-[11px] text-charcoal/45">{products.length} תוצאות נמצאו</p>
                </div>
              </div>

              <p className="text-[11px] font-semibold text-charcoal/55 uppercase tracking-wider mb-3">
                איפה לקנות
              </p>

              <div className="grid grid-cols-2 gap-3">
                {products.map((product: Product, i: number) => (
                  <ProductCard
                    key={i}
                    product={product}
                    isSaved={saved.has(product.link)}
                    onSave={() => handleSave(product)}
                  />
                ))}
              </div>

              <button
                onClick={reset}
                className="w-full mt-5 border-2 border-[#EDE5D8] rounded-2xl py-3.5 text-[14px] font-semibold text-charcoal/60"
              >
                + סריקה חדשה
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({
  product, isSaved, onSave,
}: {
  product: Product;
  isSaved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#EDE5D8]">
      <div className="bg-[#F4F4F4] aspect-square relative flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <ShoppingBag size={28} className="text-charcoal/20" />
        )}
        <button
          onClick={onSave}
          className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
        >
          <Heart
            size={14}
            className={isSaved ? 'text-terracotta fill-terracotta' : 'text-charcoal/40'}
          />
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[10px] font-semibold text-charcoal/50 uppercase mb-0.5">{product.store}</p>
        <p className="text-[11px] font-medium text-charcoal leading-tight line-clamp-2 mb-1.5">
          {product.title}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-terracotta">{product.price}</span>
          <a
            href={product.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 bg-terracotta/10 rounded-full flex items-center justify-center"
          >
            <ExternalLink size={11} className="text-terracotta" />
          </a>
        </div>
      </div>
    </div>
  );
}
