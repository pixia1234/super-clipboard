import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

const extractRules = (config) => {
  if (!config) {
    return {};
  }

  if (Array.isArray(config)) {
    return config.reduce(
      (rules, item) => ({
        ...rules,
        ...(item?.rules ?? {})
      }),
      {}
    );
  }

  return config.rules ?? {};
};

const tsRecommendedRules = extractRules(tseslint.configs?.recommended);

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        URL: "readonly",
        File: "readonly",
        FileReader: "readonly",
        HTMLInputElement: "readonly",
        console: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks
    },
    rules: {
      ...tsRecommendedRules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "no-undef": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
