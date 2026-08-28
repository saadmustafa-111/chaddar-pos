'use client';

import { useState, useEffect, useRef } from 'react';
import { brandingApi, Branding } from '../api/branding';

const DEFAULT_BRANDING: Branding = {
  shopName: 'SteelCoil POS',
  logoUrl: null,
};

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const brandingFetched = useRef(false);

  useEffect(() => {
    if (brandingFetched.current) return;
    brandingFetched.current = true;

    brandingApi
      .get()
      .then((data) => {
        setBranding({
          shopName: data.shopName || DEFAULT_BRANDING.shopName,
          logoUrl: data.logoUrl ?? null,
        });
      })
      .catch(() => {
        setBranding(DEFAULT_BRANDING);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { branding, isLoading };
}
