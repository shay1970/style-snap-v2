import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BottomNav } from './components/BottomNav'
import { HomeScreen } from './components/HomeScreen'
import { SnapScreen } from './components/SnapScreen'
import { SocialScreen } from './components/SocialScreen'
import { TwinScreen } from './components/TwinScreen'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8" style={{ background: 'linear-gradient(135deg, #e8e0d0 0%, #f5f0e8 50%, #ede5d8 100%)' }}>
      <div className="relative w-full max-w-[390px] h-[844px] bg-[#F5F0E8] rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-white">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
          <div className="w-32 h-6 bg-black rounded-b-3xl" />
        </div>

        {/* Screens */}
        <div className="relative w-full h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomeScreen key="home" setActiveTab={setActiveTab} />}
            {activeTab === 'snap' && <SnapScreen key="snap" setActiveTab={setActiveTab} />}
            {activeTab === 'social' && <SocialScreen key="social" />}
            {activeTab === 'twin' && <TwinScreen key="twin" />}
          </AnimatePresence>
        </div>

        {/* Bottom Nav */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  )
}
