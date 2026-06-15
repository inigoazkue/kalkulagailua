import asyncio
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models import Category, CategoryKeyword, CategoryTypeEnum
from app.routers import transactions, categories, investments, imports, accounts, transfers, backup
from app.routers import auth as auth_router
from app.auth import verify_token
from app.services.categorizer import auto_categorize_all

app = FastAPI(title="Kalkulagailua API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)

protected = {"dependencies": [Depends(verify_token)]}
app.include_router(transactions.router, prefix="/api", **protected)
app.include_router(categories.router, prefix="/api", **protected)
app.include_router(investments.router, prefix="/api", **protected)
app.include_router(imports.router, prefix="/api", **protected)
app.include_router(accounts.router, prefix="/api", **protected)
app.include_router(transfers.router, prefix="/api", **protected)
app.include_router(backup.router, prefix="/api", **protected)

DEFAULT_CATEGORIES = [
    {"name": "Nómina", "category_type": CategoryTypeEnum.income, "color": "#22c55e", "keywords": ["nomina", "nómina", "salario"]},
    {"name": "Alquiler", "category_type": CategoryTypeEnum.fixed_expense, "color": "#ef4444", "keywords": ["alquiler"]},
    {"name": "Hipoteca", "category_type": CategoryTypeEnum.fixed_expense, "color": "#ef4444", "keywords": ["hipoteca"]},
    {"name": "Supermercado", "category_type": CategoryTypeEnum.variable_expense, "color": "#f97316", "keywords": ["mercadona", "lidl", "aldi", "carrefour", "eroski", "supermercado"]},
    {"name": "Restaurantes", "category_type": CategoryTypeEnum.variable_expense, "color": "#f97316", "keywords": ["restaurante", "bar ", "cafeteria", "cafetería", "mcdonalds", "burger"]},
    {"name": "Transporte", "category_type": CategoryTypeEnum.variable_expense, "color": "#3b82f6", "keywords": ["renfe", "metro", "bus ", "taxi", "uber", "cabify", "gasolinera", "gasolina"]},
    {"name": "Inversión", "category_type": CategoryTypeEnum.investment, "color": "#8b5cf6", "keywords": ["inversion", "inversión", "trade republic", "myinvestor", "degiro", "etf", "fondo"]},
    {"name": "Salud", "category_type": CategoryTypeEnum.variable_expense, "color": "#06b6d4", "keywords": ["farmacia", "médico", "medico", "hospital", "clinica", "clínica", "sanidad"]},
    {"name": "Ocio", "category_type": CategoryTypeEnum.variable_expense, "color": "#ec4899", "keywords": ["netflix", "spotify", "amazon prime", "cine", "teatro", "concierto"]},
    {"name": "Ahorro", "category_type": CategoryTypeEnum.savings, "color": "#10b981", "keywords": []},
]


async def _auto_categorize_loop():
    await asyncio.sleep(15 * 60)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await auto_categorize_all(db)
        except Exception:
            pass
        await asyncio.sleep(15 * 60)


@app.on_event("startup")
async def start_background_tasks():
    asyncio.create_task(_auto_categorize_loop())


@app.on_event("startup")
async def seed_default_categories():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count()).select_from(Category))
        count = result.scalar()
        if count == 0:
            for cat_data in DEFAULT_CATEGORIES:
                keywords = cat_data.pop("keywords")
                category = Category(**cat_data, is_default=True)
                session.add(category)
                await session.flush()
                for kw in keywords:
                    session.add(CategoryKeyword(category_id=category.id, keyword=kw))
                cat_data["keywords"] = keywords
            await session.commit()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
