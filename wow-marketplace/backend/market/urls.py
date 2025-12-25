from django.urls import path
from . import views

urlpatterns = [
    # Home
    path("", views.home, name="home"),
    
    # Configuración
    path("api/config/", views.get_config_view, name="get_config"),
    path("api/update-config/", views.update_config, name="update_config"),
    
    # Items
    path("api/add-item/", views.add_item, name="add_item"),
    path("api/delete-item/", views.delete_item, name="delete_item"),
    path("api/delete-multiple-items/", views.delete_multiple_items, name="delete_multiple_items"),
    path("api/delete-all-items/", views.delete_all_items, name="delete_all_items"),
    path("api/check-items-exist/", views.check_items_exist, name="check_items_exist"),
    
    # Tracked Items
    path("api/update-tracked-items/", views.update_tracked_items, name="update_tracked_items"),
    path("api/add-tracked-item/", views.add_tracked_item, name="add_tracked_item"),
    
    # Auctions
    path("api/update-auctions/", views.update_auctions, name="update_auctions"),
    path("api/auction-status/", views.auction_status, name="auction_status"),
    
    # Snapshots
    path("api/delete-snapshots/", views.delete_snapshots, name="delete_snapshots"),
    path("api/delete-all-snapshots/", views.delete_all_snapshots, name="delete_all_snapshots"),

    # Music
    path("api/music-list/", views.get_music_list, name="music_list"),
]