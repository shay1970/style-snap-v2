import { Search } from 'lucide-react'
import { motion } from 'framer-motion'

export function SocialScreen() {
  const hashtags = ['#streetstyle', '#minimalist', '#y2k', '#oversized', '#monochrome', '#vintage']

  const posts = [
    { id: 1, img: 'https://images.unsplash.com/photo-1495385794356-15371f348c31?w=800&q=80', user: '@sarah.styles' },
    { id: 2, img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80', user: '@minimal.daily' },
    { id: 3, img: 'https://images.unsplash.com/photo-1485230895905-ef40ba8daa69?w=800&q=80', user: '@urban.chic' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full w-full overflow-y-auto hide-scrollbar pb-24 pt-12"
    >
      <div className="px-6 mb-6">
        <h1 className="font-serif text-4xl text-charcoal mb-2">Social Snap</h1>
        <p dir="rtl" className="text-charcoal/60 text-sm">השראה מהרשת, ישירות לארון שלך</p>
      </div>

      {/* Trending */}
      <div className="mb-8" dir="rtl">
        <h2 className="px-6 font-serif text-lg text-charcoal mb-3">טרנדים</h2>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-6 pb-2">
          {hashtags.map((tag) => (
            <span key={tag} className="px-4 py-1.5 rounded-full border border-charcoal/10 text-xs text-charcoal whitespace-nowrap bg-white/40 cursor-pointer">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-6 px-6">
        {posts.map((post) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-card-dark"
          >
            <img src={post.img} alt="Social post" className="w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute top-4 left-4 text-white/80 text-xs font-medium tracking-wide">{post.user}</div>
            <div className="absolute bottom-4 left-4 right-4">
              <button className="w-full py-3.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/30 transition-colors cursor-pointer">
                <Search size={16} />
                <span dir="rtl">מצא את הבגדים</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
