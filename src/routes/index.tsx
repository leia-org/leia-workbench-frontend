import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Chat } from '../views/Chat';
import { Edit } from '../views/Edit';
import { Login } from '../views/Login';
import { CreateLeia } from '../views/CreateLeia';
import { AdminLogin } from '../views/AdminLogin';
import { Administration } from '../views/Administration';
import { Replication } from '../views/Replication';
import { Experiments } from '../views/Experiments';
import { Experiment } from '../views/Experiment';
import { Conversations } from '../views/Conversations';
import { LiveDashboard } from '../views/LiveDashboard';
import { SpectatorView } from '../views/SpectatorView';
import { AuthProvider } from '../context';
import { Outlet } from 'react-router-dom';
import { ApiKeysPage } from '../views/ApiKeys';
import ProtectedRoute from '../components/ProtectedRoute';


export const router = createBrowserRouter([
   {element:(
    <AuthProvider>
        <Outlet />
    </AuthProvider>
   ),

    children:[{
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
    element: <ProtectedRoute requireAdmin={true} />,
    children: [
      {
        path: '/administration',
        element: <Administration />,
      },
      {
        path: '/administration/api-keys',
        element: <ApiKeysPage />,
      },
      {
        path: '/experiments',
        element: <Experiments />,
      },
      {
        path: '/experiments/:id',
        element: <Experiment />,
      },
    ],
  },
  {
    path: '/login',
    element: <AdminLogin />,
  },
  {
    path: '/replications/:id',
    element: <Replication />,
  },
  {
    path: '/replications/:id/conversations',
    element: <Conversations />,
  },
  {
    path: '/replications/:id/live',
    element: <LiveDashboard />,
  },
  {
    path: '/spectate/:sessionId',
    element: <SpectatorView />,
  },

  {
    path: '*',
    element: <Navigate to="/" replace />,
  },]}
]);
