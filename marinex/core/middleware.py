# core/middleware.py
import threading

_thread_locals = threading.local()

def get_current_user():
    return getattr(_thread_locals, "user", None)

class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # store only if authenticated
        _thread_locals.user = request.user if hasattr(request, "user") and request.user.is_authenticated else None
        response = self.get_response(request)
        try:
            del _thread_locals.user
        except Exception:
            pass
        return response
