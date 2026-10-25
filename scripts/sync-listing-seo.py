#!/usr/bin/env python3
"""Keep public blog archives descriptive and distinct without rebuilding their cards.

Reads only versioned HTML, never the ignored historical data/blog inventory.
Run by npm run build; existing URLs, pagination, counts and article bodies are retained.
"""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BRAND = ' | Lisard Bellod'
CATEGORIES = {
    'amazon': ('Accesorios y compras en Amazon', 'Experiencias con accesorios, tecnología y compras en Amazon. Consulta los productos y las valoraciones del archivo de Lisard Bellod.'),
    'bitcoin': ('Bitcoin: experiencias y recursos', 'Experiencias de Lisard Bellod con Bitcoin: compra, custodia, nodos y recursos para entender cómo funciona, recogidos en el archivo del blog.'),
    'calcotades': ('Calçotadas en Valls: restaurantes y experiencias', 'Restaurantes, fotografías y experiencias de calçotadas en Valls y alrededores. Recorre el archivo gastronómico de Lisard Bellod.'),
    'caniche-toy': ('Caniche toy: cachorros y experiencias', 'Publicaciones de Lisard Bellod sobre caniche toy: cachorros, criadores y momentos cotidianos, con fotos y vídeos del archivo del blog.'),
    'coche-electrico': ('Coches eléctricos: pruebas, recarga y ahorro', 'Pruebas de coches eléctricos, consumo real, autonomía, cargadores y viajes. Experiencias de Lisard Bellod para entender la compra y el uso de un eléctrico.'),
    'comprar-vino': ('Vinos y vermut: experiencias y recomendaciones', 'Vinos, vermut, ferias y experiencias gastronómicas del archivo de Lisard Bellod. Descubre las publicaciones de esta categoría ordenadas por fecha.'),
    'compras': ('Compras y accesorios: pruebas y experiencias', 'Pruebas y experiencias con accesorios para el coche, tecnología y otras compras. Consulta las publicaciones de Lisard Bellod y su fecha original.'),
    'concurso': ('Concursos: fotografía y exposiciones caninas', 'Concursos fotográficos, exposiciones caninas y otras citas recogidas por Lisard Bellod. Resultados y experiencias conservados en el archivo del blog.'),
    'curioso': ('Curiosidades, experiencias y descubrimientos', 'Curiosidades, descubrimientos y experiencias de Lisard Bellod: desde herramientas y coches eléctricos hasta momentos de la vida cotidiana.'),
    'dog-show-2': ('Exposiciones caninas: resultados y vídeos', 'Archivo de exposiciones caninas de Lisard Bellod: resultados, calendarios históricos y vídeos de pinscher alemán y pinscher miniatura en el ring.'),
    'drone': ('Vídeos con dron: paisajes y vistas aéreas', 'Vídeos a vista de dron de Lisard Bellod, con imágenes de Barcelona y la bodega Mas del Nen en Sarral. Consulta las entradas y sus grabaciones.'),
    'foto-2': ('Fotografía: lugares, animales y momentos', 'Fotografías de lugares, animales, fiestas y momentos cotidianos, junto con experiencias de creación de imágenes, en el archivo de Lisard Bellod.'),
    'futbol-2': ('Fútbol: vídeos, fotos y recuerdos', 'Vídeos, fotografías y comentarios de fútbol del archivo de Lisard Bellod: partidos, jugadores, Barça, Real Madrid y recuerdos de competiciones.'),
    'huerto': ('Huerto y granja: calçots, gallinas y cosechas', 'Experiencias en el huerto y la granja: plantar calçots, recoger huevos y cuidar los naranjos. Fotos y vídeos del archivo personal de Lisard Bellod.'),
    'humor': ('Humor: vídeos, frases y anécdotas', 'Vídeos, frases, imágenes y anécdotas de humor compartidos por Lisard Bellod. Explora las publicaciones y recuerdos del archivo del blog.'),
    'impresion-3d': ('Impresión 3D: proyectos y accesorios Bambu Lab', 'Proyectos de impresión 3D, timelapses y accesorios para Bambu Lab. Experiencias de Lisard Bellod con impresoras, materiales y piezas impresas.'),
    'iphone': ('iPhone e iOS: tutoriales y experiencias', 'Tutoriales, trucos y experiencias de Lisard Bellod con iPhone e iOS. Consulta la versión y la fecha de cada entrada del archivo sobre Apple.'),
    'lisard': ('Experiencias, viajes y proyectos personales', 'Viajes, creación de vídeos, negocios y experiencias personales de Lisard Bellod. Explora su diario y las historias del archivo del blog.'),
    'manual': ('Tutoriales de tecnología, coche y negocio', 'Tutoriales y explicaciones de Lisard Bellod sobre tecnología, funciones del coche, herramientas y negocios. Guías del archivo ordenadas por fecha.'),
    'musica': ('Música: canciones, artistas y videoclips', 'Canciones, artistas, videoclips y descubrimientos musicales compartidos por Lisard Bellod. Recorre las publicaciones de música de su archivo.'),
    'pepitu-header': ('Pepitu: historias del archivo del blog', 'Historias, proyectos y publicaciones de la etapa Pepitu del blog de Lisard Bellod, con recuerdos de sus webs y de las exposiciones caninas.'),
    'perros': ('Perros: pinscher, caniche y exposiciones caninas', 'Experiencias de Lisard Bellod con perros: pinscher, caniche toy, cachorros y exposiciones caninas. Fotos, vídeos y recuerdos del archivo.'),
    'pinscher': ('Pinscher alemán y miniatura: fotos y experiencias', 'Fotos, vídeos y experiencias con pinscher alemán y pinscher miniatura. Recuerdos y resultados de exposiciones caninas en el archivo de Lisard Bellod.'),
    'promp': ('Prompts e imágenes con inteligencia artificial', 'Ejemplos de prompts para crear imágenes con inteligencia artificial y experiencias con herramientas digitales en el blog de Lisard Bellod.'),
    'quejas': ('Opiniones, averías y experiencias de consumo', 'Opiniones de Lisard Bellod sobre consumo, comercio, averías y atención al cliente. Experiencias personales explicadas en su contexto y fecha.'),
    'receta': ('Recetas de cocina, postres y bebidas', 'Recetas compartidas por Lisard Bellod: platos caseros, crema catalana, limoncello y otras bebidas. Consulta ingredientes y preparación en cada entrada.'),
    'recopilatorio': ('Recopilaciones de fotos, vídeos y experiencias', 'Recopilaciones del archivo de Lisard Bellod: fotografías, vídeos, humor, perros y experiencias. Explora las entradas y sus selecciones temáticas.'),
    'sashamania': ('Sashamania: pinscher y exposiciones caninas', 'Historias de Sashamania, cachorros de pinscher miniatura y exposiciones caninas. Fotos, vídeos y recuerdos conservados en el blog de Lisard Bellod.'),
    'tecnologia': ('Tecnología: accesorios, pruebas y experiencias', 'Pruebas y experiencias con tecnología: accesorios para el coche, conectividad, localizadores y dispositivos. Descubre los artículos de Lisard Bellod.'),
    'trucos': ('Trucos y tutoriales de tecnología y negocio', 'Trucos y tutoriales sobre iPhone, imágenes con inteligencia artificial, herramientas y negocio. Experiencias de Lisard Bellod ordenadas por fecha.'),
    'video': ('Vídeos del blog: coches, viajes y experiencias', 'Entradas con vídeos de Lisard Bellod: coches eléctricos, instalaciones de cargadores, viajes y experiencias. Explora el archivo por fecha de publicación.'),
    'webs': ('Webs, herramientas y proyectos digitales', 'Webs, calculadoras y proyectos digitales creados o comentados por Lisard Bellod. Explora las ideas y experiencias reunidas en esta categoría.'),
    'x': ('Proyectos e ideas: otras publicaciones', 'Otras publicaciones de Lisard Bellod: proyectos digitales, ideas y experiencias de comercio. Consulta las entradas de esta sección del archivo.'),
}


