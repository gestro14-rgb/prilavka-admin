// Расчёт рекомендуемой цены и цены безубыточности для модуля
// "Ценообразование" (ProductForm.jsx + Pricing.jsx).
//
// Эквайринг считается в % от цены ПРОДАЖИ, а не от закупки — значит он
// зависит от того самого P, который мы вычисляем. Наивный расчёт (взять
// эквайринг от закупочной цены) занижает комиссию и завышает
// рекомендованную цену. Списания (waste%) тоже накручиваются на себестоимость
// проданной единицы: закупка и упаковка непроданного (испортившегося) товара
// должна быть отбита с того, что реально продалось — Cw = (закупка+упаковка)
// / (1-waste%). Эквайринг внутри той же скобки в исходной формуле, поэтому
// его коэффициент растягивается тем же (1-waste%): aw = эквайринг% / (1-waste%).
//
//   P = (Cw + P × aw + доля_постоянных) × (1 + маржа)
//
// Обозначим D = Cw + доля_постоянных (не зависит от P), m = маржа/100. Тогда:
//
//   цена_безубыточности = D / (1 - aw)
//   рекомендуемая_цена  = D × (1 + m) / (1 - aw × (1 + m))
//
// "Маржа" здесь — наценка на себестоимость (cost-plus), а не % от выручки.

// Эффективная закупочная стоимость единицы (упаковки) товара.
// pricing_unit = 'kg' — закупка введена за килограмм, умножаем на вес
// упаковки weight_kg (структурированное поле из migrations/036; текстовое
// products.weight НЕ парсим — там свободный текст вида "1 пучок"). Вес не
// задан или невалиден → null: расчёт невозможен, форма просит заполнить вес.
// pricing_unit = 'piece' (и любое другое значение) — закупка как есть.
export function effectivePurchaseCost({ purchasePrice, pricingUnit, weightKg }) {
  if (purchasePrice == null || purchasePrice === '') return null;
  if (pricingUnit === 'kg') {
    const w = Number(weightKg);
    if (!Number.isFinite(w) || w <= 0) return null;
    return Number(purchasePrice) * w;
  }
  return Number(purchasePrice);
}

