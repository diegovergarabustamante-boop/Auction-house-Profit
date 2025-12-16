from django.db import models


# -------------------------
# Profesiones
# -------------------------

class Profession(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


# -------------------------
# Reinos conectados
# -------------------------

class ConnectedRealm(models.Model):
    blizzard_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=100)

    def __str__(self):
        return self.name


# -------------------------
# Items
# -------------------------

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


# -------------------------
# Materiales
# -------------------------

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


# -------------------------
# Precios crudos por reino
# -------------------------

class PriceSnapshot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    realm = models.ForeignKey(ConnectedRealm, on_delete=models.CASCADE)
    min_price = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["item", "realm", "created_at"])
        ]


# -------------------------
# Resultados de arbitrage
# -------------------------

class ArbitrageResult(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    buy_realm = models.ForeignKey(
        ConnectedRealm,
        related_name="buy_results",
        on_delete=models.CASCADE
    )
    sell_realm = models.ForeignKey(
        ConnectedRealm,
        related_name="sell_results",
        on_delete=models.CASCADE
    )
    profit = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
