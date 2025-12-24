try:
    with open('market/static/market/js/home.js', 'r', encoding='utf-8') as f:
        content = f.read()
    print('✅ Archivo JavaScript leído correctamente')
    print(f'📏 Tamaño: {len(content)} caracteres')
    print(f'📝 Líneas: {len(content.split(chr(10)))} líneas')

    # Verificar funciones necesarias
    if 'function updateCurrentTrackDisplay' in content:
        print('✅ Función updateCurrentTrackDisplay encontrada')
    else:
        print('❌ Función updateCurrentTrackDisplay NO encontrada')

    if 'loadMusicPreferences' in content:
        print('✅ Función loadMusicPreferences encontrada')
    else:
        print('❌ Función loadMusicPreferences NO encontrada')

    if 'saveMusicPreferences' in content:
        print('✅ Función saveMusicPreferences encontrada')
    else:
        print('❌ Función saveMusicPreferences NO encontrada')

    if 'updateVolume' in content:
        print('✅ Función updateVolume encontrada')
    else:
        print('❌ Función updateVolume NO encontrada')

    if 'startVisualizerAnimation' in content:
        print('✅ Función startVisualizerAnimation encontrada')
    else:
        print('❌ Función startVisualizerAnimation NO encontrada')

    if 'stopVisualizerAnimation' in content:
        print('✅ Función stopVisualizerAnimation encontrada')
    else:
        print('❌ Función stopVisualizerAnimation NO encontrada')

except Exception as e:
    print(f'❌ Error: {e}')