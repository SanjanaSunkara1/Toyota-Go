const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const context = {};
vm.runInNewContext(fs.readFileSync("catalog.js","utf8") + "\n" + fs.readFileSync("cars.js","utf8") + "\nglobalThis.library = cars;",context);
const cars = context.library;
test("complete manufacturer snapshot has 43 unique model-year entries across 31 families", () => {
  assert.equal(cars.length,43);
  assert.equal(new Set(cars.map(car=>car.id)).size,43);
  assert.equal(new Set(cars.map(car=>car.family)).size,31);
  assert(cars.some(car=>car.id==="tacomahybrid"));
  assert(cars.some(car=>car.id==="tundrahybrid"));
});
test("catalog preserves model-year-specific prices, seating and correct official photo paths", () => {
  assert.equal(cars.find(car=>car.id==="corolla-2026").price,23125);
  assert.equal(cars.find(car=>car.id==="corolla").price,23325);
  assert.equal(cars.find(car=>car.id==="highlanderhybrid").seats,8);
  assert(cars.find(car=>car.id==="priusphev").images[0].includes("/2027/priuspluginhybrid/"));
  assert(cars.find(car=>car.id==="chr").images[0].includes("/2027/c-hr/"));
  cars.forEach(car=>assert(car.price>0 && Number.isInteger(car.year) && car.images.length && car.url.startsWith("https://www.toyota.com/")));
});
test("standard AWD and powertrain flags stay correct for older model-year entries", () => {
  assert(cars.find(car=>car.id==="bzwoodland-2026").awdStd);
  assert(cars.find(car=>car.id==="bzwoodland-2026").ev);
  assert(cars.find(car=>car.id==="priusphev").phev);
  assert(!cars.find(car=>car.id==="corolla").hybrid);
  assert(cars.find(car=>car.id==="tacomahybrid").hybrid);
});
