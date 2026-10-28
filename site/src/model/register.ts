import { parseRegister } from '@faillocal/engine';
import type { Register } from '@faillocal/engine';
// Compiled from register/pilbara-model-site.yaml by scripts/build-register.mjs (predev/prebuild/pretest).
import json from '../generated/register.json' with { type: 'json' };

/** The model site's register, validated once at module load. */
export const register: Register = parseRegister(json);
