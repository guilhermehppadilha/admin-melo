import { RouterProvider } from 'react-router';
import { Toaster } from './components/ui/sonner';
import router from './routes/Router';
import './css/globals.css';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default App;
