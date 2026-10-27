import { simulate } from '@faillocal/engine';
import { describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import { groupState, SERVICE_GROUPS, serviceLabel, serviceName } from '../src/model/serviceGroups.js';

const vendor = SERVICE_GROUPS.find((g) => g.id === 'vendor-access')!;

describe('service groups', () => {
  test('cover every service the register declares', () => {
    expect(SERVICE_GROUPS.flatMap((g) => g.services).sort()).toEqual(register.services.map((s) => s.id).sort());
  });

  test('names come from the register except the two display names', () => {
    const names = Object.fromEntries(SERVICE_GROUPS.map((g) => [g.id, g.name]));
    expect(names).toEqual({
      'hosted-erp': 'Hosted ERP',
      'cloud-identity': 'Cloud logins',
      'iroc-link': 'Perth operations link',
      'corporate-network': 'Corporate network',
      'vendor-access': 'Vendor remote access',
    });
  });

  test('the shared vendor cable shows the worse of its two services', () => {
    const timeline = simulate(register, 's3-vendor-setpoint', 'prepared');
    const sample = timeline.samples.find((s) => s.hour === 12)!;
    expect(sample.services['vendor-a-access']).toBe('revoked');
    expect(sample.services['vendor-b-access']).toBe('up');
    expect(groupState(sceneState(register, sample), vendor)).toBe('revoked');
    expect(groupState(sceneState(register, timeline.samples[0]!), vendor)).toBe('live');
  });
});

describe('serviceLabel', () => {
  test("a service alone in its group takes the group's name; a shared group's service keeps its own", () => {
    expect(serviceLabel('hosted-erp')).toBe('Hosted ERP');
    expect(serviceLabel('iroc-link')).toBe(serviceName('iroc-link'));
    expect(serviceLabel('vendor-a-access')).toBe(serviceName('vendor-a-access'));
    expect(serviceLabel('vendor-a-access')).not.toBe(vendor.name);
  });
});
