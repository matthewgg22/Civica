"use client";

// The animated, scroll-driven hero. This is the ONLY module on the page that
// imports `motion`, so dynamic-importing it (see why-civica/page.tsx) keeps
// framer-motion out of the initial bundle — the page shell paints first.
// Users with prefers-reduced-motion get the motion-free StaticGeminiHero.

import React from "react";
import { useScroll, useSpring, useTransform, useReducedMotion } from "motion/react";
import { GoogleGeminiEffect } from "./ui/google-gemini-effect";
import { StaticGeminiHero } from "./StaticGeminiHero";

export default function WhyCivicaHero() {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Smooth the raw scroll so the lines grow gradually instead of jumping.
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  // All 5 paths START undrawn and grow to full, staggered into a gentle cascade.
  const p1 = useTransform(progress, [0.0, 0.6], [0, 1]);
  const p2 = useTransform(progress, [0.03, 0.63], [0, 1]);
  const p3 = useTransform(progress, [0.06, 0.66], [0, 1]);
  const p4 = useTransform(progress, [0.09, 0.69], [0, 1]);
  const p5 = useTransform(progress, [0.12, 0.72], [0, 1]);

  const phoneOpacity = useTransform(progress, [0.34, 0.46], [0, 1]);
  const mSubmit = useTransform(progress, [0.6, 0.7], [0, 1]);
  const mInterview = useTransform(progress, [0.74, 0.84], [0, 1]);
  const mBenefits = useTransform(progress, [0.88, 0.97], [0, 1]);

  // Respect the OS reduced-motion setting: clean static diagram, no rAF.
  if (reduceMotion) {
    return <StaticGeminiHero />;
  }

  return (
    <div className="why-gemini-scroll" ref={ref}>
      <div className="why-gemini-sticky">
        <div className="container why-gemini-copy">
          <p className="eyebrow">Why Civica</p>
          <h1 className="why-gemini-headline">
            The rules are complicated.
            <br />
            Your application shouldn&rsquo;t be.
          </h1>
          <p className="why-gemini-sub">
            SNAP eligibility depends on income, household size, and rules that vary
            state&nbsp;by&nbsp;state. Civica walks you through every question — so you
            arrive at your application confident in every answer.
          </p>
        </div>

        <GoogleGeminiEffect
          pathLengths={[p1, p2, p3, p4, p5]}
          phoneOpacity={phoneOpacity}
          milestoneOpacities={[mSubmit, mInterview, mBenefits]}
        />

        <div className="why-gemini-scroll-hint" aria-hidden="true">
          <span>Scroll to explore</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 2v10M3 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
