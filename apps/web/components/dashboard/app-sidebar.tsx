'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { navigation, NavItem } from './navigation';
import { authApi } from '../../features/auth/api/auth';

function CoilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c0 4-2 6-2 9s2 5 2 9" />
      <path d="M12 3c0 4 2 6 2 9s-2 5-2 9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function WarehouseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  gauge: GaugeIcon,
  tag: TagIcon,
  truck: TruckIcon,
  building: BuildingIcon,
  document: DocumentIcon,
  warehouse: WarehouseIcon,
  coil: CoilIcon,
};

function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(() => isActivePath(item.href, pathname));

  if (hasChildren) {
    const branchIsActive = isActivePath(item.href, pathname);

    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            branchIsActive
              ? 'bg-[#1C232C] text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#151B23]'
          }`}
        >
          <div className="flex items-center gap-3">
            {iconMap[item.icon] && (() => {
              const Icon = iconMap[item.icon];
              return <Icon />;
            })()}
            <span>{item.label}</span>
          </div>
          <ChevronIcon isOpen={isExpanded} />
        </button>
        {isExpanded && (
          <div className="ml-4 mt-1 space-y-0.5">
            {item.children!.map((child) => {
              const Icon = iconMap[child.icon];
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isChildActive
                      ? 'bg-[#1C232C] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-100 hover:bg-[#151B23]'
                  }`}
                >
                  {Icon && <Icon />}
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const isItemActive = pathname === item.href;
  const Icon = iconMap[item.icon];

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isItemActive
          ? 'bg-[#1C232C] text-zinc-100'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#151B23]'
      }`}
    >
      {Icon && <Icon />}
      <span>{item.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <aside className="w-64 h-screen bg-[#0B0F14] border-r border-[#1C232C] flex flex-col">
      <div className="p-5 border-b border-[#1C232C]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1C232C] flex items-center justify-center">
            <CoilIcon className="w-5 h-5 text-zinc-300" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100 tracking-wide">
              STEELCOIL
            </div>
            <div className="text-xs text-zinc-500">Inventory POS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="p-4 border-t border-[#1C232C]">
        <div className="mb-3 pb-3 border-b border-[#1C232C]">
          <div className="text-xs text-zinc-500 mb-1">Administrator</div>
          <div className="text-sm text-zinc-400">Local System</div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#151B23] transition-colors"
        >
          <LogOutIcon />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}