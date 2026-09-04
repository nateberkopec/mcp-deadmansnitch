# Dead Man's Snitch API v1: observed contract

This document is the contract. The digital twin (`deadmanssnitch-twin`) must
reproduce it, and the differential conformance suite asserts it. The document
merges the official docs with these sources: live probes from 2026-09-03, the
official `snitcher` Ruby gem (v0.4.2), the Terraform provider, two community
clients, VCR recordings of real responses, and strings from the Field Agent
binary. Where the docs and reality disagree, reality wins. This document calls
out each such discrepancy.

Sources: <https://deadmanssnitch.com/docs/api/v1>, `/docs/faq`, `/docs/field-agent`,
`/docs/integrations/webhooks`, `/plans`.

## 1. Authentication, base URL, versioning

| Item | Value |
|---|---|
| Base URL | `https://api.deadmanssnitch.com/v1/`. Only `v1` exists. `/v2/snitches` returns an HTML 404. |
| Auth | HTTP Basic. The username is the API key, and the password is empty. `Authorization: Basic base64("<API_KEY>:")`. |
| Password | The server ignores the password. Terraform sends `":"`, and it works. A 401 carries `WWW-Authenticate: Basic realm="Use your API Key as the User Name; Password is ignored"`. |
| Key scope | Each key belongs to a "Case", which is a team or project account. The Heroku add-on provisions `DEADMANSSNITCH_API_KEY`. Note the double s. |
| Plan gate | Only the paid plans have API access. The free "Lone Snitch" plan has no API. |
| Request content type | Send `Content-Type: application/json` on a POST or PATCH that has a body. Malformed JSON returns `400` with an empty body. |
| Response content type | `application/json; charset=utf-8`, `cache-control: no-cache`, plus `x-request-id`, `x-runtime`, `server: Heroku`. |
| Unknown route | `404` HTML, which is the Rails error page with `text/html`. This happens even with valid auth. Only a known resource returns the JSON `resource_not_found`. |
| Trailing slash | The server accepts `/v1/snitches/`. |
| Pagination | There is none. The list returns everything. "Order is not guaranteed to be consistent across subsequent requests." |
| Rate limit (API) | The docs give only `429 rate_limited`. They document no threshold and no headers. |
| User-Agent | The server does not require it. snitcher sends `Snitcher; ruby/3.x; <platform>; v0.4.2`. |

## 2. Snitch object

Documented shape:

```json
{
  "token": "c2354d53d2",
  "href": "/v1/snitches/c2354d53d2",
  "name": "Daily Backups",
  "tags": ["production", "critical"],
  "status": "pending",
  "checked_in_at": null,
  "interval": "daily",
  "alert_type": "basic",
  "alert_email": [],
  "check_in_url": "https://nosnch.in/c2354d53d2",
  "created_at": "2014-03-28T22:07:44.902Z",
  "notes": "Postgres box at 123.213.231.132"
}
```

Real recorded response (2020-05-26). It includes the undocumented legacy `type`
object:

```json
{"token":"89e9d93839","href":"/v1/snitches/89e9d93839","name":"Some snitch","tags":["some","tags"],"notes":"some notes","status":"pending","created_at":"2020-05-26T21:01:23.441Z","check_in_url":"https://nosnch.in/89e9d93839","checked_in_at":null,"type":{"interval":"hourly"},"interval":"hourly","alert_type":"basic","alert_email":["foo@example.com"]}
```

| Field | Type | Notes |
|---|---|---|
| `token` | string | The identifier. All observed tokens are 10 lowercase hex characters. Read-only. |
| `href` | string | The relative path `/v1/snitches/<token>`. Read-only. |
| `name` | string | Required on create. |
| `tags` | string[] | A response never gives null. It gives `[]` when there are no tags. |
| `status` | enum | `pending`, `healthy`, `failed`, `errored`, `paused`. Read-only. See section 6. |
| `notes` | string or null | Observed as `""` in the create example in the docs, and as `null` in the VCR update. Treat the field as nullable. |
| `checked_in_at` | string or null | ISO 8601 UTC with millisecond precision. "Last time your job checked in healthy." The value is `null` until the first check-in. Read-only. |
| `check_in_url` | string | `https://nosnch.in/<token>`. Read-only. |
| `interval` | enum | See the interval table. |
| `alert_type` | enum | `basic` uses fixed UTC windows. `smart` learns the check-in time and moves the deadline earlier. The default is `basic`. |
| `alert_email` | string[] | An override list. `[]` means that there is no override, and the service alerts all team members. |
| `created_at` | string | ISO 8601 UTC with millisecond precision. Read-only. |
| `type` | object | Undocumented and legacy. The value is `{"interval": "<interval>"}`, and it mirrors `interval`. It is present in all recorded real responses. The official gem reads `payload["type"]["interval"]`, so the twin must emit it. |

