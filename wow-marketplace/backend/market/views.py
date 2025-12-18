from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from market.models import ItemPriceSnapshot
from market.management.commands.update_auctions import run_update_auctions

from django.http import JsonResponse
from market.models import AuctionUpdateStatus
import time


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



def auction_status(request):
    status = AuctionUpdateStatus.objects.first()

    if not status:
        return JsonResponse({"running": False})

    elapsed = status.elapsed_seconds()
    eta = 0

    if status.processed_realms > 0:
        avg = elapsed / status.processed_realms
        eta = avg * (status.total_realms - status.processed_realms)

    return JsonResponse({
        "running": status.is_running,
        "total": status.total_realms,
        "current": status.current_realm,
        "done": status.processed_realms,
        "remaining": status.total_realms - status.processed_realms,
        "elapsed": int(elapsed),
        "eta": int(eta),
    })