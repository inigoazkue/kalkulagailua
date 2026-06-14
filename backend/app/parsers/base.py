import hashlib
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional


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
