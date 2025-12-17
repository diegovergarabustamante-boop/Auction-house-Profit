from rest_framework import serializers
from .models import ArbitrageResult, ConnectedRealm, Item


class ConnectedRealmSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConnectedRealm
        fields = ("id", "name", "slug")


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ("id", "name", "blizzard_id")


class ArbitrageResultSerializer(serializers.ModelSerializer):
    item = ItemSerializer()
    buy_realm = ConnectedRealmSerializer()
    sell_realm = ConnectedRealmSerializer()

    class Meta:
        model = ArbitrageResult
        fields = (
            "id",
            "item",
            "buy_realm",
            "sell_realm",
            "profit",
            "created_at",
        )
