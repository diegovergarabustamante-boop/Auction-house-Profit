from django.db import models


class Profession(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Item(models.Model):
    name = models.CharField(max_length=255, unique=True)
    profession = models.ForeignKey(
        Profession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    def __str__(self):
        return self.name


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


class ConnectedRealm(models.Model):
    blizzard_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class ItemPriceSnapshot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)

    estimated_sell_price = models.DecimalField(
        max_digits=12, decimal_places=2
    )

    best_buy_realm = models.ForeignKey(
        ConnectedRealm,
        null=True,
        blank=True,
        related_name="best_buys",
        on_delete=models.SET_NULL
    )

    best_sell_realm = models.ForeignKey(
        ConnectedRealm,
        null=True,
        blank=True,
        related_name="best_sells",
        on_delete=models.SET_NULL
    )

    profit = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)
