from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_nested import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from core.views import (
    AccountRegistrationView, 
    BoatViewSet,
    UserProfileView,
    BoatBrandViewSet,
    BoatModelViewSet,
    PortViewSet,
    BoatAttachmentViewSet,
    DocumentViewSet,
    DocumentCategoryViewSet,
    TaskViewSet,
    TaskStatusViewSet,
    TaskCategoryViewSet,
    WorkStatusViewSet,
    WorkViewSet,
    WorkCategoryViewSet,
    CompanyViewSet,
    AccountViewSet,
    AccountUsersViewSet,
    AccountCompanyViewSet,
    DocumentAIAnalyze,
    NavigationRouteViewSet,
    NavigationPointCreate,
    NavigationExportGPX,
    NavigationExportKML
)

router = routers.DefaultRouter()
router.register(r'boats', BoatViewSet, basename='boat')
router.register(r'brands', BoatBrandViewSet, basename='brand')
router.register(r'models', BoatModelViewSet, basename='model')
router.register(r'ports', PortViewSet, basename='port')
router.register(r'task-statuses', TaskStatusViewSet, basename='task-status')
router.register(r'document-categories', DocumentCategoryViewSet, basename='document-category')
router.register(r'work-statuses', WorkStatusViewSet, basename='work-status')
router.register(r'work-categories', WorkCategoryViewSet, basename='work-category')
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'task-categories', TaskCategoryViewSet, basename='task-category')
router.register(r'my-companies', AccountCompanyViewSet, basename='my-company')

boats_router = routers.NestedSimpleRouter(router, r'boats', lookup='boat')
boats_router.register(r'attachments', BoatAttachmentViewSet, basename='boat-attachments')
boats_router.register(r'documents', DocumentViewSet, basename='boat-documents')
boats_router.register(r'tasks', TaskViewSet, basename='boat-tasks')
boats_router.register(r'works', WorkViewSet, basename='boat-works')
boats_router.register(r'bitacora',NavigationRouteViewSet,basename='boat-bitacora')

accounts_router = routers.NestedSimpleRouter(router, r'accounts', lookup='account')
accounts_router.register(r'users', AccountUsersViewSet, basename='account-users')

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/register/", AccountRegistrationView.as_view(), name="register"),
    path("api/me/", UserProfileView.as_view(), name="user-profile"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/", include(router.urls)),
    path("api/", include(boats_router.urls)),
    path("api/", include(accounts_router.urls)),
    path("api/ai/analyze-document/", DocumentAIAnalyze.as_view()),

    path("api/navigation/route/<uuid:route_id>/point/", NavigationPointCreate.as_view()),
    path("api/navigation/route/<uuid:route_id>/export/gpx/", NavigationExportGPX.as_view()),
    path("api/navigation/route/<uuid:route_id>/export/kml/", NavigationExportKML.as_view()),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)