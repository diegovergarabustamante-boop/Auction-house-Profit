from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json

from .models import (
    Item,
    TrackedItem,
    ItemPriceSnapshot,
    AuctionUpdateStatus,
    Profession
)
from market.management.commands.update_auctions import run_update_auctions


def home(request):
    items = (
        Item.objects
        .select_related("tracking", "profession")
        .order_by("name")
    )

    snapshots = (
        ItemPriceSnapshot.objects
        .select_related("item", "best_buy_realm", "best_sell_realm")
        .order_by("-profit")[:50]
    )

    professions = Profession.objects.order_by("name")

    return render(
        request,
        "market/home.html",
        {
            "items": items,          # 👈 tabla 1
            "snapshots": snapshots,  # 👈 tabla 2
            "professions": professions, # 👈 lista para select
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


@require_POST
def add_item(request):
    """
    Añade un nuevo Item desde la tabla con posibilidad de seleccionar profesión
    """
    data = json.loads(request.body)
    item_name = data.get("name", "").strip()
    profession_id = data.get("profession_id")

    if not item_name:
        return JsonResponse({"ok": False, "error": "No name provided"}, status=400)

    # Obtener la profesión si se indicó
    profession = None
    if profession_id:
        try:
            profession = Profession.objects.get(id=profession_id)
        except Profession.DoesNotExist:
            return JsonResponse({"ok": False, "error": "Profesión no válida"}, status=400)

    # crear o recuperar el item
    item, created = Item.objects.get_or_create(name=item_name, defaults={"profession": profession})
    if not created:
        # si el item ya existía, actualizar su profesión
        item.profession = profession
        item.save(update_fields=["profession"])

    # asegurarse de que haya un TrackedItem activo
    TrackedItem.objects.get_or_create(item=item, defaults={"active": True})

    return JsonResponse({"ok": True, "item_id": item.id, "item_name": item.name})


@require_POST
def add_tracked_item(request):
    """
    Añade un item a tracked (por compatibilidad con endpoints antiguos)
    """
    data = json.loads(request.body)
    item_name = data.get("item_name", "").strip()

    if not item_name:
        return JsonResponse({"ok": False, "error": "Nombre vacío"})

    # Crear o recuperar Item
    item, created_item = Item.objects.get_or_create(name=item_name)

    # Crear o recuperar TrackedItem activo
    tracked, created_tracked = TrackedItem.objects.get_or_create(
        item=item,
        defaults={"active": True}
    )

    # Si existía pero estaba inactivo, lo activamos
    if not tracked.active:
        tracked.active = True
        tracked.save(update_fields=["active"])

    return JsonResponse({
        "ok": True,
        "item_id": item.id,
        "item_name": item.name,
        "created_item": created_item,
        "created_tracked": created_tracked
    })


from django.views.decorators.http import require_POST
from django.http import JsonResponse
from .models import Item

@require_POST
def delete_item(request):
    data = json.loads(request.body)
    item_id = data.get("item_id")

    if not item_id:
        return JsonResponse({"ok": False, "error": "No item_id provided"}, status=400)

    try:
        item = Item.objects.get(id=item_id)
        item.delete()  # Esto elimina el Item y el TrackedItem por relación OneToOne
        return JsonResponse({"ok": True, "item_id": item_id})
    except Item.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Item not found"}, status=404)
    


    from django.views.decorators.http import require_POST
from django.http import JsonResponse
from .models import Item, TrackedItem, ItemPriceSnapshot
import json

@require_POST
def delete_item(request):
    data = json.loads(request.body)
    item_id = data.get("item_id")
    if not item_id:
        return JsonResponse({"ok": False, "error": "No se proporcionó item_id"})

    try:
        item = Item.objects.get(id=item_id)
        item.delete()
        return JsonResponse({"ok": True})
    except Item.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Item no encontrado"})

@require_POST
def delete_multiple_items(request):
    data = json.loads(request.body)
    ids = data.get("item_ids", [])
    if not ids:
        return JsonResponse({"ok": False, "error": "No se proporcionaron item_ids"})
    
    Item.objects.filter(id__in=ids).delete()
    return JsonResponse({"ok": True, "deleted_count": len(ids)})

@require_POST
def delete_all_items(request):
    count = Item.objects.count()
    Item.objects.all().delete()
    return JsonResponse({"ok": True, "deleted_count": count})