from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db.models import Max
import json
import os
from django.core.files import File
from django.conf import settings
import csv

from market.management.commands.update_auctions import get_token, get_item_id, load_cache, save_cache
from .models import (
    Item, TrackedItem, ItemPriceSnapshot, AuctionUpdateStatus, 
    Profession, UserConfig  # Añadido UserConfig
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
    
    # Obtener solo el snapshot más reciente por item
    max_created_subquery = ItemPriceSnapshot.objects.values('item').annotate(max_created=Max('created_at')).values('max_created')
    snapshots = ItemPriceSnapshot.objects.filter(
        created_at__in=max_created_subquery
    ).select_related(
        "item", "best_buy_realm", "best_sell_realm"
    ).order_by("-profit")[:50]
    
    professions = Profession.objects.order_by("name")
    
    # Cargar configuración actual
    config = UserConfig.load()
    
    # Formatear las fechas para el template
    for snapshot in snapshots:
        snapshot.formatted_date = snapshot.formatted_created_at()
    
    for item in items:
        if item.tracking:
            item.tracking.formatted_created_at = item.tracking.formatted_created_at()
            item.tracking.formatted_last_modified = item.tracking.formatted_last_modified()
    
    return render(
        request,
        "market/home.html",
        {
            "items": items,
            "snapshots": snapshots,
            "professions": professions,
            "config": config,  # Pasar configuración al template
        },
    )

# =====================================================
# CONFIGURATION
# =====================================================
def get_config_view(request):
    """Gets the current configuration"""
    config = UserConfig.load()
    return JsonResponse({
        "ok": True,
        "config": {
            "max_realms_to_scan": config.max_realms_to_scan,
            "realms_to_scan": config.get_realms_to_scan_list(),
            "dev_mode": config.dev_mode,
        }
    })

@require_POST
def update_config(request):
    """Actualiza la configuración del usuario"""
    data = json.loads(request.body)
    config = UserConfig.load()
    
    try:
        if "max_realms_to_scan" in data:
            max_realms = int(data["max_realms_to_scan"])
            config.max_realms_to_scan = max(0, max_realms)  # 0 or positive
        
        if "realms_to_scan" in data:
            # Validate that it's a list of strings
            realms = data["realms_to_scan"]
            if isinstance(realms, list):
                # Filter empty elements and remove duplicates preserving order
                unique_realms = []
                seen = set()
                for realm in realms:
                    realm_clean = realm.strip()
                    if realm_clean and realm_clean.lower() not in seen:
                        seen.add(realm_clean.lower())
                        unique_realms.append(realm_clean)
                config.realms_to_scan = json.dumps(unique_realms)
        
        if "dev_mode" in data:
            config.dev_mode = bool(data["dev_mode"])
        
        config.save()
        
        return JsonResponse({
            "ok": True,
            "message": "Configuration updated successfully",
            "config": {
                "max_realms_to_scan": config.max_realms_to_scan,
                "realms_to_scan": config.get_realms_to_scan_list(),
                "dev_mode": config.dev_mode,
            }
        })
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

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
    if status.processed_realms and status.total_realms > 0:
        avg = elapsed / status.processed_realms
        eta = avg * (status.total_realms - status.processed_realms)
    
    return JsonResponse({
        "running": status.is_running,
        "total": status.total_realms,
        "current": status.current_realm,
        "done": status.processed_realms,
        "elapsed": int(elapsed),
        "eta": int(eta),
        "config_info": status.config_info or "",
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
    
    # Recuperar los snapshots restantes (solo los más recientes por item)
    max_created_subquery = ItemPriceSnapshot.objects.values('item').annotate(max_created=Max('created_at')).values('max_created')
    snapshots = ItemPriceSnapshot.objects.filter(
        created_at__in=max_created_subquery
    ).select_related(
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
            "created_at": s.formatted_created_at(),
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
# Ruta al CSV y la carpeta de iconos
CSV_PATH = r'C:\Users\diego\OneDrive\Desktop\Auction house api\Auction-house\Auction-house-Profit\wow-marketplace\backend\market\static\items_with_icons.csv'
ICONS_PATH = r'C:\Users\diego\OneDrive\Desktop\Auction house api\Auction-house\Auction-house-Profit\wow-marketplace\backend\market\static\icons'

# Leer CSV y mapear los iconos
def load_icons_from_csv():
    icon_mapping = {}
    try:
        with open(CSV_PATH, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file, delimiter=',')
            for row in reader:
                try:
                    icon_mapping[int(row['ID'])] = row['IconName'].strip().lower()
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        console_log("❌ Archivo CSV no encontrado:", CSV_PATH)
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
    console_log(f"📊 Total de items en CSV: {len(icon_mapping)}")
    
    # Convertir blizzard_id a int para búsqueda
    blizzard_id_int = None
    try:
        blizzard_id_int = int(item.blizzard_id) if item.blizzard_id else None
    except (ValueError, TypeError):
        console_log(f"⚠️ No se pudo convertir Blizzard ID a int: {item.blizzard_id}")
    
    if blizzard_id_int and blizzard_id_int in icon_mapping:
        icon_name = icon_mapping[blizzard_id_int]
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
        if blizzard_id_int:
            console_log(f"⚠️ No se encontró icono en CSV para Blizzard ID {blizzard_id_int} (convertido de {item.blizzard_id})")
        else:
            console_log(f"⚠️ Blizzard ID inválido o vacío: {item.blizzard_id}")

@require_POST
def add_item(request):
    """Añade un nuevo Item solo si se encuentra en Blizzard"""
    console_log("🟢 ========== INICIO add_item ==========")
    data = json.loads(request.body)
    item_name = data.get("name", "").strip()
    profession_id = data.get("profession_id")
    profession_name = data.get("profession_name", "").strip()
    is_decor = data.get("is_decor", False)
    
    console_log(f"📋 Datos recibidos: nombre='{item_name}', profesión_id={profession_id}, profesión_nombre='{profession_name}', is_decor={is_decor}")
    
    if not item_name:
        console_log("❌ Error: Nombre vacío")
        return JsonResponse({"ok": False, "error": "No name provided"}, status=400)
    
    profession = None
    
    # Mapeo de nombres de profesión (inglés/español a inglés)
    profession_name_mapping = {
        # Español a Inglés
        'alquimia': 'Alchemy',
        'herrería': 'Blacksmithing',
        'encantamiento': 'Enchanting',
        'ingeniería': 'Engineering',
        'herboristería': 'Herbalism',
        'inscripción': 'Inscription',
        'joyería': 'Jewelcrafting',
        'pelambre': 'Leatherworking',
        'minería': 'Mining',
        'desuello': 'Skinning',
        'sastrería': 'Tailoring',
        'cocina': 'Cooking',
        'pesca': 'Fishing',
        'arqueología': 'Archaeology',
        
        # Inglés (asegurar formato correcto)
        'alchemy': 'Alchemy',
        'blacksmithing': 'Blacksmithing',
        'enchanting': 'Enchanting',
        'engineering': 'Engineering',
        'herbalism': 'Herbalism',
        'inscription': 'Inscription',
        'jewelcrafting': 'Jewelcrafting',
        'leatherworking': 'Leatherworking',
        'mining': 'Mining',
        'skinning': 'Skinning',
        'tailoring': 'Tailoring',
        'cooking': 'Cooking',
        'fishing': 'Fishing',
        'archaeology': 'Archaeology'
    }
    
    # Primero intentar por nombre de profesión (si se proporciona)
    if profession_name:
        normalized_profession_name = profession_name.lower()
        english_profession_name = profession_name_mapping.get(normalized_profession_name)
        
        if english_profession_name:
            try:
                profession = Profession.objects.get(name__iexact=english_profession_name)
                console_log(f"✅ Profesión encontrada por nombre: {profession.name}")
            except Profession.DoesNotExist:
                console_log(f"⚠️ Profesión no encontrada en BD: '{english_profession_name}'")
                # Podemos crear la profesión automáticamente
                try:
                    profession = Profession.objects.create(name=english_profession_name)
                    console_log(f"✅ Profesión creada automáticamente: {profession.name}")
                except Exception as e:
                    console_log(f"❌ Error creando profesión: {e}")
        else:
            console_log(f"⚠️ Nombre de profesión no reconocido: '{profession_name}'")
    # Si no hay nombre, intentar por ID
    elif profession_id:
        try:
            profession = Profession.objects.get(id=profession_id)
            console_log(f"✅ Profesión encontrada por ID: {profession.name}")
        except Profession.DoesNotExist:
            console_log(f"❌ Profesión no encontrada con ID: {profession_id}")
            return JsonResponse({"ok": False, "error": "Profesión no válida"}, status=400)
    
    # =======================
    # PRIMERO VERIFICAR SI EL ITEM YA EXISTE
    # =======================
    console_log(f"🔍 Buscando si el item ya existe en base de datos: '{item_name}'")
    
    try:
        # Intentar encontrar el item en la base de datos
        existing_item = Item.objects.get(name__iexact=item_name)
        console_log(f"✅ Item ya existe en BD: {existing_item.name} (ID: {existing_item.id})")
        
        # Si ya existe, actualizar profesión si se proporciona una nueva
        updated_fields = []
        if profession and existing_item.profession != profession:
            existing_item.profession = profession
            updated_fields.append("profession")
            console_log(f"🔄 Actualizando profesión a: {profession.name}")
        
        if updated_fields:
            existing_item.save(update_fields=updated_fields)
            console_log(f"💾 Campos actualizados: {updated_fields}")
        
        # Crear o activar tracking
        tracked, tracked_created = TrackedItem.objects.get_or_create(
            item=existing_item,
            defaults={"active": True}
        )
        
        if not tracked.active:
            tracked.active = True
            tracked.save(update_fields=["active"])
            console_log("✅ TrackedItem activado")
        
        console_log(f"✅ Item ya existente procesado: {existing_item.name}")
        
        # Obtener URL del icono
        icon_url = None
        if existing_item.icon and existing_item.icon.url:
            icon_url = request.build_absolute_uri(existing_item.icon.url)
        else:
            icon_url = "https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_01.jpg"
        
        return JsonResponse({
            "ok": True,
            "item_id": existing_item.id,
            "item_name": existing_item.name,
            "blizzard_id": existing_item.blizzard_id,
            "created_item": False,
            "is_decor": is_decor,
            "profession_assigned": profession is not None,
            "profession_name": profession.name if profession else None,
            "tracked_created_at": tracked.created_at.strftime("%d/%m %H:%M") if tracked_created else tracked.formatted_created_at(),
            "tracked_last_modified": tracked.last_modified.strftime("%d/%m %H:%M") if tracked_created else tracked.formatted_last_modified(),
            "icon_url": icon_url,
            "message": "Item ya existente - activado para seguimiento" + (f" con profesión {profession.name}" if profession else "")
        })
        
    except Item.DoesNotExist:
        console_log(f"⚠️ Item NO encontrado en base de datos, consultando API de Blizzard...")
        # El item no existe, proceder con la consulta a Blizzard
        pass
    
    except Exception as e:
        console_log(f"❌ Error buscando item en BD: {e}")
        # Continuar con el flujo normal si hay error
    
    # =======================
    # OBTENER BLIZZARD ITEM ID (solo si no existe)
    # =======================
    console_log("🔑 Obteniendo token de Blizzard...")
    token = get_token()
    console_log("📂 Cargando cache local...")
    cache = load_cache()
    console_log(f"🔍 Buscando Blizzard ID para: '{item_name}'...")
    blizzard_id = get_item_id(token, item_name, cache)
    
    if not blizzard_id:
        console_log(f"❌ No se encontró el item en Blizzard: '{item_name}'")
        return JsonResponse({"ok": False, "error": "No se encontró el item en Blizzard"}, status=404)
    
    console_log(f"✅ Blizzard ID encontrado: {blizzard_id}")
    
    # =======================
    # CREAR ITEM Y TRACKED
    # =======================
    console_log("🏗️ Creando Item en base de datos...")
    
    item, created = Item.objects.get_or_create(
        name=item_name,
        defaults={
            "profession": profession,
            "blizzard_id": blizzard_id
        }
    )
    
    console_log(f"✅ Item {'creado' if created else 'encontrado'}: {item_name} (ID: {item.id})")
    
    # Si ya existía (caso raro por el case-insensitive), actualizar
    updated_fields = []
    if not created:
        if item.blizzard_id != blizzard_id:
            item.blizzard_id = blizzard_id
            updated_fields.append("blizzard_id")
            console_log(f"🔄 Actualizando Blizzard ID a: {blizzard_id}")
        
        if profession and item.profession != profession:
            item.profession = profession
            updated_fields.append("profession")
            console_log(f"🔄 Actualizando profesión a: {profession.name}")
        
        if updated_fields:
            item.save(update_fields=updated_fields)
            console_log(f"💾 Campos actualizados: {updated_fields}")
    
    # Crear o activar tracking
    console_log("🎯 Creando/Actualizando TrackedItem...")
    tracked, tracked_created = TrackedItem.objects.get_or_create(
        item=item,
        defaults={"active": True}
    )
    
    if not tracked.active:
        tracked.active = True
        tracked.save(update_fields=["active"])
        console_log("✅ TrackedItem activado")
    
    console_log(f"✅ TrackedItem {'creado' if tracked_created else 'encontrado'}")
    
    # Asignar el icono al ítem (solo para nuevos items o si no tiene icono)
    if created or not item.icon:
        console_log("🖼️ Procesando icono...")
        assign_icon_to_item(item, is_decor)
    else:
        console_log("✅ Item ya tiene icono, omitiendo asignación")
    
    save_cache(cache)
    console_log(f"💾 Cache guardada")
    
    # Obtener URL del icono
    icon_url = None
    if item.icon and item.icon.url:
        icon_url = request.build_absolute_uri(item.icon.url)
    else:
        icon_url = "https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_01.jpg"
    
    console_log("🟢 ========== FIN add_item ==========")
    
    return JsonResponse({
        "ok": True,
        "item_id": item.id,
        "item_name": item.name,
        "blizzard_id": item.blizzard_id,
        "created_item": created,
        "is_decor": is_decor,
        "profession_assigned": profession is not None,
        "profession_name": profession.name if profession else None,
        "tracked_created_at": tracked.created_at.strftime("%d/%m %H:%M"),
        "tracked_last_modified": tracked.last_modified.strftime("%d/%m %H:%M"),
        "icon_url": icon_url,
        "message": "Item nuevo creado exitosamente" + (f" con profesión {profession.name}" if profession else "")
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

@require_POST
def check_items_exist(request):
    """Verifica rápidamente qué items ya existen en la base de datos"""
    data = json.loads(request.body)
    item_names = data.get("item_names", [])
    
    if not item_names:
        return JsonResponse({"ok": False, "error": "No items provided"}, status=400)
    
    # Buscar items que ya existen (case-insensitive)
    existing_items = Item.objects.filter(
        name__in=[name for name in item_names]
    ).values_list('name', flat=True)
    
    # Convertir a lowercase para comparación case-insensitive
    existing_names_lower = {name.lower() for name in existing_items}
    
    result = {}
    for item_name in item_names:
        result[item_name] = item_name.lower() in existing_names_lower
    
    return JsonResponse({
        "ok": True,
        "results": result,
        "existing_count": len(existing_names_lower),
        "total_count": len(item_names)
    })

# =====================================================
# MUSIC LIST
# =====================================================
def get_music_list(request):
    """Returns the list of music files available under static/market/music."""
    try:
        music_dir = os.path.join(settings.BASE_DIR, "market", "static", "market", "music")
        if not os.path.isdir(music_dir):
            return JsonResponse({"ok": True, "tracks": []})

        allowed_exts = {".mp3", ".ogg", ".wav", ".m4a"}
        files = []
        for name in os.listdir(music_dir):
            full_path = os.path.join(music_dir, name)
            if not os.path.isfile(full_path):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext in allowed_exts:
                url = f"{settings.STATIC_URL}market/music/{name}"
                files.append({
                    "url": url,
                    "name": os.path.splitext(name)[0]
                })

        # Optional: sort for deterministic order client-side can shuffle
        files.sort(key=lambda x: x["name"].lower())
        return JsonResponse({"ok": True, "tracks": files})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)