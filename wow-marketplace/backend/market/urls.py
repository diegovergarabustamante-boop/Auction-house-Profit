from django.urls import path
from .views import home, update_auctions, auction_status

urlpatterns = [
    path("", home, name="home"),
    path("update-auctions/", update_auctions, name="update_auctions"),
    # market/urls.py
    path("auction-status/", auction_status, name="auction_status"),

]
