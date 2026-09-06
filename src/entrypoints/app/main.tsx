import React from 'react';
import ReactDOM from 'react-dom/client';
import { initLanguage, watchLanguage } from '@/i18n';
import { App } from '@/ui/App';
import '@/ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// 語言偏好要在第一次 render 前就套用，不然畫面會先以英文閃一下才切成使用者選的語言
void (async () => {
  await initLanguage();
  watchLanguage();
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
})();
