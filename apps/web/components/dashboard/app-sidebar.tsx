'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { navigation, NavItem } from './navigation';
import { authApi } from '../../features/auth/api/auth';
import { useBranding } from '../../features/settings/hooks/use-branding';

const ICON_SIZE = 'w-[18px] h-[18px]';
const ICON_STROKE = 1.5;

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={`${ICON_SIZE} shrink-0 ${className ?? ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 14h4m4 0h4M4 10h4m4 0h4M4 6h4m4 0h4" />
    </Icon>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M1 8h14M1 8v8h5M16 16H1M16 16v-3h3l2-2.5V8H6" />
    </Icon>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 21V11M7 21V5m4 16V7m4 14V9m4 10V3" />
      <rect x="1" y="3" width="22" height="18" rx="1" />
    </Icon>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9 14l6-6m0 0H7m2 0h2m2 0v10a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1h8a1 1 0 011 1v6" />
    </Icon>
  );
}

function WarehouseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 21V10m6 11V7m6 14V5m6 16V9" />
      <rect x="1" y="3" width="22" height="18" rx="1" />
    </Icon>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </Icon>
  );
}

function CoilIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l4.5 4.5a2 2 0 010 2.828l-4.5 4.5a2 2 0 01-2.828 0l-4.5-4.5A2 2 0 013 8.5v-5a2 2 0 012-2z" />
    </Icon>
  );
}

function CashIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="1" y="5" width="22" height="14" rx="2" />
      <path d="M1 10h22" />
    </Icon>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M1 9V7a2 2 0 012-2h18a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-2" />
      <path d="M1 13h22" />
    </Icon>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Icon>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M12 17v1M7 11V7a5 5 0 0110 0v4" />
    </Icon>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      className="w-[18px] h-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4M16 17l4 4m0-4l-4 4M12 19v-9" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  gauge: GaugeIcon,
  tag: TagIcon,
  truck: TruckIcon,
  building: BuildingIcon,
  document: DocumentIcon,
  warehouse: WarehouseIcon,
  coil: CoilIcon,
  layers: LayersIcon,
  cash: CashIcon,
  users: UsersIcon,
  wallet: WalletIcon,
  lock: LockIcon,
};

function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavItemRow({
  item,
}: {
  item: NavItem;
}) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(() =>
    isActivePath(item.href, pathname),
  );

  const isActive = pathname === item.href;
  const branchActive = isActivePath(item.href, pathname);
  const Icon = iconMap[item.icon];

  if (hasChildren) {
    return (
      <div className="space-y-0.5">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className={`
            group flex items-center w-full rounded-lg
            h-9 px-3 gap-2.5
            text-[13px] font-medium
            transition-colors duration-150
            ${branchActive
              ? 'bg-[#1a2332] text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#151B23]'
            }
          `}
        >
          {Icon && <Icon className={branchActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'} />}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronIcon isOpen={isExpanded} />
        </button>

        {isExpanded && (
          <div className="space-y-0.5 ml-3 pl-3 border-l border-[#1C232C]">
            {item.children!.map((child) => {
              const ChildIcon = iconMap[child.icon];
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`
                    flex items-center rounded-lg
                    h-8 px-3 gap-2.5
                    text-[13px]
                    transition-colors duration-150
                    ${childActive
                      ? 'bg-[#1a2332] text-zinc-100 font-medium'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#151B23]'
                    }
                  `}
                >
                  {ChildIcon && (
                    <ChildIcon className={childActive ? 'text-zinc-100' : 'text-zinc-600'} />
                  )}
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center rounded-lg
        h-10 px-3 gap-2.5
        text-[13px] font-medium
        transition-colors duration-150
        ${isActive
          ? 'bg-[#1a2332] text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#151B23]'
        }
      `}
    >
      {Icon && <Icon className={isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'} />}
      <span>{item.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const { branding } = useBranding();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <aside className="w-60 h-screen bg-[#0B0F14] border-r border-[#1C232C] flex flex-col">
      <div className="px-4 py-4 border-b border-[#1C232C]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#11161D] border border-[#1C232C] flex items-center justify-center shrink-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <svg
                className="w-4 h-4 text-zinc-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3c0 4-2 6-2 9s2 5 2 9M12 3c0 4 2 6 2 9s-2 5-2 9" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-zinc-200 tracking-tight truncate">
              {branding.shopName}
            </div>
            <div className="text-[11px] text-zinc-600 leading-none">POS System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navigation.map((item) => (
          <NavItemRow key={item.href} item={item} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[#1C232C]">
        <div className="flex items-center justify-between mb-2 px-3 py-1.5">
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Admin
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center rounded-lg h-9 px-3 gap-2.5 w-full text-[13px] text-zinc-500 hover:text-zinc-200 hover:bg-[#151B23] transition-colors duration-150"
        >
          <LogOutIcon />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
