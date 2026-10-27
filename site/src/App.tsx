export interface AppProps {
  register?: { site: { fictional: boolean } };
}

export function App({ register }: AppProps) {
  return <main>{register?.site.fictional && <span className="badge">Fictional model site</span>}</main>;
}
