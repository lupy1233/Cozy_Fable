import { useTranslations } from 'next-intl';
import { PencilLine, Hammer, Scale } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tn = useTranslations('Nav');

  const metrics = [
    { value: t('metricWorkshops'), label: t('metricWorkshopsLabel') },
    { value: t('metricProjects'), label: t('metricProjectsLabel') },
    { value: t('metricSatisfaction'), label: t('metricSatisfactionLabel') },
  ];

  const steps = [
    { icon: PencilLine, title: t('step1Title'), body: t('step1Body') },
    { icon: Hammer, title: t('step2Title'), body: t('step2Body') },
    { icon: Scale, title: t('step3Title'), body: t('step3Body') },
  ];

  const sizes = [
    { name: t('sizeSmall'), desc: t('sizeSmallDesc'), credits: 1 },
    { name: t('sizeMedium'), desc: t('sizeMediumDesc'), credits: 2 },
    { name: t('sizeLarge'), desc: t('sizeLargeDesc'), credits: 4 },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-foreground to-ink-2 font-serif text-lg italic text-background shadow-sm">
            P
          </span>
          <span className="font-serif text-xl leading-none tracking-[-0.02em]">Plan</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{tn('login')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">{tn('register')}</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="flex flex-col items-center gap-6 py-20 text-center">
          <span className="label">{t('kicker')}</span>
          <h1 className="page-title max-w-3xl">{t('title')}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="walnut" size="lg">
              <Link href="/requests/new">{t('ctaNewRequest')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register?role=company">{t('ctaCompanies')}</Link>
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-8 border-t border-border pt-8">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="font-serif text-3xl tracking-[-0.02em]">{m.value}</div>
                <div className="label mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border py-16">
          <h2 className="serif mb-8 text-center text-3xl">{t('howTitle')}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-walnut-soft text-walnut">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-2">0{i + 1}</span>
                </div>
                <h3 className="mb-1.5 font-serif text-xl">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sizing */}
        <section className="border-t border-border py-16">
          <div className="mb-8 text-center">
            <h2 className="serif text-3xl">{t('sizingTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('sizingSub')}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {sizes.map((s) => (
              <div key={s.name} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-2xl">{s.name}</span>
                  <span className="rounded-full bg-walnut-soft px-2.5 py-0.5 font-mono text-[11px] text-walnut">
                    {s.credits} {t('creditsUnit')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="my-16 overflow-hidden rounded-2xl bg-gradient-to-br from-foreground to-ink-2 px-8 py-12 text-background shadow-lg">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <h2 className="font-serif text-3xl">{t('ctaBandTitle')}</h2>
            <p className="text-background/75">{t('ctaBandBody')}</p>
            <Button asChild variant="walnut" size="lg">
              <Link href="/register?role=company">{t('ctaBandButton')}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
