export interface Branding {
  shopName: string;
  logoUrl: string | null;
}

export const brandingApi = {
  get: () =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/branding`, {
      credentials: 'include',
    }).then((res) => {
      if (!res.ok) throw new Error('Failed to load branding');
      return res.json() as Promise<Branding>;
    }),
};
