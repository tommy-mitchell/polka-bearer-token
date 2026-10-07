import * as configs from "@tommy-mitchell/configs/xo";

/** @type {import("xo").FlatXoConfig} */
export default [...configs.xo, ...configs.dprint, { ignores: "test-d" }, {
	rules: {
		"unicorn/prefer-type-literal-last": "off",
	},
}];
