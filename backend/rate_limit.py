"""Rate limiting en memoria con ventana deslizante."""
import time
from collections import defaultdict
from typing import Dict, List


class RateLimiter:
    """Límite de peticiones por clave (IP / email / api_key)."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        if len(self._requests[key]) >= self.max_requests:
            return False
        self._requests[key].append(now)
        return True


login_limiter   = RateLimiter(max_requests=10, window_seconds=60)   # 10 intentos/min
webhook_limiter = RateLimiter(max_requests=60, window_seconds=60)   # 60 req/min
