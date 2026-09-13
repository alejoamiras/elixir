// The versioned origin's cockpit head (the `old` role): this build mines nothing — it exists to
// move what is left off a version that has ended. Its account restores here and is created on the
// apex; the bridge tile and the migration card do the rest.
import { useAtomValue } from 'jotai';
import { Alert, AlertDescription, AlertTitle, Tile, TileHeader } from '../../../ui/src/index.ts';
import { bootAtom } from '../state';

export function Retired({ className }: { className?: string }) {
  const boot = useAtomValue(bootAtom);
  const version = import.meta.env.VITE_ROLLUP_VERSION;
  return (
    <Tile className={className} data-testid="retired">
      <TileHeader aside={`V${version} · retired`}>this version has ended</TileHeader>
      <Alert variant="warn">
        <AlertTitle>Mining has ended on this version.</AlertTitle>
        <AlertDescription>
          This address keeps V{version}’s last app so what is left can still leave: send ahead to the next
          version, or to Ethereum, from the wallet. Nothing new is mined here, and no account is created here
          — sign in with the passkey or the twelve words you already have.
        </AlertDescription>
      </Alert>
      <p className="mt-3 text-xs text-ink-3">
        {boot.phase === 'ready'
          ? 'Your balance is on the wallet page; the migration card there and here says what is lost and when.'
          : `V${version} goes quiet after the upgrade, without notice. Anything still on it then is lost.`}
      </p>
    </Tile>
  );
}
