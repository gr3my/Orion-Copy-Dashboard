import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Mount-time data fetching via effects is the intended pattern for this
      // dashboard's client pages; keep it as a warning, not a build blocker.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/", "out/", "build/", "next-env.d.ts"]),
]);

export default eslintConfig;
