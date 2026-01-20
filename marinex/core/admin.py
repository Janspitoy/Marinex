from django.contrib import admin, messages
from django.utils import timezone
from import_export import resources, widgets
from import_export.admin import ImportExportModelAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    UserRole, UserCargo, SubscriptionPlan, User, Account, UserAccount,
    AppSession, PasswordResetToken,
    Country, Province, ServiceOfficial, EspaceOcupat, Company, CompanyService,
    BoatBrand, BoatModel, Material, Port,
    Boat, BoatAttachment,
    DocumentCategory, DocumentPeriodization, DocumentStatus, Document,
    TaskCategory, WorkCategory, WorkStatus, TaskStatus, Work, Task,
    WorkMaterial,
    NavigationRoute, NavigationPoint, AccountCompany
)


class AuditAdminMixin(admin.ModelAdmin):
    readonly_fields = ("created_at", "updated_at", "created_by", "updated_by")
    date_hierarchy = "created_at"

    def save_model(self, request, obj, form, change):
        if not change:
            if hasattr(obj, "created_by") and not getattr(obj, "created_by", None):
                try:
                    obj.created_by = request.user
                except Exception:
                    pass
        if hasattr(obj, "updated_by"):
            try:
                obj.updated_by = request.user
            except Exception:
                pass
        super().save_model(request, obj, form, change)


class SoftDeleteAdminMixin(AuditAdminMixin):
    readonly_fields = AuditAdminMixin.readonly_fields + ("deleted_at", "deleted_by")
    actions = ["soft_delete_selected", "restore_selected"]

    def get_queryset(self, request):
        if hasattr(self.model, 'all_objects'):
            return self.model.all_objects.all()
        return super().get_queryset(request)

    def perform_soft_delete(self, request, queryset):
        count = 0
        for obj in queryset:
            try:
                if hasattr(obj, "soft_delete") and callable(getattr(obj, "soft_delete")):
                    obj.soft_delete(by_user=request.user)
                    count += 1
                elif hasattr(obj, "deleted_at"):
                    obj.deleted_at = timezone.now()
                    if hasattr(obj, "deleted_by"):
                        obj.deleted_by = request.user
                    obj.save()
                    count += 1
            except Exception as e:
                self.message_user(request, f"Не удалось удалить {obj}: {e}", level=messages.ERROR)
        if count > 0:
            self.message_user(request, f"Помечено как удалённые: {count} объектов", level=messages.SUCCESS)

    def perform_restore(self, request, queryset):
        count = 0
        for obj in queryset:
            try:
                if hasattr(obj, "restore") and callable(getattr(obj, "restore")):
                    obj.restore()
                    count += 1
                elif hasattr(obj, "deleted_at"):
                    obj.deleted_at = None
                    if hasattr(obj, "deleted_by"):
                        obj.deleted_by = None
                    obj.save()
                    count += 1
            except Exception as e:
                self.message_user(request, f"Не удалось восстановить {obj}: {e}", level=messages.ERROR)
        if count > 0:
            self.message_user(request, f"Восстановлено объектов: {count}", level=messages.SUCCESS)

    def soft_delete_selected(self, request, queryset):
        self.perform_soft_delete(request, queryset.filter(deleted_at__isnull=True))

    soft_delete_selected.short_description = "Пометить выбранные как удалённые"

    def restore_selected(self, request, queryset):
        self.perform_restore(request, queryset.filter(deleted_at__isnull=False))

    restore_selected.short_description = "Восстановить выбранные"


class BaseResource(resources.ModelResource):
    class Meta:
        abstract = True
        exclude = ("created_at", "updated_at", "deleted_at", "created_by", "updated_by", "deleted_by")
        skip_unchanged = True
        report_skipped = True


class CleanBrandWidget(widgets.ForeignKeyWidget):
    def get_foreign_key(self, value, row=None, **kwargs):
        if not value:
            return None
        try:
            clean_value = value.strip()
            return self.model.objects.get(name__iexact=clean_value)
        except self.model.DoesNotExist:
            return None
        except self.model.MultipleObjectsReturned:
            return self.model.objects.filter(name__iexact=clean_value).first()


class UserResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "role__name", "cargo__name",
                  "subscription_plan__name", "is_active", "is_staff")


class AccountResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Account
        fields = ("id", "name", "country__name", "province__name")


class BoatResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Boat
        fields = ("id", "name", "account__name", "model__brand__name", "model__name", "year", "registration_number",
                  "serial_number", "port__name")


class DocumentResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Document
        fields = ("id", "name", "boat__name", "category__name", "status__name", "expiration_date", "no_expiration")


class WorkResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Work
        fields = ("id", "title", "boat__name", "service_company__name", "status__name", "cost_estimate", "cost_final",
                  "start_date", "end_date")


class MaterialResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Material
        fields = ("id", "name", "unit", "price_per_unit")


class UserRoleResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = UserRole
        fields = ("id", "name")


class UserCargoResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = UserCargo
        fields = ("id", "name")


class SubscriptionPlanResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = SubscriptionPlan
        fields = ("id", "name", "price_monthly", "max_boats", "allow_navigation", "allow_support")


class UserAccountResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = UserAccount
        fields = ("id", "user__username", "account__name", "role__name", "added_by__username")


class CountryResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Country
        fields = ("id", "name", "iso_code")


class ProvinceResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Province
        fields = ("id", "name", "country__name")


class ServiceOfficialResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = ServiceOfficial
        fields = ("id", "name")


class EspaceOcupatResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = EspaceOcupat
        fields = ("id", "name")


class CompanyResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Company
        fields = ("id", "name", "country__name", "province__name", "email", "phone", "address", "website")


class CompanyServiceResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = CompanyService
        fields = ("id", "company__name", "service_official__name", "espace_ocupat__name")


class AccountCompanyResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = AccountCompany
        fields = ("id", "account__name", "company__name", "notes")


class BoatBrandResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = BoatBrand
        fields = ("id", "name", "country__name")


class BoatModelResource(BaseResource):
    brand = resources.Field(
        column_name='brand__name',
        attribute='brand',
        widget=CleanBrandWidget(model=BoatBrand, field='name')
    )

    class Meta(BaseResource.Meta):
        model = BoatModel
        fields = ('brand', 'name', 'year_start', 'length', 'width')
        import_id_fields = ()
        export_order = ('brand', 'name', 'year_start', 'length', 'width')


class PortResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Port
        fields = ("id", "name", "province__name")


class DocumentCategoryResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = DocumentCategory
        fields = ("id", "name", "parent__name", "level")


class DocumentPeriodizationResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = DocumentPeriodization
        fields = ("id", "name", "months")


class DocumentStatusResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = DocumentStatus
        fields = ("id", "name")


class TaskCategoryResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = TaskCategory
        fields = ("id", "name", "parent__name", "level")


class WorkCategoryResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = WorkCategory
        fields = ("id", "name", "parent__name", "level")


class WorkStatusResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = WorkStatus
        fields = ("id", "name", "code")


class TaskStatusResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = TaskStatus
        fields = ("id", "name", "code")


class TaskResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = Task
        fields = ("id", "title", "account__name", "boat__name", "work__title", "category__name",
                  "assigned_user__username", "status__name", "priority", "due_date")


class WorkMaterialResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = WorkMaterial
        fields = ("id", "work__title", "material__name", "quantity", "total_price")


class NavigationRouteResource(BaseResource):
    class Meta(BaseResource.Meta):
        model = NavigationRoute
        fields = ("id", "name", "account__name", "boat__name", "start_time", "end_time")


@admin.register(UserRole)
class UserRoleAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = UserRoleResource
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(UserCargo)
class UserCargoAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = UserCargoResource
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = SubscriptionPlanResource
    list_display = ("name", "price_monthly", "max_boats", "allow_navigation", "allow_support", "created_at")
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin, BaseUserAdmin):
    resource_class = UserResource
    readonly_fields = ('last_login', 'date_joined') + SoftDeleteAdminMixin.readonly_fields
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Custom Profile', {'fields': ('profile_photo_url', 'role', 'cargo', 'country', 'province')}),
        ('Subscription', {'fields': ('subscription_plan', 'subscription_expires_at')}),
        ('Audit & Status', {'fields': SoftDeleteAdminMixin.readonly_fields}),
    )
    list_display = ("username", "email", "first_name", "last_name", "role", "cargo", "is_staff", "is_active",
                    "deleted_at")
    list_filter = ("is_staff", "is_active", "role", "cargo", "country")
    search_fields = ("username", "email", "first_name", "last_name")
    list_select_related = ("role", "cargo", "country", "province", "subscription_plan")


