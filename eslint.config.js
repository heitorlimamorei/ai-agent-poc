import js from "@eslint/js";
import tseslint from "typescript-eslint";

const tsFiles = ["**/*.ts", "**/*.tsx"];
const scopeToTsFiles = (configs) => configs.map((config) => ({ ...config, files: tsFiles }));

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "bun.lock"],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
  },
  ...scopeToTsFiles(tseslint.configs.strictTypeChecked),
  ...scopeToTsFiles(tseslint.configs.stylisticTypeChecked),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: false,
        },
      ],
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowAny: false,
          allowNullableBoolean: false,
          allowNullableEnum: false,
          allowNullableNumber: false,
          allowNullableObject: false,
          allowNullableString: false,
          allowNumber: false,
          allowString: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
);
