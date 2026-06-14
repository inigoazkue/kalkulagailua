import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from app.parsers.base import BaseParser, ParsedTransaction


class TradeRepublicParser(BaseParser):
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        text = file_bytes.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))

        if reader.fieldnames is None:
            raise ValueError("Empty or invalid CSV file")

        fieldnames_lower = {f.strip().lower(): f.strip() for f in reader.fieldnames}

        date_col = self._find_col(fieldnames_lower, ["date", "fecha", "buchungsdatum", "booking date"])
        desc_col = self._find_col(fieldnames_lower, ["description", "concepto", "buchungstext", "reference", "type"])
        amount_col = self._find_col(fieldnames_lower, ["amount", "importe", "betrag", "value"])
        balance_col = self._find_col(fieldnames_lower, ["balance", "saldo", "kontostand"])

        if not date_col or not desc_col or not amount_col:
            raise ValueError(f"Required columns not found. Available: {list(fieldnames_lower.keys())}")

        results = []
        for row in reader:
            raw_date = row.get(date_col, "").strip()
            raw_desc = row.get(desc_col, "").strip()
            raw_amount = row.get(amount_col, "").strip()

            if not raw_date or not raw_desc or not raw_amount:
                continue

            try:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%Y/%m/%d"):
                    try:
                        tx_date = datetime.strptime(raw_date[:10], fmt).date()
                        break
                    except ValueError:
                        continue
                else:
                    continue
            except Exception:
                continue

            try:
                amount_str = raw_amount.replace(",", ".").replace(" ", "")
                amount = Decimal(amount_str)
            except InvalidOperation:
                continue

            balance: Optional[Decimal] = None
            if balance_col:
                raw_bal = row.get(balance_col, "").strip()
                if raw_bal:
                    try:
                        balance = Decimal(raw_bal.replace(",", ".").replace(" ", ""))
                    except InvalidOperation:
                        pass

            results.append(ParsedTransaction(
                date=tx_date,
                description=raw_desc,
                amount=amount,
                balance=balance,
            ))

        return results

    def _find_col(self, fieldnames_lower: dict, candidates: list[str]) -> Optional[str]:
        for candidate in candidates:
            if candidate in fieldnames_lower:
                return fieldnames_lower[candidate]
        for candidate in candidates:
            for key, original in fieldnames_lower.items():
                if candidate in key:
                    return original
        return None
