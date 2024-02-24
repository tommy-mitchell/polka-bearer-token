import * as tsd from "tsd";
import type { Middleware, Request, Response } from "polka"; // eslint-disable-line import/no-extraneous-dependencies
import bearerToken, { type BearerTokenOptions } from "../src/index.js";

tsd.expectType<Middleware>(bearerToken());
tsd.expectType<Middleware>(bearerToken({}));
tsd.expectType<Middleware>(bearerToken({
	bodyKey: "my_token",
	queryKey: "my_token",
	headerKey: "my_auth",
}));

const middleware = bearerToken();

declare const req: Request;
declare const res: Response;

await middleware(req, res, () => {
	tsd.expectType<string | undefined>(req.token);
});

tsd.expectAssignable<BearerTokenOptions>({ cookie: false });
tsd.expectAssignable<BearerTokenOptions>({ cookie: true });

tsd.expectAssignable<BearerTokenOptions>({
	cookie: { key: "my_token" },
});

tsd.expectAssignable<BearerTokenOptions>({
	cookie: {
		key: "my_token",
		secret: "SUPER_SECRET",
	},
});
