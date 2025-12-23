from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

import time
import json
import requests

from market.models import (
    AuctionUpdateStatus,
    Item,
    ConnectedRealm,
    ItemPriceSnapshot,
    TrackedItem,
    UserConfig,  # Añadido
)

# ======================
# CONFIG - OBTENER DEL MODELO
# ======================
def get_config():
    """Obtiene la configuración del usuario"""
    config = UserConfig.load()
    return {
        "REGION": config.region,
        "LOCALE": config.locale,
        "PRIMARY_REALMS": config.get_primary_realms_list(),
        "MAX_REALMS_TO_SCAN": config.max_realms_to_scan,
        "DEV_MODE": config.dev_mode,
    }

BASE_DIR = settings.BASE_DIR
CREDENTIALS_FILE = BASE_DIR / "blizzard_credentials.txt"
REALMS_JSON = BASE_DIR / "wow_realms_connected.json"
CACHE_FILE = BASE_DIR / "item_id_cache.json"

# ======================
# AUTH
# ======================
def load_credentials():
    creds = {}
    with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                creds[k] = v
    return creds["CLIENT_ID"], creds["CLIENT_SECRET"]


def get_token():
    client_id, client_secret = load_credentials()
    config = get_config()
    region = config["REGION"]
    
    r = requests.post(
        f"https://{region}.battle.net/oauth/token",
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials"},
    )
    r.raise_for_status()
    return r.json()["access_token"]


# ======================
# CACHE
# ======================
def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)


# ======================
# REALMS
# ======================
def load_realms():
    with open(REALMS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    config = get_config()
    max_realms = config["MAX_REALMS_TO_SCAN"]
    
    # Determinar cuántos reinos escanear
    if max_realms > 0:
        max_to_scan = min(max_realms, len(data))
    else:
        max_to_scan = len(data)  # 0 = todos
    
    # Aplicar dev mode si está activado
    if config["DEV_MODE"]:
        max_to_scan = min(max_to_scan, 10)  # Limitar a 10 en dev mode
    
    realms_data = data[:max_to_scan]
    
    realms = {}
    for r in realms_data:
        realm, _ = ConnectedRealm.objects.update_or_create(
            blizzard_id=r["id"],
            defaults={"name": r["name"], "slug": r["slug"]},
        )
        realms[realm.name] = realm

    return realms


# ======================
# ITEMS
# ======================
def get_item_id(token, item_name, cache):
    """Obtiene el ID de Blizzard para un item, usando cache primero"""
    
    # Primero verificar si el item está en la cache local
    if item_name in cache:
        print(f"📦 ID encontrado en cache para: {item_name}")
        return cache[item_name]
    
    # Si no está en cache, verificar en la base de datos primero
    try:
        item = Item.objects.get(name__iexact=item_name)
        if item.blizzard_id:
            print(f"💾 ID encontrado en base de datos para: {item_name}")
            cache[item_name] = item.blizzard_id  # Guardar en cache para futuro
            return item.blizzard_id
    except Item.DoesNotExist:
        pass  # Item no existe en BD, continuar con API
    
    print(f"🌐 Consultando API de Blizzard para: {item_name}")
    
    config = get_config()
    region = config["REGION"]
    locale = config["LOCALE"]
    
    # Consultar API de Blizzard
    try:
        r = requests.get(
            f"https://{region}.api.blizzard.com/data/wow/search/item",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "namespace": f"static-{region}",
                "locale": locale,
                "name.en_US": item_name,
                "_pageSize": 5,
            },
            timeout=10  # Timeout de 10 segundos
        )
        r.raise_for_status()
        
        for res in r.json().get("results", []):
            name = res["data"]["name"].get(locale)
            if name and name.lower() == item_name.lower():
                cache[item_name] = res["data"]["id"]
                print(f"✅ ID obtenido de API para: {item_name}")
                return cache[item_name]
        
        print(f"❌ Item no encontrado en API: {item_name}")
        return None
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión con API de Blizzard: {e}")
        return None
    except Exception as e:
        print(f"❌ Error inesperado en API: {e}")
        return None


# ======================
# AUCTIONS
# ======================
def get_all_auctions(token, realms, status):
    all_auctions = {}
    total = len(realms)

    status.total_realms = total
    status.processed_realms = 0
    status.is_running = True
    status.save()

    config = get_config()
    region = config["REGION"]
    locale = config["LOCALE"]
    
    for idx, realm in enumerate(realms.values(), start=1):
        status.current_realm = realm.name
        status.processed_realms = idx
        status.save(update_fields=["current_realm", "processed_realms", "updated_at"])

        try:
            r = requests.get(
                f"https://{region}.api.blizzard.com/data/wow/connected-realm/{realm.blizzard_id}/auctions",
                headers={"Authorization": f"Bearer {token}"},
                params={"namespace": f"dynamic-{region}", "locale": locale},
                timeout=15
            )
            if r.status_code == 200:
                all_auctions[realm.name] = r.json().get("auctions", [])
                print(f"✅ Reino {idx}/{total}: {realm.name} - {len(all_auctions[realm.name])} subastas")
            else:
                print(f"⚠️ Reino {idx}/{total}: {realm.name} - Error {r.status_code}")
                all_auctions[realm.name] = []
        except requests.exceptions.RequestException as e:
            print(f"❌ Error en reino {realm.name}: {e}")
            all_auctions[realm.name] = []

    status.is_running = False
    status.save(update_fields=["is_running", "updated_at"])
    return all_auctions


