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
      className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600"
      aria-label={privacyLabel}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2">
        <a
          href={`/${locale}/privacy`}
          className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
        >
          {privacyLabel}
        </a>
        <a
          href={`/${locale}/privacy#do-not-sell`}
          className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
        >
          {doNotSellLabel}
        </a>
      </div>
    </footer>
  );
}
