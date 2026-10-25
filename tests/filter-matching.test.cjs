const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = {window:{}};
const game = fs.readFileSync("game.js", "utf8").split('document.querySelector("#signup-tab").addEventListener')[0];
vm.runInNewContext(
  fs.readFileSync("catalog.js", "utf8") + "\n" + fs.readFileSync("cars.js", "utf8") +
  "\n" + game + "\nglobalThis.subject={matchingVehicles,state,cars};", context);
const {matchingVehicles, state, cars} = context.subject;
const base = {
  modelFamily:"any", modelYear:"any", bodyStyle:"any", passengers:2, childSeats:false,
  awd:false, fuelInterest:"any", preferredPlan:"any", downPayment:0,
  totalFunds:100000, maxPrice:100000, monthlyCap:2000, annualMiles:12000,
  creditTier:"unknown", skippedQuestions:["max-price","monthly-cap","total-funds","mileage"],
};
test("preview respects combinations without changing the active profile or prices", () => {
  const prior = state.profile;
  const prices = cars.map(car => car.price);
  assert.equal(matchingVehicles(base).length,43);
  assert.equal(matchingVehicles({...base, fuelInterest:"fcev"}).length,1);
  assert.equal(matchingVehicles({...base, bodyStyle:"truck", fuelInterest:"ev"}).length,0);
  matchingVehicles({...base, awd:true});
  assert.equal(state.profile,prior);
  assert.deepEqual(cars.map(car => car.price),prices);
});
test("price and payment limits are never silently relaxed", () => {
  assert.equal(matchingVehicles({...base,maxPrice:1,skippedQuestions:[]}).length,0);
  assert.equal(matchingVehicles({...base,monthlyCap:1,preferredPlan:"loan",skippedQuestions:[]}).length,0);
  const matches = matchingVehicles({...base,bodyStyle:"truck",fuelInterest:"hybrid",modelYear:"2026",maxPrice:70000,skippedQuestions:["monthly-cap","total-funds","mileage"]});
  assert.equal(matches.length,2);
  assert(matches.every(car => car.price<=70000 && car.body==="truck" && car.hybrid && car.year===2026));
});
