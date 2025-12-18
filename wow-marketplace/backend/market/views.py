from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json

from .models import (
    ItemPriceSnapshot,
    AuctionUpdateStatus,
    TrackedItem
)

from market.management.commands.update_auctions import run_update_auctions


from market.models import Item, ItemPriceSnapshot, TrackedItem

def home(request):
    items = (
        Item.objects
        .select_related("tracking")
        .order_by("name")
    )

    snapshots = (
        ItemPriceSnapshot.objects
        .select_related("item", "best_buy_realm", "best_sell_realm")
        .order_by("-profit")[:50]
    )

    return render(
        request,
        "market/home.html",
        {
            "items": items,          # 👈 tabla 1
            "snapshots": snapshots,  # 👈 tabla 2
        },
    )



@require_POST
def update_tracked_items(request):
    data = json.loads(request.body)
    item_ids = data.get("item_ids", [])

    # Desactivar todos
    TrackedItem.objects.update(active=False)

    # Activar o crear los seleccionados
    for item_id in item_ids:
        TrackedItem.objects.update_or_create(
            item_id=item_id,
            defaults={"active": True}
        )

    return JsonResponse({"ok": True, "count": len(item_ids)})



@require_POST
def update_auctions(request):
    created = run_update_auctions()
    return JsonResponse({"status": "ok", "created": created})


def auction_status(request):
    status = AuctionUpdateStatus.objects.first()
    if not status:
        return JsonResponse({"running": False})

    elapsed = status.elapsed_seconds()
    eta = 0
    if status.processed_realms:
        avg = elapsed / status.processed_realms
        eta = avg * (status.total_realms - status.processed_realms)

    return JsonResponse({
        "running": status.is_running,
        "total": status.total_realms,
        "current": status.current_realm,
        "done": status.processed_realms,
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
