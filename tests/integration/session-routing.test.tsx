import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthProvider } from '../../src/context/AuthProvider';
import { useAuth } from '../../src/context/useAuth';
import ProtectedRoute from '../../src/components/ProtectedRoute';
import { authFetch } from '../../src/lib/api';
import { vi } from 'vitest';

let server: Server, baseUrl: string;
let sessionStatus = 200, resourceStatus = 200, role = 'admin';
let email = 'teacher@example.test';
let logouts = 0;
const requests: { path: string; authorization?: string }[] = [];
const token = () => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ id: 'teacher', email, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'synthetic-test-signature',
].join('.');

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => { requests.push({ path: req.path, authorization: req.headers.authorization }); next(); });
  app.get('/api/v1/users/session', (_req, res) => res.status(sessionStatus).json(sessionStatus === 200 ? { token: token() } : { message: 'No session' }));
  app.post('/api/v1/users/logout', (_req, res) => { logouts++; res.sendStatus(204); });
  app.get('/resource', (_req, res) => res.status(resourceStatus).json({ message: resourceStatus === 200 ? 'Ready' : 'Expired' }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  sessionStatus = 200; resourceStatus = 200; role = 'admin'; email = 'teacher@example.test'; logouts = 0; requests.length = 0;
  vi.stubEnv('VITE_AUTH_SERVICE_BACKEND', baseUrl);
  localStorage.clear();
});

function Dashboard() {
  const { user, token } = useAuth();
  return <main><p>{user?.email}</p><button onClick={() => { void authFetch(`${baseUrl}/resource`, token); }}>Load resource</button></main>;
}
function openDashboard() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><AuthProvider><Routes>
    <Route path='/login' element={<p>Login screen</p>} />
    <Route element={<ProtectedRoute requiredRoles={['admin', 'advanced']} />}>
      <Route path='/dashboard' element={<Dashboard />} />
    </Route>
  </Routes></AuthProvider></MemoryRouter>);
}

test('restores the central session, decodes the user and authorizes a mounted protected route', async () => {
  localStorage.setItem('token', 'obsolete-local-token');
  openDashboard();
  await screen.findByText('teacher@example.test');
  expect(localStorage.getItem('token')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Load resource' }));
  await waitFor(() => expect(requests.some((req) => req.path === '/resource' && req.authorization?.startsWith('Bearer '))).toBe(true));
  expect(logouts).toBe(0);
});

test('a real HTTP 401 triggers the fetch event, clears the provider and navigates to login', async () => {
  openDashboard(); await screen.findByText('teacher@example.test');
  resourceStatus = 401;
  fireEvent.click(screen.getByRole('button', { name: 'Load resource' }));
  await screen.findByText('Login screen');
  await waitFor(() => expect(logouts).toBe(1));
  expect(screen.queryByText('teacher@example.test')).toBeNull();
});

test('a missing central session cannot show protected content', async () => {
  sessionStatus = 401; openDashboard();
  await screen.findByText('Login screen');
  expect(screen.queryByRole('button', { name: 'Load resource' })).toBeNull();
});

test('an unauthorized role closes its session and cannot render the dashboard', async () => {
  role = 'instructor'; openDashboard();
  await screen.findByText('Login screen');
  await waitFor(() => expect(logouts).toBe(1));
  expect(screen.queryByRole('button', { name: 'Load resource' })).toBeNull();
});

test('regaining window focus refreshes the session identity from Auth', async () => {
  openDashboard(); await screen.findByText('teacher@example.test');
  email = 'updated@example.test';
  fireEvent.focus(window);
  await screen.findByText('updated@example.test');
  expect(logouts).toBe(0);
});
