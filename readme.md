# polka-bearer-token

Bearer token middleware for [Polka](https://github.com/lukeed/polka). Minimally ported from [`express-bearer-token`](https://github.com/tkellen/js-express-bearer-token).

## Install

## Usage

```js
import polka from "polka";
import bearerToken from "polka-bearer-token";

const app = polka()
  .use(bearerToken())
  .use((req, res, next) => {
    console.log(req.token);
    next();
  })
  .listen(8000);
```

Per [RFC6750] this module will attempt to extract a bearer token from a request from these locations:

- The key `access_token` in the request body.
- The key `access_token` in the request params.
- The value from the header `Authorization: Bearer <token>`.
- (Optional) Get a token from cookies header with key `access_token`.

If a token is found, it will be stored on `req.token`. If one has been provided in more than one location, this will abort the request immediately by sending code `400` (per [RFC6750]).

## API

### options

Type: `Object`

For APIs which are not compliant with [RFC6750], the key for the token in each location is customizable.

#### bodyKey

Type: `String`\
Default: `"access_token"`

The key that will be used to find the token in the request body.

#### queryKey

Type: `String`\
Default: `"access_token"`

The key that will be used to find the token in the request params.

#### headerKey

Type: `String`\
Default: `"Bearer"`

The value that will be used to find the token in the request header.

#### cookie

Type: `Object`\
Default: `undefined`

Set to enable cookie parsing. If the cookie is signed, a secret must be set.

> [!WARNING]
> By **NOT** passing `signed: true`, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.

##### key

## Related

- [express-bearer-token]() -

[RFC6750]: https://tools.ietf.org/html/rfc6750
