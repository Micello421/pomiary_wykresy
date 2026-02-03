# Pomiary i Wykresy - Narzędzie do Analizy Wymiarów Spoin

Aplikacja webowa do pomiaru wymiarów, analizy i wizualizacji danych z badań spoin.

## Funkcjonalności

### 📏 Pomiary
- **Rysowanie linii pomiarowych** na zdjęciach - klik na pierwszy punkt, klik na drugi punkt
- **Kalibracja** - podwójny klik na wymiar aby ustawić wymiar odniesienia
- **4 tryby pracy**: Measure, Scale, Eraser, Edit
- **Snap to angle** - przyciąganie do kątów 45°
- **Widok powiększający (loupe)** - precyzyjne pozycjonowanie punktów

### 📊 Analiza i Eksport
- **Export wymiarów** - 5 formatów:
  - Overlay (przezroczysta nakładka)
  - Z pomiarami
  - Z tabelą pomiarów
  - Tabela jako obraz
  - CSV (do analizy)

### 📈 Analiza CSV
- **Upload wielopieniowych plików CSV**
- **Histogramy i wykresy rozrzutu** dla każdego pliku
- **Statystyki**: średnia, odchylenie std., min, max
- **Pobieranie wykresów** jako PNG

### 🔍 Analiza Prędkości Posuwu
- **Wpis prędkości posuwu** (10-30 mm/min) dla każdej próbki
- **Wykres średnia vs prędkość** z trendem wielomianowym
- **Wszystkie pomiary** vs prędkość z:
  - Anomaliami (>2σ)
  - Przedziałami ufności (95% CI)
  - Zakrzywioną linią trendu
- **Szczegółowe wykresy** per-plik z anomaliami i przedziałami

### ⬇️ Pobieranie
- Pobieranie histogramów i scatter plotów
- Pobieranie wszystkich wykresów prędkości jednocześnie

## Uruchomienie

Otwórz `augenmass.html` w przeglądarce - nic się nie uploaduje, wszystko działa lokalnie.

## Technologia

- HTML5 Canvas
- JavaScript ES5 (strict mode)
- Chart.js 4.4.1
- Bootstrap 5.3.3
- Python (analyze_welds.py dla analizy standalone)

## Użycie

1. Wczytaj zdjęcie (jpg, png, etc.)
2. Narysuj pomiary na zdjęciu
3. Exportuj wymiary jako CSV
4. Uploaduj CSV do sekcji analizy
5. Podaj prędkości posuwu dla każdej próbki
6. Generuj i pobieraj wykresy

## Autor

Aplikacja rozwinięta z podstawowego narzędzia do pomiarów na zdjęciach z dodaniem zaawansowanej analizy statystycznej i wizualizacji danych.
