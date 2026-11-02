/**
 * קובץ: src/main.tsx
 * מטרה: אתחול React וחיבור רכיב היישום לאלמנט הכניסה בדף.
 * מטרות עיקריות:
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RouterProvider,
} from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from './auth/AuthContext';
import './styles/global.css';
import './styles/components.css';
import { themeService } from './services/themeService';

themeService.initialize();

// rootElement — הנתון rootElement בהקשר הפעולה.
const rootElement =
  document.getElementById('root');

// עצירת הפעולה עם שגיאה כאשר !rootElement.
if (!rootElement) {
  throw new Error(
    'Root element was not found.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);