import React from 'react';
import { Home, CalendarCheck, BarChart3, Pill } from 'lucide-react';

export type TabType = 'home' | 'today' | 'progress' | 'treatment';

interface NavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  pendingCount = 0,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'today',
      label: 'Today',
      icon: <CalendarCheck className="w-5 h-5" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: 'treatment',
      label: 'Treatment',
      icon: <Pill className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#18181B]/95 backdrop-blur-md border-t border-zinc-800/80 px-4 py-2 pb-safe select-none">
      <div className="w-full max-w-2xl mx-auto flex items-center justify-around">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-1.5 px-2 relative group transition-colors active:scale-95"
            >
              {/* Active pill background */}
              <div
                className={`relative px-5 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-zinc-400 group-hover:text-zinc-200'
                }`}
              >
                {tab.icon}

                {/* Badge if pending tasks */}
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#18181B]">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] font-medium mt-1 tracking-tight transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-zinc-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
