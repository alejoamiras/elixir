import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useTweenedNumber } from '../../../ui/src/index.ts';
import { unsettledAtom } from '../state';

/**
 * A KPI number that glides to `value`; while it moves, `id` sits in `unsettledAtom`, so the page can
 * say when every number is at rest. `format` renders the in-flight value (an integer stays an integer).
 */
export function Tweened({
  id,
  value,
  format = (v) => String(Math.round(v)),
}: {
  id: string;
  value: number;
  format?: (v: number) => string;
}) {
  const shown = useTweenedNumber(value);
  const setUnsettled = useSetAtom(unsettledAtom);
  const settled = shown === value;
  useEffect(() => {
    setUnsettled((s) => {
      if (settled === !s.has(id)) return s;
      const next = new Set(s);
      settled ? next.delete(id) : next.add(id);
      return next;
    });
  }, [id, settled, setUnsettled]);
  useEffect(
    () => () =>
      setUnsettled((s) => {
        if (!s.has(id)) return s;
        const next = new Set(s);
        next.delete(id);
        return next;
      }),
    [id, setUnsettled],
  );
  return <>{format(shown)}</>;
}