The list example in the docs omits `check_in_url` and `notes` on some items. The
real list returns the full object, which is identical to the object from
GET-one.

### Interval values (request param `interval`)

| Value | Meaning | Restriction |
|---|---|---|
| `1_minute` | Every minute | Basic only |
| `2_minute` | Every two minutes | Basic only |
| `3_minute` | Every three minutes | Basic only |
| `5_minute` | Every five minutes | Basic only |
| `10_minute` | Every ten minutes | Basic only |
| `15_minute` | Every fifteen minutes | Basic only |
| `30_minute` | Every thirty minutes | Basic only |
| `hourly` | Every hour | |
| `2_hour` | Every two hours | |
| `3_hour` | Every three hours | |
| `4_hour` | Every four hours | |
| `6_hour` | Every six hours | |
| `8_hour` | Every eight hours | |
| `12_hour` | Every twelve hours | |
| `daily` | Once per day (midnight UTC) | |
| `weekly` | Once per week (Monday to Monday, midnight UTC) | |
| `monthly` | Once per month (midnight on the 1st) | |

Notes:

- The interval table in the FAQ also lists "20 Minute" (`*/20`). The API list does not contain it. The server may accept `20_minute`, but this is undocumented.
- The 422 example message in the docs is stale: `must be "15_minute", "30_minute", "hourly", "daily", "weekly", or "monthly"`. The twin should use the full list.
- Plan gating: the free plan permits `hourly`, `daily`, `weekly`, and `monthly`. Little Birdy permits the "Basic Intervals". Private Eye and Surveillance Van permit the "Enhanced Intervals", which are the sub-hourly and the N-hour values. The exact mapping is not published. For smart alerts, all paid plans permit `weekly` and `monthly`, and `hourly` through `daily` need Surveillance Van. A sub-hourly interval is always basic only.
- The older clients hard-code the six-value list. These clients are snitcher, the Node client, and the Terraform README. That list is stale.

## 3. Endpoints

Each endpoint requires auth. A success body is JSON, unless the status is `204`.

### 3.1 List snitches: `GET /v1/snitches`

- Query parameter `tags`, comma-separated. The endpoint returns the snitches that match all the listed tags (AND). Percent-encode the spaces. An empty `?tags=` behaves as no filter.
- `200` with a JSON array of Snitch objects. If nothing matches, the array is `[]`.
- There is no server-side filter for status or interval.

### 3.2 Get snitch: `GET /v1/snitches/:token`

- `200` with a Snitch object.
- `404` with `{"type":"resource_not_found","error":"The requested resource was not found."}`. A token that belongs to another case gives the same result.

### 3.3 Create: `POST /v1/snitches`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `interval` | string | yes | The enum above |
| `alert_type` | string | no | `basic` or `smart`. The default is `basic` |
| `alert_email` | array, string, or null | no | An array of addresses, or a comma-separated string. `null` or `[]` disables the override. |
| `notes` | string or null | no | |
| `tags` | array or null | no | |

- Success status: the docs do not state it. The real recorded response is `200 OK`, not 201. Terraform accepts only 200. The twin returns 200. The client accepts any 2xx.
- Body: the full Snitch object. A new snitch has `status: "pending"`, `checked_in_at: null`, `tags: []`, `alert_email: []`, and `notes: ""`.
- `422 resource_invalid` with `validations`. An empty body gives two validations: `name` and `interval`, each with "can't be blank".
- `402 plan_limit_reached`: `{"type":"plan_limit_reached","error":"We could not create your snitch because you are at your plan limit of 1 snitch! Delete an unused snitch, or head over to https://deadmanssnitch.com/ to upgrade your plan."}`. The real response also carried `Location: https://deadmanssnitch.com/`. The plan-limit check runs before the validation. A 402 was recorded for a body that had only `name`.
- Legacy request form: snitcher sends `{"type":{"interval":"hourly"}}` in place of the top-level `interval`, and it works. The legacy validation attribute name was `"type.interval"`. The twin may accept both forms.
- The server ignores the unknown fields and the read-only fields in the body. The read-only fields are `token`, `href`, `status`, `check_in_url`, and `checked_in_at`.

### 3.4 Update: `PATCH /v1/snitches/:token`

- Body: the same fields as create, and all of them are optional. The server does not touch a field that the request omits. `tags` replaces the whole list, and `{"tags": []}` clears it.
- `200` with the full updated Snitch object.
- `404 resource_not_found` for an unknown token. `422 resource_invalid` for a bad value.
- Docs quirk: in the update example, the response shows a token in `check_in_url` that differs from the token in the path. It also shows an `alert_type` that the request did not send. This is a documentation error, not real behavior. The token and `check_in_url` are stable.

