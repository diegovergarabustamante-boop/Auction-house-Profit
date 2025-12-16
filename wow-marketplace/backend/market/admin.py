from django.contrib import admin
from .models import (
    Profession,
    Item,
    Material,
    ItemMaterial,
    ConnectedRealm,
    ItemPriceSnapshot
)

admin.site.register(Profession)
admin.site.register(Item)
admin.site.register(Material)
admin.site.register(ItemMaterial)
admin.site.register(ConnectedRealm)
admin.site.register(ItemPriceSnapshot)
