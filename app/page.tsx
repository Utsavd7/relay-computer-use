'use client';
import { useState, useEffect } from 'react';
import Landing from '@/components/relay/landing';
import Workbench from '@/components/relay/workbench';
export default function Home() {
  const [app, setApp] = useState(false);
  useEffect(() => {
    setApp(new URLSearchParams(location.search).has('app'));
    const sync = () => setApp(new URLSearchParams(location.search).has('app'));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return app ? (
    <Workbench />
  ) : (
    <Landing
      open={() => {
        history.pushState({}, '', `${location.pathname}?app=1`);
        setApp(true);
        window.scrollTo(0, 0);
      }}
    />
  );
}
