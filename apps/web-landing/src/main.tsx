import '@yacana/web-kit/browser/node-guard';
import './index.css';
import { ThemeProvider } from '@yacana/ui';
import { loadConnection } from '@yacana/web-kit/browser/connection';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { watchChain } from './chain';
import type { LaunchStatus, LiveStatus } from './state';

const connection = loadConnection();

function Root() {
  const [live, setLive] = useState<LiveStatus>({ phase: 'loading' });
  const [launch, setLaunch] = useState<LaunchStatus>({ phase: 'loading' });
  useEffect(() => watchChain(connection, { live: setLive, launch: setLaunch }), []);
  return <App live={live} launch={launch} />;
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
