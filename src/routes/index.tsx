import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Chat } from '../views/Chat';
import { Edit } from '../views/Edit';
import { Login } from '../views/Login';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/chat/experiment/:experimentCode/student/:studentCode',
    element: <Chat />,
  },
  {
    path: '/edit',
    element: <Edit />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
