from django.shortcuts import render
from market.models import ItemPriceSnapshot


def home(request):
    snapshots = (
        ItemPriceSnapshot.objects
        .select_related("item", "best_buy_realm", "best_sell_realm")
        .order_by("-profit")[:50]
    )

    return render(
        request,
        "market/home.html",
        {"snapshots": snapshots},
    )
