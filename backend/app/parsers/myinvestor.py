import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
import pandas as pd
from app.parsers.base import BaseParser, ParsedTransaction, fix_mojibake


def _read_csv(file_bytes: bytes, header_row) -> pd.DataFrame:
    for encoding in ("utf-8-sig", "latin-1", "utf-8"):
        for sep in (";", ","):
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, header=header_row, encoding=encoding)
                if df.shape[1] >= 3:
                    return df
            except Exception:
                continue
    raise ValueError("No se pudo leer el CSV de MyInvestor")


class MyInvestorParser(BaseParser):
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        raw = _read_csv(file_bytes, None)

        header_row = None
        for i, row in raw.iterrows():
            row_vals = [str(v).strip().lower() for v in row.values]
            if any("fecha" in v for v in row_vals):
                header_row = i
                break

        if header_row is None:
            raise ValueError("No se encontró la cabecera con Fecha")

        df = _read_csv(file_bytes, header_row)
        df.columns = [str(c).strip() for c in df.columns]

        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if "fecha" in lower and "date" not in col_map:
                col_map["date"] = col
            elif "concepto" in lower or "descripci" in lower or "movimiento" in lower:
                col_map["description"] = col
            elif "importe" in lower or "cantidad" in lower or "amount" in lower:
                col_map["amount"] = col
            elif "saldo" in lower:
                col_map["balance"] = col

        if not all(k in col_map for k in ["date", "description", "amount"]):
            raise ValueError(f"Columnas no encontradas. Detectadas: {list(df.columns)}")

        results = []
        for _, row in df.iterrows():
            raw_date = row[col_map["date"]]
            raw_desc = row[col_map["description"]]
            raw_amount = row[col_map["amount"]]

            if pd.isna(raw_date) or pd.isna(raw_desc) or pd.isna(raw_amount):
                continue

            try:
                if isinstance(raw_date, str):
                    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                        try:
                            tx_date = datetime.strptime(raw_date.strip(), fmt).date()
                            break
                        except ValueError:
                            continue
                    else:
                        continue
                else:
                    tx_date = pd.Timestamp(raw_date).date()
            except Exception:
                continue

            description = fix_mojibake(str(raw_desc).strip())
            if not description:
                continue

            try:
                amount_str = str(raw_amount).strip().replace(".", "").replace(",", ".")
                amount = Decimal(amount_str)
            except InvalidOperation:
                continue

            balance: Optional[Decimal] = None
            if "balance" in col_map:
                raw_bal = row.get(col_map["balance"])
                if raw_bal is not None and not pd.isna(raw_bal):
                    try:
                        balance = Decimal(str(raw_bal).strip().replace(".", "").replace(",", "."))
                    except InvalidOperation:
                        pass

            results.append(ParsedTransaction(date=tx_date, description=description, amount=amount, balance=balance))

        return results
