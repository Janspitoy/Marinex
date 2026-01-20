from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import AbstractUser, Group, Permission, UserManager
import uuid
from django.core.files.storage import default_storage
import uuid
from django.db import models
from django.conf import settings

# -------------------------
# Managers
# -------------------------
class ActiveManager(UserManager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

class AllObjectsManager(UserManager):
    def get_queryset(self):
        return super().get_queryset()

# -------------------------
# Audit & Soft-delete base
# -------------------------
class AuditModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        on_delete=models.SET_NULL
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        on_delete=models.SET_NULL
    )

    class Meta:
        abstract = True

class SoftDeleteModel(AuditModel):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="%(class)s_deleted",
        on_delete=models.SET_NULL
    )

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def soft_delete(self, by_user=None):
        self.deleted_at = timezone.now()
        if by_user:
            self.deleted_by = by_user
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at", "updated_by"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at", "updated_by"])

# -------------------------
# USERS / AUTH
# -------------------------
class UserRole(AuditModel):
    name = models.CharField(max_length=150, unique=True)

    def __str__(self):
        return self.name

class UserCargo(AuditModel):
    name = models.CharField(max_length=150, unique=True)  # e.g. Captain, Mechanic

    def __str__(self):
        return self.name

class SubscriptionPlan(AuditModel):
    name = models.CharField(max_length=128)
    max_boats = models.PositiveIntegerField(default=1)
    allow_navigation = models.BooleanField(default=False)
    allow_support = models.BooleanField(default=False)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return self.name

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile_photo_url = models.TextField(blank=True, null=True)
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Номер телефона"
    )
    dni = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        verbose_name="DNI/NIE"
    )
    email = models.EmailField(unique=True)
    role = models.ForeignKey(UserRole, null=True, blank=True, on_delete=models.SET_NULL)
    cargo = models.ForeignKey(UserCargo, null=True, blank=True, on_delete=models.SET_NULL)
    subscription_plan = models.ForeignKey(SubscriptionPlan, null=True, blank=True, on_delete=models.SET_NULL)
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    groups = models.ManyToManyField(Group, related_name="custom_user_set", blank=True)
    user_permissions = models.ManyToManyField(Permission, related_name="custom_user_permissions_set", blank=True)
    country = models.ForeignKey("Country", null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    province = models.ForeignKey("Province", null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    # audit fields for manual creation (kept in User)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="user_created", on_delete=models.SET_NULL
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="user_updated", on_delete=models.SET_NULL
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="user_deleted", on_delete=models.SET_NULL
    )

    objects = AllObjectsManager()
    active_objects = ActiveManager()

    def soft_delete(self, by_user=None):
        self.deleted_at = timezone.now()
        if by_user:
            self.deleted_by = by_user
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at", "updated_by"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at", "updated_by"])

    def __str__(self):
        return self.get_full_name() or self.username or self.email


