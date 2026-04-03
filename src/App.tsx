import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { DiagramProvider } from './context/DiagramContext';
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <DiagramProvider>
      <RouterProvider router={router} />
      <ToastContainer position="bottom-right" />
    </DiagramProvider>
  );
}

export default App;