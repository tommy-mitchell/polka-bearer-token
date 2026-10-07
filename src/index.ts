import { parseCookie } from "cookie";
import { signedCookie as decodeCookie } from "cookie-parser";
import type { Middleware } from "polka";

export type BearerTokenOptions = {
	/**
	 * The key that will be used to find the token in the request body.
	 *
	 * @default "access_token"
	 */
	bodyKey?: string;

	// dprint-ignore
	/**
	 * Set to enable cookie parsing. If the cookie is signed, a secret must be set.
	 *
	 * Setting this to `true` uses the default `{ key: "access_token" }`.
	 *
	 * **WARNING:** By **NOT** setting a secret, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.
	 *
	 * @default false
	 */
	cookie?: {
		/**
		 * The key that will be used to find the token in the request cookies.
		 *
		 * @default "access_token"
		 */
		key?: string;

		/**
		 * The secret used to sign the cookie. If set, unsigned cookies will be disallowed.
		 *
		 * **WARNING:** By **NOT** setting a secret, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.
		 */
		secret?: string;
	} | boolean;

	/**
	 * The value that will be used to find the token in the request header. Case-insensitive.
	 *
	 * @default "Bearer"
	 */
	headerKey?: string;

	/**
	 * The key that will be used to find the token in the request params.
	 *
	 * @default "access_token"
	 */
	queryKey?: string;
};

declare module "polka" {
	interface Request { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		/** The Bearer token found in the request, if any. */
		token?: string;
	}
}

function withDefaults(options: BearerTokenOptions) {
	const {
		bodyKey = "access_token",
		headerKey = "Bearer",
		queryKey = "access_token",
	} = options;

	let cookie = options.cookie ?? false;

	if (typeof cookie === "boolean") {
		cookie = cookie ? { key: "access_token" } : {};
	} else {
		cookie.key ??= "access_token";
	}

	return { bodyKey, cookie, headerKey, queryKey };
}

/**
 * A Polka middleware for parsing Bearer tokens according to {@link https://tools.ietf.org/html/rfc6750 RFC6750}.
 *
 * @example
 * import polka from "polka";
 * import bearerToken from "polka-bearer-token";
 *
 * const app = polka()
 *   .use(bearerToken())
 *   .use((req, res, next) => {
 *     console.log(req.token);
 *     next();
 *   })
 *   .listen(8000);
 */
export default function bearerToken(options: BearerTokenOptions = {}): Middleware {
	const { bodyKey, cookie, headerKey, queryKey } = withDefaults(options);

	return (request, response, next) => {
		let token = "";
		let isTokenProvidedMultipleTimes = false;

		// Query
		if (Object.hasOwn(request.query ?? {}, queryKey)) {
			token = request.query[queryKey]!;
		}

		// Body
		if (Object.hasOwn(request.body as unknown ?? {}, bodyKey)) {
			isTokenProvidedMultipleTimes = Boolean(token);
			token = request.body[bodyKey]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		}

		// Headers
		const { authorization: authorizationHeader, cookie: cookieHeader } = request.headers;

		// Authorization header
		if (authorizationHeader) {
			const [key, maybeToken] = authorizationHeader.split(" ") as [string, ...string[]];

			if (maybeToken && key.toLowerCase() === headerKey.toLowerCase()) {
				isTokenProvidedMultipleTimes = Boolean(token);
				token = maybeToken;
			}
		}

		// Cookie
		if (cookieHeader && cookie.key) {
			const plainCookie = parseCookie(cookieHeader)[cookie.key];

			if (plainCookie) {
				const cookieToken = cookie.secret
					? decodeCookie(plainCookie, cookie.secret)
					: plainCookie;

				if (cookieToken) { // eslint-disable-line @typescript-eslint/strict-boolean-expressions
					isTokenProvidedMultipleTimes = Boolean(token);
					token = cookieToken;
				}
			}
		}

		// RFC6750 states the access_token MUST NOT be provided in more than one place in a single request.
		if (isTokenProvidedMultipleTimes) {
			response.statusCode = 400;
			response.end();
		} else {
			request.token = token;
			void next();
		}
	};
}
