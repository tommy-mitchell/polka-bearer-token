import type { Middleware } from "polka";

type BearerTokenOptions = {
	/**
	 * Specify the key that will be used to find the token in the request body.
	 */
	bodyKey?: string;

	/**
	 * Specify the key that will be used to find the token in the request params.
	 */
	queryKey?: string;

	/**
	 * Specify the value that will be used to find the token in the request header.
	 */
	headerKey?: string;

	/**
	 * Specify the key that will be used to bind the token to (if found on the request).
	 */
	reqKey?: string;

	/**
	 * Specify cookie options with key, AND if is signed, pass a secret.
	 */
	cookie?: {
		signed: boolean;
		key: string;
		secret: string;
	};
};

/**
 * This module will attempt to extract a bearer token from a request from these locations:
 * - The key access_token in the request body.
 * - The key access_token in the request params.
 * - The value from the header Authorization: Bearer <token>.
 * - Will check headers cookies if has any 'access_token=TOKEN;'
 *
 * If a token is found, it will be stored on req.token.
 * If a token has been provided in more than one location, the request will be aborted immediately with HTTP status code 400 (per RFC6750).
 *
 * To change the variables used by this module, you can specify an object with new options.
 */
export default function bearerToken(options?: BearerTokenOptions): Middleware;

declare module "polka" {
	interface Request {
		token?: string;
	}
}
