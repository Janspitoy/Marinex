from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from rest_framework import viewsets, permissions, serializers, generics
from .serializers import TaskSerializer, TaskStatusSerializer, WorkSerializer, WorkStatusSerializer, \
    WorkCategorySerializer, TaskCategorySerializer, AccountCompanySerializer, CompanyServiceSerializer
from .models import (
    Boat, UserAccount, Account, BoatBrand, BoatModel, Port, Work, Company,
    BoatAttachment, WorkStatus, WorkCategory, TaskCategory, AccountCompany
)
from .models import Document, DocumentCategory
from .serializers import DocumentSerializer, DocumentCategorySerializer, CompanySerializer, BoatSerializerMinimal
from .models import Task, TaskStatus
from django.db import models
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from .serializers import (
    AccountRegistrationSerializer,
    BoatSerializer,
    UserSerializer,
    UserProfileSerializer,
    BoatBrandSerializer,
    BoatModelSerializer,
    PortSerializer,
    BoatAttachmentSerializer
)

from django.core.files.storage import default_storage
from django.contrib.auth import get_user_model
from uuid import UUID
from rest_framework import viewsets, status
from .models import NavigationRoute, NavigationPoint
from .serializers import NavigationRouteSerializer, NavigationPointSerializer
import google.generativeai as genai
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
import tempfile
import os
import json

User = get_user_model()


def save_profile_photo(user, file):
    ext = file.name.split('.')[-1]
    filename = f"profile_photos/{user.id}.{ext}"
    path = default_storage.save(filename, file)
    return settings.MEDIA_URL + path

# --- Endpoint: /api/me/ ---
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user

        # Если пришел файл фото
        if 'profile_photo' in request.FILES:
            photo = request.FILES['profile_photo']
            user.profile_photo_url = save_profile_photo(user, photo)
            user.save(update_fields=['profile_photo_url'])
            return Response({"profile_photo": user.profile_photo_url})

        # Если пришёл JSON (обычное обновление полей)
        serializer = UserProfileSerializer(
            user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)




# --- Endpoint: /api/register/ ---
class AccountRegistrationView(generics.CreateAPIView):
    serializer_class = AccountRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED
        )


# --- Endpoint: /api/brands/ ---
class BoatBrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BoatBrand.objects.all().order_by('name')
    serializer_class = BoatBrandSerializer
    permission_classes = [IsAuthenticated]


