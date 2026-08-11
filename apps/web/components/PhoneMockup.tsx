// Real Civica iOS app screenshot inside an iPhone 16 Pro-style CSS frame.
// Screenshot includes the real iOS dynamic island — no CSS island overlay.
import Image from "next/image";

export function PhoneMockup() {
  return (
    <div className="iphone">
      <div className="iphone__btn iphone__btn--vol-up" />
      <div className="iphone__btn iphone__btn--vol-dn" />
      <div className="iphone__btn iphone__btn--power" />
      <div className="iphone__bezel">
        {/* 1206×2622 source, displayed a few hundred px wide. This is the one
            place the image optimizer earns its keep on this site. */}
        <Image
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
