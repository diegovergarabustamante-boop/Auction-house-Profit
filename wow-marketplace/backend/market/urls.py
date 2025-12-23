from django.urls import path
from . import views

urlpatterns = [
    # Página principal
    path("", views.home, name="home"),

    # Items a escanear
    path("api/update-tracked-items/", views.update_tracked_items, name="update_tracked_items"),
    path("api/add-tracked-item/", views.add_tracked_item, name="add_tracked_item"),
    path("add-item/", views.add_item, name="add_item"),
    path("api/check-items-exist/", views.check_items_exist, name="check_items_exist"),

    # Eliminación de items
    path("delete-item/", views.delete_item, name="delete_item"),
    path("delete-multiple-items/", views.delete_multiple_items, name="delete_multiple_items"),
    path("delete-all-items/", views.delete_all_items, name="delete_all_items"),

    # Actualización de subastas
    path("api/update-auctions/", views.update_auctions, name="update_auctions"),
    path("api/auction-status/", views.auction_status, name="auction_status"),

    # Snapshots
    path("api/delete-snapshots/", views.delete_snapshots, name="delete_snapshots"),
    path("api/delete-all-snapshots/", views.delete_all_snapshots, name="delete_all_snapshots"),
]
