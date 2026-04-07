from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import (
    user,
    workspace,
    board,
    list,
    card,
    comment,
    board_note
)

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