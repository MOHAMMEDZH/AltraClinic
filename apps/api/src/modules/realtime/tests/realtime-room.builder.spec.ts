import { RealtimeRoomBuilder } from '../domain/realtime-room.builder';

describe('RealtimeRoomBuilder', () => {
  const TENANT = 'tenant-abc';
  const BRANCH = 'branch-1';
  const USER = 'user-123';

  it('builds tenant channel room', () => {
    expect(RealtimeRoomBuilder.tenantChannel(TENANT, 'queue')).toBe('tenant:tenant-abc:channel:queue');
  });

  it('builds branch-scoped room', () => {
    expect(RealtimeRoomBuilder.branchChannel(TENANT, BRANCH, 'appointments'))
      .toBe('tenant:tenant-abc:branch:branch-1:channel:appointments');
  });

  it('builds user-private room', () => {
    expect(RealtimeRoomBuilder.userRoom(TENANT, USER)).toBe('tenant:tenant-abc:user:user-123');
  });

  it('sanitizes colons in IDs', () => {
    expect(RealtimeRoomBuilder.userRoom('tenant:evil', 'user:1'))
      .toBe('tenant:tenant_evil:user:user_1');
  });

  it('returns tenant + branch rooms for subscription', () => {
    const rooms = RealtimeRoomBuilder.roomsForSubscription(TENANT, BRANCH, 'dashboard');
    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toContain('channel:dashboard');
    expect(rooms[1]).toContain('branch:branch-1');
  });

  it('returns only tenant room when branchId is null', () => {
    const rooms = RealtimeRoomBuilder.roomsForSubscription(TENANT, null, 'patients');
    expect(rooms).toHaveLength(1);
  });
});
