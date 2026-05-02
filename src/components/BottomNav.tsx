import { Home, Camera, Share2, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TABS = [
  { id: 'home',   label: 'בית',    Icon: Home    },
  { id: 'snap',   label: 'סנאפ',   Icon: Camera  },
  { id: 'social', label: 'סושיאל', Icon: Share2  },
  { id: 'twin',   label: 'תאום',   Icon: Users   },
];

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <div className="absolute bottom-0 inset-x-0 h-16 bg-cream border-t border-[#EDE5D8] flex items-center z-40">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative"
          >
            {isActive && (
              <motion.div
                layoutId="nav-dot"
                className="absolute top-0 inset-x-0 h-0.5 bg-terracotta rounded-b-full"
              />
            )}
            <Icon
              size={20}
              strokeWidth={isActive ? 2.2 : 1.5}
              className={isActive ? 'text-terracotta' : 'text-charcoal/35'}
            />
            <span className={`text-[10px] leading-none ${isActive ? 'text-terracotta font-semibold' : 'text-charcoal/35 font-normal'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
