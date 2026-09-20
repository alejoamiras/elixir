import { Primary, Quiet, QuietRow, Screen } from './Screen';

export function Start({
  onCreate,
  onLogIn,
  onNotNow,
}: {
  onCreate: () => void;
  onLogIn: () => void;
  onNotNow: () => void;
}) {
  return (
    <Screen
      eyebrow="account"
      title="Mine with an account."
      body="Your balance lives in an account only you can open. It takes a tap."
    >
      <div className="flex flex-col gap-2.5">
        <Primary onClick={onCreate} data-testid="start-create">
          Create account
        </Primary>
        <Primary variant="outline" onClick={onLogIn} data-testid="start-login">
          Log in
        </Primary>
      </div>
      <QuietRow>
        <Quiet onClick={onNotNow} data-testid="not-now">
          Just watch for now
        </Quiet>
      </QuietRow>
    </Screen>
  );
}
