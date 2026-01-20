import os
import csv
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import BoatBrand, BoatModel


class Command(BaseCommand):
    help = 'Импортирует модели лодок из файла core/fixtures/modelos.csv'

    def handle(self, *args, **kwargs):
        # 1. Определяем путь к файлу
        file_path = os.path.join(settings.BASE_DIR, 'core', 'fixtures', 'modelos.csv')

        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"Файл не найден: {file_path}"))
            return

        self.stdout.write(self.style.SUCCESS(f"Начинаем импорт из {file_path}..."))

        # 2. Читаем CSV
        try:
            with open(file_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                created_count = 0
                updated_count = 0
                skipped_count = 0

                for row in reader:
                    brand_name = row.get('brand__name')
                    model_name = row.get('name')

                    if not brand_name or not model_name:
                        self.stderr.write(
                            self.style.WARNING(f"Пропущена строка: brand__name или name отсутствуют. {row}"))
                        skipped_count += 1
                        continue

                    # 3. "Чистим" данные и ищем бренд
                    clean_brand_name = brand_name.strip()
                    if not clean_brand_name:
                        self.stderr.write(self.style.WARNING(f"Пропущена строка: имя бренда пустое. {row}"))
                        skipped_count += 1
                        continue

                    # --- 🚀 ИЗМЕНЕНИЕ ЗДЕСЬ ---
                    # Вместо того чтобы падать, мы НАХОДИМ или СОЗДАЕМ бренд
                    # 'name__iexact' - ищет без учета регистра
                    # 'defaults' - используется, если бренд НУЖНО создать
                    brand, created = BoatBrand.objects.get_or_create(
                        name__iexact=clean_brand_name,
                        defaults={'name': clean_brand_name}
                    )

                    if created:
                        self.stdout.write(self.style.NOTICE(f"  -> Создан новый бренд: '{clean_brand_name}'"))
                    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

                    # 4. "Чистим" числовые данные
                    try:
                        length = Decimal(row['length'].strip().replace(',', '.')) if row.get('length') and row[
                            'length'].strip() else None
                        width = Decimal(row['width'].strip().replace(',', '.')) if row.get('width') and row[
                            'width'].strip() else None
                        year_start = int(row['year_start'].strip()) if row.get('year_start') and row[
                            'year_start'].strip() else None
                    except (InvalidOperation, ValueError, TypeError) as e:
                        self.stderr.write(self.style.WARNING(
                            f"Пропущена модель '{model_name}': Ошибка конвертации числа. {e}. {row}"))
                        skipped_count += 1
                        continue

                    # 5. Создаем или Обновляем модель
                    obj, created_model = BoatModel.objects.update_or_create(
                        brand=brand,
                        name=model_name.strip(),
                        defaults={
                            'year_start': year_start,
                            'length': length,
                            'width': width
                        }
                    )

                    if created_model:
                        created_count += 1
                    else:
                        updated_count += 1

                self.stdout.write(self.style.SUCCESS(f"\nИмпорт завершен."))
                self.stdout.write(self.style.SUCCESS(f"Создано моделей: {created_count}"))
                self.stdout.write(self.style.SUCCESS(f"Обновлено моделей: {updated_count}"))
                self.stdout.write(self.style.WARNING(f"Пропущено строк: {skipped_count}"))

        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Файл не найден: {file_path}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Произошла ошибка: {e}"))