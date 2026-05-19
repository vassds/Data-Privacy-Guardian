import React from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsDashboard } from './components/OptionsDashboard';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<OptionsDashboard />);
}