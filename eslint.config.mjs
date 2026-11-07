import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "infra/cdk.out/**", "infra/node_modules/**", ".data/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  security.configs.recommended,
  {
    rules: {
      // Object-injection warnings are noisy for typed record lookups; the
      // data we index with is validated by zod or is a compile-time key.
      "security/detect-object-injection": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  { files: ["scripts/**", "tests/**"], rules: { "no-console": "off", "security/detect-non-literal-fs-filename": "off", "security/detect-non-literal-regexp": "off" } },
];

export default config;
