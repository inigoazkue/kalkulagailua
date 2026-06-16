import hashlib
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional


def fix_mojibake(text: str) -> str:
    """Corrige texto UTF-8 decodificado incorrectamente una o dos veces.

    Algunos exportadores (ej. MyInvestor) generan CSVs donde los caracteres
    acentuados quedan re-codificados: 'ó' (UTF-8: 0xC3 0xB3) se reinterpreta
    como Latin-1 ('Ã³'), y a veces ese resultado se vuelve a codificar en
    UTF-8 una segunda vez ('ÃÂ³'). Revertimos aplicando encode('latin-1') +
    decode('utf-8') hasta 2 veces; si el texto no es mojibake, el encode/decode
    falla de inmediato (UnicodeError) y se devuelve el texto original intacto.
    """
    fixed = text
    for _ in range(2):
        try:
            candidate = fixed.encode("latin-1").decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            break
        if candidate == fixed:
            break
        fixed = candidate
    return fixed


@dataclass
class ParsedTransaction:
    date: date
    description: str
    amount: Decimal
    balance: Optional[Decimal] = None

    def to_hash(self, occurrence: int = 1) -> str:
        if occurrence == 1:
            # Backward-compatible: matches hashes already stored in the DB
            raw = f"{self.date}|{self.description}|{self.amount}"
        else:
            # Disambiguate duplicate (date, description, amount) within the same file.
            # Use running balance when available (always unique); otherwise use position counter.
            suffix = str(self.balance) if self.balance is not None else f"occ:{occurrence}"
            raw = f"{self.date}|{self.description}|{self.amount}|{suffix}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class ParsedMetadata:
    iban: Optional[str] = None
    current_balance: Optional[Decimal] = None


class BaseParser:
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        raise NotImplementedError

    def parse_metadata(self, file_bytes: bytes) -> ParsedMetadata:
        return ParsedMetadata()
