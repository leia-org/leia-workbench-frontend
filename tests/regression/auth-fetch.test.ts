import { beforeEach, describe, expect, test, vi } from 'vitest';
import { authFetch } from '../../src/lib/api';

let events: ReturnType<typeof vi.fn>;
beforeEach(() => {
  events = vi.fn();
  vi.stubGlobal('window', { dispatchEvent: events });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"id":"replication"}', { status: 200 })));
});

describe('Workbench authenticated requests', () => {
  test('sends the current bearer, cookie credentials, body and custom headers together', async () => {
    const body = JSON.stringify({ name: 'Updated replication' });
    const { res, data } = await authFetch('/replications/replication', 'fresh-token', {
      method: 'PATCH', body, headers: { 'X-Request-Id': 'request', Authorization: 'Bearer stale-token' }, credentials: 'omit',
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/replications/replication', {
      method: 'PATCH', body, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'request', Authorization: 'Bearer fresh-token' },
    });
    expect(res.status).toBe(200);
    expect(data).toEqual({ id: 'replication' });
    expect(events).not.toHaveBeenCalled();
  });

  test('anonymous requests keep cookies without inventing a bearer token', async () => {
    await authFetch('/replications/replication?token=share-token', null);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }));
  });

  test('401 dispatches the session-expired event and preserves the response body for callers', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"message":"Expired"}', { status: 401 }));
    const { res, data } = await authFetch('/replications', 'expired-token');
    expect(res.status).toBe(401);
    expect(data).toEqual({ message: 'Expired' });
    expect(events).toHaveBeenCalledOnce();
    expect(events.mock.calls[0][0].type).toBe('auth-unauthorized');
  });

  test('an unsuccessful login does not trigger a global logout event', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"message":"Invalid credentials"}', { status: 401 }));
    const { data } = await authFetch('/api/v1/users/login', null, { method: 'POST' });
    expect(data.message).toBe('Invalid credentials');
    expect(events).not.toHaveBeenCalled();
  });

  test.each([400, 403, 404, 500])('a %s response does not expire a valid session', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"message":"Rejected"}', { status }));
    expect((await authFetch('/replications', 'valid-token')).res.status).toBe(status);
    expect(events).not.toHaveBeenCalled();
  });

  test('an empty 204 response is a successful operation with null data', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const { res, data } = await authFetch('/replications/replication/form', 'token', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(data).toBeNull();
  });

  test('non-JSON proxy failures do not hide the HTTP status or throw a parsing exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const { res, data } = await authFetch('/replications', 'token');
    expect(res.status).toBe(502);
    expect(data).toBeNull();
    expect(events).not.toHaveBeenCalled();
  });

  test('network errors propagate without sending a false session-expired event', async () => {
    const error = new TypeError('Network unavailable');
    vi.mocked(fetch).mockRejectedValue(error);
    await expect(authFetch('/replications', 'token')).rejects.toBe(error);
    expect(events).not.toHaveBeenCalled();
  });
});
