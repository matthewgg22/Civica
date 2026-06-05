// Real Civica iOS app screenshot inside an iPhone 16 Pro-style CSS frame.
// Screenshot includes the real iOS dynamic island — no CSS island overlay.
export function PhoneMockup() {
  return (
    <div className="iphone">
      <div className="iphone__btn iphone__btn--vol-up" />
      <div className="iphone__btn iphone__btn--vol-dn" />
      <div className="iphone__btn iphone__btn--power" />
      <div className="iphone__bezel">
        <img
          src="/civica-ios-screenshot.png"
          alt="Civica iOS app — Apply for SNAP"
          className="iphone__screenshot"
          width={1206}
          height={2622}
        />
      </div>
    </div>
  );
}
