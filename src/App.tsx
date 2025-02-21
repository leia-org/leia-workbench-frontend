import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { DiagramProvider } from './context/DiagramContext';

function App() {
  return (
    <DiagramProvider>
      <RouterProvider router={router} />
    </DiagramProvider>
  );
}

export default App; 