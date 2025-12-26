import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Brain, FileText, BarChart3, Calculator, PenTool } from 'lucide-react';

const Index = () => {
  const { t, i18n } = useTranslation();
  const isRTL = ['fa', 'ar'].includes(i18n.language);

  const features = [
    { icon: Search, title: t('home.features.search'), desc: t('home.features.searchDesc') },
    { icon: Brain, title: t('home.features.ai'), desc: t('home.features.aiDesc') },
    { icon: FileText, title: t('home.features.systematic'), desc: t('home.features.systematicDesc') },
    { icon: BarChart3, title: t('home.features.meta'), desc: t('home.features.metaDesc') },
    { icon: Calculator, title: t('home.features.sample'), desc: t('home.features.sampleDesc') },
    { icon: PenTool, title: t('home.features.proposal'), desc: t('home.features.proposalDesc') },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('app.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('app.subtitle')}</p>
            </div>
          </div>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border"
          >
            <option value="en">English</option>
            <option value="fa">فارسی</option>
            <option value="ar">العربية</option>
            <option value="tr">Türkçe</option>
          </select>
        </div>
      </header>

      <section className="bg-sidebar text-sidebar-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('home.welcome')}</h2>
          <p className="text-lg md:text-xl opacity-90 max-w-3xl mx-auto mb-8">{t('home.description')}</p>
          <Button size="lg" className="bg-secondary text-secondary-foreground">{t('home.getStarted')}</Button>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>Research Copilot - Powered by Lovable AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
