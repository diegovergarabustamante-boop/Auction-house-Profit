from django.contrib import admin
from django.urls import path, include
from market import views  # 👈 IMPORTANTE

from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("market.urls")),   # 👈 frontend
    path("api/", include("market.urls")),  # (luego lo separamos)
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


from django.shortcuts import render

def dashboard(request):
    return render(request, "dashboard.html")