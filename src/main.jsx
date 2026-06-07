import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import NetworkGraph from './NetworkGraph';
import { samplePapers } from './data/samplePapers';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{ width: '100vw', height: '100vh' }}>
      <NetworkGraph papers={samplePapers} />
    </div>
  </StrictMode>
);