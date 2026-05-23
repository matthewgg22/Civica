import Link from "next/link";
import type { Metadata } from "next";
import CountyExposurePanel from "../../../components/compliance/CountyExposurePanel";
import { getCountyDemoData, listDemoCounties } from "../../../lib/countyDemoExposure";
import type { CountyDemoData } from "../../../lib/countyDemoExposure";

export const dynamic = "force-static";
export const revalidate = 3600; // 1h — these are static estimates, no per-request data

type RouteParams = { county: string };

// Pre-render all supported county slugs at build time so the CDN serves
// static HTML. Unknown slugs fall through to the 404-style "not found" UI.
export async function generateStaticParams(): Promise<RouteParams[]> {
  const { listDemoCounties: list } = await import("../../../lib/countyDemoExposure");
  return list().map((c) => ({ county: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<RouteParams> },
): Promise<Metadata> {
  const { county } = await params;
  const data = getCountyDemoData(county);
  if (!data) {
    return {
      title: "County demo · Civica",
      description: "SNAP §10102 / §10105 exposure estimate by California county.",
    };
  }
  return {
    title: `${data.displayName} · OBBBA exposure · Civica`,
    description: `Estimated §10105 penalty exposure for ${data.displayName}: ${data.estimatedExposureLabel}. ${data.ageGapLabel} residents newly in §10102 ABAWD scope.`,
  };
}

export default async function CountyDemoPage({ params }: { params: Promise<RouteParams> }) {
  const { county } = await params;
  const data = getCountyDemoData(county);
  const supported = listDemoCounties();

  if (!data) {
    return (
      <div className="min-h-screen bg-paper">
        <main className="max-w-3xl mx-auto px-8 py-16">
          <p className="eyebrow mb-2">County not found</p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">
            We don't have an exposure estimate for "{county}" yet.
          </h1>
          <p className="text-[15px] text-graphite mt-3 leading-relaxed">
            The county demo currently covers {supported.length} California counties — those with
            the highest §10102 / §10105 exposure or strongest CDSS proximity. We can run an
            estimate for any CA county in 24–48 hours on request.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={`mailto:hello@civica.app?subject=${encodeURIComponent(`County exposure estimate request: ${county}`)}`}
              className="px-5 py-2.5 bg-pine text-paper rounded-[4px] font-semibold text-[14px] hover:bg-pine-pressed transition-colors text-center"
            >
              Request an estimate
            </a>
            <Link
              href={`/county-demo/${supported[0]?.slug ?? "los-angeles"}`}
              className="px-5 py-2.5 bg-surface border border-hairline text-ink rounded-[4px] font-semibold text-[14px] hover:bg-paper transition-colors text-center"
            >
              View {supported[0]?.displayName ?? "Los Angeles County"} instead
            </Link>
          </div>
          <CountyDirectory current={null} supported={supported} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <main className="max-w-5xl mx-auto px-8 py-10">
        <CountyExposurePanel county={data} />
        <CountyDirectory current={data.slug} supported={supported} />
        <Footer />
      </main>
    </div>
  );
}

function CountyDirectory({
  current,
  supported,
}: {
  current: string | null;
  supported: CountyDemoData[];
}) {
  const others = supported.filter((c) => c.slug !== current);
  if (others.length === 0) return null;
  return (
    <section className="mt-10 pt-6 border-t border-hairline">
      <p className="eyebrow mb-3">Other counties in this demo</p>
      <div className="flex flex-wrap gap-2">
        {others.map((c) => (
          <Link
            key={c.slug}
            href={`/county-demo/${c.slug}`}
            className="px-3 py-1.5 bg-surface border border-hairline rounded-[3px] text-[13px] font-semibold text-ink hover:border-pine hover:text-pine transition-colors"
          >
            {c.displayName} · {c.estimatedExposureLabel}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-10 pt-6 border-t border-hairline text-[12px] text-graphite leading-relaxed">
      <p>
        Civica is AI compliance infrastructure for SNAP, built for the OBBBA penalty
        window. This is a pre-pilot estimate page; production figures will use county FNS
        QC data (FOIA pending) once received.
      </p>
      <p className="mt-2">
        Sources: CDSS DSS-8202 monthly reports, FNS QC Annual Reports, ACS 5-year
        estimates, OBBBA §10102 / §10105 statutory text. Methodology disclosed above.
      </p>
    </footer>
  );
}
