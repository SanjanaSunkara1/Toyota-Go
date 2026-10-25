"""Educational banking sandbox. Never accesses real bank accounts or TFS."""
import json
import math
import os
import re
import secrets
import threading
import time
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


class FinanceError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def amount(value):
    if isinstance(value, bool):
        raise FinanceError("Amounts must be numbers.")
    try:
        result = float(value)
    except (ValueError, TypeError):
        raise FinanceError("An amount is missing or invalid.") from None
    if not math.isfinite(result) or result < 0 or result > 10_000_000_000:
        raise FinanceError("Amounts must be finite and between zero and ten billion.")
    return result


def cents(value):
    try:
        result = Decimal(str(value))
    except InvalidOperation:
        raise FinanceError("Enter a positive amount with at most two decimal places.") from None
    if not result.is_finite() or result <= 0 or result > 100000 or result != result.quantize(Decimal(".01")):
        raise FinanceError("Enter an amount from $0.01 to $100,000 with at most two decimal places.")
    return int(result * 100)


def sample_accounts(scenario):
    tight = scenario == "tight"
    return [
        {"id": "demo-checking", "nickname": "Fictional commuter checking", "type": "Checking",
         "balance": 900 if tight else 14500, "customer_id": "fictional-driver"},
        {"id": "demo-savings", "nickname": "Demo reserve — not a TFS account", "type": "Savings",
         "balance": 300 if tight else 8000, "customer_id": "fictional-driver"},
    ]


def sample_records(scenario, today=None):
    today = today or date.today()
    deposits, purchases = [], []
    for offset in [15, 45, 75]:
        when = (today - timedelta(days=offset)).isoformat()
        deposits.append({"amount": 3400 if scenario == "tight" else 6000,
                         "transaction_date": when, "status": "completed", "description": "Sample salary"})
        for value, category in [(240, "gas station"), (600, "groceries"), (200, "other")]:
            purchases.append({"amount": value, "purchase_date": when, "status": "completed", "category": [category]})
    bills = [{"payment_amount": value, "recurring_date": 1, "payee": name}
             for value, name in [(1800, "Rent"), (240, "Utilities"), (80, "Phone"),
                                 (150, "Insurance"), (180, "Credit card")]]
    bills.append({"payment_amount": 420, "recurring_date": 1, "payee": "Existing auto loan", "loan_id": "existing-loan"})
    return {"deposits": deposits, "purchases": purchases, "bills": bills,
            "loans": [{"_id": "existing-loan", "monthly_payment": 420, "status": "approved"}]}


