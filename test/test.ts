import test from "ava";
import cookie from "cookie-signature";
import polka, { type Request, type Response } from "polka";
import ky from "ky";
import getPort from "get-port";
import bearerToken, { type BearerTokenOptions } from "../src/index.js";

const token = "test-token";
const secret = "SUPER_SECRET";
const signedCookie = encodeURI(`s:${cookie.sign(token, secret)}`);

type MacroArgs = [{
	req?: Partial<Request>;
	res?: Partial<Response>;
	options?: BearerTokenOptions;
	expected?: string;
}];

const verify = test.macro<MacroArgs>((t, { req = {}, res = {}, options, expected = token }) => {
	const middleware = bearerToken(options);
	void middleware(req as Request, res as Response, () => {
		t.is(req.token, expected);
	});
});

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-empty-function */

test("body", verify, {
	req: {
		body: { access_token: token },
	},
});

test("body - custom", verify, {
	req: {
		body: { my_token: token },
	},
	options: {
		bodyKey: "my_token",
	},
});

test("query string", verify, {
	req: {
		query: { access_token: token },
	},
});

test("query string - custom", verify, {
	req: {
		query: { my_token: token },
	},
	options: {
		queryKey: "my_token",
	},
});

test("header", verify, {
	req: {
		headers: {
			authorization: `Bearer ${token}`,
		},
	},
});

test("header - case insensitive", verify, {
	req: {
		headers: {
			authorization: `bearer ${token}`,
		},
	},
});

test("header - custom", verify, {
	req: {
		headers: {
			authorization: `my_auth ${token}`,
		},
	},
	options: {
		headerKey: "my_auth",
	},
});

test("cookie parsing is disabled by default", verify, {
	req: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
	expected: "",
});

test("cookie", verify, {
	req: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
	options: { cookie: true },
});

test("cookie - custom", verify, {
	req: {
		headers: {
			cookie: `my_token=${token}; `,
		},
	},
	options: {
		cookie: { key: "my_token" },
	},
});

test("cookie - signed", verify, {
	req: {
		headers: {
			cookie: `access_token=${signedCookie}; `,
		},
	},
	options: {
		cookie: { signed: true, secret },
	},
});

test("cookie - signed - custom", verify, {
	req: {
		headers: {
			cookie: `my_token=${signedCookie}; `,
		},
	},
	options: {
		cookie: { key: "my_token", signed: true, secret },
	},
});

test("cookie - throws if signed but no secret", t => {
	// @ts-expect-error: expects secret
	t.throws(() => bearerToken({ cookie: { signed: true } }), {
		message: "[polka-bearer-token]: A secret token must be set when using signed cookies.",
	});
});

const locations = [
	{ body: { access_token: token } },
	{ query: { access_token: token } },
	{ headers: { authorization: `Bearer ${token}` } },
	{ headers: { cookie: `access_token=${token}; ` } },
] as const satisfies Array<Partial<Request>>;

const combinations = locations.flatMap((location, i) => {
	const rest = locations.slice(i + 1);
	return rest.map(other => ({ ...location, ...other }));
});

for (const req of combinations) {
	let [key1, key2] = Object.keys(req);

	if (!key1 || !key2) {
		continue;
	}

	if (key1 === "headers") {
		// @ts-expect-error: Object.keys doesn't type guard
		key1 = req.headers.authorization ? "header" : "cookie";
	}

	if (key2 === "headers") {
		// @ts-expect-error: Object.keys doesn't type guard
		key2 = req.headers.authorization ? "header" : "cookie";
	}

	const keys = `${key1}, ${key2}`;

	test(`fails if token is set multiple times - ${keys}`, t => {
		const res = { end: () => {} };

		const middleware = bearerToken({ cookie: true });
		void middleware(req as Request, res as Response, () => {});

		t.is((req as Request).token, undefined);
		t.is((res as Response).statusCode, 400);
	});
}

test("polka server", async t => {
	const port = await getPort();
	const server = polka()
		.use(bearerToken())
		.get("/", (req, res) => {
			t.is(req.token, token);
			res.end();
		})
		.listen(port);

	const response = await ky.get(`http://localhost:${port}/`, {
		searchParams: { access_token: token },
	});

	t.is(response.status, 200);
	server.server.close();
});

/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-empty-function */
