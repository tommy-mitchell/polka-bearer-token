import { parseCookie } from "cookie";
import { unsign as decode } from "cookie-signature";
import type { IError, Middleware } from "polka";

const MULTIPLE_TOKEN_ERROR_MESSAGE = "Bearer token provided multiple times.";

const arrify = <T>(value?: T | T[]): T[] => (
	value === undefined ? [] : (Array.isArray(value) ? value : [value])
);

const isObject = (value: unknown): value is Record<PropertyKey, unknown> => (
	typeof value === "object" && value !== null && !Array.isArray(value)
);

export type BearerTokenOptions = {
	/**
	 * The key that will be used to find the token in the request body. The body must have already been parsed by an earlier middleware.
	 *
	 * @default "access_token"
	 */
	bodyKey?: string;

	/**
	 * Whether or not the middleware should call `next()` or end the response if multiple tokens are provided.
	 *
	 * If `true`, `next()` is called with an error of the shape:
	 * ```json
	 * {
	 *   message: "Bearer token provided multiple times.",
	 *   status: 400
	 * }
	 * ```
	 *
	 * This can then be handled in Polka's {@link https://github.com/lukeed/polka/tree/v1.0.0-next.28#optionsonerror `options.onError` handler}.
	 *
	 * @default false
	 */
	continueOnMultiple?: boolean;

	/**
	 * Set to enable cookie parsing. Optionally uses the provided secret key(s) to decode an Express-style signed cookie (`s:<value>.<signature>`).
	 *
	 * Setting this to `true` uses the default `{ key: "access_token" }`.
	 *
	 * **Using signed cookies is strongly recommended.**
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
		 * The secret key used to sign the cookie. If an array is provided, each secret will attempt to decode the signed cookie in order.
		 */
		secret?: string[] | string;
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

function tryDecodeCookie(cookie: string, secrets?: string[] | string): string | undefined {
	if (!cookie.startsWith("s:")) {
		return cookie;
	}

	for (const secret of arrify(secrets)) {
		const result = decode(cookie.slice(2), secret);
		if (result !== false) {
			return result;
		}
	}

	return undefined;
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
export default function bearerToken({ continueOnMultiple, ...options }: BearerTokenOptions = {}): Middleware {
	const { bodyKey, cookie, headerKey, queryKey } = withDefaults(options);

	return async (request, response, next) => {
		let token: string | undefined;
		let isTokenProvidedMultipleTimes = false;

		// Query
		const queryToken = request?.query?.[queryKey];
		if (queryToken) {
			token = queryToken;
		}

		// Body
		const body = isObject(request?.body) ? request.body : {};
		const bodyToken = body[bodyKey];
		if (typeof bodyToken === "string" && bodyToken) {
			isTokenProvidedMultipleTimes = Boolean(token);
			token = bodyToken;
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
				const cookieToken = tryDecodeCookie(plainCookie, cookie.secret);

				if (cookieToken) {
					isTokenProvidedMultipleTimes = Boolean(token);
					token = cookieToken;
				}
			}
		}

		// RFC6750 states the access_token MUST NOT be provided in more than one place in a single request.
		if (isTokenProvidedMultipleTimes) {
			if (continueOnMultiple) {
				const error: IError = new Error(MULTIPLE_TOKEN_ERROR_MESSAGE);
				error.status = 400;

				return next(error);
			}

			response.statusCode = 400;
			response.end(MULTIPLE_TOKEN_ERROR_MESSAGE);
		} else {
			request.token = token;
			void next();
		}
	};
}
