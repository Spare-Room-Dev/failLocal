import type { ReactNode } from 'react';
import { register as defaultRegister } from './model/register.js';
import { useRoute } from './routes.js';
import type { Route } from './routes.js';
import { BuiltPage } from './ui/pages/BuiltPage.js';
import { FooterNav } from './ui/pages/FooterNav.js';
import { LimitsPage } from './ui/pages/LimitsPage.js';
import { SitePage } from './ui/pages/SitePage.js';
import { SourcesPage } from './ui/pages/SourcesPage.js';
import { TestedPage } from './ui/pages/TestedPage.js';
import { WelcomePage } from './ui/pages/WelcomePage.js';
import './ui/pages/pages.css';

export interface AppProps {
  register?: { site: { fictional: boolean } };
}

const PAGES: Record<Exclude<Route, 'site'>, () => ReactNode> = {
  welcome: WelcomePage,
  sources: SourcesPage,
  tested: TestedPage,
  built: BuiltPage,
  limits: LimitsPage,
};

/**
 * Hash-routed pages. The site view carries the badge in its top bar and the footer at the end of its
 * detail column; every other page shows the badge above its copy.
 */
export function App({ register = defaultRegister }: AppProps) {
  const route = useRoute();
  if (route === 'site')
    return <SitePage footer={<FooterNav current={route} />} />;
  const Page = PAGES[route];
  return (
    <>
      <main className="page-frame">
        {register.site.fictional && <span className="badge">Fictional model site</span>}
        <Page />
      </main>
      <FooterNav current={route} />
    </>
  );
}