def analyze(accounts, records, gross=None, today=None):
    """90 observed days / three 30-day months; no prediction of future income."""
    today = today or date.today()
    start = today - timedelta(days=89)
    warnings = [
        "Deposits are an income proxy, not verified earnings. One-off deposits may distort this estimate.",
        "Uses 90 observed days divided into three 30-day months; future income and costs can differ.",
        "Unlinked bill and purchase records can overlap. Review sandbox data before using a budget.",
        "A 20% deposit-income buffer is a demo assumption, not a guarantee against financial strain.",
        "Illustrative APR tiers are not Toyota/TFS offers, lender decisions, or credit pre-approval.",
    ]
    complete = True

    def observed(row, field):
        nonlocal complete
        if str(row.get("status", "completed")).lower() in {"pending", "cancelled", "canceled", "denied"}:
            return False
        try:
            when = date.fromisoformat(str(row[field])[:10])
        except (ValueError, KeyError, TypeError):
            complete = False
            warnings.append("A transaction has no usable date; it was excluded.")
            return False
        return start <= when <= today

    deposits = 0
    for row in records["deposits"]:
        if observed(row, "transaction_date") and not re.search(r"\btransfer\b", str(row.get("description", "")), re.I):
            deposits += amount(row.get("amount"))

    debts = 0
    loan_ids = set()
    for row in records["loans"]:
        if row.get("status") in {"pending", "denied", "declined"}:
            continue
        loan_ids.add(row.get("_id"))
        if row.get("monthly_payment") is None:
            complete = False
            warnings.append("A loan has no monthly payment; its principal was not substituted for a payment.")
        else:
            debts += amount(row["monthly_payment"])

    bills = 0
    bill_ids = {row.get("_id") for row in records["bills"] if row.get("_id")}
    for row in records["bills"]:
        if row.get("status") in {"cancelled", "canceled"} or (row.get("loan_id") and row["loan_id"] in loan_ids):
            continue
        if not row.get("recurring_date"):
            complete = False
            warnings.append("A bill has no recurrence; a monthly amount cannot safely be inferred.")
            continue
        frequency = str(row.get("frequency", "monthly")).lower()
        factors = {"monthly": 1, "weekly": 52 / 12, "biweekly": 26 / 12, "annual": 1 / 12}
        if frequency not in factors:
            complete = False
            warnings.append("An unsupported bill recurrence was excluded.")
            continue
        value = amount(row.get("payment_amount")) * factors[frequency]
        if re.search(r"credit\s*card", str(row.get("payee", "")), re.I):
            debts += value
        else:
            bills += value

    gas = other = 0
    for row in records["purchases"]:
        if not observed(row, "purchase_date"):
            continue
        if (row.get("bill_id") in bill_ids and row.get("bill_id")) or (row.get("loan_id") in loan_ids and row.get("loan_id")):
            continue
        categories = " ".join(map(str, row.get("category", []))) if isinstance(row.get("category"), list) else str(row.get("category", ""))
        text = categories + " " + str(row.get("merchant_name", ""))
        if re.search(r"gas\s*station|fuel|gasoline|petrol", text, re.I):
            gas += amount(row.get("amount"))
        else:
            other += amount(row.get("amount"))
    income, gas, other = deposits / 3, gas / 3, other / 3
    if gross is not None:
        denominator = amount(gross)
        if denominator == 0:
            raise FinanceError("Gross monthly income must be greater than zero, or left blank.")
        basis = "User-entered gross monthly income"
    else:
        denominator = income
        basis = "Observed deposits proxy — not lender DTI"
    ratio = debts / denominator if denominator > 0 else None
    disposable = income - bills - debts - gas - other
    buffer = income * .2
    budget = max(0, disposable - buffer) if complete and income > 0 else None
    apr = None
    if budget and ratio is not None:
        apr = 1.9 if ratio <= .2 else 4.5 if ratio <= .36 else 8.9
    if not income:
        warnings.append("No observed income. No payment budget or APR scenario can be suggested.")
    if not complete:
        warnings.append("Incomplete records: payment-budget and APR suggestions are withheld.")
    return {
        "observed_from": start.isoformat(), "observed_to": today.isoformat(),
        "income_monthly": round(income, 2), "bills_monthly": round(bills, 2),
        "debt_monthly": round(debts, 2), "gas_monthly": round(gas, 2),
        "other_spending_monthly": round(other, 2),
        "liquid_balance": round(sum(amount(a["balance"]) for a in accounts if a["type"] in {"Checking", "Savings"}), 2),
        "disposable_monthly": round(disposable, 2), "safety_buffer": round(buffer, 2),
        "payment_budget": round(budget, 2) if budget is not None else None,
        "debt_ratio": ratio, "ratio_basis": basis, "apr": apr,
        "apr_label": "Illustrative APR scenario" if apr else "No APR scenario suggested",
        "complete": complete, "warnings": list(dict.fromkeys(warnings)),
    }


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Nessie:
    """Fixed HTTPS host; API key is used only by server requests and never logged."""
    def __init__(self):
        self.key = os.environ.get("NESSIE_API_KEY")
        if not self.key:
            raise FinanceError("Nessie API is not configured. Use explicitly labeled sample mode or add NESSIE_API_KEY through workspace Secrets.", 503)

    def request(self, path, data=None):
        url = "https://api.nessieisreal.com" + path + "?" + urlencode({"key": self.key})
        request = Request(url, data=json.dumps(data).encode() if data is not None else None,
                          headers={"Content-Type": "application/json", "Accept": "application/json"})
        try:
            with build_opener(NoRedirect()).open(request, timeout=10) as response:
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise FinanceError("Nessie returned too much data; narrow the sandbox dataset.", 502)
                return json.loads(raw)
        except HTTPError as exc:
            if exc.code in {401, 403}:
                raise FinanceError("Nessie rejected the configured API credential. Update it through workspace Secrets.", 502) from None
            raise FinanceError("Nessie rejected the request. Check your sandbox accounts and service availability.", 502) from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise FinanceError("Nessie could not be reached or returned invalid data. No sample data has been substituted.", 502) from None

    def rows(self, path):
        result = self.request(path)
        if not isinstance(result, list) or any(not isinstance(row, dict) for row in result):
            raise FinanceError("Unexpected Nessie response format.", 502)
        if len(result) > 1000:
            raise FinanceError("Too many sandbox records; use a smaller test account.", 502)
        return result

    def accounts(self):
        result = []
        for row in self.rows("/accounts"):
            if row.get("type") not in {"Checking", "Savings"}:
                continue
            if not row.get("_id") or not row.get("customer_id"):
                raise FinanceError("A Nessie account is missing its identifier or customer.", 502)
            result.append({"id": str(row["_id"]), "customer_id": str(row["customer_id"]),
                           "nickname": str(row.get("nickname") or row["type"]),
                           "type": row["type"], "balance": amount(row.get("balance"))})
        return result

    def records(self, ids):
        output = {name: [] for name in ("deposits", "bills", "loans", "purchases")}
        for account_id in ids:
            for name in output:
                output[name].extend(self.rows("/accounts/" + quote(account_id, safe="") + "/" + name))
        merchants = {}
        for row in output["purchases"]:
            merchant_id = row.get("merchant_id")
            if not merchant_id:
                continue
            if merchant_id not in merchants:
                if len(merchants) >= 40:
                    raise FinanceError("More than 40 merchants; narrow the sandbox dataset.", 502)
                merchants[merchant_id] = self.request("/merchants/" + quote(str(merchant_id), safe=""))
            merchant = merchants[merchant_id]
            if not isinstance(merchant, dict):
                raise FinanceError("Unexpected Nessie merchant format.", 502)
            row["category"] = merchant.get("category", [])
            row["merchant_name"] = merchant.get("name", "")
        return output


