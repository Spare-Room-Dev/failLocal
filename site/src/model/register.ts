import { loadRegisterYaml } from '@faillocal/engine';
import type { Register } from '@faillocal/engine';
import yaml from '../../../register/pilbara-model-site.yaml?raw';

/** The model site's register, parsed and validated once at module load. */
export const register: Register = loadRegisterYaml(yaml);
