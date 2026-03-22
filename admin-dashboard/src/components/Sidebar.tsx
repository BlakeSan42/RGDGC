import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  Disc3,
  Tag,
  Wallet,
  Settings,
  X,
  Shield,
  CarFront,
  BookOpen,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems: Array<{ to: string; icon: any; label: string; end?: boolean; divider?: boolean }> = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/events', icon: Calendar, label: 'Events' },
  { to: '/leagues', icon: Trophy, label: 'Leagues' },
  { to: '/players', icon: Users, label: 'Players' },
  { to: '/discs', icon: Disc3, label: 'Discs' },
  { to: '/stickers', icon: Tag, label: 'Stickers' },
  { to: '/treasury', icon: Wallet, label: 'Treasury' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', divider: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/ksa-intel', icon: Shield, label: 'KSA Intel', divider: true },
  { to: '/ksa-intel/articles', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/ksa-intel/towing', icon: CarFront, label: 'Tow Tracking' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-forest-900 text-white
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-forest-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-disc-500 rounded-lg flex items-center justify-center">
              <Disc3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-tight">RGDGC</h1>
              <p className="text-[10px] text-forest-300 leading-tight">Admin Dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => (
            <div key={item.to}>
              {item.divider && (
                <div className="mt-4 mb-2 px-3 pt-3 border-t border-forest-700">
                  <p className="text-[10px] uppercase tracking-wider text-forest-400 font-semibold">
                    {item.to.includes('ksa') ? 'Intelligence' : 'Club Management'}
                  </p>
                </div>
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-forest-800 text-white'
                      : 'text-forest-200 hover:bg-forest-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-forest-800">
          <p className="text-xs text-forest-400 text-center">
            River Grove Disc Golf Club
          </p>
          <p className="text-[10px] text-forest-500 text-center mt-0.5">
            River Grove, IL
          </p>
        </div>
      </aside>
    </>
  );
}
