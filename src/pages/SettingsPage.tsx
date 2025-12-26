import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Monitor, Globe } from 'lucide-react';
import { Layout } from '@/components/Layout';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = ['fa', 'ar'].includes(i18n.language);

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [apiDelay, setApiDelay] = useState(1);
  const [maxArticles, setMaxArticles] = useState(50);
  const [autoSave, setAutoSave] = useState(true);

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    const root = document.documentElement;
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">Customize your Research Copilot experience</p>
        </div>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('settings.language')}
            </CardTitle>
            <CardDescription>Choose your preferred language</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {languages.map(lang => (
                <Button
                  key={lang.code}
                  variant={i18n.language === lang.code ? 'default' : 'outline'}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  className="justify-start"
                >
                  <span className="font-medium">{lang.nativeName}</span>
                  <span className="text-xs opacity-70 ml-2">({lang.name})</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.theme')}</CardTitle>
            <CardDescription>Choose your preferred color scheme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => applyTheme('light')}
                className="flex-col h-20 gap-2"
              >
                <Sun className="w-5 h-5" />
                <span>{t('settings.light')}</span>
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => applyTheme('dark')}
                className="flex-col h-20 gap-2"
              >
                <Moon className="w-5 h-5" />
                <span>{t('settings.dark')}</span>
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => applyTheme('system')}
                className="flex-col h-20 gap-2"
              >
                <Monitor className="w-5 h-5" />
                <span>{t('settings.system')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Settings */}
        <Card>
          <CardHeader>
            <CardTitle>API Settings</CardTitle>
            <CardDescription>Configure API rate limiting and search parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('settings.delay')}</Label>
                <span className="text-sm text-muted-foreground">{apiDelay}s</span>
              </div>
              <Slider
                value={[apiDelay]}
                onValueChange={([v]) => setApiDelay(v)}
                min={0.5}
                max={3}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Delay between API calls to avoid rate limits
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('settings.maxArticles')}</Label>
                <span className="text-sm text-muted-foreground">{maxArticles}</span>
              </div>
              <Slider
                value={[maxArticles]}
                onValueChange={([v]) => setMaxArticles(v)}
                min={10}
                max={100}
                step={10}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-save to Library</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save search results to your library
                </p>
              </div>
              <Switch checked={autoSave} onCheckedChange={setAutoSave} />
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About Research Copilot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Version: 1.0.0</p>
            <p>Powered by Lovable AI</p>
            <p className="pt-2">
              Research Copilot is an AI-powered research assistant that helps you search, 
              analyze, and synthesize academic literature. It supports systematic reviews, 
              meta-analysis, and proposal writing.
            </p>
            <div className="pt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://docs.lovable.dev" target="_blank" rel="noopener noreferrer">
                  Documentation
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
