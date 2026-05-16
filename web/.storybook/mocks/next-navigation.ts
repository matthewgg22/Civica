// Minimal next/navigation stub for Storybook.
import { fn } from "@storybook/test";

export const useRouter = () => ({
  push: fn(),
  replace: fn(),
  refresh: fn(),
  back: fn(),
  forward: fn(),
  prefetch: fn(),
});

export const usePathname = () => "/en/app/questions";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = fn();
