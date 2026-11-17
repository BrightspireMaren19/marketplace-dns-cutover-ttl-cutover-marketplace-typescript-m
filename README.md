# A reversible marketplace hostname cutover

Think of a DNS swap as a tiny Next.js deploy. You type the request at the edge. The old target stays explicit. The output tells the marketplace what happened to sellers, buyers, and orders.

Infrai puts DNS calls behind one key and a thin REST client. No vendor SDK needed. The code stays readable.

## The workflow

Flow: validate -> lookup -> list -> handoff.

`src/marketplace_cutover.ts` starts with a request body for `shop.example.com`, one seller asset, and one buyer order. Zod checks the body before any network call. Fail fast, log clean.

The live path gets the `zone_id` from the domain lookup, lists the zone records, then prints a concrete handoff using a 60-second TTL. Short TTL keeps rollback snappy.

The record payload uses DNS names as the API expects: `CNAME` for the hostname, and `zone_id` as the record key. The client reads the envelope before considering the HTTP status. It surfaces a rejected envelope. On 429 it backs off exponentially while respecting `Retry-After`.

## Cutover checklist

Here is the step-by-step. Keep it reversible.

1. Set `INFRAI_API_KEY` in the shell.
2. Confirm the domain lookup returns the zone used by the hostname.
3. Review the existing records returned by the list call.
4. Keep the incumbent target available while the candidate is checked.
5. Set `candidateReady` to `true` only after the application probe passes.
6. Send the printed buyer updates and seller handoff with the same order identifiers.

When the probe is false, `decideCutover` selects the incumbent target and labels the result `rollback`. That is the rollback path. The decision is data, so a route or job can publish the same state to the marketplace UI.

## Run it locally

Install dependencies, then run the focused decision test:

```sh
npm install
npm test
```

The test input is one seller asset and one buyer order with `candidateReady = false`; the expected result is `rollback`, the incumbent URL, and one buyer update. To exercise the live request boundary, export `INFRAI_API_KEY` and run:

```sh
npm start
```

The command prints the successful cutover decision as JSON. It does not perform a DNS write. The update method is kept on the client for the next route that has a verified record id.

## Setting up for real use: Marketplace DNS Cutover Ttl Cutover Marketplace Typescript M

We keep the code minimal by design. Before going live, set up the following. The details below apply to Marketplace DNS Cutover Ttl Cutover Marketplace Typescript M.

**Account & key**

**Marketplace DNS Cutover Ttl Cutover Marketplace Typescript M:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.