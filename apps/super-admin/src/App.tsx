import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router';
import { BrowserRouter } from 'react-router-dom';

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
