import { ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface SnapScreenProps {
  setActiveTab: (tab: string) => void
}

export function SnapScreen({ setActiveTab }: SnapScreenProps) {
  const results = [
    { id: 1, img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80', name: 'Classic Silk Blouse', price: '₪349' },
    { id: 2, img: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?w=400&q=80', name: 'Pleated Trousers', price: '₪420' },
    { id: 3, img: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', name: 'Minimalist Blazer', price: '₪890' },
    { id: 4, img: 'https://images.unsplash.com/photo-1618245318763-a15156d6b23c?w=400&q=80', name: 'Leather Loafers', price: '₪550' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full w-full overflow-y-auto hide-scrollbar pb-24 pt-12 px-6"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => setActiveTab('home')} className="w-8 h-8 flex items-center justify-center cursor-pointer">
          <ArrowLeft size={20} className="text-charcoal" />
        </button>
        <span className="text-[10px] font-semibold tracking-[0.3em] text-terracotta uppercase">Snap</span>
        <div className="w-8 h-8" />
      </div>

      <div className="text-center mb-6">
        <h1 className="font-serif text-4xl text-charcoal mb-2">Outfit Snap</h1>
        <p dir="rtl" className="text-charcoal/60 text-sm">צלם או העלה תמונת בגד</p>
      </div>

      {/* Viewfinder */}
      <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-charcoal/20 bg-white/30 flex flex-col items-center justify-center mb-8 relative overflow-hidden">
        <div className="absolute inset-4 border border-charcoal/10 rounded-xl pointer-events-none" />
        <Camera size={48} strokeWidth={1} className="text-charcoal/30 mb-3" />
        <p dir="rtl" className="text-charcoal/40 text-xs">גע כאן לצילום או העלאה</p>
        <div className="flex gap-4 mt-6 absolute bottom-8">
          <button className="w-12 h-12 rounded-full border border-charcoal/20 flex items-center justify-center bg-white/50 backdrop-blur-sm text-charcoal cursor-pointer">
            <ImageIcon size={20} />
          </button>
          <button className="w-16 h-16 rounded-full bg-charcoal flex items-center justify-center text-white shadow-lg cursor-pointer">
            <Camera size={24} />
          </button>
          <div className="w-12 h-12" />
        </div>
      </div>

      {/* Results */}
      <div dir="rtl">
        <h2 className="font-serif text-xl text-charcoal mb-4">מוצרים דומים</h2>
        <div className="grid grid-cols-2 gap-4">
          {results.map((item) => (
            <motion.div key={item.id} whileHover={{ y: -2 }} className="group cursor-pointer">
              <div className="aspect-[4/5] rounded-xl overflow-hidden bg-white mb-2">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <h3 className="text-xs font-medium text-charcoal truncate">{item.name}</h3>
              <p className="text-xs text-terracotta mt-0.5">{item.price}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
