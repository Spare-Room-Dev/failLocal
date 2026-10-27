import { register } from './register.js';
import type { Cable, SceneState } from './sceneState.js';

/** One service card and one cable: the services a visitor cuts and restores together on screen. */
export interface ServiceGroup {
  id: string;
  name: string;
  services: string[];
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
 * share one card and one cable, each with its own row on the card.
 */
export const SERVICE_GROUPS: ServiceGroup[] = [
  { id: 'hosted-erp', name: 'Hosted ERP', services: ['hosted-erp'] },
  { id: 'cloud-identity', name: serviceName('cloud-identity'), services: ['cloud-identity'] },
  { id: 'iroc-link', name: serviceName('iroc-link'), services: ['iroc-link'] },
  { id: 'corporate-network', name: serviceName('corporate-network'), services: ['corporate-network'] },
  { id: 'vendor-access', name: 'Vendor remote access', services: ['vendor-a-access', 'vendor-b-access'] },
];

/** The group's cable: the worst state among its services (severed, then revoked, then live). */
export function groupState(scene: SceneState, g: ServiceGroup): Cable {
  const cables = g.services.map((id) => scene.services[id]?.cable ?? 'live');
  if (cables.includes('severed')) return 'severed';
  if (cables.includes('revoked')) return 'revoked';
  return 'live';
}
