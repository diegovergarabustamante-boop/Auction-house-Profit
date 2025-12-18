from django.urls import path
from .views import home, update_auctions

urlpatterns = [
    path("", home, name="home"),
    path("update-auctions/", update_auctions, name="update_auctions"),
]
