from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from market.models import ItemPriceSnapshot
from market.management.commands.update_auctions import run_update_auctions

from django.http import JsonResponse
from market.models import AuctionUpdateStatus
import time


from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

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

@require_POST
def delete_snapshots(request):
    data = json.loads(request.body)
    ids = data.get("ids", [])

    ItemPriceSnapshot.objects.filter(id__in=ids).delete()

    return JsonResponse({"deleted": len(ids)})


@require_POST
def delete_all_snapshots(request):
    count = ItemPriceSnapshot.objects.count()
    ItemPriceSnapshot.objects.all().delete()

    return JsonResponse({"deleted": count})
