from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

import json
import requests

from market.models import (
    AuctionUpdateStatus,
    Item,
    ConnectedRealm,
    ItemPriceSnapshot,
    TrackedItem,
    UserConfig,
)

# =====================================================
# CONFIG
# =====================================================
def get_config():
    config = UserConfig.load()
    return {
        "REGION": config.region,
        "LOCALE": "en_US",
        "SELL_REALMS": config.get_realms_to_scan_list(),  # SOLO PARA VENDER
        "MAX_REALMS_TO_SCAN": config.max_realms_to_scan,
        "DEV_MODE": config.dev_mode,
    }


BASE_DIR = settings.BASE_DIR
CREDENTIALS_FILE = BASE_DIR / "blizzard_credentials.txt"
REALMS_JSON = BASE_DIR / "wow_realms_connected.json"
CACHE_FILE = BASE_DIR / "item_id_cache.json"

# =====================================================
# AUTH
# =====================================================
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
    region = get_config()["REGION"]

    r = requests.post(
        f"https://{region}.battle.net/oauth/token",
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]

# =====================================================
# CACHE
# =====================================================
def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

# =====================================================
# REALMS (SIEMPRE TODOS)
# =====================================================
def load_all_realms():
    with open(REALMS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    realms = {}
    for r in data:
        realm, _ = ConnectedRealm.objects.update_or_create(
            blizzard_id=r["id"],
            defaults={"name": r["name"], "slug": r["slug"]},
        )
        realms[realm.name] = realm

    return realms

# =====================================================
# ITEMS
# =====================================================
def get_item_id(token, item_name, cache):
    if item_name in cache:
        return cache[item_name]

    try:
        item = Item.objects.get(name__iexact=item_name)
        if item.blizzard_id:
            cache[item_name] = item.blizzard_id
            return item.blizzard_id
    except Item.DoesNotExist:
        pass

    region = get_config()["REGION"]
    locale = get_config()["LOCALE"]

    r = requests.get(
        f"https://{region}.api.blizzard.com/data/wow/search/item",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "namespace": f"static-{region}",
            "locale": locale,
            f"name.{locale}": item_name,
            "_pageSize": 5,
        },
        timeout=10,
    )

    for res in r.json().get("results", []):
        name = res["data"]["name"].get(locale)
        if name and name.lower() == item_name.lower():
            cache[item_name] = res["data"]["id"]
            return cache[item_name]

    return None

# =====================================================
# AUCTIONS (ESCANEA TODOS)
# =====================================================
def get_all_auctions(token, realms, status):
    config = get_config()
    region = config["REGION"]
    locale = config["LOCALE"]

    status.total_realms = len(realms)
    status.processed_realms = 0
    status.is_running = True
    status.save()

    auctions = {}

    for i, realm in enumerate(realms.values(), start=1):
        status.current_realm = realm.name
        status.processed_realms = i
        status.save(update_fields=["current_realm", "processed_realms", "updated_at"])

        try:
            r = requests.get(
                f"https://{region}.api.blizzard.com/data/wow/connected-realm/{realm.blizzard_id}/auctions",
                headers={"Authorization": f"Bearer {token}"},
                params={"namespace": f"dynamic-{region}", "locale": locale},
                timeout=15,
            )
            r.raise_for_status()
            auctions[realm.name] = r.json().get("auctions", [])
            print(f"✅ {i}/{len(realms)} {realm.name}")
        except Exception as e:
            print(f"❌ {realm.name}: {e}")
            auctions[realm.name] = []

    status.is_running = False
    status.save(update_fields=["is_running", "updated_at"])
    return auctions

# =====================================================
# ARBITRAGE (FILTRO SOLO EN VENTA)
# =====================================================
def min_price(auctions, item_id):
    prices = [
        a.get("unit_price") or (a.get("buyout") / a.get("quantity", 1))
        for a in auctions
        if a.get("item", {}).get("id") == item_id
    ]
    return min(prices) if prices else None


def min_price_by_realm(all_auctions, item_id):
    return {
        realm: p
        for realm, auctions in all_auctions.items()
        if (p := min_price(auctions, item_id))
    }


def analyze_arbitrage(prices):
    config = get_config()
    sell_realms = set(config["SELL_REALMS"])

    if not prices:
        return None, None, None, 0

    buy_realm = min(prices, key=prices.get)
    buy_price = prices[buy_realm]

    best_profit = 0
    best_sell = None
    best_sell_price = None

    for realm, sell_price in prices.items():
        if sell_realms and realm not in sell_realms:
            continue  # 🔑 FILTRO SOLO AQUÍ

        profit = (sell_price - buy_price) * 0.95
        if profit > best_profit:
            best_profit = profit
            best_sell = realm
            best_sell_price = sell_price

    if best_profit < 1000:
        return buy_realm, None, None, 0

    return buy_realm, best_sell, best_sell_price, best_profit

# =====================================================
# MAIN
# =====================================================
def run_update_auctions():
    status, _ = AuctionUpdateStatus.objects.get_or_create(id=1)
    status.started_at = timezone.now()
    status.is_running = True
    status.save()

    token = get_token()
    cache = load_cache()

    realms = load_all_realms()  # 🔥 SIEMPRE TODOS (240+)

    config = get_config()
    realm_items = list(realms.items())

    if config["DEV_MODE"]:
        realm_items = realm_items[:10]
    elif config["MAX_REALMS_TO_SCAN"] > 0:
        realm_items = realm_items[: config["MAX_REALMS_TO_SCAN"]]

    realms = dict(realm_items)

    auctions = get_all_auctions(token, realms, status)

    created = 0
    for tracked in TrackedItem.objects.filter(active=True).select_related("item"):
        item = tracked.item
        item_id = get_item_id(token, item.name, cache)
        if not item_id:
            continue

        prices = min_price_by_realm(auctions, item_id)
        buy, sell, sell_price, profit = analyze_arbitrage(prices)

        if sell:
            ItemPriceSnapshot.objects.create(
                item=item,
                best_buy_realm=ConnectedRealm.objects.get(name=buy),
                best_sell_realm=ConnectedRealm.objects.get(name=sell),
                buy_price=prices[buy] / 10000,
                estimated_sell_price=sell_price / 10000,
                profit=profit / 10000,
            )
            created += 1

    save_cache(cache)
    status.is_running = False
    status.save(update_fields=["is_running", "updated_at"])
    return created

# =====================================================
# COMMAND
# =====================================================
class Command(BaseCommand):
    help = "Update WoW auction data"

    def handle(self, *args, **options):
        self.stdout.write("🚀 Scanning ALL connected realms...")
        created = run_update_auctions()
        self.stdout.write(self.style.SUCCESS(f"✅ Snapshots created: {created}"))
