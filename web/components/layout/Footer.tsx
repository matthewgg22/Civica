// Footer rendered at the bottom of every page in the [locale] tree.
// Required by CCPA §1798.135: the "Do Not Sell or Share My Personal
// Information" link must appear on any internet property where
// personal information is collected. Civica does not sell personal
// information, but the link is still required — it routes to the
// privacy page anchor that documents the disclosure.

type Props = {
  locale: string;
  privacyLabel: string;
  doNotSellLabel: string;
};

export function Footer({ locale, privacyLabel, doNotSellLabel }: Props) {
  return (
    <footer
      className="border-t border-hairline px-4 py-4 text-sm text-graphite"
      aria-label={privacyLabel}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2">
        <a
          href={`/${locale}/privacy`}
          className="underline decoration-hairline underline-offset-2 hover:text-ink"
        >
          {privacyLabel}
        </a>
        <a
          href={`/${locale}/privacy#do-not-sell`}
          className="underline decoration-hairline underline-offset-2 hover:text-ink"
        >
          {doNotSellLabel}
        </a>
      </div>
    </footer>
  );
}