def get_price_per_unit(a):
    if a.get("unit_price"):
        return a["unit_price"]
    if a.get("buyout"):
        return a["buyout"] / a.get("quantity", 1)
    return None


def min_buyout(auctions, item_id):
    prices = [
        get_price_per_unit(a)
        for a in auctions
        if a.get("item", {}).get("id") == item_id and get_price_per_unit(a)
    ]
    return min(prices) if prices else None


def min_buyout_by_realm(all_auctions, item_id):
    prices = {}
    for realm, auctions in all_auctions.items():
        p = min_buyout(auctions, item_id)
        if p:
            prices[realm] = p
    return prices


def analyze_arbitrage(prices):
    config = get_config()
    primary_realms = config["PRIMARY_REALMS"]
    
    if not prices:
        return None, None, None, 0

    buy_realm = min(prices, key=prices.get)
    buy_price = prices[buy_realm]

    best_target = None
    best_profit = 0
    best_sell_price = None

    for realm in primary_realms:
        if realm in prices:
            sell_price = prices[realm]
            profit = (sell_price - buy_price) * 0.95  # AH cut

            if profit > best_profit:
                best_profit = profit
                best_target = realm
                best_sell_price = sell_price

    if best_profit < 1000:
        return buy_realm, None, None, 0

    return buy_realm, best_target, best_sell_price, best_profit


def run_update_auctions():
    status, _ = AuctionUpdateStatus.objects.get_or_create(id=1)
    status.started_at = timezone.now()
    status.is_running = True
    status.processed_realms = 0
    status.current_realm = ""
    
    config = get_config()
    max_realms = config["MAX_REALMS_TO_SCAN"]
    primary_count = len(config["PRIMARY_REALMS"])
    
    status.config_info = f"Config: {max_realms if max_realms > 0 else 'todos'} reinos | {primary_count} reinos principales | Dev: {config['DEV_MODE']}"
    status.save()

    token = get_token()
    cache = load_cache()
    realms = load_realms()
    auctions = get_all_auctions(token, realms, status)

    created = 0
    tracked_items = TrackedItem.objects.filter(active=True).select_related("item")
    print(f"🎯 Items a escanear: {[t.item.name for t in tracked_items]}")

    for tracked in tracked_items:
        item = tracked.item

        item_id = get_item_id(token, item.name, cache)
        if not item_id:
            print(f"⚠️ No se encontró ID para: {item.name}")
            continue

        # Guardar Blizzard Item ID en la base de datos
        if item.blizzard_id != item_id:
            item.blizzard_id = item_id
            item.save(update_fields=["blizzard_id"])

        prices = min_buyout_by_realm(auctions, item_id)
        
        if not prices:
            print(f"⚠️ No se encontraron precios para: {item.name}")
            continue
            
        buy, sell, sell_price, profit = analyze_arbitrage(prices)

        if sell:
            try:
                buy_realm_obj = ConnectedRealm.objects.get(name=buy)
                sell_realm_obj = ConnectedRealm.objects.get(name=sell)
                
                ItemPriceSnapshot.objects.create(
                    item=item,
                    best_buy_realm=buy_realm_obj,
                    best_sell_realm=sell_realm_obj,
                    buy_price=prices[buy] / 10000,
                    estimated_sell_price=sell_price / 10000,
                    profit=profit / 10000,
                )
                created += 1
                print(f"✅ Snapshot creado para {item.name}: {buy} → {sell} (+{profit/10000:.2f}g)")
            except ConnectedRealm.DoesNotExist:
                print(f"❌ Error: Reino no encontrado en BD: {buy} o {sell}")
        else:
            print(f"ℹ️ No hay oportunidad de arbitraje para: {item.name}")

    save_cache(cache)

    status.is_running = False
    status.save(update_fields=["is_running", "updated_at"])

    print(f"✅ Proceso completado. Snapshots creados: {created}")
    return created


# ======================
# COMMAND
# ======================
class Command(BaseCommand):
    help = "Update WoW auction data and arbitrage opportunities"

    def handle(self, *args, **options):
        self.stdout.write("🚀 Updating auctions...")
        
        # Mostrar configuración actual
        config = get_config()
        self.stdout.write(f"⚙️ Configuración: {config['MAX_REALMS_TO_SCAN'] if config['MAX_REALMS_TO_SCAN'] > 0 else 'todos'} reinos | {len(config['PRIMARY_REALMS'])} reinos principales")

        try:
            created = run_update_auctions()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"❌ Error: {e}"))
            return

        self.stdout.write(self.style.SUCCESS(f"✅ Done. Snapshots creados: {created}"))