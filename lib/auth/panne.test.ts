import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIMEOUT,
  estPanneDeTransport,
  withTimeout,
  AUTH_TIMEOUT_MS,
} from "./panne.ts";

test("rend la valeur quand la promesse gagne", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 1000), "ok");
});

test("rend TIMEOUT quand le délai gagne", async () => {
  const jamais = new Promise<string>(() => {});
  assert.equal(await withTimeout(jamais, 5), TIMEOUT);
});

test("propage le rejet de la promesse utile", async () => {
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error("boum")), 1000),
    /boum/
  );
});

test("annule le timer perdant, y compris sur rejet", async () => {
  // Sans `clearTimeout`, ces appels laisseraient des timers armés et le runner
  // signalerait des handles pendants en fin de test.
  const avant = process.getActiveResourcesInfo().filter((r) => r === "Timeout");
  await withTimeout(Promise.resolve(1), 60_000);
  await withTimeout(Promise.reject(new Error("x")), 60_000).catch(() => {});
  const apres = process.getActiveResourcesInfo().filter((r) => r === "Timeout");
  assert.equal(apres.length, avant.length);
});

test("reconnaît la panne de transport, et elle seule", () => {
  assert.equal(
    estPanneDeTransport({ name: "AuthRetryableFetchError" }),
    true
  );
  // Un vrai refus : il ne doit surtout pas être lu comme une panne.
  assert.equal(estPanneDeTransport({ name: "AuthSessionMissingError" }), false);
  assert.equal(estPanneDeTransport(new Error("réseau")), false);
  assert.equal(estPanneDeTransport(null), false);
  assert.equal(estPanneDeTransport(undefined), false);
  assert.equal(estPanneDeTransport("AuthRetryableFetchError"), false);
});

test("le délai reste sous la limite d'exécution d'un proxy", () => {
  assert.ok(AUTH_TIMEOUT_MS > 0 && AUTH_TIMEOUT_MS <= 5000);
});
