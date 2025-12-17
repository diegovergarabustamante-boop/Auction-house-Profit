from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import ArbitrageResult
from .serializers import ArbitrageResultSerializer


class TopArbitrageView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            ArbitrageResult.objects
            .select_related("item", "buy_realm", "sell_realm")
            .order_by("-profit")[:50]
        )

        serializer = ArbitrageResultSerializer(qs, many=True)
        return Response(serializer.data)
