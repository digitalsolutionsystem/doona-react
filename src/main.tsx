import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAccentTheme } from './utils/accentTheme';

initAccentTheme();

createRoot(document.getElementById('root')!).render(<App />);
