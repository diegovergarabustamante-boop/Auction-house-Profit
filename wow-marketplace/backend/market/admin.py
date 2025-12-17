from django.contrib import admin
from .models import (
    Profession,
    Item,
    Material,
    ItemMaterial,
    ConnectedRealm,
    ItemPriceSnapshot,
)


@admin.register(Profession)
class ProfessionAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "profession")
    search_fields = ("name",)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(ItemMaterial)
class ItemMaterialAdmin(admin.ModelAdmin):
    list_display = ("item", "material", "quantity_required")


@admin.register(ConnectedRealm)
class ConnectedRealmAdmin(admin.ModelAdmin):
    list_display = ("name", "blizzard_id", "slug")


@admin.register(ItemPriceSnapshot)
class ItemPriceSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "best_buy_realm",
        "best_sell_realm",
        "estimated_sell_price",
        "profit",
        "created_at",
    )
    list_filter = ("best_sell_realm",)
    ordering = ("-profit",)
