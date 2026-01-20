from django.db import transaction
from rest_framework import serializers
from .models import (
    User, Account, UserAccount, UserRole, Boat, BoatModel, Port,
    BoatBrand, BoatAttachment, WorkStatus, Work, Company, WorkCategory, CompanyService, NavigationPoint, NavigationRoute
)
from .models import Document, DocumentCategory, DocumentStatus, DocumentPeriodization
from .models import Task, TaskCategory, TaskStatus, AccountCompany


class BoatAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatAttachment
        fields = (
            'id', 'boat', 'file', 'attachment_type',
            'created_at', 'created_by', 'order'
        )
        read_only_fields = ('boat', 'created_by')

    def create(self, validated_data):
        # Получаем boat и user из "контекста" (переданного из view)
        boat = self.context['boat']
        user = self.context['request'].user

        return BoatAttachment.objects.create(
            boat=boat,
            created_by=user,
            **validated_data
        )


class BoatSerializerMinimal(serializers.ModelSerializer):
    class Meta:
        model = Boat
        fields = ('id', 'name')


class UserProfileSerializer(serializers.ModelSerializer):
    has_boats = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'dni', 'has_boats', 'profile_photo_url'
        )

    def get_has_boats(self, user):
        # Проверяем, есть ли у пользователя доступ хотя бы к одному аккаунту,
        # у которого есть хотя бы одна лодка.
        user_accounts = UserAccount.objects.filter(user=user)
        account_ids = user_accounts.values_list('account_id', flat=True)
        return Boat.objects.filter(account_id__in=account_ids).exists()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "phone_number", "dni"
        )


class BoatBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatBrand
        fields = ('id', 'name')


class BoatModelSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)

    class Meta:
        model = BoatModel
        fields = ('id', 'name', 'brand', 'brand_name')


class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Port
        fields = ('id', 'name')


class BoatSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source="model.name", read_only=True)
    brand_name = serializers.CharField(source="model.brand.name", read_only=True)
    port_name = serializers.CharField(source="port.name", read_only=True)

    # --- INICIO DE LA MODIFICACIÓN ---
    # 1. Añade los campos de Provincia y País (son de solo lectura)
    province_name = serializers.CharField(source="province.name", read_only=True, allow_null=True)
    country_name = serializers.CharField(source="province.country.name", read_only=True, allow_null=True)
    # --- FIN DE LA MODIFICACIÓN ---

    # Показываем вложения
    attachments = BoatAttachmentSerializer(many=True, read_only=True)

    model = serializers.PrimaryKeyRelatedField(
        queryset=BoatModel.objects.all(), write_only=True
    )
    port = serializers.PrimaryKeyRelatedField(
        queryset=Port.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Boat

        # --- INICIO DE LA MODIFICACIÓN ---
        # 2. Añade TODOS los campos nuevos a la lista 'fields'
        fields = (
            "id", "name", "year", "registration_number", "serial_number",
            "model", "port",  # Поля для записи
            "model_name", "brand_name", "port_name",  # Поля для чтения
            "attachments",
            "account",
            # --- Campos añadidos ---
            "length",
            "width",
            "draft",
            "engine_type",
            "engine_power",
            "province_name",  # <--- Campo nuevo de lectura
            "country_name"  # <--- Campo nuevo de lectura
        )
        # --- FIN DE LA MODIFICACIÓN ---

class AccountRegistrationSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(max_length=255, write_only=True)
    password = serializers.CharField(
        style={"input_type": "password"}, write_only=True
    )

    class Meta:
        model = User
        fields = (
            "username", "password", "email", "first_name", "last_name",
            "phone_number", "dni", "account_name"
        )
        extra_kwargs = {
            'email': {'required': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        account_name = validated_data.pop("account_name")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            phone_number=validated_data.get("phone_number"),
            dni=validated_data.get("dni")
        )
        account = Account.objects.create(name=account_name)

        try:
            owner_role = UserRole.objects.get(name="Account Owner")
        except UserRole.DoesNotExist:
            raise serializers.ValidationError("Системная ошибка: Роли не настроены.")

        UserAccount.objects.create(
            user=user,
            account=account,
            role=owner_role,
            added_by=user
        )
        return user

class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = ('id', 'name', 'parent', 'level')

class DocumentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentStatus
        fields = ('id', 'name')

class DocumentPeriodizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentPeriodization
        fields = ('id', 'name', 'months')

class DocumentSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    status_name = serializers.CharField(source='status.name', read_only=True)
    periodization_name = serializers.CharField(source='periodization.name', read_only=True)

    category = serializers.PrimaryKeyRelatedField(
        queryset=DocumentCategory.objects.all(), required=False, allow_null=True
    )
    status = serializers.PrimaryKeyRelatedField(
        queryset=DocumentStatus.objects.all(), required=False, allow_null=True
    )
    periodization = serializers.PrimaryKeyRelatedField(
        queryset=DocumentPeriodization.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Document
        fields = (
            'id', 'name', 'notes', 'file',
            'expiration_date', 'no_expiration',
            'created_at',
            'category', 'status', 'periodization',
            'category_name', 'status_name', 'periodization_name'
        )
        read_only_fields = ('created_at',)

class TaskStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskStatus
        fields = ('id', 'name', 'code')


class TaskCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCategory
        fields = ['id', 'name', 'parent', 'level']

class TaskSerializer(serializers.ModelSerializer):
    status_details = TaskStatusSerializer(source='status', read_only=True)
    category_details = TaskCategorySerializer(source='category', read_only=True)
    assigned_user_details = UserSerializer(source='assigned_user', read_only=True)

    status = serializers.PrimaryKeyRelatedField(
        queryset=TaskStatus.objects.all(),
        required=False,
        allow_null=True
    )
    category = serializers.PrimaryKeyRelatedField(
        queryset=TaskCategory.objects.all(),
        required=False,
        allow_null=True
    )
    assigned_user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Task
        fields = (
            'id',
            'title',
            'description',
            'due_date',
            'priority',

            # Relations
            'status',
            'status_details',
            'category',
            'category_details',
            'assigned_user',
            'assigned_user_details'
        )
        read_only_fields = ('id', 'boat', 'account')  # boat y account se ponen en el view

class WorkStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkStatus
        fields = ("id", "name", "code")

class WorkCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkCategory
        fields = ['id', 'name', 'parent', 'level']


class CompanySerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True, allow_null=True)
    province_name = serializers.CharField(source='province.name', read_only=True, allow_null=True)

    class Meta:
        model = Company
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "address",
            "website",
            "country",
            "province",
            "country_name",
            "province_name"
        )


class CompanyServiceSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service_official.name', read_only=True)
    espace_name = serializers.CharField(source='espace_ocupat.name', read_only=True)

    class Meta:
        model = CompanyService
        fields = ('id', 'service_name', 'espace_name')

class AccountCompanySerializer(serializers.ModelSerializer):
    company_details = CompanySerializer(source='company', read_only=True)
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())

    class Meta:
        model = AccountCompany
        fields = (
            'id',
            'account',
            'company',
            'company_details',
            'notes',
            'created_at'
        )
        read_only_fields = ('id', 'created_at')


class WorkSerializer(serializers.ModelSerializer):
    # ---- READ-ONLY связки ----
    status_details = WorkStatusSerializer(source="status", read_only=True)
    category_details = WorkCategorySerializer(source="category", read_only=True)
    service_company_details = CompanySerializer(source="service_company", read_only=True)
    assigned_user_details = UserSerializer(source="assigned_user", read_only=True)

    # ---- WRITE FIELDS ----
    status = serializers.PrimaryKeyRelatedField(
        queryset=WorkStatus.objects.all(),
        required=False,
        allow_null=True
    )

    category = serializers.PrimaryKeyRelatedField(
        queryset=WorkCategory.objects.all(),
        required=False,
        allow_null=True
    )

    service_company = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        required=False,
        allow_null=True
    )

    assigned_user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Work
        fields = (
            "id",
            "account",
            "boat",

            # Relations
            "category",
            "category_details",
            "service_company",
            "service_company_details",
            "assigned_user",
            "assigned_user_details",

            # Basic fields
            "title",
            "description",
            "notes",

            # Status
            "status",
            "status_details",

            # Costs
            "cost_estimate",
            "cost_final",

            # Dates
            "start_date",
            "end_date",
        )

        read_only_fields = ("id", "account", "boat")


class NavigationPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = NavigationPoint
        fields = ("id", "lat", "lng", "speed", "type", "recorded_at")


class NavigationRouteSerializer(serializers.ModelSerializer):
    points = NavigationPointSerializer(many=True, read_only=True)

    class Meta:
        model = NavigationRoute
        fields = (
            "id",
            "account",
            "boat",
            "name",
            "start_time",
            "end_time",
            "points",
        )
        read_only_fields = ("account", "boat")