// categoryMarginPercent — целевая маржа категории товара (migrations/037).
// Двухуровневый приоритет: маржа категории, если задана, иначе глобальная
// defaultMarginPercent из настроек. Уровня "маржа товара" сознательно нет.
export function calcPricing({ purchasePrice, settings, categoryMarginPercent }) {
  const fixedCostsMonthly = Number(settings?.fixedCostsMonthly) || 0;
  const plannedSalesMonthly = Number(settings?.plannedSalesMonthly) || 0;
  const packagingCostPerUnit = Number(settings?.packagingCostPerUnit) || 0;
  const acquiringPercent = Number(settings?.acquiringPercent) || 0;
  const defaultMarginPercent = Number(settings?.defaultMarginPercent) || 0;
  const wastePercent = Number(settings?.wastePercent) || 0;
  const avgItemsPerOrder = settings?.avgItemsPerOrder != null ? Number(settings.avgItemsPerOrder) : null;

  if (plannedSalesMonthly <= 0) {
    return { error: 'Заполните настройки ценообразования, чтобы видеть рекомендации' };
  }

  // avgItemsPerOrder не заполнен (null) — намеренно, а не 0/по умолчанию 1
  // (см. migrations/035): раньше вся доля постоянных на заказ ошибочно
  // относилась целиком к одному товару, как будто в заказе всегда одна
  // позиция. Дефолт 1 маскировал бы эту же ошибку под видом "настроено".
  if (!avgItemsPerOrder || avgItemsPerOrder <= 0) {
    return { error: 'Укажите среднее число товаров в заказе в настройках ценообразования, чтобы точно распределить постоянные расходы' };
  }

  const w = wastePercent / 100;
  if (w >= 1) {
    return { error: 'Процент списаний не может быть 100% и больше — проверьте настройки ценообразования' };
  }

  const a = acquiringPercent / 100;
  const marginPercent = categoryMarginPercent != null ? Number(categoryMarginPercent) : defaultMarginPercent;
  const m = marginPercent / 100;
  // Постоянные расходы делятся дважды: сначала на число заказов (доля на
  // заказ), потом на среднее число позиций внутри заказа (доля на товар) —
  // раньше второго деления не было, и вся доля на заказ ошибочно приписывалась
  // одному товару.
  const fixedSharePerOrder = fixedCostsMonthly / plannedSalesMonthly;
  const fixedShare = fixedSharePerOrder / avgItemsPerOrder;

  const wasteAdjustedGoodsCost = (Number(purchasePrice) + packagingCostPerUnit) / (1 - w);
  const wasteAdjustedAcquiring = a / (1 - w);
  const costBeforeAcquiring = wasteAdjustedGoodsCost + fixedShare;

  const denominatorBreakEven = 1 - wasteAdjustedAcquiring;
  const denominatorRecommended = 1 - wasteAdjustedAcquiring * (1 + m);

  if (denominatorBreakEven <= 0 || denominatorRecommended <= 0) {
    return { error: 'Комиссия эквайринга и списания в сумме слишком высоки относительно маржи — проверьте настройки ценообразования' };
  }

  const breakEvenPrice = costBeforeAcquiring / denominatorBreakEven;
  const recommendedPrice = (costBeforeAcquiring * (1 + m)) / denominatorRecommended;
  const acquiringCostAtRecommended = recommendedPrice * wasteAdjustedAcquiring;
  // Себестоимость единицы — уже с поправкой на списания (wasteAdjustedGoodsCost).
  const unitCost = wasteAdjustedGoodsCost + acquiringCostAtRecommended;

  // Премиальная цена — тот же расчёт, что recommendedPrice, но с целевой
  // маржой ×1.5 (25% → 37.5%). При высокой марже её знаменатель может уйти
  // в ноль/минус раньше, чем у рекомендуемой — тогда premiumPrice = null
  // (UI показывает "—"), а не ошибка на весь блок.
  const mPremium = m * 1.5;
  const denominatorPremium = 1 - wasteAdjustedAcquiring * (1 + mPremium);
  const premiumPrice = denominatorPremium > 0
    ? (costBeforeAcquiring * (1 + mPremium)) / denominatorPremium
    : null;

  return {
    fixedShare,
    unitCost,
    breakEvenPrice,
    recommendedPrice,
    premiumPrice,
    // Какая маржа реально применена и откуда — для подписи в UI.
    marginPercent,
    marginSource: categoryMarginPercent != null ? 'category' : 'global',
  };
}

// green — текущая цена ≥ рекомендуемой (хорошая маржа)
// yellow — между безубыточностью и рекомендуемой (в плюсе, но ниже желаемой маржи)
// red — ниже безубыточности (продаём в убыток)
export function pricingStatus(currentPrice, { breakEvenPrice, recommendedPrice }) {
  const price = Number(currentPrice) || 0;
  if (price >= recommendedPrice) return 'green';
  if (price >= breakEvenPrice) return 'yellow';
  return 'red';
}

// Какую маржу и прибыль на единицу реально даёт ТЕКУЩАЯ установленная цена
// (в отличие от recommendedPrice — это подсказка "куда стремиться", а не
// то, что сейчас происходит). Прибыль = текущая цена − безубыток: та же
// база (breakEvenPrice), что и в pricingStatus, чтобы цифры не расходились.
export function calcCurrentPriceMargin(currentPrice, { breakEvenPrice }) {
  const price = Number(currentPrice) || 0;
  const profitPerUnit = price - breakEvenPrice;
  const marginPercent = breakEvenPrice > 0 ? (profitPerUnit / breakEvenPrice) * 100 : 0;
  return { profitPerUnit, marginPercent };
}
