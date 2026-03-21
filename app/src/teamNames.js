/**
 * Случайные названия команд в духе названий комнат (прилагательное + существительное).
 * Две команды всегда с разными парами, где возможно.
 */

const ADJ = [
  'Весёлые',
  'Летучие',
  'Танцующие',
  'Сонные',
  'Мохнатые',
  'Шумные',
  'Добрые',
  'Быстрые',
  'Хитрые',
  'Смелые',
  'Тихие',
  'Яркие',
  'Серые',
  'Золотые',
  'Морские',
];

const NOUN = [
  'Плясуны',
  'Барабашки',
  'Финтиплюшки',
  'Крендельки',
  'Карасики',
  'Хохотуны',
  'Скворечники',
  'Булочки',
  'Еноты',
  'Коты',
  'Панды',
  'Ракеты',
  'Пингвины',
  'Капибары',
  'Ниндзя',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateOneTeamName() {
  return `${pick(ADJ)} ${pick(NOUN)}`;
}

/** Два разных названия для двух команд */
export function generateTwoTeamNames() {
  const a = generateOneTeamName();
  let b = generateOneTeamName();
  let guard = 0;
  while (b === a && guard++ < 40) {
    b = generateOneTeamName();
  }
  return [a, b];
}
