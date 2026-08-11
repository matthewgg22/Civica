// apps/web has declared `"lint": "eslint"` and depended on eslint@9 +
// eslint-config-next for a long time, with no flat config to run against — so
// the script exited 2 before reading a single file and this app has never been
// linted (#695). CI never ran it either, and `next build` does not lint in
// Next 16, so the only way to notice was to type `pnpm lint` by hand.
//
// Mirrors apps/dashboard/eslint.config.mjs deliberately. That app is PARKED, so
// this is a copy rather than a shared import: matching it means the two Next
// apps fail the same way on the same mistakes, without this file taking a
// dependency on a directory nobody is allowed to touch.
//
// packages/config/eslint.config.mjs is the OTHER house config — plain
// typescript-eslint for non-Next packages. Not used here: it has no React or
// Next plugin, so it would miss the client/server boundary and hook-dependency
// rules that are the actual reason to lint this app.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // OFF, deliberately, after reading all 22 sites it flagged.
      //
      // Every one is the same shape:
      //
      //   const [locale, setLocale] = useState("en");
      //   useEffect(() => { setLocale(localStorage.getItem(KEY)) }, []);
      //
      // That is not a mistake, it is the ONLY correct way to hydrate from a
      // browser-only API in an app that server-renders. localStorage and
      // window.location do not exist on the server, so they cannot be read
      // during render or in a useState initializer — doing so either crashes
      // the server render or produces markup that disagrees with the client's,
      // which is a hydration error. React's own docs point at an effect for
      // exactly this case.
      //
      // The rule is right that this costs a second render. It has no option to
      // permit the mount-only form, so the choice is: turn it off, or add 22
      // inline disables that say the same thing 22 times, or "fix" 22 correct
      // components into hydration bugs. Off, with this note.
      //
      // What we give up: it would have caught a genuine setState-during-effect
      // cascade in NEW code. If that bites, the answer is a narrower custom
      // rule (allow `useEffect(fn, [])`, flag the rest), not re-enabling this
      // one and re-disabling it in 22 files.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    // eslint-config-next's own defaults, restated because listing any ignores
    // replaces them.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright writes traces and error-context markdown here on failure.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
