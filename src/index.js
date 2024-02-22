import { parse as parseCookie } from "cookie";
import { signedCookie as decodeCookie } from "cookie-parser";

const getCookie = (serializedCookies, key) => parseCookie(serializedCookies)[key] || false;

export default function bearerToken(options) {
	try {
		options ??= { cookie: false };

		const queryKey = options.queryKey || "access_token";
		const bodyKey = options.bodyKey || "access_token";
		const headerKey = options.headerKey || "Bearer";
		const reqKey = options.reqKey || "token";
		const { cookie } = options;

		if (cookie && !cookie.key) {
			cookie.key = "access_token";
		}

		if (cookie && cookie.signed && !cookie.secret) {
			throw new Error(
				"[polka-bearer-token]: You must provide a secret token to cookie attribute, or disable signed property",
			);
		}

		return (req, res, next) => {
			let token;
			let error;

			// Query
			if (req.query && req.query[queryKey]) {
				token = req.query[queryKey];
			}

			// Body
			if (req.body && req.body[bodyKey]) {
				if (token) {
					error = true;
				}

				token = req.body[bodyKey];
			}

			// Headers
			if (req.headers) {
				// Authorization header
				if (req.headers.authorization) {
					const parts = req.headers.authorization.split(" ");
					if (parts.length === 2 && parts[0] === headerKey) {
						if (token) {
							error = true;
						}

						token = parts[1];
					}
				}

				// Cookie
				if (cookie && req.headers.cookie) {
					const plainCookie = getCookie(req.headers.cookie || "", cookie.key); // Seeks the key
					if (plainCookie) {
						const cookieToken = cookie.signed
							? decodeCookie(plainCookie, cookie.secret)
							: plainCookie;

						if (cookieToken) {
							if (token) {
								error = true;
							}

							token = cookieToken;
						}
					}
				}
			}

			// RFC6750 states the access_token MUST NOT be provided in more than one place in a single request.
			if (error) {
				res.statusCode = 400;
				res.end();
			} else {
				req[reqKey] = token;
				next();
			}
		};
	} catch (error) {
		console.error(error);
	}
}
