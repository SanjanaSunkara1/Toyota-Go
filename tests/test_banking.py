"""Deterministic sandbox math, transfer safety, and upstream boundary tests."""
import copy
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from banking import FinanceError, Nessie, SandboxService, analyze, sample_accounts, sample_records, cents


class BankingTests(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 10, 25)
        self.accounts = sample_accounts("balanced")
        self.records = sample_records("balanced", self.today)
        self.service = SandboxService()
        _, self.session = self.service.session()

    def result(self, **kwargs):
        return analyze(self.accounts, self.records, today=self.today, **kwargs)

    def transfer(self, **changes):
        return self.service.run(self.session, "reserve", {
            "mode": "sample", "scenario": "balanced", "source_id": "demo-checking",
            "payee_id": "demo-savings", "amount": "2000.01", "confirmed": True,
            "idempotency_key": "test-transfer-000001", **changes,
        })

    def test_balanced_cashflow_and_apr_are_explicit_scenarios(self):
        result = self.result()
        self.assertEqual(result["income_monthly"], 6000)
        self.assertEqual(result["bills_monthly"], 2270)
        self.assertEqual(result["debt_monthly"], 600)
        self.assertEqual(result["gas_monthly"], 240)
        self.assertEqual(result["other_spending_monthly"], 800)
        self.assertEqual(result["disposable_monthly"], 2090)
        self.assertEqual(result["safety_buffer"], 1200)
        self.assertEqual(result["payment_budget"], 890)
        self.assertEqual(result["liquid_balance"], 22500)
        self.assertEqual(result["apr"], 1.9)
        self.assertIn("not lender DTI", result["ratio_basis"])
        self.assertAlmostEqual(result["debt_ratio"], .1)
        self.assertEqual(self.result(gross=8000)["debt_ratio"], .075)

    def test_tight_profile_has_no_apr_or_positive_budget(self):
        result = analyze(sample_accounts("tight"), sample_records("tight", self.today), today=self.today)
        self.assertLess(result["disposable_monthly"], 0)
        self.assertEqual(result["payment_budget"], 0)
        self.assertIsNone(result["apr"])

    def test_loan_principal_is_not_a_monthly_payment(self):
        self.records["loans"] = [{"_id": "existing-loan", "amount": 20000}]
        result = self.result()
        self.assertFalse(result["complete"])
        self.assertIsNone(result["payment_budget"])
        self.assertIsNone(result["apr"])

    def test_nonrecurring_bills_withhold_suggestion(self):
        self.records["bills"].append({"payment_amount": 100})
        self.assertFalse(self.result()["complete"])
        self.assertIsNone(self.result()["apr"])

    def test_future_pending_and_internal_income_are_excluded(self):
        for extra in [
            {"transaction_date": (self.today + timedelta(days=1)).isoformat()},
            {"transaction_date": self.today.isoformat(), "status": "pending"},
            {"transaction_date": self.today.isoformat(), "description": "Internal transfer"},
        ]:
            self.records["deposits"].append({"amount": 99999, **extra})
        self.assertEqual(self.result()["income_monthly"], 6000)

    def test_missing_income_is_not_replaced_with_demo_income(self):
        self.records["deposits"] = []
        result = self.result()
        self.assertIsNone(result["payment_budget"])
        self.assertIsNone(result["apr"])
        self.assertIsNone(result["debt_ratio"])

    def test_sample_transfer_exact_cents_and_idempotency(self):
        receipt = self.transfer()
        self.assertEqual(receipt["status"], "completed")
        self.assertEqual(receipt["source_balance"], 12499.99)
        self.assertEqual(receipt["payee_balance"], 10000.01)
        self.assertEqual(self.transfer(), receipt)
        self.assertEqual(self.service.accounts(self.session, "sample", "balanced")[0]["balance"], 12499.99)
        with self.assertRaises(FinanceError) as caught:
            self.transfer(amount="2000.02")
        self.assertEqual(caught.exception.status, 409)

    def test_unsafe_or_unconfirmed_transfers_are_rejected(self):
        for changes in [
            {"confirmed": False}, {"amount": -1}, {"amount": "0.001"}, {"amount": 20000},
            {"source_id": "demo-savings"}, {"payee_id": "demo-checking"},
            {"payee_id": "nonexistent"}, {"amount": float("nan")},
        ]:
            with self.subTest(changes=changes), self.assertRaises(FinanceError):
                self.transfer(**changes)
        self.assertEqual(self.service.accounts(self.session, "sample", "balanced")[0]["balance"], 14500)

    def test_scenarios_and_sessions_do_not_share_balances(self):
        self.transfer()
        _, other = self.service.session()
        self.assertEqual(self.service.accounts(other, "sample", "balanced")[0]["balance"], 14500)
        self.assertEqual(self.service.accounts(self.session, "sample", "tight")[0]["balance"], 900)

    def test_cross_customer_transfer_rejected(self):
        self.service.accounts(self.session, "sample", "balanced")[1]["customer_id"] = "other-driver"
        with self.assertRaises(FinanceError):
            self.transfer()

    def test_duplicate_and_foreign_analysis_accounts_rejected(self):
        for ids in [[], ["demo-checking", "demo-checking"], ["other"], [{}]]:
            with self.subTest(ids=ids), self.assertRaises(FinanceError):
                self.service.run(self.session, "analyze", {"account_ids": ids})

    def test_savings_only_analysis_does_not_invent_salary(self):
        result = self.service.run(self.session, "analyze", {"account_ids": ["demo-savings"]})
        self.assertEqual(result["income_monthly"], 0)
        self.assertIsNone(result["payment_budget"])

    def test_uncertain_upstream_transfer_is_never_repeated(self):
        accounts = copy.deepcopy(self.accounts)
        payload = {"confirmed": True, "source_id": "demo-checking", "payee_id": "demo-savings",
                   "amount": 100, "idempotency_key": "uncertain-transfer-00001"}
        with patch("banking.Nessie") as provider:
            provider.return_value.request.side_effect = FinanceError("timeout", 502)
            first = self.service.reserve(self.session, accounts, "nessie", "balanced", payload)
            second = self.service.reserve(self.session, accounts, "nessie", "balanced", payload)
            self.assertEqual(first["status"], "unknown")
            self.assertEqual(first, second)
            self.assertEqual(provider.return_value.request.call_count, 1)
            self.assertEqual(accounts[0]["balance"], 14500)

    def test_nessie_records_keep_endpoint_and_merchant_mapping(self):
        provider = object.__new__(Nessie)
        paths = []
        def rows(path):
            paths.append(path)
            return [{"merchant_id": "m", "amount": 60, "purchase_date": "2026-10-20"}] if path.endswith("/purchases") else []
        with patch.object(provider, "rows", side_effect=rows), patch.object(provider, "request", return_value={"name": "Sample fuel", "category": ["gas station"]}):
            records = provider.records(["sample-id"])
        self.assertEqual(paths, ["/accounts/sample-id/" + name for name in ["deposits", "bills", "loans", "purchases"]])
        self.assertEqual(records["purchases"][0]["category"], ["gas station"])

    def test_invalid_modes_and_amounts_fail_explicitly(self):
        for mode in ["real", [], None]:
            with self.assertRaises(FinanceError):
                self.service.run(self.session, "accounts", {"mode": mode})
        for value in [0, True, float("inf"), "bad", "1.001"]:
            with self.assertRaises(FinanceError):
                cents(value)


if __name__ == "__main__":
    unittest.main()
