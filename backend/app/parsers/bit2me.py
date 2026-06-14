import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
import pandas as pd
from app.parsers.base import BaseParser, ParsedTransaction


class Bit2meParser(BaseParser):
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        df = pd.read_excel(io.BytesIO(file_bytes), header=None)

        header_row = None
        for i, row in df.iterrows():
            row_vals = [str(v).strip().lower() for v in row.values]
            if any("fecha" in v or "date" in v for v in row_vals):
                header_row = i
                break

        if header_row is None:
            raise ValueError("Could not find header row")

        df = pd.read_excel(io.BytesIO(file_bytes), header=header_row)
        df.columns = [str(c).strip() for c in df.columns]

        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if ("fecha" in lower or "date" in lower) and "date" not in col_map:
                col_map["date"] = col
            elif "tipo" in lower or "type" in lower or "operaci" in lower:
                col_map["description"] = col
            elif "importe" in lower or "cantidad" in lower or "amount" in lower or "precio" in lower:
                if "amount" not in col_map:
                    col_map["amount"] = col
            elif "total" in lower and "eur" in lower:
                col_map["amount"] = col

        if "description" not in col_map:
            for col in df.columns:
                lower = col.lower()
                if "concepto" in lower or "descripci" in lower or "activo" in lower:
                    col_map["description"] = col
                    break

        if not all(k in col_map for k in ["date", "description", "amount"]):
            col_list = list(df.columns)
            if len(col_list) >= 3:
                col_map["date"] = col_list[0]
                col_map["description"] = col_list[1]
                col_map["amount"] = col_list[2]
            else:
                raise ValueError(f"Could not identify required columns. Available: {list(df.columns)}")

        results = []
        for _, row in df.iterrows():
            raw_date = row[col_map["date"]]
            raw_desc = row[col_map["description"]]
            raw_amount = row[col_map["amount"]]

            if pd.isna(raw_date) or pd.isna(raw_desc) or pd.isna(raw_amount):
                continue

            try:
                if isinstance(raw_date, str):
                    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
                        try:
                            tx_date = datetime.strptime(raw_date.strip()[:10], fmt).date()
                            break
                        except ValueError:
                            continue
                    else:
                        continue
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
                try:
                    amount_str = str(raw_amount).replace(",", ".")
                    amount = Decimal(amount_str)
                except InvalidOperation:
                    continue

            results.append(ParsedTransaction(
                date=tx_date,
                description=f"Bit2me: {description}",
                amount=amount,
                balance=None,
            ))

        return results
