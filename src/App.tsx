import { useCallback, useEffect, useState } from 'react';
import { AboutAndPillars } from './components/AboutAndPillars';
import { BookingSection } from './components/BookingSection';
import { ContactAndFooter } from './components/ContactAndFooter';
import { FloatingControls } from './components/FloatingControls';
import { HeroSection } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { PortfolioSection } from './components/PortfolioSection';
import { StoryCarousel } from './components/StoryCarousel';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useStudioData } from './hooks/useStudioData';
import { AdminPage } from './pages/AdminPage';
import { LegalPage } from './pages/LegalPages';

const DEFAULT_HERO_IMG = '/src/assets/images/hero_artist_studio_1795099827821.jpg';
const DEFAULT_SANCTUARY_IMG = '/src/assets/images/studio_sanctuary_interior_1795099827191.jpg';

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const { data, reload } = useStudioData();

  const { isPlaying, isLoading, volume, togglePlay, changeVolume } = useAudioPlayer(
    data.activeTrack,
    data.config.playerEnabled,
    data.config.defaultVolume
  );

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string, hash?: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setPathname(path);
    }
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const featuredHeroUrl = data.story[0]?.photoUrl || DEFAULT_HERO_IMG;
  const sanctuaryUrl = data.story[2]?.photoUrl || DEFAULT_SANCTUARY_IMG;

  if (pathname.startsWith('/admin')) {
    return <AdminPage onNavigate={navigate} onStudioMutated={reload} />;
  }

  if (pathname === '/privacidade') {
    return (
      <>
        <Navbar currentPath={pathname} onNavigate={navigate} />
        <LegalPage mode="privacidade" config={data.config} onNavigate={navigate} />
        <FloatingControls
          config={data.config}
          activeTrack={data.activeTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          volume={volume}
          onTogglePlay={togglePlay}
          onVolumeChange={changeVolume}
        />
      </>
    );
  }

  if (pathname === '/termos') {
    return (
      <>
        <Navbar currentPath={pathname} onNavigate={navigate} />
        <LegalPage mode="termos" config={data.config} onNavigate={navigate} />
        <FloatingControls
          config={data.config}
          activeTrack={data.activeTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          volume={volume}
          onTogglePlay={togglePlay}
          onVolumeChange={changeVolume}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Navbar currentPath={pathname} onNavigate={navigate} />

      <main>
        <HeroSection config={data.config} featuredImageUrl={featuredHeroUrl} />

        <StoryCarousel
          title={data.config.storyTitle}
          closingQuote={data.config.storyClosingQuote}
          chapters={data.story}
        />

        <PortfolioSection
          items={data.gallery}
          columns={data.config.galleryColumns}
        />

        <AboutAndPillars config={data.config} sanctuaryImageUrl={sanctuaryUrl} />

        <BookingSection config={data.config} onNavigate={navigate} />
      </main>

      <ContactAndFooter config={data.config} onNavigate={navigate} />

      <FloatingControls
        config={data.config}
        activeTrack={data.activeTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        volume={volume}
        onTogglePlay={togglePlay}
        onVolumeChange={changeVolume}
      />
    </div>
  );
}
