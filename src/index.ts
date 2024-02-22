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
	 * @default undefined
	 */
	cookie?: AllOrNoneOf<{
		// TODO: docs
		key?: string;
		signed: boolean;
		secret: string;
	}, 'signed' | 'secret'>;
};

declare module "polka" {
	interface Request { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		token?: string;
	}
}

export default function bearerToken(options: BearerTokenOptions = {}): Middleware {
	const {
		queryKey = "access_token",
		bodyKey = "access_token",
		headerKey = "Bearer",
		cookie = {},
	} = options;

	if (cookie && !cookie.key) {
		cookie.key = "access_token";
	}

	if (cookie && cookie.signed && !cookie.secret) {
		throw new Error(
			"[polka-bearer-token]: A secret token must be set when using signed cookies.",
		);
	}

	return (req, res, next) => {
		let token = "";
		let isTokenProvidedMultipleTimes = false;

		// Query
		if (req.query?.[queryKey]) {
			token = req.query[queryKey];
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
			if (cookie && cookieHeader) {
				const plainCookie = parseCookie(cookieHeader)[cookie.key!];

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
