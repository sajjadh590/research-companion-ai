import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Search, 
  Library, 
  FileText, 
  BarChart3, 
  Calculator, 
  PenTool, 
  Settings,
  Brain,
  Menu,
  X,
  LogIn,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const navigation = [
  { key: 'home', path: '/', icon: Home },
  { key: 'search', path: '/search', icon: Search },
  { key: 'library', path: '/library', icon: Library },
  { key: 'systematic', path: '/systematic-review', icon: FileText },
  { key: 'metaAnalysis', path: '/meta-analysis', icon: BarChart3 },
  { key: 'sampleSize', path: '/sample-size', icon: Calculator },
  { key: 'proposal', path: '/proposal', icon: PenTool },
  { key: 'settings', path: '/settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isRTL = ['fa', 'ar'].includes(i18n.language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col flex-1 overflow-y-auto scrollbar-thin">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">{t('app.title')}</h1>
              <p className="text-xs text-sidebar-foreground/60">{t('app.subtitle')}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(`nav.${item.key}`)}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Language Selector */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full bg-sidebar-accent text-sidebar-foreground rounded-lg px-3 py-2 text-sm border border-sidebar-border"
            >
              <option value="en">English</option>
              <option value="fa">فارسی</option>
              <option value="ar">العربية</option>
              <option value="tr">Türkçe</option>
            </select>
            
            {user ? (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                {t('auth.logout')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="w-4 h-4" />
                {t('auth.login')}
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">{t('app.title')}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="px-4 py-2 border-t border-border bg-card">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(`nav.${item.key}`)}</span>
                </NavLink>
              );
            })}
            <div className="py-2 space-y-2">
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border"
              >
                <option value="en">English</option>
                <option value="fa">فارسی</option>
                <option value="ar">العربية</option>
                <option value="tr">Türkçe</option>
              </select>
              
              {user ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  {t('auth.logout')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate('/auth')}
                >
                  <LogIn className="w-4 h-4" />
                  {t('auth.login')}
                </Button>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
