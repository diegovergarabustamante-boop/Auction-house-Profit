from django.db import models


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

    def elapsed_seconds(self):
        return (self.updated_at - self.started_at).total_seconds()


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
        Profession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    blizzard_id = models.IntegerField(null=True, blank=True)  # <-- nuevo campo
    icon = models.ImageField(upload_to='item_icons/', null=True, blank=True)  # <-- campo para la imagen

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
        ConnectedRealm,
        related_name="buy_snapshots",
        on_delete=models.CASCADE,
    )
    best_sell_realm = models.ForeignKey(
        ConnectedRealm,
        related_name="sell_snapshots",
        on_delete=models.CASCADE,
    )

    buy_price = models.DecimalField(max_digits=12, decimal_places=2)
    estimated_sell_price = models.DecimalField(max_digits=12, decimal_places=2)
    profit = models.DecimalField(max_digits=12, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.item.name} | {self.profit}g"


# =====================================================
# TRACKED ITEMS
# =====================================================
class TrackedItem(models.Model):
    item = models.OneToOneField(
        Item,
        on_delete=models.CASCADE,
        related_name="tracking"
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = "Activo" if self.active else "Inactivo"
        return f"{self.item.name} ({status})"
