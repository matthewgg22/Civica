// Real Civica iOS app screenshot inside an iPhone 16 Pro-style frame.
// The screenshot already includes iOS chrome (status bar, nav bar).
// The CSS frame provides the phone body, dynamic island, side buttons.
export function PhoneMockup() {
  return (
    <div className="iphone">
      <div className="iphone__btn iphone__btn--vol-up" />
      <div className="iphone__btn iphone__btn--vol-dn" />
      <div className="iphone__btn iphone__btn--power" />
      <div className="iphone__bezel">
        {/* Dynamic island sits on top of the screenshot */}
        <div className="iphone__island" />
        <img
          src="/civica-ios-screenshot.png"
          alt="Civica iOS app — Apply for SNAP"
          className="iphone__screenshot"
          width={390}
          height={844}
        />
        <div className="iphone__home-indicator" />
      </div>
    </div>
  );
}
