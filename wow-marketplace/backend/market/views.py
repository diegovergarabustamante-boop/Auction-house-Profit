from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json
from market.management.commands.update_auctions import get_token, get_item_id, load_cache, save_cache
from .models import (
    Item, TrackedItem, ItemPriceSnapshot, AuctionUpdateStatus, Profession
)
from market.management.commands.update_auctions import run_update_auctions

def console_log(*messages):
    """Función auxiliar para imprimir mensajes en consola"""
    message = " ".join(str(m) for m in messages)
    print(f"[CONSOLE] {message}")

# =====================================================
# HOME
# =====================================================
def home(request):
    items = Item.objects.select_related("tracking", "profession").order_by("name")
    snapshots = ItemPriceSnapshot.objects.select_related(
        "item", "best_buy_realm", "best_sell_realm"
    ).order_by("-profit")[:50]
    professions = Profession.objects.order_by("name")
    
    # Formatear las fechas para el template (ESTA ES LA PARTE IMPORTANTE)
    for snapshot in snapshots:
        snapshot.formatted_date = snapshot.formatted_created_at()  # DD/MM HH:MM
    
    for item in items:
        if item.tracking:
            item.tracking.formatted_created_at = item.tracking.formatted_created_at()  # DD/MM HH:MM
            item.tracking.formatted_last_modified = item.tracking.formatted_last_modified()  # DD/MM HH:MM
    
    return render(
        request,
        "market/home.html",
        {
            "items": items,
            "snapshots": snapshots,
            "professions": professions,
        },
    )

# =====================================================
# TRACKED ITEMS
# =====================================================
@require_POST
def update_tracked_items(request):
    data = json.loads(request.body)
    item_ids = data.get("item_ids", [])
    TrackedItem.objects.update(active=False)
    for item_id in item_ids:
        TrackedItem.objects.update_or_create(item_id=item_id, defaults={"active": True})
    return JsonResponse({"ok": True, "count": len(item_ids)})

@require_POST
def add_tracked_item(request):
    data = json.loads(request.body)
    item_name = data.get("item_name", "").strip()
    if not item_name:
        return JsonResponse({"ok": False, "error": "Nombre vacío"})
    
    item, created_item = Item.objects.get_or_create(name=item_name)
    tracked, created_tracked = TrackedItem.objects.get_or_create(
        item=item, defaults={"active": True}
    )
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

# =====================================================
# AUCTIONS
# =====================================================
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

# =====================================================
# SNAPSHOTS
# =====================================================
@require_POST
def delete_snapshots(request):
    data = json.loads(request.body)
    ids = data.get("ids", [])
    
    # Eliminar los snapshots seleccionados
    deleted_count, _ = ItemPriceSnapshot.objects.filter(id__in=ids).delete()
    
    # Recuperar los snapshots restantes
    snapshots = ItemPriceSnapshot.objects.select_related(
        "item", "best_buy_realm", "best_sell_realm"
    ).order_by("-profit")[:50]
    
    # Formatear las fechas para la respuesta JSON
    snapshots_data = []
    for s in snapshots:
        snapshot_data = {
            "id": s.id,
            "item_name": s.item.name,
            "blizzard_id": s.item.blizzard_id,
            "best_buy_realm": s.best_buy_realm.name,
            "best_sell_realm": s.best_sell_realm.name,
            "buy_price": str(s.buy_price),
            "estimated_sell_price": str(s.estimated_sell_price),
            "profit": str(s.profit),
            "created_at": s.formatted_created_at(),  # ¡AÑADIR FECHA FORMATEADA!
        }
        snapshots_data.append(snapshot_data)
    
    return JsonResponse({"deleted": deleted_count, "snapshots": snapshots_data})

@require_POST
def delete_all_snapshots(request):
    count = ItemPriceSnapshot.objects.count()
    ItemPriceSnapshot.objects.all().delete()
    return JsonResponse({"deleted": count})

# =====================================================
# ITEMS
# =====================================================
import os
import csv
from django.core.files import File
from django.conf import settings

# Ruta al CSV y la carpeta de iconos
CSV_PATH = r'C:\Users\diego\OneDrive\Desktop\Auction house api\Auction-house\Auction-house-Profit\wow-marketplace\backend\market\static\items_with_icons.csv'
ICONS_PATH = r'C:\Users\diego\OneDrive\Desktop\Auction house api\Auction-house\Auction-house-Profit\wow-marketplace\backend\market\static\icons'

# Leer CSV y mapear los iconos
def load_icons_from_csv():
    icon_mapping = {}
    with open(CSV_PATH, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file, delimiter=',')
        for row in reader:
            icon_mapping[int(row['ID'])] = row['IconName'].strip().lower()
    return icon_mapping

