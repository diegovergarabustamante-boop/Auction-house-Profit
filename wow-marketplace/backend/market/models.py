from django.db import models


# =========================
# PROFESIONES
# =========================
class Profession(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


# =========================
# ITEMS
# =========================
class Item(models.Model):
    name = models.CharField(max_length=255, unique=True)
    blizzard_id = models.IntegerField(unique=True)
    profession = models.ForeignKey(
        Profession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    def __str__(self):
        return self.name


# =========================
# MATERIALES
# =========================
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


# =========================
# CONNECTED REALMS
# =========================
class ConnectedRealm(models.Model):
    blizzard_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=100)

    def __str__(self):
        return self.name


# =========================
# SNAPSHOT DE PRECIOS
# =========================
class ItemPriceSnapshot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    realm = models.ForeignKey(ConnectedRealm, on_delete=models.CASCADE)

    min_price = models.BigIntegerField()
    quantity = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("item", "realm", "created_at")


# =========================
# RESULTADO DE ARBITRAJE
# =========================
class ArbitrageResult(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)

    buy_realm = models.ForeignKey(
        ConnectedRealm,
        related_name="buy_arbitrages",
        on_delete=models.CASCADE
    )

    sell_realm = models.ForeignKey(
        ConnectedRealm,
        related_name="sell_arbitrages",
        on_delete=models.CASCADE
    )

    profit = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
