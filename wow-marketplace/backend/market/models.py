from django.db import models
from django.utils import timezone
import json

# =====================================================
# USER CONFIGURATION
# =====================================================
class UserConfig(models.Model):
    """User configuration for the arbitrage scanner"""
    id = models.AutoField(primary_key=True)
    max_realms_to_scan = models.IntegerField(
        default=0, 
        help_text="0 = all realms, N = maximum number of realms to scan"
    )
    realms_to_scan = models.TextField(
        default='["Stormrage", "Area 52", "Moon Guard", "Ragnaros", "Dalaran", "Zul\'jin", "Proudmoore"]',
        help_text="JSON list of realms to scan for arbitrage"
    )
    dev_mode = models.BooleanField(
        default=True, 
        help_text="Development mode (limit realms to 10 for quick tests)"
    )
    region = models.CharField(max_length=10, default="us")
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Configuration"
        verbose_name_plural = "User Configurations"
    
    def save(self, *args, **kwargs):
        # Asegurarse de que solo haya una configuración
        self.id = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        config, _ = cls.objects.get_or_create(id=1)
        return config
    
    def get_realms_to_scan_list(self):
        """Returns the list of realms to scan as a Python list"""
        try:
            return json.loads(self.realms_to_scan)
        except (json.JSONDecodeError, TypeError):
            return ["Stormrage", "Area 52", "Moon Guard", "Ragnaros", "Dalaran", "Zul'jin", "Proudmoore"]
    
    def __str__(self):
        realms_count = len(self.get_realms_to_scan_list())
        return f"Config: {self.max_realms_to_scan if self.max_realms_to_scan > 0 else 'all'} realms | Dev: {self.dev_mode}"

# =====================================================
# AUCTION UPDATE STATUS
# =====================================================
class AuctionUpdateStatus(models.Model):
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    total_realms = models.IntegerField(default=0)
    current_realm = models.CharField(max_length=100, blank=True)
    processed_realms = models.IntegerField(default=0)
    is_running = models.BooleanField(default=False)
    config_info = models.TextField(blank=True, help_text="Información de configuración usada en el escaneo")
    
    def elapsed_seconds(self):
        return (self.updated_at - self.started_at).total_seconds()
    
    def __str__(self):
        status = "Running" if self.is_running else "Idle"
        return f"Update Status: {status} | {self.processed_realms}/{self.total_realms} realms"

# =====================================================
# PROFESSIONS
# =====================================================
class Profession(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    def __str__(self):
        return self.name

# =====================================================
# ITEMS & MATERIALS
# =====================================================
class Item(models.Model):
    name = models.CharField(max_length=255, unique=True)
    profession = models.ForeignKey(
        Profession, null=True, blank=True, on_delete=models.SET_NULL
    )
    blizzard_id = models.IntegerField(null=True, blank=True)
    icon = models.ImageField(upload_to='item_icons/', null=True, blank=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ["name"]

class Material(models.Model):
    name = models.CharField(max_length=255, unique=True)
    
    def __str__(self):
        return self.name

class ItemMaterial(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    material = models.ForeignKey(Material, on_delete=models.CASCADE)
    quantity_required = models.PositiveIntegerField()
    
    class Meta:
        unique_together = ("item", "material")

# =====================================================
# REALMS & SNAPSHOTS
# =====================================================
class ConnectedRealm(models.Model):
    blizzard_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=100)
    
    def __str__(self):
        return self.name

class ItemPriceSnapshot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    best_buy_realm = models.ForeignKey(
        ConnectedRealm, related_name="buy_snapshots", on_delete=models.CASCADE,
    )
    best_sell_realm = models.ForeignKey(
        ConnectedRealm, related_name="sell_snapshots", on_delete=models.CASCADE,
    )
    buy_price = models.DecimalField(max_digits=12, decimal_places=2)
    estimated_sell_price = models.DecimalField(max_digits=12, decimal_places=2)
    profit = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def formatted_created_at(self):
        """Devuelve la fecha en formato DD/MM HH:MM"""
        return self.created_at.strftime("%d/%m %H:%M")
    
    def __str__(self):
        return f"{self.item.name} | {self.profit}g"

# =====================================================
# TRACKED ITEMS
# =====================================================
class TrackedItem(models.Model):
    item = models.OneToOneField(
        Item, on_delete=models.CASCADE, related_name="tracking"
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    
    def formatted_created_at(self):
        """Devuelve la fecha en formato DD/MM HH:MM"""
        return self.created_at.strftime("%d/%m %H:%M")
    
    def formatted_last_modified(self):
        """Devuelve la fecha en formato DD/MM HH:MM"""
        return self.last_modified.strftime("%d/%m %H:%M")
    
    def __str__(self):
        status = "Activo" if self.active else "Inactivo"
        return f"{self.item.name} ({status})"