import { register } from './register.js';
import type { Cable, SceneState } from './sceneState.js';

/** One service card and one cable: the services a visitor cuts and restores together on screen. */
export interface ServiceGroup {
  id: string;
  name: string;
  services: string[];
  /** Short labels on a card with several services, for each one's status line; each keeps the register's name as its title. */
  rowLabels?: Record<string, string>;
  /** The one-letter key on each service's own Cut button, on a card with several services. */
  buttonKeys?: Record<string, string>;
}

/** The register's name for a service. Throws when the register has no such service. */
export function serviceName(id: string): string {
  const service = register.services.find((s) => s.id === id);
  if (!service) throw new Error(`register has no service ${id}`);
  return service.name;
}

/**
 * Every service a scenario can cut, in cable order (controller ruling R3, D-102). Names are the
 * register's, except two display names: the register's hosted ERP name lists its modules and is too
 * long for a card, and the vendor card has no register entry of its own. The two vendor accesses
 * share one card and one cable; each has its own Cut button and, when it differs, its own status line.
 */
export const SERVICE_GROUPS: ServiceGroup[] = [
  { id: 'hosted-erp', name: 'Hosted ERP', services: ['hosted-erp'] },
  { id: 'cloud-identity', name: serviceName('cloud-identity'), services: ['cloud-identity'] },
  { id: 'iroc-link', name: serviceName('iroc-link'), services: ['iroc-link'] },
  { id: 'corporate-network', name: serviceName('corporate-network'), services: ['corporate-network'] },
  {
    id: 'vendor-access',
    name: 'Vendor remote access',
    services: ['vendor-a-access', 'vendor-b-access'],
    rowLabels: { 'vendor-a-access': 'Vendor A', 'vendor-b-access': 'Vendor B' },
    buttonKeys: { 'vendor-a-access': 'A', 'vendor-b-access': 'B' },
  },
];

/** Where group `i`'s cable runs, as a fraction of the scene's width: evenly spaced, in card order. */
export function cableFraction(i: number): number {
  return (i + 1) / (SERVICE_GROUPS.length + 1);
}

/** A service's own label on screen: its group's name when the group holds only it, the register's name otherwise. */
export function serviceLabel(id: string): string {
  const group = SERVICE_GROUPS.find((g) => g.services.includes(id));
  if (!group) throw new Error(`no service group has ${id}`);
  return group.services.length === 1 ? group.name : serviceName(id);
}

/** The group's cable: the worst state among its services (severed, then revoked, then live). Throws on a missing service. */
export function groupState(services: SceneState['services'], g: ServiceGroup): Cable {
  const cables = g.services.map((id) => {
    const service = services[id];
    if (!service) throw new Error(`scene has no service ${id}`);
    return service.cable;
  });
  if (cables.includes('severed')) return 'severed';
  if (cables.includes('revoked')) return 'revoked';
  return 'live';
}
