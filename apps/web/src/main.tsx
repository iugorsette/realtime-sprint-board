import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';

const client = new QueryClient();
const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}
