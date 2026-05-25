"""Auth / OTP domain exceptions."""


class OtpError(Exception):
    """Structured OTP error for API responses."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        attempts_remaining: int | None = None,
        action: str | None = None,
    ):
        self.code = code
        self.message = message
        self.attempts_remaining = attempts_remaining
        self.action = action
        super().__init__(message)
