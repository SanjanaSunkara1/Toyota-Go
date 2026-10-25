const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = {window:{}};
const game = fs.readFileSync("game.js", "utf8").split('document.querySelector("#signup-tab").addEventListener')[0];
vm.runInNewContext(
  fs.readFileSync("catalog.js", "utf8") + "\n" + fs.readFileSync("cars.js", "utf8") +
  "\n" + game + "\nglobalThis.subject={matchingVehicles,state,cars,plans,planIsAffordable,planAffordabilityIssues};", context);
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
test("lease and cash previews explain limits without weakening eligibility", () => {
  const {plans,planIsAffordable,planAffordabilityIssues} = context.subject;
  const lease = plans.find(p=>p.id==="lease"), cash = plans.find(p=>p.id==="cash");
  const car = cars.find(c=>c.price<30000);
  const prior = state.profile;
  try {
    state.profile = {...base, totalFunds:12000, annualMiles:15000, skippedQuestions:[]};
    assert.equal(planIsAffordable(car,lease),false);
    assert(planAffordabilityIssues(car,lease).some(message=>message.includes("10,000 miles/year")));
    assert.equal(planIsAffordable(car,cash),false);
    assert(planAffordabilityIssues(car,cash).some(message=>message.includes("available savings")));
    state.profile = {...state.profile,totalFunds:100000,annualMiles:10000};
    assert.equal(planIsAffordable(car,lease),true);
    assert.equal(planIsAffordable(car,cash),true);
    state.profile = {...state.profile,totalFunds:1,annualMiles:30000,skippedQuestions:["total-funds","mileage"]};
    assert.equal(planIsAffordable(car,lease),true);
    assert.equal(planIsAffordable(car,cash),true);
  } finally {
    state.profile = prior;
  }
});