# --- Endpoint: /api/models/ ---
class BoatModelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BoatModel.objects.all().order_by('name')
    serializer_class = BoatModelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Фильтруем модели по бренду """
        queryset = super().get_queryset()
        brand_id = self.request.query_params.get('brand_id')
        if brand_id:
            queryset = queryset.filter(brand_id=brand_id)
        return queryset


# --- Endpoint: /api/ports/ ---
class PortViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Port.objects.all().order_by('name')
    serializer_class = PortSerializer
    permission_classes = [IsAuthenticated]


# --- Endpoint: /api/boats/<boat_pk>/attachments/ ---
class BoatAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = BoatAttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)  # Для файлов

    def get_queryset(self):
        # Этот ViewSet вложенный, boat_id придет из URL
        boat_id = self.kwargs.get('boat_pk')  # 'boat_pk' из-за nested-routers
        if not boat_id:
            return BoatAttachment.objects.none()

        # Убедимся, что пользователь имеет доступ к этой лодке
        user_accounts_ids = UserAccount.objects.filter(
            user=self.request.user
        ).values_list('account_id', flat=True)

        try:
            boat = Boat.objects.get(pk=boat_id, account_id__in=user_accounts_ids)
            return boat.attachments.all()
        except Boat.DoesNotExist:
            return BoatAttachment.objects.none()

    def get_serializer_context(self):
        # Передаем boat и request в сериализатор
        context = super().get_serializer_context()
        boat_id = self.kwargs.get('boat_pk')
        try:
            context['boat'] = Boat.objects.get(pk=boat_id)
        except Boat.DoesNotExist:
            pass  # Обработка ошибки будет в get_queryset
        context['request'] = self.request
        return context


class BoatViewSet(viewsets.ModelViewSet):
    serializer_class = BoatSerializer
    permission_classes = [IsAuthenticated]

    # Убрали parser_classes отсюда

    def get_queryset(self):
        user = self.request.user
        user_accounts_ids = UserAccount.objects.filter(
            user=user
        ).values_list('account_id', flat=True)
        return Boat.objects.filter(account_id__in=user_accounts_ids)

    def perform_create(self, serializer):
        user_account = UserAccount.objects.filter(user=self.request.user).first()
        if not user_account:
            raise serializers.ValidationError(
                "У вас нет аккаунта, к которому можно добавить лодку."
            )
        # Сохраняем лодку, привязав к аккаунту
        serializer.save(account=user_account.account)

class DocumentCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentCategory.objects.all().order_by('level', 'name')
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]

# core/views.py

class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser) # <-- ДОБАВЬТЕ ЭТУ СТРОКУ

    def get_queryset(self):
        # Получаем boat_pk из URL
        boat_pk = self.kwargs.get('boat_pk')
        if not boat_pk:
            return Document.objects.none()

        # TODO: Добавить проверку безопасности, что пользователь
        # имеет доступ к лодке (boat_pk)

        return Document.objects.filter(boat_id=boat_pk).order_by('category__name', 'name')

    def perform_create(self, serializer):
        boat_pk = self.kwargs.get('boat_pk')
        try:
            boat = Boat.objects.get(pk=boat_pk)
        except Boat.DoesNotExist:
            raise serializers.ValidationError("Лодка не найдена.")

            # TODO: Добавить проверку безопасности

        serializer.save(
            created_by=self.request.user,
            boat=boat
        )


class TaskCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Devuelve las categorías de tareas (Jerárquicas)
    """
    queryset = TaskCategory.objects.all().order_by("level", "name")
    serializer_class = TaskCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Filtros opcionales igual que en WorkCategory
        if self.request.query_params.get("roots_only") == "1":
            return qs.filter(parent__isnull=True)

        parent_id = self.request.query_params.get("parent")
        if parent_id:
            return qs.filter(parent_id=parent_id)

        return qs


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        boat_pk = self.kwargs.get('boat_pk')
        if not boat_pk:
            return Task.objects.none()

        try:
            boat = Boat.objects.select_related('account').get(pk=boat_pk)
            account_id = boat.account.id
        except Boat.DoesNotExist:
            return Task.objects.none()

        return Task.objects.filter(
            models.Q(boat_id=boat_pk) | models.Q(account_id=account_id, boat__isnull=True)
        ).select_related(
            'status',
            'category',
            'assigned_user' # Importante para evitar N+1 queries
        ).order_by('due_date')

    def perform_create(self, serializer):
        boat_pk = self.kwargs.get('boat_pk')
        try:
            boat = Boat.objects.select_related('account').get(pk=boat_pk)
        except Boat.DoesNotExist:
            raise serializers.ValidationError("Лодка не найдена.")

        serializer.save(
            created_by=self.request.user, # Si usas AuditModel o campos manuales en Task
            boat=boat,
            account=boat.account
        )

class TaskStatusViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API для получения списка возможных статусов Задач
    """
    queryset = TaskStatus.objects.all()
    serializer_class = TaskStatusSerializer
    permission_classes = [permissions.IsAuthenticated]


class WorkStatusViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WorkStatus.objects.all()
    serializer_class = WorkStatusSerializer
    permission_classes = [permissions.IsAuthenticated]


class WorkViewSet(viewsets.ModelViewSet):
    serializer_class = WorkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        boat_pk = self.kwargs.get("boat_pk")
        if not boat_pk:
            return Work.objects.none()

        # Ищем лодку + аккаунт
        try:
            boat = Boat.objects.select_related("account").get(pk=boat_pk)
            account_id = boat.account.id
        except Boat.DoesNotExist:
            return Work.objects.none()

        return (
            Work.objects.filter(
                models.Q(boat_id=boat_pk) |
                models.Q(account_id=account_id, boat__isnull=True)
            )
            .select_related(
                "status",
                "category",
                "service_company",
                "assigned_user"
            )
            .order_by("start_date")
        )

    def perform_create(self, serializer):
        boat_pk = self.kwargs.get("boat_pk")

        try:
            boat = Boat.objects.select_related("account").get(pk=boat_pk)
        except Boat.DoesNotExist:
            raise serializers.ValidationError("Лодка не найдена.")

        serializer.save(
            boat=boat,
            account=boat.account
        )

class WorkCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Возвращает древовидный список категорий работ
    """
    queryset = WorkCategory.objects.all().order_by("level", "name")
    serializer_class = WorkCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()

        # Вариант: фильтрация только по root категориям
        if self.request.query_params.get("roots_only") == "1":
            return qs.filter(parent__isnull=True)

        # Вариант: фильтр по parent
        parent_id = self.request.query_params.get("parent")
        if parent_id:
            return qs.filter(parent_id=parent_id)

        return qs


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all().order_by('name')
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    @action(detail=True, methods=['get'])
    def services(self, request, pk=None):
        company = self.get_object()
        services = company.services.select_related('service_official', 'espace_ocupat').all()
        serializer = CompanyServiceSerializer(services, many=True)
        return Response(serializer.data)

