import nextVitals from "eslint-config-next/core-web-vitals";

/** ESLint 9 flat config (Next 16 removed `next lint`; run `npm run lint`). */
const config = [
  ...nextVitals,
  {
    // React Compiler rules new in eslint-config-next 16. They flag patterns the 15.x config accepted
    // (mostly setState inside effects that read localStorage). Warn until those are refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "backend/**", "graphify-out/**", "deploy/**", "next-env.d.ts"],
  },
];

export default config;