# Función para asociar el icono al ítem
def assign_icon_to_item(item, is_decor=False):
    """Asigna un icono al ítem."""
    console_log("🎨 Asignando icono para item:", item.name, "(Decor:", is_decor, ")")
    
    if is_decor:
        console_log("📦 Es un decor item, usando icono por defecto")
        return
    
    console_log("🔍 Buscando icono en CSV para Blizzard ID:", item.blizzard_id)
    icon_mapping = load_icons_from_csv()
    icon_name = icon_mapping.get(item.blizzard_id)
    
    if icon_name:
        console_log("✅ Icono encontrado en CSV:", icon_name)
        icon_filename = f"{icon_name}.png"
        icon_path = os.path.join(ICONS_PATH, icon_filename)
        
        if os.path.exists(icon_path):
            console_log("📁 Archivo encontrado en:", icon_path)
            try:
                with open(icon_path, 'rb') as icon_file:
                    item.icon.save(icon_filename, File(icon_file), save=True)
                console_log("✅ Icono asignado exitosamente")
            except Exception as e:
                console_log("❌ Error al asignar icono:", str(e))
        else:
            console_log("⚠️ Archivo no encontrado:", icon_path)
    else:
        console_log("⚠️ No se encontró icono en CSV para Blizzard ID:", item.blizzard_id)

@require_POST
def add_item(request):
    """Añade un nuevo Item solo si se encuentra en Blizzard y obtiene el Blizzard Item ID desde la API."""
    print("🟢 ========== INICIO add_item ==========")
    data = json.loads(request.body)
    item_name = data.get("name", "").strip()
    profession_id = data.get("profession_id")
    is_decor = data.get("is_decor", False)
    
    print(f"📋 Datos recibidos: nombre='{item_name}', profesión_id={profession_id}, is_decor={is_decor}")
    
    if not item_name:
        print("❌ Error: Nombre vacío")
        return JsonResponse({"ok": False, "error": "No name provided"}, status=400)
    
    profession = None
    if profession_id:
        try:
            profession = Profession.objects.get(id=profession_id)
            print(f"✅ Profesión encontrada: {profession.name}")
        except Profession.DoesNotExist:
            print(f"❌ Profesión no encontrada con ID: {profession_id}")
            return JsonResponse({"ok": False, "error": "Profesión no válida"}, status=400)
    
    # =======================
    # OBTENER BLIZZARD ITEM ID
    # =======================
    print("🔑 Obteniendo token de Blizzard...")
    token = get_token()  # obtener token Blizzard
    print("📂 Cargando cache local...")
    cache = load_cache()  # cargar cache local
    print(f"🔍 Buscando Blizzard ID para: '{item_name}'...")
    blizzard_id = get_item_id(token, item_name, cache)
    
    if not blizzard_id:
        print(f"❌ No se encontró el item en Blizzard: '{item_name}'")
        return JsonResponse({"ok": False, "error": "No se encontró el item en Blizzard"}, status=404)
    
    print(f"✅ Blizzard ID encontrado: {blizzard_id}")
    
    # =======================
    # CREAR ITEM Y TRACKED
    # =======================
    print("🏗️ Creando/Actualizando Item en base de datos...")
    
    item, created = Item.objects.get_or_create(
        name=item_name,
        defaults={
            "profession": profession,
            "blizzard_id": blizzard_id
        }
    )
    
    print(f"✅ Item {'creado' if created else 'encontrado'}: {item_name} (ID: {item.id})")
    
    # Si ya existía, actualizar blizzard_id y profesión si es necesario
    updated_fields = []
    if not created:
        if item.blizzard_id != blizzard_id:
            item.blizzard_id = blizzard_id
            updated_fields.append("blizzard_id")
            print(f"🔄 Actualizando Blizzard ID a: {blizzard_id}")
        
        if profession and item.profession != profession:
            item.profession = profession
            updated_fields.append("profession")
            print(f"🔄 Actualizando profesión a: {profession.name}")
        
        if updated_fields:
            item.save(update_fields=updated_fields)
            print(f"💾 Campos actualizados: {updated_fields}")
    
    # Crear o activar tracking
    print("🎯 Creando/Actualizando TrackedItem...")
    tracked, tracked_created = TrackedItem.objects.get_or_create(
        item=item, defaults={"active": True}
    )
    
    if not tracked.active:
        tracked.active = True
        tracked.save(update_fields=["active"])
        print("✅ TrackedItem activado")
    
    print(f"✅ TrackedItem {'creado' if tracked_created else 'encontrado'}")
    
    # Asignar el icono al ítem
    print("🖼️ Procesando icono...")
    assign_icon_to_item(item, is_decor)
    
    save_cache(cache)
    print(f"💾 Cache guardada")
    print("🟢 ========== FIN add_item ==========")
    
    return JsonResponse({
        "ok": True,
        "item_id": item.id,
        "item_name": item.name,
        "blizzard_id": item.blizzard_id,
        "created_item": created,
        "is_decor": is_decor
    })

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
    
    deleted_count = Item.objects.filter(id__in=ids).delete()[0]
    return JsonResponse({"ok": True, "deleted_count": deleted_count})

@require_POST
def delete_all_items(request):
    count = Item.objects.count()
    Item.objects.all().delete()
    return JsonResponse({"ok": True, "deleted_count": count})