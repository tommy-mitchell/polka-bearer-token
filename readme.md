# polka-bearer-token

Bearer token middleware for [Polka](https://github.com/lukeed/polka). Minimally ported from [`express-bearer-token`](https://github.com/tkellen/js-express-bearer-token).

## What?

Per [RFC6750] this module will attempt to extract a bearer token from a request from these locations:

- The key `access_token` in the request body.
- The key `access_token` in the request params.
- The value from the header `Authorization: Bearer <token>`.
- (Optional) Get a token from cookies header with key `access_token`.

If a token is found, it will be stored on `req.token`. If one has been provided in more than one location, this will abort the request immediately by sending code 400 (per [RFC6750]).

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

For APIs which are not compliant with [RFC6750], the key for the token in each location is customizable, as is the key the token is bound to on the request (default configuration shown):

```js
app.use(bearerToken({
  bodyKey: "access_token",
  queryKey: "access_token",
  headerKey: "Bearer",
  reqKey: "token",
  cookie: false, // by default is disabled
}));
```

Get token from cookie key (it can be signed or not)

**Warning**: by **NOT** passing `{signed: true}` you are accepting a non signed cookie and an attacker might spoof the cookies. Use signed cookies when possible.

```js
app.use(bearerToken({
  cookie: {
    signed: true, // if passed true you must pass secret otherwise will throw error
    secret: "YOUR_APP_SECRET",
    key: "access_token", // default value
  },
}));
```

[RFC6750]: https://tools.ietf.org/html/rfc6750
