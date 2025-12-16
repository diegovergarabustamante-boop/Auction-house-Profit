from django.contrib import admin
from .models import (
    Profession,
    Item,
    Material,
    ItemMaterial,
    ConnectedRealm,
    PriceSnapshot,
    ArbitrageResult,
)

# -------------------------
# Básicos
# -------------------------

@admin.register(Profession)
class ProfessionAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("name", "blizzard_id")
    search_fields = ("name",)
    

@admin.register(ItemMaterial)
class ItemMaterialAdmin(admin.ModelAdmin):
    list_display = ("item", "material", "quantity_required")
    list_filter = ("item", "material")


@admin.register(ConnectedRealm)
class ConnectedRealmAdmin(admin.ModelAdmin):
    list_display = ("blizzard_id", "name", "slug")
    search_fields = ("name", "slug")


# -------------------------
# Precios por reino
# -------------------------

@admin.register(PriceSnapshot)
class PriceSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "realm",
        "min_price",
        "created_at",
    )
    list_filter = ("realm",)
    search_fields = ("item__name",)
    date_hierarchy = "created_at"


# -------------------------
# Resultados de arbitrage
# -------------------------

@admin.register(ArbitrageResult)
class ArbitrageResultAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "buy_realm",
        "sell_realm",
        "profit",
        "created_at",
    )
    list_filter = ("buy_realm", "sell_realm")
    search_fields = ("item__name",)
    date_hierarchy = "created_at"
