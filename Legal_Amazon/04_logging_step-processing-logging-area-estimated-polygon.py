import processing
import os
from qgis.core import QgsVectorFileWriter, QgsProject

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURAÇÃO PRINCIPAL
# Escolha o modo de geometrização:
#   1 = Retângulo mínimo orientado (OrientedBoundingBox) — mais geométrico/rígido
#   2 = Envoltória convexa (Convex Hull)  ← RECOMENDADO para pátios de exploração
#   3 = Simplificação de vértices — mantém forma, remove irregularidades
modo_geometria = 2
# ─────────────────────────────────────────────────────────────────────────────

# 1. Definição dos caminhos
caminho_entrada = r'C:\Users\bruno.ferreira\Downloads\y1988\loggin_vetorizado1988.shp'
caminho_saida   = r'C:\Users\bruno.ferreira\Downloads\y1988\resultado_final_1988.shp'

# 2. Carregar a camada de entrada
layer_entrada = iface.addVectorLayer(caminho_entrada, "Entrada", "ogr")

if not layer_entrada:
    print("Erro: Não foi possível carregar o arquivo de entrada. Verifique o caminho.")
else:
    distancia = 0.0072

    print("Iniciando processamento geométrico...")

    # ── Buffer Positivo + Dissolve (liga os pontos próximos) ──────────────────
    buffer_pos = processing.run("native:buffer", {
        'INPUT': layer_entrada,
        'DISTANCE': distancia,
        'SEGMENTS': 30,
        'DISSOLVE': True,
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    # ── Buffer Negativo (retorna ao tamanho aproximado original) ──────────────
    buffer_neg = processing.run("native:buffer", {
        'INPUT': buffer_pos,
        'DISTANCE': -distancia,
        'SEGMENTS': 30,
        'DISSOLVE': False,
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    # ── Explode (partes simples) ───────────────────────────────────────────────
    single_parts = processing.run("native:multiparttosingleparts", {
        'INPUT': buffer_neg,
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    # ── Geometrização (NOVO) ───────────────────────────────────────────────────
    print(f"Aplicando geometrização (modo {modo_geometria})...")

    if modo_geometria == 1:
        # Retângulo mínimo orientado ao eixo do polígono
        # Ideal quando os pátios têm forma nitidamente retangular
        geom_layer = processing.run("native:orientedboundingbox", {
            'INPUT': single_parts,
            'OUTPUT': 'TEMPORARY_OUTPUT'
        })['OUTPUT']

    elif modo_geometria == 2:
        # Envoltória convexa: preenche as "mordidas" côncavas
        # Melhor resultado visual para pátios de exploração de madeira
        geom_layer = processing.run("native:convexhull", {
            'INPUT': single_parts,
            'OUTPUT': 'TEMPORARY_OUTPUT'
        })['OUTPUT']

    elif modo_geometria == 3:
        # Simplificação Douglas-Peucker: reduz vértices irregulares
        # Tolerância em graus decimais — ajuste conforme necessário
        tolerancia_simplificacao = 0.0005
        geom_layer = processing.run("native:simplifygeometries", {
            'INPUT': single_parts,
            'METHOD': 0,           # 0 = Douglas-Peucker
            'TOLERANCE': tolerancia_simplificacao,
            'OUTPUT': 'TEMPORARY_OUTPUT'
        })['OUTPUT']

    else:
        print(f"Modo inválido: {modo_geometria}. Use 1, 2 ou 3.")
        geom_layer = single_parts  # Fallback: sem geometrização

    # ── Atributos: ID ─────────────────────────────────────────────────────────
    print("Calculando atributos (ID e Área)...")
    layer_com_id = processing.run("native:fieldcalculator", {
        'INPUT': geom_layer,
        'FIELD_NAME': 'id_parte',
        'FIELD_TYPE': 1,           # Integer
        'FORMULA': '@row_number',
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    # ── Atributos: Área em hectares ───────────────────────────────────────────
    final_layer = processing.run("native:fieldcalculator", {
        'INPUT': layer_com_id,
        'FIELD_NAME': 'area_ha',
        'FIELD_TYPE': 0,           # Float
        'FIELD_LENGTH': 15,
        'FIELD_PRECISION': 3,
        'FORMULA': '$area / 10000',
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    # ── Exportação Final ──────────────────────────────────────────────────────
    print(f"Exportando resultado para: {caminho_saida}")

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "ESRI Shapefile"
    options.fileEncoding = "utf-8"

    writer = QgsVectorFileWriter.writeAsVectorFormatV3(
        final_layer,
        caminho_saida,
        QgsProject.instance().transformContext(),
        options
    )

    if writer[0] == QgsVectorFileWriter.NoError:
        print("Processo concluído com sucesso!")
        iface.addVectorLayer(caminho_saida, f"Loggin Processado 1988 (modo {modo_geometria})", "ogr")
    else:
        print(f"Erro ao salvar arquivo: {writer[0]}")