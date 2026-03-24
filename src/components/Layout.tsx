import { ReactNode, useState, useEffect } from 'react';
import { LogIn, LogOut, Menu, X, MapPin, Phone, Mail, ChevronRight, Instagram, Facebook, Linkedin } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Ticker } from './Ticker';
import { WhatsAppButton } from './WhatsAppButton';
import { ScrollToTop } from './ScrollToTop';

export function Layout({ children, user, onLogin, onLogout, onNavigate, settings }: { children: ReactNode, user: any, onLogin: () => void, onLogout: () => void, onNavigate: (path: string) => void, settings: any }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      // Update document title
      if (settings.siteTitle) {
        document.title = settings.siteTitle;
      }
      
      // Apply theme palette
      const palettes: Record<string, any> = {
        emerald: { primary: '#10b981', dark: '#059669', light: '#34d399' },
        blue: { primary: '#2563eb', dark: '#1d4ed8', light: '#60a5fa' },
        amber: { primary: '#d97706', dark: '#b45309', light: '#fbbf24' },
        tjgold: { primary: '#000000', dark: '#000000', light: '#D4AF37' },
        slate: { primary: '#334155', dark: '#1e293b', light: '#64748b' },
        violet: { primary: '#7c3aed', dark: '#6d28d9', light: '#a78bfa' },
        red: { primary: '#991b1b', dark: '#7f1d1d', light: '#ef4444' },
      };
      
      const palette = palettes[settings.themePalette || 'emerald'] || palettes.emerald;
      document.documentElement.style.setProperty('--primary-color', palette.primary);
      document.documentElement.style.setProperty('--primary-dark-color', palette.dark);
      document.documentElement.style.setProperty('--primary-light-color', palette.light);

      // Apply Header Style
      const headerStyles: Record<string, any> = {
        light: { bg: '#f5f5f4', text: '#44403c', border: '#e7e5e4', backdrop: 'none' },
        dark: { bg: 'radial-gradient(circle at 50% 0%, #1c1917 0%, #0c0a09 100%)', text: '#d6d3d1', border: '#292524', backdrop: 'none' },
        'glass-light': { bg: 'rgba(255, 255, 255, 0.7)', text: '#1c1917', border: 'rgba(255, 255, 255, 0.3)', backdrop: 'blur(12px)' },
        'glass-dark': { bg: 'rgba(12, 10, 9, 0.7)', text: '#d6d3d1', border: 'rgba(255, 255, 255, 0.1)', backdrop: 'blur(12px)' },
        primary: { bg: palette.primary, text: '#ffffff', border: palette.dark, backdrop: 'none' },
        accent: { bg: palette.light, text: palette.primary, border: palette.primary, backdrop: 'none' },
      };
      const hStyle = headerStyles[settings.headerStyle || 'light'] || headerStyles.light;
      document.documentElement.style.setProperty('--header-bg', hStyle.bg);
      document.documentElement.style.setProperty('--header-text', hStyle.text);
      document.documentElement.style.setProperty('--header-border', hStyle.border);
      document.documentElement.style.setProperty('--header-backdrop', hStyle.backdrop);

      // Apply Background Style
      const bgStyles: Record<string, any> = {
        light: { bg: '#fafaf9' },
        dark: { bg: 'radial-gradient(circle at 50% 50%, #1c1917 0%, #0c0a09 100%)' },
        primary: { bg: palette.primary },
        accent: { bg: palette.light },
      };
      const bStyle = bgStyles[settings.backgroundStyle || 'light'] || bgStyles.light;
      document.documentElement.style.setProperty('--body-bg', bStyle.bg);

      // Apply Typography
      const typographyStyles: Record<string, string> = {
        default: '"Inter", ui-sans-serif, system-ui, sans-serif',
        editorial: '"Lora", ui-serif, Georgia, serif',
        modern: '"Outfit", ui-sans-serif, system-ui, sans-serif',
        elegant: '"Playfair Display", ui-serif, Georgia, serif',
      };
      const font = typographyStyles[settings.typography || 'default'] || typographyStyles.default;
      document.documentElement.style.setProperty('--font-family-sans', font);
      document.documentElement.style.setProperty('--font-family-display', font);
    }
  }, [settings]);

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col grain-overlay" style={{ background: 'var(--body-bg, #fafaf9)', backgroundAttachment: 'fixed' }}>
      <header 
        className="sticky top-0 z-50 shadow-sm transition-all duration-300 grain-overlay overflow-hidden"
        style={{ 
          background: settings?.headerBackgroundImage ? `url(${settings.headerBackgroundImage}) center/cover no-repeat` : 'var(--header-bg, #f5f5f4)', 
          color: settings?.headerBackgroundImage ? '#ffffff' : 'var(--header-text, #44403c)',
          borderBottom: '1px solid var(--header-border, #e7e5e4)',
          backdropFilter: 'var(--header-backdrop, none)',
          WebkitBackdropFilter: 'var(--header-backdrop, none)'
        }}
      >
        {settings?.headerBackgroundImage && (
          <div 
            className="absolute inset-0 bg-black pointer-events-none" 
            style={{ opacity: settings.headerOverlayOpacity || 0.5 }}
          ></div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center relative z-10">
          {!settings?.hideLogoTop && (
            settings?.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt="TJ INVEST" 
                className="h-16 md:h-24 w-auto object-contain cursor-pointer" 
                onClick={() => handleNavigate('/')}
              />
            ) : (
              <div 
                className="h-16 md:h-24 flex items-center justify-center font-bold text-2xl cursor-pointer"
                style={{ color: 'var(--primary-dark-color, #059669)' }}
                onClick={() => handleNavigate('/')}
              >
                TJ INVEST
              </div>
            )
          )}
          
          {/* Desktop Menu */}
            <nav className="hidden md:flex gap-8 items-center font-medium" style={{ color: 'inherit' }}>
            <button onClick={() => handleNavigate('/')} className="hover:text-primary transition">Início</button>
            <button onClick={() => handleNavigate('/')} className="hover:text-primary transition">Leilões</button>
            <button onClick={() => handleNavigate('/leiloeiros')} className="hover:text-primary transition">Leiloeiros</button>
            <button onClick={() => handleNavigate('/blog')} className="hover:text-primary transition">Blog</button>
            <button onClick={() => handleNavigate('/sobre')} className="hover:text-primary transition">Sobre</button>
            <a href={`https://wa.me/${(settings.phone || '5531973590970').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">Contato</a>
            {user?.email === 'tjinvestoficial@gmail.com' && (
              <>
                <button onClick={() => handleNavigate('/admin/discovery')} className="hover:text-primary transition">Discovery</button>
                <button onClick={() => handleNavigate('/admin')} className="hover:text-primary transition">Admin</button>
              </>
            )}
            {user && (
              <button onClick={onLogout} className="text-red-500 hover:text-red-700 transition"><LogOut size={20} /></button>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2"
            style={{ color: 'inherit' }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden border-t px-4 py-4 flex flex-col gap-4 font-medium shadow-inner transition-colors duration-300 relative z-20"
            style={{ 
              backgroundColor: settings?.headerBackgroundImage ? 'rgba(0,0,0,0.85)' : 'var(--header-bg, #f5f5f4)', 
              color: settings?.headerBackgroundImage ? '#ffffff' : 'var(--header-text, #44403c)',
              borderTopColor: 'var(--header-border, #e7e5e4)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
          >
            <button onClick={() => handleNavigate('/')} className="text-left py-2 hover:text-primary transition">Início</button>
            <button onClick={() => handleNavigate('/')} className="text-left py-2 hover:text-primary transition">Leilões</button>
            <button onClick={() => handleNavigate('/leiloeiros')} className="text-left py-2 hover:text-primary transition">Leiloeiros</button>
            <button onClick={() => handleNavigate('/blog')} className="text-left py-2 hover:text-primary transition">Blog</button>
            <button onClick={() => handleNavigate('/sobre')} className="text-left py-2 hover:text-primary transition">Sobre</button>
            <a href={`https://wa.me/${(settings.phone || '5531973590970').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-left py-2 hover:text-primary transition block">Contato</a>
            {user?.email === 'tjinvestoficial@gmail.com' && (
              <>
                <button onClick={() => handleNavigate('/admin/discovery')} className="text-left py-2 hover:text-primary transition">Discovery</button>
                <button onClick={() => handleNavigate('/admin')} className="text-left py-2 hover:text-primary transition">Admin</button>
              </>
            )}
            {user && (
              <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-left py-2 text-red-500 hover:text-red-700 transition flex items-center gap-2"><LogOut size={20} /> Sair</button>
            )}
          </div>
        )}
      </header>
      
      {settings.showTicker !== false && (
        <div className="relative z-10">
          <Ticker items={settings.tickerItems} />
        </div>
      )}

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8 relative z-10">
        <div key={window.location.pathname}>
          {children}
        </div>
      </main>

      <div className="relative z-50">
        <WhatsAppButton phone={settings.phone || '5531973590970'} />
        <ScrollToTop />
      </div>

      <footer className="bg-stone-950 text-stone-400 pt-16 pb-8 border-t border-stone-900 grain-overlay">
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
            
            {/* Brand Column */}
            <div className="md:col-span-5">
              {!settings?.hideLogoFooter && (
                <div 
                  className="bg-white inline-block p-3 rounded-2xl mb-6 cursor-pointer"
                  onClick={() => onNavigate('/')}
                >
                  {settings?.logoUrl ? (
                    <img 
                      src={settings.logoUrl} 
                      alt="TJ INVEST" 
                      className="h-12 w-auto object-contain" 
                      width="133" 
                      height="64" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 flex items-center justify-center font-bold text-xl text-primary-dark">
                      TJ INVEST
                    </div>
                  )}
                </div>
              )}
              <p className="text-stone-400 leading-relaxed max-w-md text-sm">
                Especialistas em leilões de imóveis, oferecendo as melhores oportunidades do mercado com total segurança jurídica, transparência e alta rentabilidade para seus investimentos.
              </p>
              <div className="flex gap-4 mt-6">
                {settings?.instagram && (
                  <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 hover:bg-primary hover:text-white transition-all duration-300">
                    <Instagram size={18} />
                  </a>
                )}
                {settings?.facebook && (
                  <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 hover:bg-primary hover:text-white transition-all duration-300">
                    <Facebook size={18} />
                  </a>
                )}
                {settings?.linkedin && (
                  <a href={settings.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 hover:bg-primary hover:text-white transition-all duration-300">
                    <Linkedin size={18} />
                  </a>
                )}
              </div>
            </div>

            {/* Links Column */}
            <div className="md:col-span-3">
              <h4 className="text-white font-bold text-lg mb-6">Links Rápidos</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => onNavigate('/')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Início
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Leilões em Destaque
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/leiloeiros')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Leiloeiros Confiáveis
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/blog')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Blog & Notícias
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/sobre')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Sobre Nós
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/faq')} className="flex items-center gap-2 text-sm hover:text-primary-light transition-colors group">
                    <ChevronRight size={14} className="text-stone-600 group-hover:text-primary-light transition-colors" />
                    Perguntas Frequentes
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="md:col-span-4">
              <h4 className="text-white font-bold text-lg mb-6">Fale Conosco</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm">
                  <div className="mt-1 w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0 text-primary">
                    <MapPin size={14} />
                  </div>
                  <span className="leading-relaxed pt-1">{settings.address}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0 text-primary">
                    <Phone size={14} />
                  </div>
                  <a href={`https://wa.me/${(settings.phone || '5531973590970').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-light transition-colors pt-1">
                    {settings.phone}
                  </a>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0 text-primary">
                    <Mail size={14} />
                  </div>
                  <a href={`mailto:${settings.email}`} className="hover:text-primary-light transition-colors pt-1">
                    {settings.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-stone-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-stone-500 text-xs">
            <div className="flex items-center gap-4 order-2 md:order-1">
              {!user && (
                <button onClick={onLogin} className="opacity-40 hover:opacity-100 transition-opacity p-2" title="Área Restrita">
                  <LogIn size={14} />
                </button>
              )}
              <p>&copy; {new Date().getFullYear()} TJ INVEST. Todos os direitos reservados.</p>
            </div>
            <div className="order-1 md:order-2 mb-4 md:mb-0">
              {/* Espaço para outros links se necessário */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
