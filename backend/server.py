from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'profamilia_conecta')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app without a prefix
app = FastAPI(
    title="Pró-Família Conecta API",
    description="API Backend para a plataforma Pró-Família Conecta",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# WhatsApp Models
class WhatsAppMessage(BaseModel):
    number: str
    text: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# WhatsApp Proxy Endpoint
@api_router.post("/whatsapp/send")
async def send_whatsapp_message(message: WhatsAppMessage):
    """
    Proxy para enviar mensagem via Evolution API
    Evita problema de Mixed Content (HTTPS -> HTTP)
    """
    try:
        whatsapp_url = os.environ.get('WHATSAPP_API_URL')
        whatsapp_key = os.environ.get('WHATSAPP_API_KEY')
        
        if not whatsapp_url or not whatsapp_key:
            raise HTTPException(status_code=503, detail="WhatsApp API não configurada")
        
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            response = await http_client.post(
                f"{whatsapp_url}/message/sendText/admin_profamilia",
                json={
                    "number": message.number,
                    "text": message.text
                },
                headers={
                    "apikey": whatsapp_key,
                    "Content-Type": "application/json"
                }
            )
            
            response.raise_for_status()
            return {"success": True, "data": response.json()}
            
    except httpx.HTTPError as e:
        logger.error(f"WhatsApp API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar mensagem: {str(e)}")
    except Exception as e:
        logger.error(f"Erro inesperado: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()