class SandboxService:
    def __init__(self):
        self.sessions = {}
        self.lock = threading.Lock()

    def session(self, token=None):
        with self.lock:
            now = time.time()
            self.sessions = {key: value for key, value in self.sessions.items() if now - value["created"] < 7200}
            if token in self.sessions:
                return token, self.sessions[token]
            if len(self.sessions) >= 256:
                raise FinanceError("Sandbox is busy. Try again later.", 503)
            token = secrets.token_urlsafe(32)
            session = {"created": now, "csrf": secrets.token_urlsafe(32), "ledgers": {}, "receipts": {}, "lock": threading.Lock()}
            self.sessions[token] = session
            return token, session

    def accounts(self, session, mode, scenario):
        if mode == "nessie":
            return Nessie().accounts()
        if scenario not in session["ledgers"]:
            session["ledgers"][scenario] = sample_accounts(scenario)
        return session["ledgers"][scenario]

    def run(self, session, action, payload):
        mode, scenario = payload.get("mode", "sample"), payload.get("scenario", "balanced")
        if not isinstance(mode, str) or not isinstance(scenario, str) or mode not in {"sample", "nessie"} or scenario not in {"balanced", "tight"}:
            raise FinanceError("Choose a supported sandbox mode and sample scenario.")
        with session["lock"]:
            accounts = self.accounts(session, mode, scenario)
            if action == "accounts":
                return {"mode": mode, "accounts": accounts}
            if action == "analyze":
                ids = payload.get("account_ids")
                if not isinstance(ids, list) or not 1 <= len(ids) <= 10 or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
                    raise FinanceError("Choose one to ten distinct checking/savings accounts.")
                selected = [a for a in accounts if a["id"] in ids]
                if len(selected) != len(ids):
                    raise FinanceError("One or more accounts are not available in this sandbox.", 403)
                records = Nessie().records(ids) if mode == "nessie" else (
                    sample_records(scenario) if "demo-checking" in ids else
                    {name: [] for name in ("deposits", "bills", "loans", "purchases")})
                result = analyze(selected, records, payload.get("gross_monthly_income"))
                return {"mode": mode, **result}
            if action == "reserve":
                return self.reserve(session, accounts, mode, scenario, payload)
            raise FinanceError("Unknown finance action.", 404)

    def reserve(self, session, accounts, mode, scenario, payload):
        if payload.get("confirmed") is not True:
            raise FinanceError("Review and explicitly confirm the test transfer first.")
        key = payload.get("idempotency_key", "")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,100}", key):
            raise FinanceError("A valid transfer idempotency key is required.")
        value = cents(payload.get("amount"))
        source_id, payee_id = payload.get("source_id"), payload.get("payee_id")
        fingerprint = (mode, scenario, source_id, payee_id, value)
        if key in session["receipts"]:
            previous = session["receipts"][key]
            if previous["fingerprint"] != fingerprint:
                raise FinanceError("This transfer key was already used for different details.", 409)
            return previous["result"]
        if len(session["receipts"]) >= 100:
            raise FinanceError("Test-transfer limit reached for this session.", 429)
        source = next((a for a in accounts if a["id"] == source_id), None)
        payee = next((a for a in accounts if a["id"] == payee_id), None)
        if not source or not payee or source_id == payee_id:
            raise FinanceError("Choose different available source and reserve accounts.")
        if source["customer_id"] != payee["customer_id"] or source["type"] != "Checking" or payee["type"] != "Savings":
            raise FinanceError("A demo reserve must move from checking to savings for the same fictional customer.")
        balance = int(Decimal(str(source["balance"])) * 100)
        if value > balance:
            raise FinanceError("The test transfer exceeds the source account's available balance.")
        result = {"mode": mode, "transfer_id": "demo-" + secrets.token_hex(8), "amount": value / 100,
                  "status": "completed", "source_balance": None, "payee_balance": None,
                  "message": "Fictional sample transfer completed. No real money moved; this is not a TFS account or deal reservation."}
        if mode == "nessie":
            result.update(status="unknown", message="Submission status is uncertain. Check the Nessie sandbox ledger before another transfer.")
            # Persist an uncertain receipt BEFORE networking; duplicate retries cannot submit twice.
            session["receipts"][key] = {"fingerprint": fingerprint, "result": result}
            try:
                response = Nessie().request("/accounts/" + quote(source_id, safe="") + "/transfers", {
                    "medium": "balance", "payee_id": payee_id, "amount": value / 100,
                    "transaction_date": date.today().isoformat(), "description": "Toyota Go sandbox reserve — not TFS",
                })
            except FinanceError:
                return result
            created = response.get("objectCreated") if isinstance(response, dict) else None
            if isinstance(created, dict) and created.get("_id"):
                result.update(status="pending", transfer_id=str(created["_id"]),
                              message="Nessie accepted the sandbox transfer. Settlement is not confirmed. No real money moved and no TFS reservation was made.")
        else:
            source["balance"] = (balance - value) / 100
            payee["balance"] = (int(Decimal(str(payee["balance"])) * 100) + value) / 100
            result.update(source_balance=source["balance"], payee_balance=payee["balance"])
        session["receipts"][key] = {"fingerprint": fingerprint, "result": result}
        return result


service = SandboxService()
