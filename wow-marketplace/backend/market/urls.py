from django.urls import path
from .views import home, update_auctions, auction_status, delete_snapshots, delete_all_snapshots

urlpatterns = [
    path("", home, name="home"),
    path("update-auctions/", update_auctions, name="update_auctions"),
    # market/urls.py
    path("auction-status/", auction_status, name="auction_status"),
    path("delete-snapshots/", delete_snapshots, name="delete_snapshots"),
    path("delete-all-snapshots/", delete_all_snapshots, name="delete_all_snapshots"),

]
