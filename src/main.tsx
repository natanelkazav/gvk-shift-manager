import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RouterProvider,
} from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from './auth/AuthContext';
import './styles/global.css';
import './styles/components.css';

const rootElement =
  document.getElementById('root');

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