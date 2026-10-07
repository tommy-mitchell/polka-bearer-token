import test from "ava";
import cookie from "cookie-signature";
import getPort from "get-port";
import ky from "ky";
import polka, { type Request } from "polka";
import * as tq from "test-quadruple";
import bearerToken, { type BearerTokenOptions } from "#src/index.ts";

const token = "test-token";
const secret = "SUPER_SECRET";
const signedCookie = encodeURI(`s:${cookie.sign(token, secret)}`);

type MacroArgs = [{
	expected?: string;
	options?: BearerTokenOptions;
	request?: Partial<Request>;
}];

const verify = test.macro<MacroArgs>((t, { expected = token, options, request: base = {} }) => {
	const request = tq.mock({ headers: {}, ...base });

	const middleware = bearerToken(options);
	void middleware(request, tq.mock({}), () => {
		t.is(request.token, expected);
	});
});

/* eslint-disable @typescript-eslint/naming-convention -- access_token naming */

test("body", verify, {
	request: {
		body: { access_token: token },
	},
});

test("body - custom", verify, {
	options: {
		bodyKey: "my_token",
	},
	request: {
		body: { my_token: token },
	},
});

test("query string", verify, {
	request: {
		query: { access_token: token },
	},
});

test("query string - custom", verify, {
	options: {
		queryKey: "my_token",
	},
	request: {
		query: { my_token: token },
	},
});

test("header", verify, {
	request: {
		headers: {
			authorization: `Bearer ${token}`,
		},
	},
});

test("header - case insensitive", verify, {
	request: {
		headers: {
			authorization: `bearer ${token}`,
		},
	},
});

test("header - custom", verify, {
	options: {
		headerKey: "my_auth",
	},
	request: {
		headers: {
			authorization: `my_auth ${token}`,
		},
	},
});

test("cookie parsing is disabled by default", verify, {
	expected: "",
	request: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
});

test("cookie", verify, {
	options: { cookie: true },
	request: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
});

test("cookie - custom", verify, {
	options: {
		cookie: { key: "my_token" },
	},
	request: {
		headers: {
			cookie: `my_token=${token}; `,
		},
	},
});

test("cookie - signed", verify, {
	options: {
		cookie: { secret },
	},
	request: {
		headers: {
			cookie: `access_token=${signedCookie}; `,
		},
	},
});

test("cookie - signed - custom", verify, {
	options: {
		cookie: { key: "my_token", secret },
	},
	request: {
		headers: {
			cookie: `my_token=${signedCookie}; `,
		},
	},
});

test("polka server", async t => {
	const port = await getPort();
	const server = polka()
		.use(bearerToken())
		.get("/", (request, response) => {
			t.is(request.token, token);
			response.end();
		})
		.listen(port);

	const response = await ky.get(`http://localhost:${port}/`, {
		searchParams: { access_token: token },
	});

	t.is(response.status, 200);
	server.server.close();
});

/* eslint-enable @typescript-eslint/naming-convention */
