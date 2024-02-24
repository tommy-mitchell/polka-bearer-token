# polka-bearer-token

Bearer token middleware for [Polka](https://github.com/lukeed/polka). Ported from [`express-bearer-token`](https://github.com/tkellen/js-express-bearer-token).

Tested with `Polka@next`.

## Install

```sh
npm install polka-bearer-token
```

<details>
<summary>Other Package Managers</summary>

```sh
yarn add polka-bearer-token
```

```sh
pnpm add polka-bearer-token
```

</details>

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

### bearerToken(options?): `Polka.Middleware`

#### options

Type: `object`

For APIs which are not compliant with [RFC6750], the key for the token in each location is customizable.

##### bodyKey

Type: `string`\
Default: `"access_token"`

The key that will be used to find the token in the request body.

##### queryKey

Type: `string`\
Default: `"access_token"`

The key that will be used to find the token in the request params.

##### headerKey

Type: `string`\
Default: `"Bearer"`

The value that will be used to find the token in the request header. Case-insensitive.

##### cookie

Type: `boolean | object`\
Default: `false`

Set to enable cookie parsing. If the cookie is signed, a secret must be set.

Setting this to `true` uses the default `{ key: "access_token" }`.

> [!WARNING]
> By **NOT** setting `signed: true`, you are accepting a non-signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.

###### key

Type: `string`\
Default: `"access_token"`

The key that will be used to find the token in the request cookies.

###### signed

Type: `boolean`\
Default: `false`

Whether or not to disallow unsigned cookies. If `true`, a secret must be set.

###### secret

Type: `string`

The secret used to sign the cookie. If set, the cookie will be verified and parsed.

## Related

- [express-bearer-token](https://github.com/tkellen/js-express-bearer-token) - Bearer token middleware for express.
- [koa-bearer-token](https://github.com/chentsulin/koa-bearer-token) - Bearer token parser middleware for koa.

[RFC6750]: https://tools.ietf.org/html/rfc6750