### 3.5 Delete: `DELETE /v1/snitches/:token`

- `204 No Content` with an empty body. `404` if the token is unknown.

### 3.6 Pause: `POST /v1/snitches/:token/pause`

- Optional JSON body `{"until": <value>}`:
  - `"healthy"`: unpause on the next healthy check-in. This is the default.
  - `"unpaused"`: stay paused until a manual unpause.
  - An ISO 8601 timestamp in the future.
- `204 No Content`.
- Precondition: the snitch must not be `pending`. It must have checked in at least one time. A pause on a snitch that is already paused is safe.
- `422` when `until` is invalid or is in the past. The error code for a pause on a pending snitch is undocumented. Assume `422 resource_invalid`.
- Only the docs mention `until`. No client library implements it.

### 3.7 Unpause: `POST /v1/snitches/:token/unpause`

- No body. `204 No Content`. The call is safe when the snitch is not paused.

### 3.8 Add tags: `POST /v1/snitches/:token/tags`

- Body: a bare JSON array of strings, for example `["production", "critical"]`.
- `200` with a JSON array of all the tags on the snitch. The existing tags come first, and the new tags are appended.

### 3.9 Remove tag: `DELETE /v1/snitches/:token/tags/:tag`

- URL-encode `:tag`. snitcher uses `CGI.escape`, so a space becomes `+`.
- `200` with a JSON array of the remaining tags.
- The behavior for a tag that is not on the snitch is undocumented.

### 3.10 Replace all tags

Use PATCH with `{"tags": [...]}`. There is no dedicated endpoint.

### 3.11 Not present

There are no endpoints for these: account or plan information, metrics or
history, check-in listings, API key management, team members, and integrations.

## 4. Check-in endpoint: `https://nosnch.in/:token`

This endpoint has no authentication. It uses a separate host and behaves
differently. It is a plain-text service, not the Rails API.

| Aspect | Observed or documented |
|---|---|
| Methods | `GET`, `POST`, `PUT`, and `PATCH` return `202`. `HEAD` and `DELETE` return `405` with the body `405 Method Not Allowed` and the header `Allow: GET, POST, PUT, PATCH`. |
| Success | `202 Accepted`, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-store`, body `Got it, thanks!\n` (16 bytes). |
| Bogus token | The endpoint still returns `202 Got it, thanks!`. It never leaks whether the token is valid. |
| No token (`/`) | `404`, body: `You are checking in without a token.\nPlease correct this so we can make sure we are monitoring your snitch.\nIf you have questions please email hi@deadmanssnitch.com.` |
| Plain HTTP | `http://nosnch.in/<token>` also returns `202`. There is no redirect. |
| Rate limit | The FAQ says: "After the first 10 pings in an hour, Snitches are limited to one hit per minute." These headers are always present: `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, and `X-Ratelimit-Reset`, which gives the seconds until the reset. For repeated hits we observed `limit: 1`, `remaining: 0`, and a `reset` value that counts down. We did not observe the status code for an over-limit request. It is presumably 429. |
| Param `m` | Message text, in the query string or in the form body. The snitcher docs limit it to 256 characters. |
| Param `s` | Exit status. `0`, `""`, and an absent value all mean success. Any other value means an error: the status becomes `errored`, and the service sends an Error Notice. This happens on the Surveillance Van plan only. On the other plans, the check-in still counts as healthy. |
| Body encodings | Form `application/x-www-form-urlencoded` (docs). The Field Agent posts `application/json;charset=utf-8`. |
| Field Agent payload (v1.0.10) | JSON with the keys `s` (omitempty), `duration` (omitempty), `output` (string), `started_at` (int64), `clock` (int64), and `agent` (version info). The User-Agent is `Dead Man's Snitch Field Agent; Go/<ver>; <os>/<arch>; v1.0.10`. The agent accepts a full URL as the token, through the regex `\Ahttps?://nosnch\.in/(.*)\z`. |

## 5. Error response format

```json
{
  "type": "resource_invalid",
  "error": "The requested resource attributes are not valid.",
  "validations": [
    { "attribute": "name", "message": "can't be blank" },
    { "attribute": "interval", "message": "can't be blank" }
  ]
}
```

`type` is stable and machine-readable. The `error` text "may change".
`validations` appears on a 422 only.

