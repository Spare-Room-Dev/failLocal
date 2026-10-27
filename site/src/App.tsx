import { register as defaultRegister } from './model/register.js';

export interface AppProps {
  register?: { site: { fictional: boolean } };
}

export function App({ register = defaultRegister }: AppProps) {
  return <main>{register.site.fictional && <span className="badge">Fictional model site</span>}</main>;
}
