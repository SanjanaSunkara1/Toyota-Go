/* Educational scenarios, not vehicle ratings or financial advice.
 * No real-world brand advantage is implied by the editable default assumptions.
 */
const DealModel = (() => {
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  const retained = (price, yearFivePercent, year) =>
    price * Math.pow(yearFivePercent / 100, year / 5);
  const emissions = (car, miles) =>
    car.ev || car.fcev ? 0 : miles / car.mpg * 8.887;
  const payment = (price, down, apr) => {
    const principal = Math.max(0, price - down);
    const rate = apr / 12;
    return rate ? principal * rate / (1 - Math.pow(1 + rate, -60)) : principal / 60;
  };
  const balance = (price, down, apr, year) => {
    const principal = Math.max(0, price - down);
    const months = Math.min(60, Math.max(0, year * 12));
    const rate = apr / 12;
    if (months === 60) return 0;
    return Math.max(0, rate
      ? principal * Math.pow(1 + rate, months) - payment(price, down, apr) * (Math.pow(1 + rate, months) - 1) / rate
      : principal * (1 - months / 60));
  };
  function evaluate(car, plan, profile, scenario, apr) {
    const due = plan.id === "cash" ? car.price * 1.07
      : plan.id === "lease" ? Math.max(1500, Math.round(car.price * .03))
      : Math.min(car.price, profile.downPayment) + Math.round(car.price * .07);
    const monthly = plan.id === "cash" ? 0 : plan.id === "lease"
      ? car.price * .0061 : payment(car.price, Math.min(car.price, profile.downPayment), apr);
    const annualEnergy = profile.annualMiles * (car.ev ? .05 : car.fcev ? .4 : 3.5 / car.mpg);
    const monthlyOwnership = monthly + (annualEnergy + scenario.toyotaMaintenance) / 12;
    const monthlyFit = profile.monthlyCap > 0
      ? clamp(100 * (1 - monthlyOwnership / (profile.monthlyCap * 2))) : (monthlyOwnership === 0 ? 100 : 0);
    const savingsFit = profile.totalFunds > 0
      ? clamp(100 * (1 - (due + 300) / profile.totalFunds)) : 0;
    const financial = clamp(monthlyFit * .55 + savingsFit * .25
      + (plan.id === "lease" ? 0 : scenario.toyotaRetention) * .20);
    const baselineCO2 = profile.annualMiles / scenario.currentMpg * 8.887;
    const co2 = emissions(car, profile.annualMiles);
    const ecological = baselineCO2 > 0 ? clamp(50 + (baselineCO2 - co2) / baselineCO2 * 50) : 50;
    const safety = scenario.toyotaSafety;
    const reliability = clamp(100 - scenario.toyotaMaintenance / 20);
    return {
      score: Math.round(clamp(financial * .45 + ecological * .25 + safety * .20 + reliability * .10)),
      financial: Math.round(financial), ecological: Math.round(ecological),
      safety, reliability: Math.round(reliability), monthlyOwnership, co2, baselineCO2,
      monthly, due
    };
  }
  return { clamp, retained, emissions, payment, balance, evaluate };
})();
