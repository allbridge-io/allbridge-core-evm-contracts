const globals = require("globals");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [
    ...compat.extends("plugin:prettier/recommended").map(config => ({
        ...config,
        files: ["**/*.ts"],
    })),
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, "off"])),
                ...globals.mocha,
                ...globals.node,
            },

            parser: tsParser,
            parserOptions: {
                ecmaVersion: 12,
                sourceType: "module",
            },
        },

        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        rules: {
            "prettier/prettier": 0,
            "no-lone-blocks": "off",
        },
    },
    {
        ignores: ["node_modules/", "artifacts/", "cache/", "coverage/"],
    }
];
