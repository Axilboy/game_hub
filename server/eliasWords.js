/** Бесплатные словари Элиас */
const FREE_ELIAS = [
  {
    id: 'basic',
    name: 'Базовый',
    words: ['Солнце', 'Дом', 'Книга', 'Вода', 'Огонь', 'Дерево', 'Машина', 'Город', 'Река', 'Гора', 'Собака', 'Кот', 'Стол', 'Окно', 'Дверь', 'Часы', 'Цветок', 'Хлеб', 'Молоко', 'Небо', 'Звезда', 'Луна', 'Дождь', 'Снег', 'Ветер', 'Море', 'Лес', 'Поле', 'Птица', 'Рыба'],
  },
  {
    id: 'animals',
    name: 'Животные',
    words: ['Лев', 'Слон', 'Тигр', 'Медведь', 'Волк', 'Лиса', 'Заяц', 'Ёж', 'Белка', 'Мышь', 'Корова', 'Лошадь', 'Свинья', 'Овца', 'Коза', 'Курица', 'Утка', 'Гусь', 'Лебедь', 'Попугай', 'Сова', 'Дятел', 'Ворона', 'Воробей', 'Акула', 'Дельфин', 'Кит', 'Краб', 'Медуза', 'Змея'],
  },
];

/** Платные словари (Про) */
const PAID_ELIAS = [
  {
    id: 'movies',
    name: 'Кино',
    words: ['Блокбастер', 'Ремейк', 'Сиквел', 'Триллер', 'Драма', 'Комедия', 'Ужасы', 'Фантастика', 'Вестерн', 'Мюзикл', 'Детектив', 'Мелодрама', 'Анимация', 'Документалка', 'Нуар', 'Экшн', 'Оскар', 'Канны', 'Премьера', 'Кассовый сбор'],
  },
  {
    id: 'science',
    name: 'Наука',
    words: ['Эксперимент', 'Гипотеза', 'Теория', 'Атом', 'Молекула', 'Гравитация', 'Эволюция', 'Клетка', 'ДНК', 'Вакуум', 'Энергия', 'Реакция', 'Лаборатория', 'Микроскоп', 'Открытие', 'Исследование', 'Формула', 'Уравнение', 'Парадокс', 'Изобретение'],
  },
  {
    id: 'sport',
    name: 'Спорт',
    words: ['Гол', 'Мяч', 'Стадион', 'Чемпионат', 'Олимпиада', 'Марафон', 'Рекорд', 'Тренер', 'Команда', 'Турнир', 'Финал', 'Полуфинал', 'Победа', 'Поражение', 'Ничья', 'Эстафета', 'Старт', 'Финиш', 'Медаль', 'Кубок'],
  },
];

const ELIAS_DICTS = {};
[...FREE_ELIAS, ...PAID_ELIAS].forEach((d) => { ELIAS_DICTS[d.id] = d; });

export function getEliasWords(dictionaryIds = ['basic']) {
  const ids = Array.isArray(dictionaryIds) ? dictionaryIds : ['basic'];
  const words = [];
  for (const id of ids) {
    const dict = ELIAS_DICTS[id];
    if (dict?.words) words.push(...dict.words);
  }
  if (words.length === 0) words.push(...FREE_ELIAS[0].words);
  return words;
}

export function getRandomEliasWord(dictionaryIds) {
  const words = getEliasWords(dictionaryIds);
  return words[Math.floor(Math.random() * words.length)];
}

export function isFreeEliasDict(id) {
  return FREE_ELIAS.some((d) => d.id === id);
}

export function getEliasDictList(availableIds = ['basic', 'animals']) {
  return (availableIds || []).map((id) => {
    const d = ELIAS_DICTS[id];
    return d ? { id: d.id, name: d.name, free: isFreeEliasDict(id) } : null;
  }).filter(Boolean);
}

export { FREE_ELIAS, PAID_ELIAS, ELIAS_DICTS };
