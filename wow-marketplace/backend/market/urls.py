from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/update-tracked-items/", views.update_tracked_items, name="update_tracked_items"),
    path("api/add-tracked-item/", views.add_tracked_item, name="add_tracked_item"),
    path("api/update-auctions/", views.update_auctions, name="update_auctions"),
    path("api/auction-status/", views.auction_status, name="auction_status"),
    path("api/delete-snapshots/", views.delete_snapshots, name="delete_snapshots"),
    path("api/delete-all-snapshots/", views.delete_all_snapshots, name="delete_all_snapshots"),
]