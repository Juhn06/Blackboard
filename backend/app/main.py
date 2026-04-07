from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from .models import (
    user,
    workspace,
    board,
    list,
    card,
    comment,
    board_note
)
from .auth.password import hash_password

from .routers import (
    auth,
    workspaces,
    boards,
    lists,
    cards,
    comments,
    board_notes
)

# create tables
user.Base.metadata.create_all(bind=engine)
workspace.Base.metadata.create_all(bind=engine)
board.Base.metadata.create_all(bind=engine)
list.Base.metadata.create_all(bind=engine)
card.Base.metadata.create_all(bind=engine)
comment.Base.metadata.create_all(bind=engine)
board_note.Base.metadata.create_all(bind=engine)

# seed admin user
def seed_admin():
    db: Session = SessionLocal()
    try:
        admin_user = db.query(user.User).filter(user.User.email == "admin@gmail.com").first()
        if not admin_user:
            hashed_password = hash_password("123456")
            admin = user.User(
                email="admin@gmail.com",
                name="Admin",
                password_hash=hashed_password
            )
            db.add(admin)
            db.commit()
            print("Admin user created: admin@gmail.com / 123456")
    finally:
        db.close()

seed_admin()

app = FastAPI()


# CORS (frontend React/Vite gọi được)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# auth
app.include_router(
    auth.router,
    prefix="/auth",
    tags=["Auth"]
)

# workspace
app.include_router(
    workspaces.router,
    prefix="/workspaces",
    tags=["Workspaces"]
)

# boards
app.include_router(
    boards.router,
    prefix="/boards",
    tags=["Boards"]
)

# lists
app.include_router(
    lists.router,
    prefix="/lists",
    tags=["Lists"]
)

# cards
app.include_router(
    cards.router,
    prefix="/cards",
    tags=["Cards"]
)

# comments
app.include_router(
    comments.router,
    prefix="/comments",
    tags=["Comments"]
)

# board notes
app.include_router(
    board_notes.router,
    prefix="/board-notes",
    tags=["Board Notes"]
)


@app.get("/")
def root():
    return {"message": "BlackBoard API running"}
