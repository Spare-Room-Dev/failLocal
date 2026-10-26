import type { Quantity, Unit } from '../src/quantity.js';
import type { Process, Register } from '../src/schema.js';

/** A quantity with assumed provenance, for tests. */
export function q<U extends Unit>(value: number, unit: U): Quantity<U> {
  return { value, unit, provenance: { kind: 'assumed', reasoning: 'test' } };
}

function process(
  id: string,
  kind: Process['kind'],
  tier: Process['tier'],
  dependsOn: Process['dependsOn'],
): Process {
  return {
    id,
    name: id,
    area: 'test',
    kind,
    tier,
    safetyFunction: 'none',
    productionConsequence: 'test',
    dependsOn,
    status: { degraded: 'degraded', stopped: 'stopped' },
    continuity: {
      maxTolerableOutage: q(48, 'hours'),
      recoveryTarget: q(24, 'hours'),
      owner: 'test',
      independentCopy: false,
    },
  };
}

/** A small valid site that exercises every reference kind; later tests mutate copies of it. */
export function minimalRegister(): Register {
  return {
    schemaVersion: 1,
    site: { id: 'test-site', name: 'Test Site', fictional: true, description: 'A fictional test site.' },
    sources: [{ id: 'test-src', title: 'Test source', url: 'https://example.com/test', accessed: '2026-01-01' }],
    processes: [
      process('ordering', 'back-office', 'low', [{ on: 'erp', onLoss: 'stop' }]),
      process('haulage', 'physical', 'medium', [{ on: 'diesel', onLoss: 'stop' }]),
      process('crushing', 'physical', 'medium', [
        { on: 'haulage', onLoss: 'stop' },
        { on: 'plc', onLoss: 'stop' },
      ]),
      process('rail', 'physical', 'low', [{ on: 'ore', onLoss: 'stop' }]),
    ],
    assets: [{ id: 'plc', name: 'PLC', type: 'plc', zone: 'test' }],
    services: [
      { id: 'erp', name: 'ERP', provider: 'test', hosting: 'test', kind: 'enterprise-app' },
    ],
    stocks: [
      {
        id: 'diesel',
        name: 'Diesel',
        capacity: q(4, 'days'),
        initial: q(4, 'days'),
        lowThreshold: q(1, 'days'),
        refillRate: q(2, 'days/day'),
        replenishedBy: 'ordering',
        consumedBy: ['haulage'],
      },
      {
        id: 'ore',
        name: 'Ore',
        capacity: q(3, 'days'),
        initial: q(3, 'days'),
        lowThreshold: q(0.5, 'days'),
        refillRate: q(2, 'days/day'),
        replenishedBy: 'crushing',
        consumedBy: ['rail'],
      },
    ],
    controls: [],
    scenarios: [
      {
        id: 'cut-erp',
        title: 'ERP cut',
        summary: 'The ERP is cut for twelve days.',
        basis: ['test-src'],
        projection: false,
        workaroundsHold: false,
        horizon: q(20, 'days'),
        events: [{ kind: 'cut-service', service: 'erp', at: q(0, 'hours'), restoreAfter: q(288, 'hours') }],
      },
    ],
    production: {
      annualTonnes: q(10, 'Mt/a'),
      price: q(100, 'USD/t'),
      shippingProcess: 'rail',
      degradedOutput: q(0.6, 'fraction'),
    },
  };
}
