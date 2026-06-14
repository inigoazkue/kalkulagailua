import hashlib
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional


@dataclass
class ParsedTransaction:
    date: date
    description: str
    amount: Decimal
    balance: Optional[Decimal] = None

    def to_hash(self) -> str:
        raw = f"{self.date}|{self.description}|{self.amount}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class BaseParser:
    def parse(self, file_bytes: bytes) -> list[ParsedTransaction]:
        raise NotImplementedError
