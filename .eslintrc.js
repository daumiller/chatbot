// double quote strings - easier to tell difference between literal and interpolation
// no spacing before type specifier
// always semicolon
// all conditional blocks require curlies
// ClassNames, functionNames, variable_names

module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: [
      "@typescript-eslint",
    ],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",

    ],
    rules: {
        // https://eslint.org/docs/rules/
        "quotes": ["error", "double", { allowTemplateLiterals:true }],
        "no-prototype-builtins": "off",
        "no-unused-vars": ["error", { vars:"all", args:"none" }],
        // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin/docs/rules
        "@typescript-eslint/type-annotation-spacing": ["error", { before:false, after:false }],
        "@typescript-eslint/camelcase"          : "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-explicit-any"    : "off",
        "@typescript-eslint/no-unused-vars": ["error", { vars:"all", args:"none" }],
    },
};
