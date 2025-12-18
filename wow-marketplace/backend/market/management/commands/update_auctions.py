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
)

# ======================
# CONFIG
# ======================
REGION = "us"
LOCALE = "en_US"

PRIMARY_REALMS = [
    "Stormrage", "Area 52", "Moon Guard",
    "Ragnaros", "Dalaran", "Zul'jin", "Proudmoore",
]

MAX_REALMS_TO_SCAN = 30
DEV_MODE = True  # True = solo 10 reinos, False = todos

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
    r = requests.post(
        f"https://{REGION}.battle.net/oauth/token",
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

    realms = {}
    realms_data = data[:MAX_REALMS_TO_SCAN] if DEV_MODE else data

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
    if item_name in cache:
        return cache[item_name]

    r = requests.get(
        f"https://{REGION}.api.blizzard.com/data/wow/search/item",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "namespace": f"static-{REGION}",
            "locale": LOCALE,
            "name.en_US": item_name,
            "_pageSize": 5,
        },
    )
    r.raise_for_status()

    for res in r.json().get("results", []):
        name = res["data"]["name"].get(LOCALE)
        if name and name.lower() == item_name.lower():
            cache[item_name] = res["data"]["id"]
            return cache[item_name]

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

    for idx, realm in enumerate(realms.values(), start=1):
        status.current_realm = realm.name
        status.processed_realms = idx
        status.save(update_fields=["current_realm", "processed_realms", "updated_at"])

        r = requests.get(
            f"https://{REGION}.api.blizzard.com/data/wow/connected-realm/{realm.blizzard_id}/auctions",
            headers={"Authorization": f"Bearer {token}"},
            params={"namespace": f"dynamic-{REGION}", "locale": LOCALE},
        )
        if r.status_code == 200:
            all_auctions[realm.name] = r.json().get("auctions", [])

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
    if not prices:
        return None, None, None, 0

    buy_realm = min(prices, key=prices.get)
    buy_price = prices[buy_realm]

    best_target = None
    best_profit = 0
    best_sell_price = None

    for realm in PRIMARY_REALMS:
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
    status.save()

    token = get_token()
    cache = load_cache()
    realms = load_realms()
    auctions = get_all_auctions(token, realms, status)

    created = 0
    tracked_items = TrackedItem.objects.filter(active=True).select_related("item")
    print("Items que se van a escanear:", [t.item.name for t in tracked_items])

    for tracked in tracked_items:
        item = tracked.item

        item_id = get_item_id(token, item.name, cache)
        if not item_id:
            continue

        # Guardar Blizzard Item ID en la base de datos
        if item.blizzard_id != item_id:
            item.blizzard_id = item_id
            item.save(update_fields=["blizzard_id"])

        prices = min_buyout_by_realm(auctions, item_id)
        buy, sell, sell_price, profit = analyze_arbitrage(prices)

        if sell:
            ItemPriceSnapshot.objects.create(
                item=item,
                best_buy_realm=realms.get(buy),
                best_sell_realm=realms.get(sell),
                buy_price=prices[buy] / 10000,
                estimated_sell_price=sell_price / 10000,
                profit=profit / 10000,
            )
            created += 1

    save_cache(cache)

    status.is_running = False
    status.save(update_fields=["is_running", "updated_at"])

    return created


# ======================
# COMMAND
# ======================
class Command(BaseCommand):
    help = "Update WoW auction data and arbitrage opportunities"

    def handle(self, *args, **options):
        self.stdout.write("🚀 Updating auctions...")

        try:
            created = run_update_auctions()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"❌ Error: {e}"))
            return

        self.stdout.write(self.style.SUCCESS(f"✅ Done. Snapshots creados: {created}"))
