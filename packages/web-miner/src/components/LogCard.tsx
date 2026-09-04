import { useAtomValue } from 'jotai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logAtom } from '../state';

export function LogCard() {
  const log = useAtomValue(logAtom);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-64 overflow-auto text-xs" data-testid="log">
          {log.length ? log.join('\n') : 'nothing yet'}
        </pre>
      </CardContent>
    </Card>
  );
}
