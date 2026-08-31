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
        href: '/inventory',
        label: 'Overview',
        icon: 'gauge',
      },
      {
        href: '/inventory/raw-coils',
        label: 'Raw Coils',
        icon: 'coil',
      },
      {
        href: '/inventory/plane-stock',
        label: 'Plane Stock',
        icon: 'layers',
      },
      {
        href: '/inventory/other-items',
        label: 'Other Items',
        icon: 'tag',
      },
    ],
  },
  {
    href: '/sales',
    label: 'Sales',
    icon: 'cash',
  },
  {
    href: '/expenses',
    label: 'Expenses',
    icon: 'wallet',
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: 'users',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: 'tag',
    children: [
      {
        href: '/settings/pricing',
        label: 'Pricing',
        icon: 'tag',
      },
      {
        href: '/settings/business',
        label: 'Business / Branding',
        icon: 'building',
      },
      {
        href: '/settings/security',
        label: 'Security',
        icon: 'lock',
      },
    ],
  },
];
