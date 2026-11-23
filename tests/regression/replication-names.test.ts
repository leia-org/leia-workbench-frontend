import { beforeEach, expect, test, vi } from 'vitest';
import { readReplicationName, writeReplicationName } from '../../src/lib/replicationNames';

let stored: string | null;
beforeEach(() => {
  stored = null;
  vi.stubGlobal('window', { localStorage: {
    getItem: vi.fn(() => stored),
    setItem: vi.fn((_key, value) => { stored = value; }),
  } });
});

test('renaming a replication updates its sidebar name without losing other cached names', () => {
  writeReplicationName('first', 'First activity');
  writeReplicationName('second', 'Second activity');
  writeReplicationName('first', 'Renamed activity');
  expect(readReplicationName('first')).toBe('Renamed activity');
  expect(readReplicationName('second')).toBe('Second activity');
});

test.each(['broken JSON', 'null', '42'])('a corrupt cache does not break share-link navigation: %s', (value) => {
  stored = value;
  expect(readReplicationName('replication')).toBeNull();
  writeReplicationName('replication', 'Recovered');
  expect(readReplicationName('replication')).toBe('Recovered');
});

test('blocked storage or a full quota does not prevent a replication from opening', () => {
  vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error('Quota exceeded'); });
  expect(readReplicationName('replication')).toBeNull();
  expect(() => writeReplicationName('replication', 'Activity')).not.toThrow();
});