class AccountCompanyViewSet(viewsets.ModelViewSet):
    serializer_class = AccountCompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_accounts_ids = UserAccount.objects.filter(user=user).values_list('account_id', flat=True)

        return AccountCompany.objects.filter(account_id__in=user_accounts_ids).select_related('company')

    def perform_create(self, serializer):
        account = serializer.validated_data['account']
        user_account = UserAccount.objects.filter(user=self.request.user, account=account).exists()

        if not user_account:
            raise serializers.ValidationError("Вы не являетесь участником этого аккаунта.")

        serializer.save(created_by=self.request.user)

class AccountViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Базовый ViewSet для аккаунтов, нужен для nested-роутинга (/api/accounts/)
    """
    queryset = Account.objects.all()
    serializer_class = BoatSerializerMinimal  # Временная заглушка или создайте AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Пользователь видит только свои аккаунты
        return Account.objects.filter(account_users__user=self.request.user)


class AccountUsersViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        account_pk = self.kwargs.get('account_pk')
        if not account_pk:
            return User.objects.none()

        # Возвращаем пользователей, связанных с этим аккаунтом через UserAccount
        return User.objects.filter(user_accounts__account_id=account_pk).distinct()


class AccountUsersViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        account_pk = self.kwargs.get('account_pk')

        # 2. Validación de seguridad: Si no hay ID o es "undefined", devuelve vacío
        if not account_pk or account_pk == 'undefined':
            return User.objects.none()

        # 3. Validación de UUID: Evita el Error 500 si el formato es incorrecto
        try:
            UUID(account_pk)
        except ValueError:
            return User.objects.none()

        return User.objects.filter(user_accounts__account_id=account_pk).distinct()



class NavigationRouteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NavigationRouteSerializer

    def get_queryset(self):
        boat_id = self.kwargs.get("boat_pk")
        return NavigationRoute.objects.filter(
            account=self.request.user.user_accounts.first().account,
            boat_id=boat_id,
            deleted_at__isnull=True
        ).order_by("-created_at")

    def perform_create(self, serializer):
        boat = Boat.objects.get(id=self.kwargs["boat_pk"])
        account = self.request.user.user_accounts.first().account

        serializer.save(
            boat=boat,
            account=account,
            created_by=self.request.user,
            updated_by=self.request.user,
        )


class NavigationPointCreate(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, route_id):
        try:
            route = NavigationRoute.objects.get(id=route_id)
        except NavigationRoute.DoesNotExist:
            return Response({"error": "Route not found"}, status=404)

        lat = request.data.get("lat")
        lng = request.data.get("lng")
        speed = request.data.get("speed", 0)
        p_type = request.data.get("type", "gps")
        timestamp = request.data.get("recorded_at")

        if lat is None or lng is None:
            return Response({"error": "Lat/Lng required"}, status=400)

        point = NavigationPoint.objects.create(
            route=route,
            lat=lat,
            lng=lng,
            speed=speed,
            type=p_type,
            recorded_at=timestamp or timezone.now()
        )

        return Response(NavigationPointSerializer(point).data, status=201)

class NavigationExportGPX(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, route_id):
        route = NavigationRoute.objects.get(id=route_id)
        points = route.points.all()

        gpx = """<?xml version="1.0"?>
