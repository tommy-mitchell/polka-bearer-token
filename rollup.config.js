import { defineConfig } from "rollup";
import dts from "rollup-plugin-dts";

export default defineConfig({
	input: "src/index.ts",
	output: {
		file: "dist/index.d.ts",
		format: "es",
	},
	external: "polka",
	plugins: [
		dts({ respectExternal: true }),
	],
});