def metadata(path, source):
    parts = path.relative_to(ROOT).parts
    page = int(parts[parts.index('pagina') + 1]) if 'pagina' in parts else 1
    if 'categoria' in parts:
        slug = parts[2]
        label = html.unescape(re.search(r'<h1>(.*?)</h1>', source, re.S)[1])
        title, description = CATEGORIES.get(slug, (label, f'Artículos de Lisard Bellod sobre {label}. Explora las experiencias, imágenes y publicaciones del archivo ordenadas por fecha.'))
    elif 'ano' in parts:
        year = parts[2]
        title = f'Blog de {year}: artículos y experiencias'
        description = f'Todas las entradas de Lisard Bellod publicadas en {year}: historias, proyectos y experiencias conservados con su fecha original. Explora el archivo anual.'
    else:
        title = 'Blog de coches eléctricos, viajes y tecnología'
        description = 'Coches eléctricos, consumo real, recarga, viajes y tecnología. Lee las pruebas, guías y experiencias de Lisard Bellod y explora su archivo desde 2006.'
    if page > 1:
        if 'categoria' not in parts and 'ano' not in parts:
            title = 'Archivo del blog: historias y experiencias'
        title += f' · Página {page}'
        # Page number belongs in the description too: each archive page is distinct.
        dates = re.findall(r'<time datetime="(\d{4})-(\d{2})-(\d{2})[^\"]*">', source)
        period = ''
        if dates:
            start, end = sorted(dates)[0], sorted(dates)[-1]
            fmt = lambda d: f'{d[2]}/{d[1]}/{d[0]}'
            period = f' Entradas del {fmt(start)} al {fmt(end)}.'
        description = f'{title} de Lisard Bellod.{period} Explora los artículos del archivo.'
    return title + BRAND, description


def sync(path):
    source = path.read_text()
    title, description = metadata(path, source)
    head, body = source.split('</head>', 1)
    head = re.sub(r'<title>.*?</title>', lambda _: f'<title>{html.escape(title)}</title>', head, flags=re.S)
    values = {'description': description, 'og:description': description, 'twitter:description': description, 'og:title': title, 'twitter:title': title}

    def meta(match):
        tag = match[0]
        key = re.search(r'(?:name|property)="([^"]+)"', tag)
        if key and key[1] in values:
            tag = re.sub(r'content="[^"]*"', lambda _: f'content="{html.escape(values[key[1]], quote=True)}"', tag)
        return tag

    head = re.sub(r'<meta\b[^>]*>', meta, head, flags=re.S)

    def structured(match):
        data = json.loads(match[1])
        if data.get('@type') != 'CollectionPage':
            return match[0]
        data.update(name=title, description=description)
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '</script>'

    head = re.sub(r'<script type="application/ld\+json">(.*?)</script>', structured, head, flags=re.S)
    result = head + '</head>' + body
    if result != source:
        path.write_text(result)
        return 1
    return 0


if __name__ == '__main__':
    paths = [ROOT / 'blog/index.html']
    for directory in ('pagina', 'categoria', 'ano'):
        paths.extend((ROOT / 'blog' / directory).rglob('index.html'))
    print(f'Archive SEO: {sum(sync(path) for path in paths)} updated, {len(paths)} checked.')
