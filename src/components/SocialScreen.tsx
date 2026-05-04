import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Share2, ShoppingBag, Heart, ExternalLink, X } from 'lucide-react';
import type { Product } from '../types';
import { checkScanLimit, incrementScanCount, saveToWardrobe, DEMO_PRODUCTS } from '../types';


interface SocialScreenProps {}

type Step = 'upload' | 'loading' | 'results';

const DEMO_LABEL = 'תלבושת סושיאל מדיה';

export function SocialScreen({}: SocialScreenProps) {
  const [step, setStep] = useState<Step>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productLabel, setProductLabel] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    if (!checkScanLimit()) {
      setError('הגעת למגבלת 5 סריקות ליום. נסה מחר!');
      return;
    }
    setStep('loading');
    incrementScanCount();

    await new Promise(r => setTimeout(r, 1500)); // סימולציה

    let label = DEMO_LABEL;
    let prods: Product[] = [];

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        label = data.label || label;
      }
    } catch {}

    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(label)}`);
      if (res.ok) {
        const data = await res.json();
        prods = Array.isArray(data) ? data : [];
      }
    } catch {}

    setProductLabel(label);
    setProducts(prods.length > 0 ? prods : DEMO_PRODUCTS);
    setStep('results');
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
        {/* Upload */}
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
              <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center">
                <Share2 size={16} className="text-terracotta" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-charcoal font-serif">Social Snap</h2>
                <p className="text-[11px] text-charcoal/45">זהה בגד מסרטון / תמונה</p>
              </div>
            </div>

            <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
              {/* Upload zone */}
              {!previewUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-3xl border-2 border-dashed border-[#C17B5C]/30 bg-[#FFF5EE] flex flex-col items-center justify-center gap-4"
                >
                  <div className="flex gap-2 items-center">
                    {['IG', 'TT', '▶️'].map(s => (
                      <div key={s} className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                        <span className="text-[13px] font-bold text-terracotta">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-charcoal mb-1">
                      העלה screenshot מסושיאל
                    </p>
                    <p className="text-[12px] text-charcoal/45">
                      אינסטגרם · טיקטוק · יוטיוב
                    </p>
                  </div>
                </button>
              ) : (
                <div className="relative rounded-3xl overflow-hidden aspect-[4/3] bg-[#F4F4F4]">
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
                  className="w-full bg-terracotta text-cream rounded-2xl py-4 text-[16px] font-semibold shadow-lg"
                >
                  🔍 זהה את הבגדים
                </button>
              )}

              {!previewUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-[#EDE5D8] rounded-2xl py-3.5 text-[14px] font-semibold text-charcoal/60"
                >
                  בחר קובץ מהגלריה
                </button>
              )}
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

        {/* Loading */}
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-cream"
          >
            <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center animate-pulse">
              <Share2 size={24} className="text-terracotta" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-charcoal mb-1">סורק את התמונה...</p>
              <p className="text-[12px] text-charcoal/45">מזהה בגדים ומחפש בחנויות</p>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {step === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="flex items-center gap-3 px-5 pt-10 pb-3 bg-cream">
              <button onClick={reset}>
                <ArrowLeft size={20} className="text-charcoal" />
              </button>
              <h2 className="text-[17px] font-bold text-charcoal font-serif flex-1">בגדים שזוהו</h2>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-20">
              <div className="mb-4 p-3 bg-white rounded-2xl border border-[#EDE5D8]">
                {previewUrl && (
                  <img src={previewUrl} alt="source" className="w-full h-24 object-cover rounded-xl mb-2" />
                )}
                <p className="text-[12px] text-charcoal/50">זוהה: <span className="font-semibold text-charcoal">{productLabel}</span></p>
              </div>

              <p className="text-[11px] font-semibold text-charcoal/55 uppercase tracking-wider mb-3">
                {products.length} תוצאות
              </p>

              <div className="grid grid-cols-2 gap-3">
                {products.map((p, i) => (
                  <SocialProductCard
                    key={i}
                    product={p}
                    isSaved={saved.has(p.link)}
                    onSave={() => {
                      saveToWardrobe(p);
                      setSaved(prev => new Set([...prev, p.link]));
                    }}
                  />
                ))}
              </div>

              <button onClick={reset} className="w-full mt-5 border-2 border-[#EDE5D8] rounded-2xl py-3.5 text-[14px] font-semibold text-charcoal/60">
                + סריקה חדשה
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialProductCard({ product, isSaved, onSave }: { product: Product; isSaved: boolean; onSave: () => void }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#EDE5D8]">
      <div className="bg-[#F4F4F4] aspect-square relative flex items-center justify-center overflow-hidden">
        {product.image
          ? <img src={product.image} alt={product.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <ShoppingBag size={28} className="text-charcoal/20" />
        }
        <button onClick={onSave} className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm">
          <Heart size={14} className={isSaved ? 'text-terracotta fill-terracotta' : 'text-charcoal/40'} />
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[10px] font-semibold text-charcoal/50 uppercase mb-0.5">{product.store}</p>
        <p className="text-[11px] font-medium text-charcoal leading-tight line-clamp-2 mb-1.5">{product.title}</p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-terracotta">{product.price}</span>
          <a href={product.link} target="_blank" rel="noopener noreferrer" className="w-6 h-6 bg-terracotta/10 rounded-full flex items-center justify-center">
            <ExternalLink size={11} className="text-terracotta" />
          </a>
        </div>
      </div>
    </div>
  );
}