<gpx version="1.1" creator="Marinex">
<trk><name>{}</name><trkseg>
""".format(route.name or route.id)

        for p in points:
            gpx += f'<trkpt lat="{p.lat}" lon="{p.lng}"><speed>{p.speed or 0}</speed></trkpt>\n'

        gpx += "</trkseg></trk></gpx>"

        return Response(gpx, content_type="application/gpx+xml")


class NavigationExportKML(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, route_id):
        route = NavigationRoute.objects.get(id=route_id)
        points = route.points.all()

        kml = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><LineString><coordinates>
"""

        for p in points:
            kml += f"{p.lng},{p.lat},0\n"

        kml += "</coordinates></LineString></Placemark></Document></kml>"

        return Response(kml, content_type="application/vnd.google-earth.kml+xml")


genai.configure(api_key=settings.GEMINI_API_KEY)


class DocumentAIAnalyze(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file provided"}, status=400)

        # Save temp file
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            for chunk in uploaded.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            # Upload to Gemini
            file_obj = genai.upload_file(
                tmp_path,
                mime_type=uploaded.content_type or "application/octet-stream"
            )

            # Load categories (convert UUID to string)
            categories = DocumentCategory.objects.all().order_by("level", "name")
            categories_json = [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "parent": str(c.parent_id) if c.parent_id else None,
                    "level": c.level,
                }
                for c in categories
            ]

            model = genai.GenerativeModel("gemini-2.5-pro")

            system_prompt = f"""
            Eres un asistente experto en documentación náutica.

            Aquí tienes la lista completa de categorías:

            {json.dumps(categories_json, indent=2)}

            Debes ANALIZAR el documento adjunto y devolver SIEMPRE un JSON válido:

            {{
              "name": "string",
              "category_id": "uuid" o null,
              "subcategory_id": "uuid" o null,
              "expiration_date": "YYYY-MM-DD" o null,
              "no_expiration": true o false,
              "notes": "string"
            }}

            REGLAS SOBRE EL NOMBRE:
            - El nombre debe ser corto y genérico (por ejemplo: "Seguro de Responsabilidad Civil").
            - NO incluyas números, códigos, pólizas ni fechas en el nombre.

            REGLAS SOBRE CATEGORÍAS:
            - category_id = categoría con level = 0
            - subcategory_id = categoría cuyo parent coincide con category_id

            REGLAS SOBRE FECHAS (MUY IMPORTANTE):
            - Las fechas dentro del documento están SIEMPRE en formato español: **DD/MM/YYYY**.
            - NO interpretes nunca las fechas como formato americano **MM/DD/YYYY**.
            - Si lees por ejemplo "15/01/2028", significa **15 de enero de 2028**, NO diciembre.
            - Debes convertir la fecha encontrada a formato ISO: "YYYY-MM-DD".
            - NO reordenes ni intercambies día y mes bajo ninguna circunstancia.

            REGLAS GENERALES:
            - NO uses ```json ni bloques de código.
            - Devuelve SOLO un JSON limpio, sin texto adicional.
            """

            response = model.generate_content([system_prompt, file_obj])

            raw = response.text.strip()

            # Remove ```json fences if AI returns them
            if raw.startswith("```"):
                raw = raw.replace("```json", "")
                raw = raw.replace("```", "")
                raw = raw.strip()

            try:
                data = json.loads(raw)
            except Exception as e:
                return Response({
                    "error": "AI returned invalid JSON",
                    "exception": str(e),
                    "raw": raw
                }, status=500)

            cleaned = {
                "name": data.get("name", ""),
                "category_id": str(data["category_id"]) if data.get("category_id") else None,
                "subcategory_id": str(data["subcategory_id"]) if data.get("subcategory_id") else None,
                "expiration_date": data.get("expiration_date"),
                "no_expiration": bool(data.get("no_expiration", False)),
                "notes": data.get("notes", "")
            }

            return Response(cleaned)

        finally:
            os.remove(tmp_path)
