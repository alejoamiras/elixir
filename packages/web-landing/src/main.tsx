import './index.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConnection } from '../../site/src/browser/connection.ts';
import { aliasRedirect } from '../../site/src/browser/host.ts';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { watchChain } from './chain';
import type { LaunchStatus, LiveStatus } from './state';

const alias = aliasRedirect(location);
if (alias) location.replace(alias);

const connection = loadConnection();

function Root() {
  const [live, setLive] = useState<LiveStatus>({ phase: 'loading' });
  const [launch, setLaunch] = useState<LaunchStatus>({ phase: 'loading' });
  useEffect(() => watchChain(connection, { live: setLive, launch: setLaunch }), []);
  return <App live={live} launch={launch} miner={connection.miner} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </StrictMode>,
);
