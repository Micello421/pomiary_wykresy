"""
Analiza wymiarów spoin z plików CSV
Generuje wykresy: histogram rozkładu i wykres rozproszenia z linią trendu
"""
import csv
import re
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

def parse_csv_file(filepath):
    """Parsuje plik CSV i zwraca listę pomiarów (bez skali)"""
    measurements = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.strip().split('\n')
        
        for line in lines:
            # Szukamy wzorca "Pomiar X: Y mm" (ale nie "Pomiar do skali")
            match = re.match(r'Pomiar (\d+): ([\d.]+) mm', line)
            if match:
                index = int(match.group(1))
                value = float(match.group(2))
                measurements.append((index, value))
            else:
                # Stary format CSV z kolumnami
                if line.startswith('Pomiar,'):
                    parts = line.split(',')
                    if len(parts) >= 3:
                        try:
                            index = int(parts[1])
                            value = float(parts[2])
                            measurements.append((index, value))
                        except ValueError:
                            continue
    
    return measurements

def create_histogram(measurements, title, output_file):
    """Tworzy histogram rozkładu wymiarów"""
    values = [m[1] for m in measurements]
    
    plt.figure(figsize=(10, 6))
    n, bins, patches = plt.hist(values, bins=15, color='steelblue', 
                                 edgecolor='black', alpha=0.7)
    
    # Statystyki
    mean_val = np.mean(values)
    std_val = np.std(values)
    min_val = np.min(values)
    max_val = np.max(values)
    
    # Linia średniej
    plt.axvline(mean_val, color='red', linestyle='--', linewidth=2, 
                label=f'Średnia: {mean_val:.3f} mm')
    
    plt.xlabel('Wymiar spoiny [mm]', fontsize=12)
    plt.ylabel('Liczba pomiarów', fontsize=12)
    plt.title(title, fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Dodaj statystyki jako tekst
    stats_text = f'n = {len(values)}\n'
    stats_text += f'μ = {mean_val:.3f} mm\n'
    stats_text += f'σ = {std_val:.3f} mm\n'
    stats_text += f'min = {min_val:.3f} mm\n'
    stats_text += f'max = {max_val:.3f} mm'
    
    plt.text(0.98, 0.98, stats_text, 
             transform=plt.gca().transAxes,
             fontsize=10, verticalalignment='top',
             horizontalalignment='right',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f'Zapisano histogram: {output_file}')

def create_scatter_plot(measurements, title, output_file):
    """Tworzy wykres rozproszenia z linią trendu"""
    indices = np.array([m[0] for m in measurements])
    values = np.array([m[1] for m in measurements])
    
    plt.figure(figsize=(12, 6))
    
    # Wykres punktowy
    plt.scatter(indices, values, color='steelblue', s=80, alpha=0.6, 
                edgecolors='black', linewidth=0.5, label='Pomiary')
    
    # Linia trendu (regresja liniowa)
    z = np.polyfit(indices, values, 1)
    p = np.poly1d(z)
    plt.plot(indices, p(indices), "r--", linewidth=2, 
             label=f'Trend: y = {z[0]:.4f}x + {z[1]:.3f}')
    
    # Średnia wartość
    mean_val = np.mean(values)
    plt.axhline(mean_val, color='green', linestyle=':', linewidth=2, 
                label=f'Średnia: {mean_val:.3f} mm')
    
    plt.xlabel('Numer pomiaru', fontsize=12)
    plt.ylabel('Wymiar spoiny [mm]', fontsize=12)
    plt.title(title, fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend(loc='best')
    
    # Statystyki
    std_val = np.std(values)
    stats_text = f'n = {len(values)}\n'
    stats_text += f'μ = {mean_val:.3f} mm\n'
    stats_text += f'σ = {std_val:.3f} mm\n'
    stats_text += f'zakres = {np.min(values):.3f} - {np.max(values):.3f} mm'
    
    plt.text(0.02, 0.98, stats_text, 
             transform=plt.gca().transAxes,
             fontsize=10, verticalalignment='top',
             horizontalalignment='left',
             bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.5))
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f'Zapisano wykres rozproszenia: {output_file}')

def main():
    # Folder z plikami
    data_folder = Path(__file__).parent / 'pliki'
    output_folder = Path(__file__).parent / 'wykresy'
    output_folder.mkdir(exist_ok=True)
    
    # Przetwarzaj wszystkie pliki CSV
    csv_files = sorted(data_folder.glob('augenmass-*-measurements.csv'))
    
    if not csv_files:
        print('Nie znaleziono plików CSV w folderze pliki/')
        return
    
    print(f'Znaleziono {len(csv_files)} plików CSV\n')
    
    for csv_file in csv_files:
        print(f'Przetwarzanie: {csv_file.name}')
        
        # Parsuj dane
        measurements = parse_csv_file(csv_file)
        
        if not measurements:
            print(f'  Brak pomiarów w pliku {csv_file.name}')
            continue
        
        print(f'  Znaleziono {len(measurements)} pomiarów')
        
        # Nazwa bazowa dla wykresów
        base_name = csv_file.stem  # np. "augenmass-0001-measurements"
        
        # Generuj wykresy
        histogram_file = output_folder / f'{base_name}_histogram.png'
        scatter_file = output_folder / f'{base_name}_scatter.png'
        
        create_histogram(measurements, 
                        f'Rozkład wymiarów spoiny - {base_name}',
                        histogram_file)
        
        create_scatter_plot(measurements,
                           f'Wymiary spoiny w funkcji numeru pomiaru - {base_name}',
                           scatter_file)
        
        print()
    
    print(f'\nWszystkie wykresy zapisane w folderze: {output_folder}')

if __name__ == '__main__':
    main()
