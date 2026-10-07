/* eslint-disable @typescript-eslint/naming-convention -- access_token naming */
import test from "ava";
import getPort from "get-port";
import ky, { type HTTPError } from "ky";
import polka, { type Request, type Response } from "polka";
import * as tq from "test-quadruple";
import bearerToken from "#src/index.ts";

const token = "test-token";

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

const setHeaderIfNeeded = (key: string, request: Partial<Request>): string => {
	if (key !== "headers" || !request.headers) {
		return key;
	}

	return request.headers.authorization ? "header" : "cookie";
};

for (const baseRequest of combinations) {
	let [key1, key2] = Object.keys(baseRequest);

	if (!key1 || !key2) {
		continue;
	}

	key1 = setHeaderIfNeeded(key1, baseRequest);
	key2 = setHeaderIfNeeded(key2, baseRequest);

	const keys = `${key1}, ${key2}`;

	test(`fails if token is set multiple times - ${keys}`, t => {
		const request = tq.mock<Request>({ headers: {}, ...baseRequest });
		const response = tq.mock<Response>({ end: () => tq.mock({}) });

		const middleware = bearerToken({ cookie: true });
		void middleware(request, response, () => {/* empty */});

		t.is(request.token, undefined);
		t.is(response.statusCode, 400);
	});
}

const DUPLICATE_REQUEST = {
	headers: { authorization: `Bearer ${token}` },
	searchParams: { access_token: token },
};

test("polka server - multiple tokens", async t => {
	const port = await getPort();
	const server = polka()
		.use(bearerToken())
		.listen(port);

	try {
		const error = await t.throwsAsync<HTTPError>(
			async () => ky.get(`http://localhost:${port}/`, DUPLICATE_REQUEST),
			{ message: /400 Bad Request/v },
		);

		t.like(error, {
			data: "Bearer token provided multiple times.",
			response: { status: 400 },
		});
	} finally {
		server.server.close();
	}
});

test("polka server - continueOnMultiple", async t => {
	const port = await getPort();

	// dprint-ignore
	const server = polka({
			onError: (error, _, __, next) => {
				t.like(error, {
					message: "Bearer token provided multiple times.",
					status: 400,
				});

				void next();
			},
		})
		.use(bearerToken({ continueOnMultiple: true }))
		.get("/", (_, response) => {
			response.end("hi!");
		})
		.listen(port);

	try {
		const response = await ky.get(`http://localhost:${port}/`, DUPLICATE_REQUEST).text();
		t.is(response, "hi!");
	} finally {
		server.server.close();
	}
});
