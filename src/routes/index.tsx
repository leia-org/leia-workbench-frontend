import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Chat } from '../views/Chat';
import { Edit } from '../views/Edit';
import { Login } from '../views/Login';
import { CreateLeia } from '../views/CreateLeia';
import { AdminLogin } from '../views/AdminLogin';
import { Administration } from '../views/Administration';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/chat/:sessionId',
    element: <Chat />,
  },
  {
    path: '/edit',
    element: <Edit />,
  },
  {
    path: '/create',
    element: <CreateLeia />,
  },
  {
    path: '/administration',
    element: <Administration />,
  },
  {
    path: '/login',
    element: <AdminLogin />,
  },
  {
    path: '/replications/:id',
    element: <Edit />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