# -------------------------
# ACCOUNT & USERACCOUNT
# -------------------------
class Account(SoftDeleteModel):
    name = models.CharField(max_length=255, db_index=True)
    # location settings for account (useful for defaults)
    country = models.ForeignKey("Country", null=True, blank=True, on_delete=models.SET_NULL, related_name="accounts")
    province = models.ForeignKey("Province", null=True, blank=True, on_delete=models.SET_NULL, related_name="accounts")

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["country"]),
            models.Index(fields=["province"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return self.name

class UserAccount(SoftDeleteModel):
    """
    Through model: one user can belong to many accounts, one account can have many users.
    Use soft-delete and audit.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_accounts")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="account_users")
    role = models.ForeignKey(UserRole, null=True, blank=True, on_delete=models.SET_NULL)

    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="useraccount_added_by", on_delete=models.SET_NULL)

    class Meta:
        unique_together = ("user", "account")
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["account"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.user} @ {self.account}"

class AppSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    refresh_token = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"Session {self.id} for {self.user}"

class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_tokens")
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["used"]),
        ]

    def mark_used(self):
        self.used = True
        self.save(update_fields=["used"])

    def __str__(self):
        return f"PasswordResetToken({self.user})"

# -------------------------
# GLOBAL CONFIGS (no account)
# -------------------------
class Country(AuditModel):
    name = models.CharField(max_length=150, unique=True)
    iso_code = models.CharField(max_length=10, null=True, blank=True)

    def __str__(self):
        return self.name

class Province(AuditModel):
    name = models.CharField(max_length=150)
    country = models.ForeignKey(Country, null=True, blank=True, on_delete=models.SET_NULL, related_name="provinces")

    class Meta:
        indexes = [
            models.Index(fields=["country"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.country})"

class ServiceOfficial(AuditModel):
    name = models.CharField(max_length=150, unique=True)

    def __str__(self):
        return self.name

class EspaceOcupat(AuditModel):
    name = models.CharField(max_length=150, unique=True)

    def __str__(self):
        return self.name

class Company(AuditModel):
    name = models.CharField(max_length=255)
    country = models.ForeignKey(Country, null=True, blank=True, on_delete=models.SET_NULL)
    province = models.ForeignKey("Province", null=True, blank=True, on_delete=models.SET_NULL, related_name="companies")
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["country"]),
            models.Index(fields=["province"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

class CompanyService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="services")
    service_official = models.ForeignKey(ServiceOfficial, on_delete=models.CASCADE)
    espace_ocupat = models.ForeignKey(EspaceOcupat, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("company", "service_official", "espace_ocupat")
        indexes = [
            models.Index(fields=["company"]),
            models.Index(fields=["service_official"]),
            models.Index(fields=["espace_ocupat"]),
        ]

    def __str__(self):
        return f"{self.company} - {self.service_official} / {self.espace_ocupat}"


class AccountCompany(AuditModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="preferred_companies")
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="linked_accounts")

    notes = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ("account", "company")
        indexes = [
            models.Index(fields=["account"]),
            models.Index(fields=["company"]),
        ]

    def __str__(self):
        return f"{self.account} -> {self.company}"

# -------------------------
# BOAT BRANDS & MODELS
# -------------------------
class BoatBrand(AuditModel):
    name = models.CharField(max_length=150)
    country = models.ForeignKey(Country, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

class BoatModel(AuditModel):
    brand = models.ForeignKey(BoatBrand, null=True, blank=True, on_delete=models.SET_NULL, related_name="models")
    service_company = models.ForeignKey(Company, null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=200)
    year_start = models.IntegerField(null=True, blank=True)
    year_end = models.IntegerField(null=True, blank=True)
    length = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    width = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    draft = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["brand"]),
            models.Index(fields=["service_company"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.brand or ''} {self.name}"

# -------------------------
# MATERIALS (global catalog) - M2M with BoatModel
# -------------------------
class Material(AuditModel):
    name = models.CharField(max_length=255, db_index=True)
    unit = models.CharField(max_length=50, null=True, blank=True)
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # many-to-many: a material can be used by many boat models; a model can have many materials
    models = models.ManyToManyField(BoatModel, related_name="materials", blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

class Port(AuditModel):
    name = models.CharField(max_length=150)
    province = models.ForeignKey(Province, null=True, blank=True, on_delete=models.SET_NULL, related_name="ports")

    class Meta:
        indexes = [
            models.Index(fields=["province"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

# -------------------------
# BOATS and ATTACHMENTS
# -------------------------
class Boat(SoftDeleteModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="boats")
    model = models.ForeignKey(BoatModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="boats")
    name = models.CharField(max_length=150)
    registration_number = models.CharField(max_length=150, null=True, blank=True, db_index=True)
    serial_number = models.CharField(max_length=150, null=True, blank=True, db_index=True)

    province = models.ForeignKey(Province, null=True, blank=True, on_delete=models.SET_NULL, related_name="boats")
    port = models.ForeignKey(Port, null=True, blank=True, on_delete=models.SET_NULL, related_name="boats")

    year = models.IntegerField(null=True, blank=True)
    length = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    width = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    draft = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    engine_type = models.CharField(max_length=150, null=True, blank=True)
    engine_power = models.CharField(max_length=150, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["account"]),
            models.Index(fields=["model"]),
            models.Index(fields=["province"]),
            models.Index(fields=["port"]),
            models.Index(fields=["deleted_at"]),
            models.Index(fields=["name"]),
            models.Index(fields=["registration_number"]),
        ]

    def save(self, *args, **kwargs):
        creating = self._state.adding
        if creating and self.model:
            # copy dimensions if not provided
            if self.length in (None, 0):
                self.length = self.model.length
            if self.width in (None, 0):
                self.width = self.model.width
            if self.draft in (None, 0):
                self.draft = self.model.draft
            if not self.year and self.model.year_start:
                self.year = self.model.year_start
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class BoatAttachment(SoftDeleteModel):
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE, related_name="attachments")
    file = models.ImageField(upload_to='boat_attachments/', null=True, blank=True)
    attachment_type = models.CharField(max_length=50, default="photo")  # photo, document, other
    order = models.IntegerField(default=0, db_index=True)
    external_id = models.CharField(max_length=255, null=True, blank=True)  # for external services (e.g. Hunto)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="boat_attachments_created", on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=["boat"]),
            models.Index(fields=["attachment_type"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return f"Attachment {self.id} for {self.boat}"

# -------------------------
# DOCUMENTS (with hierarchy + periodization + status)
# -------------------------
class DocumentCategory(AuditModel):
    name = models.CharField(max_length=150)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    level = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["parent"]),
            models.Index(fields=["level"]),
        ]

    def save(self, *args, **kwargs):
        if self.parent:
            self.level = (self.parent.level or 0) + 1
        else:
            self.level = 0
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class DocumentPeriodization(AuditModel):
    name = models.CharField(max_length=150)
    months = models.IntegerField(null=True, blank=True)  # e.g. 12, 6, NULL

    class Meta:
        indexes = [
            models.Index(fields=["months"]),
        ]

    def __str__(self):
        return self.name

class DocumentStatus(AuditModel):
    name = models.CharField(max_length=100)  # valid, expired, pending, missing

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

class Document(SoftDeleteModel):
    boat = models.ForeignKey(Boat, null=True, blank=True, on_delete=models.CASCADE, related_name="documents")
    category = models.ForeignKey(DocumentCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    status = models.ForeignKey(DocumentStatus, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    periodization = models.ForeignKey(DocumentPeriodization, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")

    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/%Y/%m/', null=True, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True, db_index=True)
    no_expiration = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["boat"]),
            models.Index(fields=["category"]),
            models.Index(fields=["status"]),
            models.Index(fields=["periodization"]),
            models.Index(fields=["expiration_date"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.boat})"

# -------------------------
# TASKS & WORKS + CATEGORIES (hierarchical)
# -------------------------
class TaskCategory(AuditModel):
    name = models.CharField(max_length=150)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    level = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["parent"]),
            models.Index(fields=["level"]),
        ]

    def save(self, *args, **kwargs):
        if self.parent:
            self.level = (self.parent.level or 0) + 1
        else:
            self.level = 0
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class WorkCategory(AuditModel):
    name = models.CharField(max_length=150)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    level = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["parent"]),
            models.Index(fields=["level"]),
        ]

    def save(self, *args, **kwargs):
        if self.parent:
            self.level = (self.parent.level or 0) + 1
        else:
            self.level = 0
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

# Status configs for Work and Task (separate tables)
class WorkStatus(AuditModel):
    """
    Configurable statuses for Work (e.g. planned, in_progress, completed, cancelled).
    """
    code = models.CharField(max_length=50, unique=True, help_text="machine code, e.g. planned")
    name = models.CharField(max_length=150, help_text="human readable, e.g. Planned")

    class Meta:
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

class TaskStatus(AuditModel):
    """
    Configurable statuses for Task (e.g. todo, in_progress, done, blocked).
    """
    code = models.CharField(max_length=50, unique=True, help_text="machine code, e.g. todo")
    name = models.CharField(max_length=150, help_text="human readable, e.g. To Do")

    class Meta:
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

class Work(SoftDeleteModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="works")
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE, related_name="works")
    category = models.ForeignKey(WorkCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="works")
    service_company = models.ForeignKey(Company, null=True, blank=True, on_delete=models.SET_NULL, related_name="works")
    assigned_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_works")

    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.ForeignKey(WorkStatus, null=True, blank=True, on_delete=models.SET_NULL, related_name="works")
    cost_estimate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cost_final = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=["account"]),
            models.Index(fields=["boat"]),
            models.Index(fields=["category"]),
            models.Index(fields=["status"]),
            models.Index(fields=["deleted_at"]),
            models.Index(fields=["start_date"]),
            models.Index(fields=["end_date"]),
        ]

    def __str__(self):
        return f"{self.title} [{self.boat}]"

class Task(SoftDeleteModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="tasks")
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE, related_name="tasks")
    work = models.ForeignKey(Work, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks")
    category = models.ForeignKey(TaskCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks")
    assigned_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tasks")

    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.ForeignKey(TaskStatus, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks")
    priority = models.CharField(max_length=64, null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["account"]),
            models.Index(fields=["boat"]),
            models.Index(fields=["work"]),
            models.Index(fields=["category"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["due_date"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return f"{self.title} [{self.boat}]"

# Work materials linking works to Materials
class WorkMaterial(AuditModel):
    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name="work_materials")
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="used_in_works")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["work"]),
            models.Index(fields=["material"]),
        ]

    def save(self, *args, **kwargs):
        if (not self.total_price or self.total_price == 0) and self.material and self.material.price_per_unit:
            self.total_price = (self.material.price_per_unit or 0) * (self.quantity or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.material} x{self.quantity} for {self.work}"


# -------------------------
# NAVIGATION: Routes & Points
# -------------------------
class NavigationRoute(SoftDeleteModel):  # <-- Вернули SoftDeleteModel
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="nav_routes")
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE, related_name="nav_routes")
    name = models.CharField(max_length=255, null=True, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["account"]),
            models.Index(fields=["boat"]),
            models.Index(fields=["start_time"]),
            models.Index(fields=["end_time"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return f"Route {self.name or self.id}"


class NavigationPoint(models.Model):
    TYPE_CHOICES = (
        ('gps', 'GPS Tracking'),
        ('start', 'Start Point'),
        ('end', 'End Point'),
        ('stop', 'Stop/Anchor'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(NavigationRoute, on_delete=models.CASCADE, related_name="points")
    lat = models.FloatField()
    lng = models.FloatField()
    speed = models.FloatField(null=True, blank=True)

    # Новое поле для типов точек
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='gps')

    # Время записи точки
    recorded_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ("recorded_at",)
        indexes = [
            models.Index(fields=["route"]),
            models.Index(fields=["recorded_at"]),
        ]

    def __str__(self):
        return f"Point {self.id} ({self.type})"
