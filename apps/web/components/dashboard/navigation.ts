export interface NavItem {
  href: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'gauge',
  },
  {
    href: '/procurement',
    label: 'Procurement',
    icon: 'truck',
    children: [
      {
        href: '/procurement/suppliers',
        label: 'Suppliers',
        icon: 'building',
      },
      {
        href: '/procurement/purchases',
        label: 'Purchases',
        icon: 'document',
      },
    ],
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: 'warehouse',
    children: [
      {
        href: '/inventory/raw-coils',
        label: 'Raw Coils',
        icon: 'coil',
      },
    ],
  },
  {
    href: '/settings/pricing',
    label: 'Pricing',
    icon: 'tag',
  },
];
