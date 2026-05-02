import { Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function TwinScreen() {
  const looks = [
    {
      id: 1, title: 'Look 1',
      img: 'https://images.unsplash.com/photo-1550639525-c97d455acf70?w=600&q=80',
      items: [{ name: 'Oversized Wool Coat' }, { name: 'Ribbed Turtleneck' }, { name: 'Wide Leg Trousers' }],
    },
    {
      id: 2, title: 'Look 2',
      img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
      items: [{ name: 'Structured Blazer' }, { name: 'Silk Camisole' }, { name: 'Straight Denim' }],
    },
    {
      id: 3, title: 'Look 3',
      img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&q=80',
      items: [{ name: 'Cashmere Sweater' }, { name: 'Pleated Midi Skirt' }, { name: 'Leather Boots' }],
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full w-full overflow-y-auto hide-scrollbar pb-24 pt-12"
    >
      <div className="px-6 mb-8">
        <h1 className="font-serif text-4xl text-charcoal mb-2">Style Twin</h1>
        <p dir="rtl" className="text-charcoal/60 text-sm">התאמה אישית של מלתחה שלמה</p>
      </div>

      {/* Input */}
      <div className="px-6 mb-10">
        <div className="relative">
          <textarea
            dir="rtl"
            placeholder="תאר/י את הסגנון שלך... (לדוגמה: מינימליסטי, נקי, גווני אדמה)"
            className="w-full h-32 bg-white/50 border border-charcoal/20 rounded-2xl p-4 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-charcoal/50 resize-none"
          />
          <button className="absolute bottom-4 left-4 bg-charcoal text-white px-5 py-2 rounded-full text-xs font-medium flex items-center gap-2 hover:bg-charcoal/90 transition-colors cursor-pointer">
            <Sparkles size={14} />
            <span>מצא לוקים</span>
          </button>
        </div>
      </div>

      {/* Looks */}
      <div dir="rtl">
        <h2 className="px-6 font-serif text-xl text-charcoal mb-4">ההצעות שלנו</h2>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar px-6 pb-6">
          {looks.map((look) => (
            <motion.div key={look.id} className="w-64 shrink-0 bg-card-dark rounded-2xl overflow-hidden flex flex-col">
              <div className="h-56 relative">
                <img src={look.img} alt={look.title} className="w-full h-full object-cover opacity-90" />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-serif font-medium text-charcoal">
                  {look.title}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {look.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-white/10 pb-2 last:border-0 last:pb-0">
                    <span className="text-white/80 text-xs font-light" dir="ltr">{item.name}</span>
                    <button className="text-terracotta text-xs font-medium flex items-center gap-1 hover:text-terracotta/80 cursor-pointer">
                      קנה <ArrowRight size={11} className="rotate-180" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
