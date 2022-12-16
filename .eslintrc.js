module.exports = {
	env: {
		browser: false,
		es2021: true,
		mocha: true,
		node: true,
	},
	extends: ["standard", "plugin:prettier/recommended", "plugin:node/recommended"],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12,
	},
	plugins: ["import"],
	rules: {
		// turn on errors for missing imports
		"import/no-unresolved": "error",
	},
	settings: {
		"import/parsers": {
			"@typescript-eslint/parser": [".ts", ".tsx"],
		},
		"import/resolver": {
			typescript: {
				alwaysTryTypes: true,
			},
		},
	},
	overrides: [
		{
			files: ["hardhat.config.js"],
			globals: { task: true },
		},
		{
			files: ["scripts/**"],
			rules: { "no-process-exit": "off" },
		},
		{
			files: ["hardhat.config.js", "scripts/**", "test/**"],
			rules: { "node/no-unpublished-require": "off" },
		},
	],
}
