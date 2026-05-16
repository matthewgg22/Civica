type Props = { message: string };

export function DisclaimerBanner({ message }: Props) {
  return (
    <div
      role="note"
      aria-label="Disclaimer"
      className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 border-b border-amber-200"
    >
      {message}
    </div>
  );
}
