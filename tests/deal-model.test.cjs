const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const model = vm.runInNewContext(fs.readFileSync("insights-model.js", "utf8") + "\nDealModel;");
const scenario = {
  toyotaRetention: 60, toyotaMaintenance: 500, toyotaSafety: 80, currentMpg: 25,
};
const profile = { downPayment: 4000, monthlyCap: 550, totalFunds: 12000, annualMiles: 12000 };
const car = { price: 29700, mpg: 50 };
const loan = { id: "loan" };
test("retention hits the editable endpoints", () => {
  assert.equal(model.retained(30000, 60, 0), 30000);
  assert.equal(model.retained(30000, 60, 5), 18000);
  assert.ok(model.retained(30000, 60, 2) > model.retained(30000, 60, 3));
});
test("amortization, zero interest and full down payment", () => {
  assert.equal(model.balance(30000, 5000, .078, 0), 25000);
  assert.equal(model.balance(30000, 5000, .078, 5), 0);
  assert.equal(model.balance(30000, 0, 0, 3), 12000);
  assert.equal(model.payment(30000, 30000, .078), 0);
  assert.equal(model.payment(30000, 0, 0), 500);
});
test("financial filters and maintenance affect the instant score", () => {
  const original = model.evaluate(car, loan, profile, scenario, .078);
  const tighter = model.evaluate(car, loan, { ...profile, monthlyCap: 200 }, scenario, .078);
  const costlier = model.evaluate(car, loan, profile, { ...scenario, toyotaMaintenance: 2000 }, .078);
  assert.ok(original.score > tighter.score);
  assert.ok(original.score > costlier.score);
  assert.ok(original.score >= 0 && original.score <= 100);
});
test("CO2 uses annual mileage and gasoline MPG, zero tailpipe for EV/FCEV", () => {
  assert.equal(model.emissions(car, 12000), 12000 / 50 * 8.887);
  assert.equal(model.emissions({ ev: true }, 12000), 0);
  assert.equal(model.emissions({ fcev: true }, 12000), 0);
  assert.equal(model.emissions(car, 24000), model.emissions(car, 12000) * 2);
});
test("lease has no resale ownership benefit; each payment mode has valid values", () => {
  const leased = model.evaluate(car, { id: "lease" }, profile, scenario, .078);
  const cash = model.evaluate(car, { id: "cash" }, profile, scenario, .078);
  assert.equal(leased.monthly, car.price * .0061);
  assert.equal(cash.monthly, 0);
  assert.equal(cash.due, car.price * 1.07);
  for (const item of [leased, cash]) for (const value of Object.values(item)) assert.ok(Number.isFinite(value));
});
test("score components stay finite and bounded at extreme valid filters", () => {
  for (const monthlyCap of [0, 2000]) for (const totalFunds of [0, 100000]) {
    const result = model.evaluate(car, loan, { ...profile, monthlyCap, totalFunds }, scenario, .145);
    for (const key of ["score", "financial", "ecological", "safety", "reliability"]) {
      assert.ok(Number.isFinite(result[key]));
      assert.ok(result[key] >= 0 && result[key] <= 100);
    }
  }
});
