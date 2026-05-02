import { motion } from 'framer-motion';
import { Camera, Bell, Heart, TrendingUp, Share2 } from 'lucide-react';

interface HomeScreenProps {
  setActiveTab: (tab: string) => void;
}

const TRENDS = ['minimalist', 'Y2K', 'bohemian', 'sporty', 'formal', 'vintage'];

const INSPIRATION = [
  { label: 'Evening Look', bg: '#2C2C2C', text: '#E8A84C' },
  { label: 'Casual Daily', bg: '#C17B5C', text: '#FFF5E4' },
  { label: 'Urban Sport', bg: '#7A9E7E', text: '#FFFBF5' },
  { label: 'Cute Vintage', bg: '#9B7B5C', text: '#FFF0D6' },
];

export function HomeScreen({ setActiveTab }: HomeScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-cream overflow-y-auto hide-scrollbar"
    >
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <div className="text-[22px] font-bold text-charcoal font-serif">
          <span className="text-terracotta">S</span>napStyle
        </div>
        <button className="w-9 h-9 rounded-full bg-[#EDE5D8] flex items-center justify-center">
          <Bell size={16} className="text-charcoal/60" />
        </button>
      </div>

      <div className="px-5 pt-2 pb-6">
        <p className="text-[11px] font-semibold text-terracotta uppercase tracking-widest mb-2">AI Fashion</p>
        <h1 className="text-[26px] font-bold text-charcoal font-serif leading-tight mb-2">
          Discover every<br />outfit you loved
        </h1>
        <p className="text-[13px] text-charcoal/55 mb-6">Snap, identify, buy - in three simple steps</p>
        <button
          onClick={() => setActiveTab('snap')}
          className="w-full bg-terracotta text-cream rounded-2xl py-4 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform"
        >
          <Camera size={20} strokeWidth={2} />
          <span className="text-[16px] font-semibold">Snap / Upload outfit</span>
        </button>
      </div>

      <div className="px-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-terracotta" />
          <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider">Trending Now</span>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {TRENDS.map(trend => (
            <button key={trend} onClick={() => setActiveTab('snap')}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#EDE5D8] text-[12px] font-medium text-charcoal/70 whitespace-nowrap">
              #{trend}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider">Inspiration</span>
          <button className="text-[11px] text-terracotta font-medium">See all</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {INSPIRATION.map(({ label, bg, text }) => (
            <button key={label} onClick={() => setActiveTab('snap')}
              className="rounded-2xl overflow-hidden aspect-[3/4] flex items-end p-3 active:scale-[0.97] transition-transform"
              style={{ backgroundColor: bg }}>
              <div className="text-left">
                <p className="text-[11px] font-semibold" style={{ color: text }}>{label}</p>
                <p className="text-[10px] opacity-70" style={{ color: text }}>tap to search</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mb-6 mt-2">
        <div className="flex gap-3">
          <button onClick={() => setActiveTab('social')} className="flex-1 bg-[#EDE5D8] rounded-2xl p-4 text-right">
            <Share2 size={18} className="text-terracotta mb-2" />
            <p className="text-[12px] font-semibold text-charcoal">Social Snap</p>
            <p className="text-[10px] text-charcoal/50">from social media</p>
          </button>
          <button onClick={() => setActiveTab('twin')} className="flex-1 bg-[#EDE5D8] rounded-2xl p-4 text-right">
            <Heart size={18} className="text-terracotta mb-2" />
            <p className="text-[12px] font-semibold text-charcoal">Style Twin</p>
            <p className="text-[10px] text-charcoal/50">similar look</p>
          </button>
        </div>
      </div>

      <div className="h-16" />
    </motion.div>
  );
}
