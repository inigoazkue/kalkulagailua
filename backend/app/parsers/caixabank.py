import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
import pandas as pd
from app.parsers.base import BaseParser, ParsedTransaction, ParsedMetadata


class CaixaBankParser(BaseParser):
    def parse_metadata(self, file_bytes: bytes) -> ParsedMetadata:
        iban = None
        try:
            for encoding in ("utf-8-sig", "latin-1", "utf-8"):
                for sep in (";", ","):
                    try:
                        df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, header=None, encoding=encoding, nrows=2)
                        if df.shape[1] >= 2:
                            # Row 1 (index 1): Titular;IBAN;...
                            raw_iban = str(df.iloc[1, 1]).strip()
                            if raw_iban.startswith("ES") or raw_iban.startswith("FR") or len(raw_iban) > 10:
                                iban = raw_iban
                            break
                    except Exception:
                        continue
                else:
                    continue
                break
        except Exception:
            pass

        # Current balance = Saldo of first (most recent) transaction
        current_balance = None
        try:
            txs = self.parse(file_bytes)
            if txs and txs[0].balance is not None:
                current_balance = txs[0].balance
        except Exception:
            pass

        return ParsedMetadata(iban=iban, current_balance=current_balance)


    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        for encoding in ("utf-8-sig", "latin-1", "utf-8"):
            for sep in (";", ","):
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, header=None, encoding=encoding)
                    if df.shape[1] >= 3:
                        break
                except Exception:
                    continue
            else:
                continue
            break

        header_row = None
        for i, row in df.iterrows():
            row_vals = [str(v).strip().lower() for v in row.values]
            if any("concepto" in v or "fecha" in v for v in row_vals) and any("importe" in v for v in row_vals):
                header_row = i
                break

        if header_row is None:
            raise ValueError("No se encontró la cabecera con Concepto/Importe")

        for encoding in ("utf-8-sig", "latin-1", "utf-8"):
            for sep in (";", ","):
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, header=header_row, encoding=encoding)
                    if df.shape[1] >= 3:
                        break
                except Exception:
                    continue
            else:
                continue
            break

        df.columns = [str(c).strip() for c in df.columns]

        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if "concepto" in lower or "descripci" in lower:
                col_map["description"] = col
            elif "fecha" in lower:
                col_map["date"] = col
            elif "importe" in lower:
                col_map["amount"] = col
            elif "saldo" in lower:
                col_map["balance"] = col

        for required in ["date", "description", "amount"]:
            if required not in col_map:
                raise ValueError(f"Columna requerida no encontrada: {required}. Columnas detectadas: {list(df.columns)}")

        results = []
        for _, row in df.iterrows():
            raw_date = row[col_map["date"]]
            raw_desc = row[col_map["description"]]
            raw_amount = row[col_map["amount"]]

            if pd.isna(raw_date) or pd.isna(raw_desc) or pd.isna(raw_amount):
                continue

            try:
                tx_date = datetime.strptime(str(raw_date).strip(), "%d/%m/%Y").date()
            except Exception:
                continue

            description = str(raw_desc).strip()
            if not description:
                continue

            # Importe usa punto como decimal (ej: -61.92), parseo directo
            try:
                amount = Decimal(str(raw_amount).strip())
            except InvalidOperation:
                continue

            # Saldo usa formato europeo con sufijo EUR (ej: 5.776,51EUR)
            balance: Optional[Decimal] = None
            if "balance" in col_map:
                raw_bal = row.get(col_map["balance"])
                if raw_bal is not None and not pd.isna(raw_bal):
                    try:
                        bal_str = str(raw_bal).strip().replace("EUR", "").replace(".", "").replace(",", ".")
                        balance = Decimal(bal_str)
                    except InvalidOperation:
                        pass

            results.append(ParsedTransaction(date=tx_date, description=description, amount=amount, balance=balance))

        return results
