import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './theme.css';
import { App } from './app';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