| HTTP | `type` | `error` (verbatim) | When |
|---|---|---|---|
| 400 | none | no body | Malformed JSON |
| 401 | `api_key_invalid` | `Access denied. Provide your API Key as the user for HTTP Basic Authentication.` | A missing key or an invalid key. The body is the same for both |
| 402 | `plan_limit_reached` | `We could not create your snitch because you are at your plan limit! Delete an unused snitch, or head over to https://deadmanssnitch.com/ to update your subscription.` (the real text includes the count) | The snitch count is at the plan limit |
| 402 | `account_on_hold` | `Your account has been put on hold! Head over to https://deadmanssnitch.com to update your subscription.` | Failed payments |
| 404 | `resource_not_found` | `The requested resource was not found.` | An unknown token or a foreign token |
| 422 | `resource_invalid` | `The requested resource attributes are not valid.` | A validation failure. See `validations` |
| 429 | `rate_limited` | `You have made too many requests too quickly.` | The API key is throttled |
| 500 | none | `Internal Server Error` (non-JSON) | |
| 503 | `service_unavailable` | `Dead Man's Snitch is undergoing maintenance` | Maintenance |
| any | `sign_in_incorrect` | | A legacy type from the username-and-password auth |

## 6. Behavior semantics (twin state machine)

Status machine:

- `pending`: the snitch is created and has never checked in. You cannot pause it. If it is still pending about 3 days after creation, the service sends a reminder email.
- `healthy`: at least one healthy check-in happened in the current period or in the last period.
- `failed`: no check-in happened during a completed period, and the service sent at least one alert. The webhooks call this state `missing`.
- `errored`: the last check-in reported `s != 0`, and the service sent at least one alert. This is a Surveillance Van plan feature.
- `paused`: the alerts are muted. With the default `until: healthy`, any healthy check-in unpauses the snitch automatically. With `until: unpaused`, only a manual unpause works. With a timestamp, the snitch unpauses automatically at that time. If the snitch stays paused for more than 3 days, the service sends a reminder email. The service pauses a snitch automatically when it is missing for the whole 2-year history window.
- First check-in: the snitch moves from `pending` to `healthy`, and the service sends a "checked in for the first time" email. A recovery from `failed` or `errored` to `healthy` sends a "reporting again" alert immediately.

Period and alert timing (basic):

- The windows are fixed UTC windows that align to the interval. Hourly aligns at :00. Daily aligns at 00:00 UTC. Weekly aligns at Monday 00:00 UTC. Monthly aligns on the 1st at 00:00 UTC. The N-minute and N-hour intervals align to multiples.
- The snitch is healthy if at least one check-in happens inside the window. There is no check on the minimum spacing.
- Monitoring begins with the first full window after the first check-in. For example, a check-in at 2:10 makes 3 to 4 pm the first monitored window, and the alert comes at about 4:01.
- The evaluation and the alert happen about 1 minute after the window ends. The service sends one alert for each failed window, until someone pauses the snitch or pings it.
- `checked_in_at` updates only on a healthy check-in.

Smart alerts: after "a few consistent check-ins", the deadline shifts earlier
toward the observed check-in time.

Webhooks, for completeness: the service POSTs the JSON
`{"type":"snitch.reporting|snitch.missing|snitch.errored|snitch.paused","timestamp":"...Z","data":{"snitch":{"token","name","notes","tags","status","previous_status"}}}`.
The statuses there are `pending, healthy, missing, errored, paused`. The timeout
is 30 s. The service retries on a non-2xx response. There is no ordering
guarantee.

## 7. Client-library discrepancies

| Client | Deviations and observations |
|---|---|
| snitcher 0.4.2 (official Ruby) | It sends `interval` nested as `{"type":{"interval":..}}`. It reads `payload["type"]["interval"]`, so it requires the legacy `type` field. It has no `unpause` and no `until`. It treats a 500 as non-JSON. Its timeout is 5 s. Its check-in is GET only, with the query params `m` and `s`. |
| Terraform provider | Its basic auth password is `":"`. It accepts a create only on status 200. It sends the read-only fields on a PATCH, and the server ignores them. It has no pause and no unpause. |
| Node client | Its statuses are `pending, healthy, failed, errored, paused`. Its six-value interval list is stale. Its check-in is a GET with `m` only. It has no unpause. |
| dead_mans_snitch_api (Ruby) | It sends `Accept: application/json`. It lists through `/v1/snitches/?tags=`. Its VCR recordings prove these facts: a create returns 200; the responses include `type.interval`; `notes` can be `null`; a 402 carries a `Location` header; and pause and delete return 204 with an empty body. |
| Previous Python server in this repo (`git show HEAD~1:src/mcp_deadmansnitch/client.py`) | Its base URL is hardcoded, and you cannot override it. Its check-in fetched the snitch first, to read `check_in_url`, and then POSTed the form `m=`. Its pause and unpause re-fetched the snitch after the 204. Its add-tags re-fetched the snitch after the tag-array response. |
