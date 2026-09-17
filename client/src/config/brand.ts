// Only show real profile URLs supplied by the shop owner; never platform homepages.
const configured = [
  { label: 'Instagram', value: import.meta.env.VITE_INSTAGRAM_URL, hosts: ['instagram.com', 'www.instagram.com'] },
  { label: 'TikTok', value: import.meta.env.VITE_TIKTOK_URL, hosts: ['tiktok.com', 'www.tiktok.com'] },
  { label: 'Facebook', value: import.meta.env.VITE_FACEBOOK_URL, hosts: ['facebook.com', 'www.facebook.com'] },
];
export const socialLinks = configured.flatMap(({ label, value, hosts }) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.pathname.replaceAll('/', '').length === 0 || url.username || url.password) return [];
    return [{ label, href: url.toString() }];
  } catch { return []; }
});
