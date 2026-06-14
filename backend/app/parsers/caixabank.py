import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
import pandas as pd
from app.parsers.base import BaseParser, ParsedTransaction


class CaixaBankParser(BaseParser):
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        df = pd.read_excel(io.BytesIO(file_bytes), header=None)

        header_row = None
        for i, row in df.iterrows():
            row_vals = [str(v).strip().lower() for v in row.values]
            if "fecha" in row_vals and "concepto" in row_vals:
                header_row = i
                break

        if header_row is None:
            raise ValueError("Could not find header row with Fecha/Concepto columns")

        df = pd.read_excel(io.BytesIO(file_bytes), header=header_row)
        df.columns = [str(c).strip() for c in df.columns]

        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if "fecha" in lower:
                col_map["date"] = col
            elif "concepto" in lower or "descripci" in lower:
                col_map["description"] = col
            elif "importe" in lower:
                col_map["amount"] = col
            elif "saldo" in lower:
                col_map["balance"] = col

        required = ["date", "description", "amount"]
        for r in required:
            if r not in col_map:
                raise ValueError(f"Missing required column: {r}")

        results = []
        for _, row in df.iterrows():
            raw_date = row[col_map["date"]]
            raw_desc = row[col_map["description"]]
            raw_amount = row[col_map["amount"]]

            if pd.isna(raw_date) or pd.isna(raw_desc) or pd.isna(raw_amount):
                continue

            try:
                if isinstance(raw_date, str):
                    tx_date = datetime.strptime(raw_date.strip(), "%d/%m/%Y").date()
                else:
                    tx_date = pd.Timestamp(raw_date).date()
            except Exception:
                continue

            description = str(raw_desc).strip()
            if not description:
                continue

            try:
                amount_str = str(raw_amount).replace(".", "").replace(",", ".")
                amount = Decimal(amount_str)
            except InvalidOperation:
                continue

            balance: Optional[Decimal] = None
            if "balance" in col_map and not pd.isna(row.get(col_map["balance"])):
                try:
                    bal_str = str(row[col_map["balance"]]).replace(".", "").replace(",", ".")
                    balance = Decimal(bal_str)
                except InvalidOperation:
                    pass

            results.append(ParsedTransaction(
                date=tx_date,
                description=description,
                amount=amount,
                balance=balance,
            ))

        return results
