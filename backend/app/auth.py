"""Lightweight per-user request scoping.

The frontend authenticates with Clerk. After sign-in, every request to this
backend includes an ``X-User-Id`` header set to the Clerk user ID. The
dependency below extracts and requires that header so each route can scope
its query to the current user.

``sendBeacon`` (used by the reading tracker on page unload) cannot set
custom headers, so we also accept the same value via a ``user_id`` query
parameter as a fallback for that one code path.

This is intentionally simple: we trust the value because the backend is
only reachable from the same-origin frontend. If the backend ever moves to
a different origin, swap this for full JWT verification using Clerk's
JWKS endpoint."""

from fastapi import Header, HTTPException, Query, status


def require_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    user_id_query: str | None = Query(default=None, alias="user_id"),
) -> str:
    value = (x_user_id or user_id_query or "").strip()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header.",
        )
    return value
