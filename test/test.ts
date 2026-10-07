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
	expected: string;
	options?: BearerTokenOptions;
	request?: Partial<Request>;
}];

const verify = test.macro<MacroArgs>((t, { expected, options, request: base = {} }) => {
	const request = tq.mock({ headers: {}, ...base });

	const middleware = bearerToken(options);
	void middleware(request, tq.mock({}), () => {
		try {
			t.is(request.token, expected, "Parsed token did not match expectations!");
		} catch {
			t.log({ expected, options, request });
		}
	});
});

/* eslint-disable @typescript-eslint/naming-convention -- access_token naming */

test("no token", verify, {
	expected: "",
});

test("body", verify, {
	expected: token,
	request: {
		body: { access_token: token },
	},
});

test("body - no token", verify, {
	expected: "",
	request: {
		body: { access_token: "" },
	},
});

test("body - custom key", verify, {
	expected: token,
	options: {
		bodyKey: "my_token",
	},
	request: {
		body: { my_token: token },
	},
});

test("body - custom key, no token", verify, {
	expected: "",
	options: {
		bodyKey: "my_token",
	},
	request: {
		body: { my_token: "" },
	},
});

test("query string", verify, {
	expected: token,
	request: {
		query: { access_token: token },
	},
});

test("query string - no token", verify, {
	expected: "",
	request: {
		query: { access_token: "" },
	},
});

test("query string - custom key", verify, {
	expected: token,
	options: {
		queryKey: "my_token",
	},
	request: {
		query: { my_token: token },
	},
});

test("query string - custom key, no token", verify, {
	expected: "",
	options: {
		queryKey: "my_token",
	},
	request: {
		query: { my_token: "" },
	},
});

for (const [key, title] of [["Bearer"], ["bearer"], ["my_auth", "custom key"]] as const) {
	const headerKey = key.toLowerCase() === "bearer" ? undefined : key;

	test(`header (${title ?? key})`, verify, {
		expected: token,
		...headerKey && { options: { headerKey } },
		request: {
			headers: {
				authorization: `${key} ${token}`,
			},
		},
	});

	test(`header - no token (${title ?? key})`, verify, {
		expected: "",
		...headerKey && { options: { headerKey } },
		request: {
			headers: {
				authorization: key,
			},
		},
	});
}

test("cookie parsing is disabled by default", verify, {
	expected: "",
	request: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
});

test("cookie", verify, {
	expected: token,
	options: { cookie: true },
	request: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
});

test("cookie - no token", verify, {
	expected: "",
	options: { cookie: true },
	request: {
		headers: {
			cookie: "access_token=; ",
		},
	},
});

test("cookie - unsigned with secret", verify, {
	expected: token,
	options: { cookie: { secret } },
	request: {
		headers: {
			cookie: `access_token=${token}; `,
		},
	},
});

test("cookie - custom key", verify, {
	expected: token,
	options: {
		cookie: { key: "my_token" },
	},
	request: {
		headers: {
			cookie: `my_token=${token}; `,
		},
	},
});

test("cookie - custom key, no token", verify, {
	expected: "",
	options: {
		cookie: { key: "my_token" },
	},
	request: {
		headers: {
			cookie: "my_token=; ",
		},
	},
});

test("cookie - signed", verify, {
	expected: token,
	options: {
		cookie: { secret },
	},
	request: {
		headers: {
			cookie: `access_token=${signedCookie}; `,
		},
	},
});

test("cookie - signed, wrong secret", verify, {
	expected: "",
	options: {
		cookie: { secret: "FAKE_SECRET" },
	},
	request: {
		headers: {
			cookie: `access_token=${signedCookie}; `,
		},
	},
});

test("cookie - signed, multiple secrets", verify, {
	expected: token,
	options: {
		cookie: { secret: ["FAKE_SECRET", secret] },
	},
	request: {
		headers: {
			cookie: `access_token=${signedCookie}; `,
		},
	},
});

test("cookie - signed, custom key", verify, {
	expected: token,
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
