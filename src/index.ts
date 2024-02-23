import type { Middleware } from "polka";
import type { RequireAllOrNone as AllOrNoneOf } from "type-fest";
import { parse as parseCookie } from "cookie";
import { signedCookie as decodeCookie } from "cookie-parser";

export type BearerTokenOptions = {
	/**
	 * The key that will be used to find the token in the request body.
	 *
	 * @default "access_token"
	 */
	bodyKey?: string;

	/**
	 * The key that will be used to find the token in the request params.
	 *
	 * @default "access_token"
	 */
	queryKey?: string;

	/**
	 * The value that will be used to find the token in the request header.
	 *
	 * @default "Bearer"
	 */
	headerKey?: string;

	// dprint-ignore
	/**
	 * Set to enable cookie parsing. If the cookie is signed, a secret must be set.
	 *
	 * Setting this to `true` uses the default `{ key: "access_token" }`.
	 *
	 * **WARNING:** By **NOT** setting `signed: true`, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.
	 *
	 * @default false
	 */
	cookie?: boolean | AllOrNoneOf<{
		/**
		 * The key that will be used to find the token in the request cookies.
		 *
		 * @default "access_token"
		 */
		key?: string;

		/**
		 * Whether or not to disallow unsigned cookies. If `true`, a secret must be set.
		 *
		 * **WARNING:** By **NOT** setting `signed: true`, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.
		 *
		 * @default false
		 */
		signed: boolean;

		/** The secret used to sign the cookie. If set, the cookie will be verified and parsed. */
		secret: string;
	}, 'signed' | 'secret'>;
};

declare module "polka" {
	interface Request { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		/** The Bearer token found in the request, if any. */
		token?: string;
	}
}

function withDefaults(options: BearerTokenOptions) {
	const {
		queryKey = "access_token",
		bodyKey = "access_token",
		headerKey = "Bearer",
	} = options;

	let cookie = options.cookie ?? false;

	if (typeof cookie === "boolean") {
		cookie = cookie ? { key: "access_token" } : {};
	} else {
		cookie.key ??= "access_token";
	}

	if (cookie && cookie.signed && !cookie.secret) {
		throw new Error("[polka-bearer-token]: A secret token must be set when using signed cookies.");
	}

	return { queryKey, bodyKey, headerKey, cookie };
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
	const { queryKey, bodyKey, headerKey, cookie } = withDefaults(options);

	return (req, res, next) => {
		let token = "";
		let isTokenProvidedMultipleTimes = false;

		// Query
		if (req.query?.[queryKey]) {
			token = req.query[queryKey]!;
		}

		// Body
		if (req.body?.[bodyKey]) {
			isTokenProvidedMultipleTimes = Boolean(token);
			token = req.body[bodyKey]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
		}

		// Headers
		if (req.headers) {
			const { authorization: authorizationHeader, cookie: cookieHeader } = req.headers;

			// Authorization header
			if (authorizationHeader) {
				const [key, maybeToken] = authorizationHeader.split(" ");

				if (key === headerKey && maybeToken) {
					isTokenProvidedMultipleTimes = Boolean(token);
					token = maybeToken;
				}
			}

			// Cookie
			if (cookie.key && cookieHeader) {
				const plainCookie = parseCookie(cookieHeader)[cookie.key];

				if (plainCookie) {
					const cookieToken = cookie.signed
						? decodeCookie(plainCookie, cookie.secret)
						: plainCookie;

					if (cookieToken) {
						isTokenProvidedMultipleTimes = Boolean(token);
						token = cookieToken;
					}
				}
			}
		}

		// RFC6750 states the access_token MUST NOT be provided in more than one place in a single request.
		if (isTokenProvidedMultipleTimes) {
			res.statusCode = 400;
			res.end();
		} else {
			req.token = token;
			void next();
		}
	};
}
