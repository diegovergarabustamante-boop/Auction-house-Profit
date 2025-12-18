from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from market.models import ItemPriceSnapshot
from market.management.commands.update_auctions import run_update_auctions


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


@require_POST
def update_auctions(request):
    created = run_update_auctions()
    return JsonResponse({
        "status": "ok",
        "created": created
    })