@admin.register(Account)
class AccountAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = AccountResource
    list_display = ("name", "country", "province", "created_at", "deleted_at")
    list_filter = ("country", "province")
    search_fields = ("name",)
    list_select_related = ("country", "province")


@admin.register(UserAccount)
class UserAccountAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = UserAccountResource
    list_display = ("user", "account", "role", "added_by", "deleted_at")
    list_filter = ("account", "role")
    search_fields = ("user__username", "user__email", "account__name")
    raw_id_fields = ("user", "account", "added_by")
    list_select_related = ("user", "account", "role", "added_by")


@admin.register(AppSession)
class AppSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "id")
    list_filter = ("user",)
    readonly_fields = ("created_at",)
    list_select_related = ("user",)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used", "created_at")
    list_filter = ("used",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at",)
    list_select_related = ("user",)


@admin.register(Country)
class CountryAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = CountryResource
    list_display = ("name", "iso_code", "created_at")
    search_fields = ("name", "iso_code")


@admin.register(Province)
class ProvinceAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = ProvinceResource
    list_display = ("name", "country", "created_at")
    list_filter = ("country",)
    search_fields = ("name", "country__name")
    list_select_related = ("country",)


@admin.register(ServiceOfficial)
class ServiceOfficialAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = ServiceOfficialResource
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(EspaceOcupat)
class EspaceOcupatAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = EspaceOcupatResource
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(Company)
class CompanyAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = CompanyResource
    list_display = ("name", "email", "phone", "country", "province", "created_at")
    list_filter = ("country", "province")
    search_fields = ("name", "email", "phone")
    list_select_related = ("country", "province")


@admin.register(AccountCompany)
class AccountCompanyAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = AccountCompanyResource
    list_display = ("account", "company", "notes", "created_at")
    list_filter = ("account", "company")
    search_fields = ("account__name", "company__name", "notes")
    raw_id_fields = ("account", "company")
    list_select_related = ("account", "company")


@admin.register(CompanyService)
class CompanyServiceAdmin(ImportExportModelAdmin, admin.ModelAdmin):
    resource_class = CompanyServiceResource
    list_display = ("company", "service_official", "espace_ocupat")
    list_filter = ("company", "service_official", "espace_ocupat")
    search_fields = ("company__name",)
    raw_id_fields = ("company", "service_official", "espace_ocupat")
    list_select_related = ("company", "service_official", "espace_ocupat")


@admin.register(BoatBrand)
class BoatBrandAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = BoatBrandResource
    list_display = ("name", "country", "created_at")
    list_filter = ("country",)
    search_fields = ("name",)
    list_select_related = ("country",)


@admin.register(BoatModel)
class BoatModelAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = BoatModelResource
    list_display = ("name", "brand", "service_company", "length", "width", "draft", "created_at")
    list_filter = ("created_at",)
    list_select_related = ("brand", "service_company")
    search_fields = ("name", "brand__name")
    raw_id_fields = ("brand", "service_company")


@admin.register(Material)
class MaterialAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = MaterialResource
    list_display = ("name", "unit", "price_per_unit", "created_at")
    search_fields = ("name",)
    filter_horizontal = ("models",)


@admin.register(Port)
class PortAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = PortResource
    list_display = ("name", "province", "created_at")
    list_filter = ("province",)
    search_fields = ("name", "province__name")
    list_select_related = ("province",)


# core/admin.py

@admin.register(Boat)
class BoatAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = BoatResource
    list_display = ("name", "account", "model", "year", "registration_number", "port", "deleted_at")
    list_filter = ("year", "account")
    search_fields = ("name", "registration_number", "serial_number")
    autocomplete_fields = ("account", "model", "province", "port")
    list_select_related = ("account", "model", "province", "port", "model__brand")

@admin.register(BoatAttachment)
class BoatAttachmentAdmin(SoftDeleteAdminMixin):
    list_display = ("boat", "attachment_type", "created_at", "deleted_at")
    list_filter = ("attachment_type", "boat")
    search_fields = ("boat__name", "external_id")
    raw_id_fields = ("boat", "created_by")
    readonly_fields = SoftDeleteAdminMixin.readonly_fields
    list_select_related = ("boat", "created_by", "deleted_by")


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = DocumentCategoryResource
    list_display = ("name", "parent", "level", "created_at")
    list_filter = ("level", "parent")
    search_fields = ("name",)
    list_select_related = ("parent",)


@admin.register(DocumentPeriodization)
class DocumentPeriodizationAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = DocumentPeriodizationResource
    list_display = ("name", "months", "created_at")
    search_fields = ("name",)


@admin.register(DocumentStatus)
class DocumentStatusAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = DocumentStatusResource
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = DocumentResource
    list_display = ("name", "boat", "category", "status", "expiration_date", "no_expiration", "deleted_at")
    list_filter = ("category", "status", "periodization", "boat", "no_expiration")
    search_fields = ("name", "notes", "boat__name")
    raw_id_fields = ("boat", "category", "status", "periodization")
    list_select_related = ("boat", "category", "status", "periodization", "created_by")


@admin.register(TaskCategory)
class TaskCategoryAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = TaskCategoryResource
    list_display = ("name", "parent", "level", "created_at")
    list_filter = ("level", "parent")
    search_fields = ("name",)
    list_select_related = ("parent",)


@admin.register(WorkCategory)
class WorkCategoryAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = WorkCategoryResource
    list_display = ("name", "parent", "level", "created_at")
    list_filter = ("level", "parent")
    search_fields = ("name",)
    list_select_related = ("parent",)


@admin.register(WorkStatus)
class WorkStatusAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = WorkStatusResource
    list_display = ("name", "code", "created_at")
    search_fields = ("name", "code")


@admin.register(TaskStatus)
class TaskStatusAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = TaskStatusResource
    list_display = ("name", "code", "created_at")
    search_fields = ("name", "code")


@admin.register(Work)
class WorkAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = WorkResource
    list_display = ("title", "boat", "account", "service_company", "status", "start_date", "end_date", "deleted_at")
    list_filter = ("status", "service_company", "category", "account", "boat")
    search_fields = ("title", "description", "boat__name")
    raw_id_fields = ("account", "boat", "category", "service_company", "assigned_user", "status")
    list_select_related = ("boat", "account", "service_company", "status", "category", "assigned_user")


@admin.register(Task)
class TaskAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = TaskResource
    list_display = ("title", "boat", "work", "assigned_user", "status", "priority", "due_date", "deleted_at")
    list_filter = ("status", "priority", "category", "account", "boat")
    search_fields = ("title", "description", "work__title", "boat__name")
    raw_id_fields = ("account", "boat", "work", "category", "assigned_user", "status")
    list_select_related = ("boat", "work", "assigned_user", "status", "account", "category")


@admin.register(WorkMaterial)
class WorkMaterialAdmin(AuditAdminMixin, ImportExportModelAdmin):
    resource_class = WorkMaterialResource
    list_display = ("work", "material", "quantity", "total_price", "created_at")
    list_filter = ("work", "material")
    search_fields = ("work__title", "material__name")
    raw_id_fields = ("work", "material")
    list_select_related = ("work", "material")


@admin.register(NavigationRoute)
class NavigationRouteAdmin(SoftDeleteAdminMixin, ImportExportModelAdmin):
    resource_class = NavigationRouteResource
    list_display = ("name", "boat", "account", "start_time", "end_time", "deleted_at")
    list_filter = ("boat", "account")
    search_fields = ("name", "boat__name")
    raw_id_fields = ("account", "boat")
    list_select_related = ("boat", "account")


@admin.register(NavigationPoint)
class NavigationPointAdmin(admin.ModelAdmin):
    list_display = ("route", "lat", "lng", "speed", "recorded_at")
    list_filter = ("route",)
    search_fields = ("route__name",)
    readonly_fields = ("recorded_at",)
    list_select_related = ("route",)


admin.site.site_header = "Admin Marinex"
admin.site.site_title = "Admin"
admin.site.index_title = "Panel Admin"