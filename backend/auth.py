"""Sign-in with a Penn State email, and the daily question limits.

Two ways to sign in, picked by whether an email account is set up:
- Email only (no SMTP settings): typing an @psu.edu address signs you in. Quick, but anyone can
  type an address that isn't theirs.
- Email + code (SMTP_USER and SMTP_PASSWORD set): the backend emails a 6-digit code, and only
  someone who can read that inbox gets in.
Either way the browser gets a session token and sends it with every request, and each person can
ask DAILY_LIMIT_PER_PERSON questions a day, the whole app DAILY_LIMIT_TOTAL.

Settings (environment variables):
- SMTP_USER, SMTP_PASSWORD: the email account that sends the codes (for Gmail, an app password).
  SMTP_HOST and SMTP_PORT default to Gmail (smtp.gmail.com, 465).
- ALLOWED_EMAIL_DOMAIN: defaults to psu.edu.
- DAILY_LIMIT_PER_PERSON (default 10) and DAILY_LIMIT_TOTAL (default 100).
"""

import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
import time
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from zoneinfo import ZoneInfo

from fastapi import Header, HTTPException

from database import (
    add_code_attempt,
    count_codes_sent_since,
    create_session,
    delete_login_code,
    delete_session,
    get_login_code,
    get_session_email,
    get_total_usage,
    get_usage,
    save_login_code,
)

logger = logging.getLogger(__name__)

ALLOWED_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "psu.edu").strip().lower()
DAILY_LIMIT_PER_PERSON = int(os.getenv("DAILY_LIMIT_PER_PERSON", "10"))
DAILY_LIMIT_TOTAL = int(os.getenv("DAILY_LIMIT_TOTAL", "100"))

CODE_MINUTES = 10           # a code works for 10 minutes
CODE_ATTEMPTS = 5           # wrong guesses allowed per code
RESEND_SECONDS = 60         # wait before asking for another code
CODES_PER_HOUR = 60         # most addresses the app will email in an hour
SESSION_DAYS = 30           # how long someone stays signed in

EMAIL_PATTERN = re.compile(r"^[a-z0-9._%+-]+@" + re.escape(ALLOWED_DOMAIN) + r"$")
EASTERN = ZoneInfo("America/New_York")


def today():
    # Limits reset at midnight Penn State time
    return datetime.now(EASTERN).strftime("%Y-%m-%d")


def _hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def codes_required():
    # Codes are used once an email account is set up to send them
    return bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def sign_in_settings():
    return {"codes": codes_required(), "domain": ALLOWED_DOMAIN}


def normalize_email(email):
    email = (email or "").strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail=f"Use your @{ALLOWED_DOMAIN} email address.")
    return email


def _send_email(to, code):
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")

    if not user or not password:
        raise HTTPException(status_code=503, detail="Sign-in email isn't set up yet.")

    message = EmailMessage()
    message["Subject"] = f"Your sign-in code: {code}"
    message["From"] = formataddr(("Multi-Agent AI", user))
    message["To"] = to
    message.set_content(
        f"Your sign-in code for Multi-Agent AI is {code}.\n\n"
        f"It works for {CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.\n"
    )

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    try:
        with smtplib.SMTP_SSL(host, port, timeout=20) as smtp:
            smtp.login(user, password)
            smtp.send_message(message)
    except Exception:
        logger.exception("Sending the sign-in email failed")
        raise HTTPException(status_code=502, detail="We couldn't send the email. Try again in a minute.")


def _new_session(email):
    token = secrets.token_urlsafe(32)
    create_session(_hash(token), email, int(time.time()) + SESSION_DAYS * 86400)
    return token


def email_only_sign_in(email):
    # Used while no email account is set up: the address alone signs you in
    if codes_required():
        raise HTTPException(status_code=400, detail="Ask for a sign-in code instead.")
    email = normalize_email(email)
    return _new_session(email), email


def request_code(email):
    if not codes_required():
        raise HTTPException(status_code=400, detail="Sign-in codes aren't turned on.")
    email = normalize_email(email)
    now = int(time.time())

    existing = get_login_code(email)
    if existing and now - existing["sent_at"] < RESEND_SECONDS:
        raise HTTPException(status_code=429, detail="We just sent a code. Wait a minute before asking for another one.")

    if count_codes_sent_since(now - 3600) >= CODES_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many sign-ins right now. Try again later.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    save_login_code(email, _hash(f"{email}:{code}"), now + CODE_MINUTES * 60, now)
    try:
        _send_email(email, code)
    except HTTPException:
        # Nothing was sent, so let them try again right away
        delete_login_code(email)
        raise
    return email


def verify_code(email, code):
    email = normalize_email(email)
    code = re.sub(r"\D", "", code or "")
    now = int(time.time())

    saved = get_login_code(email)
    if not saved or saved["expires_at"] <= now or saved["attempts"] >= CODE_ATTEMPTS:
        raise HTTPException(status_code=400, detail="That code has expired. Ask for a new one.")

    if not hmac.compare_digest(saved["code_hash"], _hash(f"{email}:{code}")):
        add_code_attempt(email)
        raise HTTPException(status_code=400, detail="That code isn't right. Check the email and try again.")

    delete_login_code(email)
    return _new_session(email), email


def _token(authorization):
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def require_user(authorization: str | None = Header(default=None)):
    # FastAPI dependency: the signed-in email, or a 401 asking the person to sign in
    token = _token(authorization)
    email = get_session_email(_hash(token), int(time.time())) if token else None
    if not email:
        raise HTTPException(status_code=401, detail="Sign in with your Penn State email to continue.")
    return email


def sign_out(authorization):
    token = _token(authorization)
    if token:
        delete_session(_hash(token))


def usage_for(email):
    return {"used_today": get_usage(email, today()), "daily_limit": DAILY_LIMIT_PER_PERSON}


def check_limits(email):
    # Stop before running the agents when today's limits are used up
    day = today()
    if get_usage(email, day) >= DAILY_LIMIT_PER_PERSON:
        raise HTTPException(
            status_code=429,
            detail=f"You've used all {DAILY_LIMIT_PER_PERSON} of today's questions. They reset at midnight.",
        )
    if get_total_usage(day) >= DAILY_LIMIT_TOTAL:
        raise HTTPException(
            status_code=429,
            detail="The app has reached today's question limit for everyone. It resets at midnight.",
        )
    return day
