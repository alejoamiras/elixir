import { useEffect, useState } from 'react';

/** Below Tailwind's `md`: the page reads, links to the stats and mines nothing. */
export const MOBILE_QUERY = '(max-width: 767px)';

export function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => globalThis.matchMedia?.(MOBILE_QUERY).matches ?? false);
  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

/** Wall-clock seconds, ticking once a second, for countdowns and ages. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
